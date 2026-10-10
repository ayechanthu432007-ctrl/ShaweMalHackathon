import { Request, Response } from 'express';

import {
  getAgentDashboard,
  getAgentPerformance,
  getAudienceInsights,
  getMonthlyReport,
  HOUSE_EVENT_TYPES,
  recordHouseEvent,
  type HouseEventType
} from '../services/agent-analytics.service';
import { applyFreeBoost, listAgentBoosts } from '../services/boost.service';
import {
  createBoostOrder,
  createSubscriptionOrder,
  getOwnedOrder,
  listOwnedOrders,
  serializeOrder,
  simulateDemoPayment,
  type PaymentOutcome
} from '../services/payment.service';
import { listPlans, serializePlan } from '../services/subscription.service';
import { prisma } from '../prisma/client';
import { writeAuditLog } from '../services/audit.service';
import { ApiError } from '../utils/api-error';
import { sendSuccess } from '../utils/api-response';

const requireActor = (req: Request): string => {
  if (!req.auth) {
    throw new ApiError(401, 'AUTH_REQUIRED', 'Authorization context is missing.');
  }

  return req.auth.userId;
};

export const agentDashboardController = async (req: Request, res: Response): Promise<void> => {
  sendSuccess(res, 200, 'Agent dashboard fetched successfully', { dashboard: await getAgentDashboard(requireActor(req)) });
};

export const agentPerformanceController = async (req: Request, res: Response): Promise<void> => {
  const days = Number(req.query.days ?? 30);
  sendSuccess(res, 200, 'Performance fetched successfully', { performance: await getAgentPerformance(requireActor(req), days) });
};

export const agentInsightsController = async (req: Request, res: Response): Promise<void> => {
  sendSuccess(res, 200, 'Audience insights fetched successfully', { insights: await getAudienceInsights(requireActor(req)) });
};

export const agentMonthlyReportController = async (req: Request, res: Response): Promise<void> => {
  const month = typeof req.query.month === 'string' ? req.query.month : undefined;
  sendSuccess(res, 200, 'Monthly report fetched successfully', { report: await getMonthlyReport(requireActor(req), month) });
};

export const agentOrdersController = async (req: Request, res: Response): Promise<void> => {
  sendSuccess(res, 200, 'Orders fetched successfully', { items: await listOwnedOrders(requireActor(req)) });
};

export const agentOrderController = async (req: Request, res: Response): Promise<void> => {
  const order = await getOwnedOrder(requireActor(req), String(req.params.reference));
  sendSuccess(res, 200, 'Order fetched successfully', { order: serializeOrder(order) });
};

export const createSubscriptionOrderController = async (req: Request, res: Response): Promise<void> => {
  // Only the plan and period are read from the request; the price is looked up on the server.
  const order = await createSubscriptionOrder(requireActor(req), String(req.body.planCode).toUpperCase(), Number(req.body.billingMonths));
  sendSuccess(res, 201, 'Order created successfully', { order });
};

export const createBoostOrderController = async (req: Request, res: Response): Promise<void> => {
  const order = await createBoostOrder(requireActor(req), String(req.body.houseId), Number(req.body.days));
  sendSuccess(res, 201, 'Order created successfully', { order });
};

export const simulateDemoPaymentController = async (req: Request, res: Response): Promise<void> => {
  const outcome = String(req.body.outcome).toUpperCase() as PaymentOutcome;
  const result = await simulateDemoPayment(requireActor(req), String(req.params.reference), outcome);
  sendSuccess(res, 200, 'Demo payment processed', result);
};

export const agentBoostsController = async (req: Request, res: Response): Promise<void> => {
  sendSuccess(res, 200, 'Boosts fetched successfully', { items: await listAgentBoosts(requireActor(req)) });
};

export const applyFreeBoostController = async (req: Request, res: Response): Promise<void> => {
  const boost = await applyFreeBoost(requireActor(req), String(req.body.houseId), Number(req.body.days));
  sendSuccess(res, 201, 'Free boost applied successfully', { boost: { id: boost.id, startsAt: boost.startsAt, endsAt: boost.endsAt, days: boost.days } });
};

/** Public: records a listing view or contact tap. Stores no personal data and never fails the page. */
export const recordHouseEventController = async (req: Request, res: Response): Promise<void> => {
  const type = String(req.body?.type ?? '').toUpperCase();
  if (!HOUSE_EVENT_TYPES.includes(type as HouseEventType)) {
    throw new ApiError(400, 'HOUSE_EVENT_INVALID', 'Unknown event type.');
  }

  const result = await recordHouseEvent({
    houseId: String(req.params.id),
    type: type as HouseEventType,
    // Behind Vercel's proxy req.ip is the proxy; the platform sets x-forwarded-for to the visitor.
    ip: String(req.header('x-forwarded-for') ?? '').split(',')[0]?.trim() || req.ip || '',
    userAgent: String(req.header('user-agent') ?? '').slice(0, 300),
    viewerUserId: req.auth?.userId
  });
  sendSuccess(res, 200, 'Event recorded', result);
};

// --- Admin ---

export const adminSubscriptionsOverviewController = async (_req: Request, res: Response): Promise<void> => {
  const now = new Date();
  const [plans, orders, subscriptions] = await Promise.all([
    listPlans(),
    prisma.paymentOrder.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { plan: true, user: { select: { id: true, name: true, email: true } } }
    }),
    prisma.agentSubscription.findMany({
      where: { endsAt: { gt: now } },
      orderBy: { endsAt: 'asc' },
      take: 100,
      include: { plan: true, user: { select: { id: true, name: true, email: true } } }
    })
  ]);

  sendSuccess(res, 200, 'Subscriptions overview fetched successfully', {
    plans: plans.map(serializePlan),
    orders: orders.map((order) => ({ ...serializeOrder(order), user: order.user })),
    activeSubscriptions: subscriptions.map((item) => ({
      id: item.id,
      user: item.user,
      plan: { code: item.plan.code, name: item.plan.name },
      billingMonths: item.billingMonths,
      startsAt: item.startsAt,
      endsAt: item.endsAt
    }))
  });
};

export const adminUpdatePlanController = async (req: Request, res: Response): Promise<void> => {
  const actorUserId = requireActor(req);
  const code = String(req.params.code).toUpperCase();
  const plan = await prisma.subscriptionPlan.findUnique({ where: { code } });
  if (!plan) {
    throw new ApiError(404, 'PLAN_NOT_FOUND', 'Plan not found.');
  }

  const data: { monthlyPriceMmk?: number; quarterlyPriceMmk?: number; monthlyListingLimit?: number | null; freeBoostDays?: number } = {};
  if (req.body.monthlyPriceMmk !== undefined) data.monthlyPriceMmk = Number(req.body.monthlyPriceMmk);
  if (req.body.quarterlyPriceMmk !== undefined) data.quarterlyPriceMmk = Number(req.body.quarterlyPriceMmk);
  if (req.body.monthlyListingLimit !== undefined) data.monthlyListingLimit = req.body.monthlyListingLimit === null ? null : Number(req.body.monthlyListingLimit);
  if (req.body.freeBoostDays !== undefined) data.freeBoostDays = Number(req.body.freeBoostDays);

  const updated = await prisma.subscriptionPlan.update({ where: { code }, data });
  await writeAuditLog({ actorUserId, action: 'ADMIN_PLAN_UPDATED', targetType: 'SubscriptionPlan', targetId: plan.id, metadata: { code, ...data } });

  sendSuccess(res, 200, 'Plan updated successfully', { plan: serializePlan(updated) });
};

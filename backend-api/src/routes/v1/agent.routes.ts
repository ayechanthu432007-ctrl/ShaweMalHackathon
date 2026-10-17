import { Router } from 'express';

import {
  createAgentHouseController,
  deleteAgentHouseController,
  listAgentBookingsController,
  listAgentHousesController,
  updateAgentHouseController,
  upsertAgentProfileController
} from '../../controllers/agent.controller';
import {
  agentBoostsController,
  agentDashboardController,
  agentInsightsController,
  agentMonthlyReportController,
  agentOrderController,
  agentOrdersController,
  agentPerformanceController,
  applyFreeBoostController,
  createBoostOrderController,
  createSubscriptionOrderController,
  simulateDemoPaymentController,
  resetDemoSubscriptionController
} from '../../controllers/agent-plan.controller';
import { occupationCompatibilityController, tenantMatchesController } from '../../controllers/recommendation.controller';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import { validateMiddleware } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/async-handler';
import {
  agentHouseCreateValidator,
  agentHouseIdParamValidator,
  agentHouseUpdateValidator,
  agentProfileUpsertValidator
} from '../../validators/agent.validator';
import {
  boostOrderValidator,
  demoPaymentValidator,
  monthlyReportQueryValidator,
  orderReferenceValidator,
  performanceQueryValidator,
  subscriptionOrderValidator
} from '../../validators/agent-plan.validator';
import { occupationCompatibilityValidator, tenantMatchesValidator } from '../../validators/recommendation.validator';

const agentRouter = Router();

agentRouter.use(requireAuth, requireRole(['agent']));
agentRouter.post('/profile', agentProfileUpsertValidator, validateMiddleware, asyncHandler(upsertAgentProfileController));
agentRouter.post('/houses', agentHouseCreateValidator, validateMiddleware, asyncHandler(createAgentHouseController));
agentRouter.get('/houses', asyncHandler(listAgentHousesController));
agentRouter.post('/houses/occupation-compatibility', occupationCompatibilityValidator, validateMiddleware, asyncHandler(occupationCompatibilityController));
agentRouter.post('/houses/tenant-matches', tenantMatchesValidator, validateMiddleware, asyncHandler(tenantMatchesController));
agentRouter.get('/bookings', asyncHandler(listAgentBookingsController));
agentRouter.patch('/houses/:id', agentHouseUpdateValidator, validateMiddleware, asyncHandler(updateAgentHouseController));
agentRouter.delete('/houses/:id', agentHouseIdParamValidator, validateMiddleware, asyncHandler(deleteAgentHouseController));

// Dashboard, plans, demo checkout, boosts and analytics. Plan limits are enforced in the services.
agentRouter.get('/dashboard', asyncHandler(agentDashboardController));
agentRouter.get('/performance', performanceQueryValidator, validateMiddleware, asyncHandler(agentPerformanceController));
agentRouter.get('/insights', asyncHandler(agentInsightsController));
agentRouter.get('/reports/monthly', monthlyReportQueryValidator, validateMiddleware, asyncHandler(agentMonthlyReportController));
agentRouter.get('/boosts', asyncHandler(agentBoostsController));
agentRouter.post('/boosts/free', boostOrderValidator, validateMiddleware, asyncHandler(applyFreeBoostController));
agentRouter.post('/boosts/orders', boostOrderValidator, validateMiddleware, asyncHandler(createBoostOrderController));
agentRouter.post('/subscription/orders', subscriptionOrderValidator, validateMiddleware, asyncHandler(createSubscriptionOrderController));
agentRouter.get('/payments/orders', asyncHandler(agentOrdersController));
agentRouter.get('/payments/orders/:reference', orderReferenceValidator, validateMiddleware, asyncHandler(agentOrderController));
agentRouter.post('/payments/orders/:reference/demo', demoPaymentValidator, validateMiddleware, asyncHandler(simulateDemoPaymentController));
agentRouter.post('/subscription/demo-reset', asyncHandler(resetDemoSubscriptionController));

export { agentRouter };

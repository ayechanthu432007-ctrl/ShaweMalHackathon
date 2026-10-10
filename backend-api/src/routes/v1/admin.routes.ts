import { Router } from 'express';

import {
  adminAssignMovingRequestController,
  adminCreateUserController,
  adminGetAgentRegistrationController,
  adminGetDriverRegistrationController,
  adminListAgentRegistrationsController,
  adminListAssignableDriversController,
  adminListAssignableMovingRequestsController,
  adminListDriverRegistrationsController,
  adminReportsOverviewController,
  adminUpdateAgentVerificationController,
  adminUpdateDriverVerificationController,
  adminUpdateUserRolesController
} from '../../controllers/admin.controller';
import { adminHouseBookingReportController } from '../../controllers/booking.controller';
import { adminMovingRequestReportController } from '../../controllers/moving.controller';
import { adminSubscriptionsOverviewController, adminUpdatePlanController } from '../../controllers/agent-plan.controller';
import { requireAdmin, requireAuth } from '../../middleware/auth.middleware';
import { adminPlanUpdateValidator } from '../../validators/agent-plan.validator';
import { validateMiddleware } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/async-handler';
import {
  adminAssignMovingRequestValidator,
  adminAssignableMovingRequestsValidator,
  adminCreateUserValidator,
  adminHouseBookingReportValidator,
  adminMovingRequestReportValidator,
  adminRegistrationLookupValidator,
  adminUpdateRolesValidator,
  adminVerificationListValidator,
  adminVerificationValidator
} from '../../validators/admin.validator';

const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/subscriptions', asyncHandler(adminSubscriptionsOverviewController));
adminRouter.patch('/subscriptions/plans/:code', adminPlanUpdateValidator, validateMiddleware, asyncHandler(adminUpdatePlanController));

adminRouter.post('/users', adminCreateUserValidator, validateMiddleware, asyncHandler(adminCreateUserController));
adminRouter.patch('/users/:id/roles', adminUpdateRolesValidator, validateMiddleware, asyncHandler(adminUpdateUserRolesController));
adminRouter.get(
  '/agents',
  adminVerificationListValidator,
  validateMiddleware,
  asyncHandler(adminListAgentRegistrationsController)
);
adminRouter.get(
  '/agents/:userId',
  adminRegistrationLookupValidator,
  validateMiddleware,
  asyncHandler(adminGetAgentRegistrationController)
);
adminRouter.patch(
  '/agents/:userId/verification',
  adminVerificationValidator,
  validateMiddleware,
  asyncHandler(adminUpdateAgentVerificationController)
);
adminRouter.get(
  '/drivers',
  adminVerificationListValidator,
  validateMiddleware,
  asyncHandler(adminListDriverRegistrationsController)
);
adminRouter.get(
  '/drivers/:userId',
  adminRegistrationLookupValidator,
  validateMiddleware,
  asyncHandler(adminGetDriverRegistrationController)
);
adminRouter.patch(
  '/drivers/:userId/verification',
  adminVerificationValidator,
  validateMiddleware,
  asyncHandler(adminUpdateDriverVerificationController)
);
adminRouter.get(
  '/moving/assignable-requests',
  adminAssignableMovingRequestsValidator,
  validateMiddleware,
  asyncHandler(adminListAssignableMovingRequestsController)
);
adminRouter.get('/moving/assignable-drivers', asyncHandler(adminListAssignableDriversController));
adminRouter.post(
  '/moving/requests/:id/assign',
  adminAssignMovingRequestValidator,
  validateMiddleware,
  asyncHandler(adminAssignMovingRequestController)
);
adminRouter.get('/reports/overview', asyncHandler(adminReportsOverviewController));
adminRouter.get(
  '/reports/bookings',
  adminHouseBookingReportValidator,
  validateMiddleware,
  asyncHandler(adminHouseBookingReportController)
);
adminRouter.get(
  '/reports/moving',
  adminMovingRequestReportValidator,
  validateMiddleware,
  asyncHandler(adminMovingRequestReportController)
);

export { adminRouter };

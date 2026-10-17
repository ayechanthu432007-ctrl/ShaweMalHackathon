import { Navigate, type RouteObject } from 'react-router'

import { AdminAuthGuard } from '@/app/router/guards'
import { RouteError } from '@/components/common/RouteError'
import { lazyPage } from './lazy-page'

const SignInPage = lazyPage(() => import('@/features/auth/pages/SignInPage'), 'SignInPage')
const SignUpPage = lazyPage(() => import('@/features/auth/pages/SignUpPage'), 'SignUpPage')
const AdminLayout = lazyPage(() => import('@/features/admin/layout/AdminLayout'), 'AdminLayout')
const AdminDashboardPage = lazyPage(() => import('@/features/admin/pages/AdminDashboardPage'), 'AdminDashboardPage')
const AdminMarketplaceListingPage = lazyPage(() => import('@/features/admin/pages/AdminMarketplaceListingPage'), 'AdminMarketplaceListingPage')
const AdminMarketplaceListingsPage = lazyPage(() => import('@/features/admin/pages/AdminMarketplaceListingsPage'), 'AdminMarketplaceListingsPage')
const AdminMarketplacePage = lazyPage(() => import('@/features/admin/pages/AdminMarketplacePage'), 'AdminMarketplacePage')
const AdminMarketplaceReportsPage = lazyPage(() => import('@/features/admin/pages/AdminMarketplaceReportsPage'), 'AdminMarketplaceReportsPage')
const AdminMarketplaceUserPage = lazyPage(() => import('@/features/admin/pages/AdminMarketplaceUserPage'), 'AdminMarketplaceUserPage')
const AdminMarketplaceUsersPage = lazyPage(() => import('@/features/admin/pages/AdminMarketplaceUsersPage'), 'AdminMarketplaceUsersPage')
const AdminMasterDataEntityPage = lazyPage(() => import('@/features/admin/pages/AdminMasterDataEntityPage'), 'AdminMasterDataEntityPage')
const AdminMasterDataPage = lazyPage(() => import('@/features/admin/pages/AdminMasterDataPage'), 'AdminMasterDataPage')
const AdminMovingAssignPage = lazyPage(() => import('@/features/admin/pages/AdminMovingAssignPage'), 'AdminMovingAssignPage')
const AdminReportsPage = lazyPage(() => import('@/features/admin/pages/AdminReportsPage'), 'AdminReportsPage')
const AdminHouseBookingReportPage = lazyPage(() => import('@/features/admin/pages/AdminHouseBookingReportPage'), 'AdminHouseBookingReportPage')
const AdminMovingRequestDetailPage = lazyPage(() => import('@/features/admin/pages/AdminMovingRequestDetailPage'), 'AdminMovingRequestDetailPage')
const AdminMovingRequestReportPage = lazyPage(() => import('@/features/admin/pages/AdminMovingRequestReportPage'), 'AdminMovingRequestReportPage')
const AdminSubscriptionsPage = lazyPage(() => import('@/features/admin/pages/AdminSubscriptionsPage'), 'AdminSubscriptionsPage')
const AdminUsersPage = lazyPage(() => import('@/features/admin/pages/AdminUsersPage'), 'AdminUsersPage')
const AdminVerificationDetailPage = lazyPage(() => import('@/features/admin/pages/AdminVerificationDetailPage'), 'AdminVerificationDetailPage')
const AdminVerificationQueuePage = lazyPage(() => import('@/features/admin/pages/AdminVerificationQueuePage'), 'AdminVerificationQueuePage')
const AdminVerificationsPage = lazyPage(() => import('@/features/admin/pages/AdminVerificationsPage'), 'AdminVerificationsPage')

export const adminRoutes: RouteObject[] = [
  {
    path: '/admin/sign-in',
    errorElement: <RouteError />,
    element: <SignInPage redirectTo="/admin/dashboard" titleKey="admin.signInTitle" />,
  },
  {
    path: '/admin/register',
    errorElement: <RouteError />,
    element: <SignUpPage redirectTo="/admin/sign-in" titleKey="admin.registerTitle" />,
  },
  {
    path: '/admin',
    element: <AdminAuthGuard />,
    errorElement: <RouteError />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: <AdminDashboardPage /> },
          { path: 'dashboard', element: <AdminDashboardPage /> },
          { path: 'verifications', element: <AdminVerificationsPage /> },
          { path: 'verifications/agents', element: <AdminVerificationQueuePage kind="agent" /> },
          { path: 'verifications/agents/:userId', element: <AdminVerificationDetailPage kind="agent" /> },
          { path: 'verifications/drivers', element: <AdminVerificationQueuePage kind="driver" /> },
          { path: 'verifications/drivers/:userId', element: <AdminVerificationDetailPage kind="driver" /> },
          { path: 'users', element: <AdminUsersPage /> },
          { path: 'subscriptions', element: <AdminSubscriptionsPage /> },
          { path: 'jobs-assign', element: <AdminMovingAssignPage /> },
          { path: 'moving-assign', element: <Navigate to="/admin/jobs-assign" replace /> },
          { path: 'master-data', element: <AdminMasterDataPage /> },
          { path: 'master-data/:entity', element: <AdminMasterDataEntityPage /> },
          { path: 'reports', element: <AdminReportsPage /> },
          { path: 'reports/bookings', element: <AdminHouseBookingReportPage /> },
          { path: 'reports/moving', element: <AdminMovingRequestReportPage /> },
          { path: 'reports/moving/:id', element: <AdminMovingRequestDetailPage /> },
          { path: 'marketplace', element: <AdminMarketplacePage /> },
          { path: 'marketplace/listings', element: <AdminMarketplaceListingsPage /> },
          { path: 'marketplace/listings/:id', element: <AdminMarketplaceListingPage /> },
          { path: 'marketplace/reports', element: <AdminMarketplaceReportsPage /> },
          { path: 'marketplace/users', element: <AdminMarketplaceUsersPage /> },
          { path: 'marketplace/users/:id', element: <AdminMarketplaceUserPage /> },
        ],
      },
    ],
  },
]

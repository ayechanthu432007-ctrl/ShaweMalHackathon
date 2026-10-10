import type { RouteObject } from 'react-router'

import { SignInPage } from '@/features/auth/pages/SignInPage'
import { SignUpPage } from '@/features/auth/pages/SignUpPage'
import { AgentHouseFormPage } from '@/features/agent/pages/AgentHouseFormPage'
import { AgentHousesPage } from '@/features/agent/pages/AgentHousesPage'
import { AgentDashboardLayout } from '@/features/agent/layout/AgentDashboardLayout'
import { AgentBookingsPage } from '@/features/agent/pages/AgentBookingsPage'
import { AgentDashboardPage } from '@/features/agent/pages/AgentDashboardPage'
import { AgentPerformancePage } from '@/features/agent/pages/AgentPerformancePage'
import { AgentBoostsPage, AgentInsightsPage, AgentReportsPage, AgentVerificationPage } from '@/features/agent/pages/AgentPremiumPages'
import { AgentCheckoutPage, AgentSubscriptionPage } from '@/features/agent/pages/AgentSubscriptionPages'
import { AgentRegisterPage } from '@/features/agent/pages/AgentRegisterPage'
import { DriverJobsPage } from '@/features/driver/pages/DriverJobsPage'
import { DriverRegisterPage } from '@/features/driver/pages/DriverRegisterPage'
import { HomePage } from '@/features/home/pages/HomePage'
import { FindingHousePage } from '@/features/houses/pages/FindingHousePage'
import { HouseDetailsPage } from '@/features/houses/pages/HouseDetailsPage'
import { BookingConfirmationPage } from '@/features/houses/pages/BookingConfirmationPage'
import { ListingDetailPage } from '@/features/marketplace/pages/ListingDetailPage'
import { MarketplaceHomePage } from '@/features/marketplace/pages/MarketplaceHomePage'
import { MarketplacePolicyPage } from '@/features/marketplace/pages/MarketplacePolicyPage'
import { MarketplaceSearchPage } from '@/features/marketplace/pages/MarketplaceSearchPage'
import { MovingOutSalePage } from '@/features/marketplace/pages/MovingOutSalePage'
import { MyMarketplacePage } from '@/features/marketplace/pages/MyMarketplacePage'
import { SellerProfilePage } from '@/features/marketplace/pages/SellerProfilePage'
import { SellItemPage } from '@/features/marketplace/pages/SellItemPage'
import { HireMovingPage } from '@/features/moving/pages/HireMovingPage'
import { MovingRequestDetailPage } from '@/features/moving/pages/MovingRequestDetailPage'
import { MovingStatusListPage } from '@/features/moving/pages/MovingStatusListPage'
import { MovingStatusPage } from '@/features/moving/pages/MovingStatusPage'
import { HistoryPage } from '@/features/profile/pages/HistoryPage'
import { ProfilePage } from '@/features/profile/pages/ProfilePage'
import { WishlistPage } from '@/features/profile/pages/WishlistPage'
import { PublicLayout } from '@/features/public/layout/PublicLayout'
import { AboutUsPage } from '@/features/public/pages/AboutUsPage'
import { FindingRoommatesPage } from '@/features/roommates/pages/FindingRoommatesPage'

export const publicRoutes: RouteObject = {
  path: '/',
  element: <PublicLayout />,
  children: [
    { index: true, element: <HomePage /> },
    { path: 'about-us', element: <AboutUsPage /> },
    { path: 'agent-register', element: <AgentRegisterPage /> },
    {
      // One shared dashboard shell for every agent page; existing addresses are unchanged.
      path: 'agent',
      element: <AgentDashboardLayout />,
      children: [
        { index: true, element: <AgentDashboardPage /> },
        { path: 'dashboard', element: <AgentDashboardPage /> },
        { path: 'houses', element: <AgentHousesPage /> },
        { path: 'houses/new', element: <AgentHouseFormPage /> },
        { path: 'houses/:id/edit', element: <AgentHouseFormPage /> },
        { path: 'bookings', element: <AgentBookingsPage /> },
        { path: 'performance', element: <AgentPerformancePage /> },
        { path: 'boosts', element: <AgentBoostsPage /> },
        { path: 'verification', element: <AgentVerificationPage /> },
        { path: 'insights', element: <AgentInsightsPage /> },
        { path: 'reports', element: <AgentReportsPage /> },
        { path: 'subscription', element: <AgentSubscriptionPage /> },
        { path: 'checkout/:reference', element: <AgentCheckoutPage /> },
      ],
    },
    { path: 'driver-register', element: <DriverRegisterPage /> },
    { path: 'sign-up', element: <SignUpPage /> },
    { path: 'sign-in', element: <SignInPage /> },
    { path: 'finding-house', element: <FindingHousePage /> },
    { path: 'houses/:id', element: <HouseDetailsPage /> },
    { path: 'houses/:id/bookings/:bookingId/confirmation', element: <BookingConfirmationPage /> },
    { path: 'hire-moving', element: <HireMovingPage /> },
    { path: 'hire-moving/:id', element: <MovingRequestDetailPage /> },
    { path: 'moving-status', element: <MovingStatusListPage /> },
    { path: 'moving-status/:id', element: <MovingStatusPage /> },
    { path: 'finding-roommates', element: <FindingRoommatesPage /> },
    { path: 'marketplace', element: <MarketplaceHomePage /> },
    { path: 'marketplace/search', element: <MarketplaceSearchPage /> },
    { path: 'marketplace/items/:id', element: <ListingDetailPage /> },
    { path: 'marketplace/sellers/:sellerId', element: <SellerProfilePage /> },
    { path: 'marketplace/moving-out-sales/:saleId', element: <MovingOutSalePage /> },
    { path: 'marketplace/policy', element: <MarketplacePolicyPage /> },
    { path: 'marketplace/sell', element: <SellItemPage /> },
    { path: 'marketplace/my', element: <MyMarketplacePage /> },
    { path: 'marketplace/my/listings/:id/edit', element: <SellItemPage /> },
    { path: 'profile', element: <ProfilePage /> },
    { path: 'profile/wishlist', element: <WishlistPage /> },
    { path: 'profile/history', element: <HistoryPage /> },
    { path: 'driver/jobs', element: <DriverJobsPage /> },
    { path: 'driver/jobs/:id', element: <DriverJobsPage /> },
  ],
}

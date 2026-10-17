import type { RouteObject } from 'react-router'

import { NotFoundPage } from '@/components/common/NotFoundPage'
import { RouteError } from '@/components/common/RouteError'
import { HomePage } from '@/features/home/pages/HomePage'
import { PublicLayout } from '@/features/public/layout/PublicLayout'
import { lazyPage } from './lazy-page'

const FindingHousePage = lazyPage(() => import('@/features/houses/pages/FindingHousePage'), 'FindingHousePage')
const MarketplaceHomePage = lazyPage(() => import('@/features/marketplace/pages/MarketplaceHomePage'), 'MarketplaceHomePage')
const SignInPage = lazyPage(() => import('@/features/auth/pages/SignInPage'), 'SignInPage')
const SignUpPage = lazyPage(() => import('@/features/auth/pages/SignUpPage'), 'SignUpPage')
const AgentHouseFormPage = lazyPage(() => import('@/features/agent/pages/AgentHouseFormPage'), 'AgentHouseFormPage')
const AgentHousesPage = lazyPage(() => import('@/features/agent/pages/AgentHousesPage'), 'AgentHousesPage')
const AgentDashboardLayout = lazyPage(() => import('@/features/agent/layout/AgentDashboardLayout'), 'AgentDashboardLayout')
const AgentBookingsPage = lazyPage(() => import('@/features/agent/pages/AgentBookingsPage'), 'AgentBookingsPage')
const AgentDashboardPage = lazyPage(() => import('@/features/agent/pages/AgentDashboardPage'), 'AgentDashboardPage')
const AgentPerformancePage = lazyPage(() => import('@/features/agent/pages/AgentPerformancePage'), 'AgentPerformancePage')
const AgentBoostsPage = lazyPage(() => import('@/features/agent/pages/AgentPremiumPages'), 'AgentBoostsPage')
const AgentInsightsPage = lazyPage(() => import('@/features/agent/pages/AgentPremiumPages'), 'AgentInsightsPage')
const AgentReportsPage = lazyPage(() => import('@/features/agent/pages/AgentPremiumPages'), 'AgentReportsPage')
const AgentVerificationPage = lazyPage(() => import('@/features/agent/pages/AgentPremiumPages'), 'AgentVerificationPage')
const AgentCheckoutPage = lazyPage(() => import('@/features/agent/pages/AgentSubscriptionPages'), 'AgentCheckoutPage')
const AgentSubscriptionPage = lazyPage(() => import('@/features/agent/pages/AgentSubscriptionPages'), 'AgentSubscriptionPage')
const AgentRegisterPage = lazyPage(() => import('@/features/agent/pages/AgentRegisterPage'), 'AgentRegisterPage')
const DriverJobsPage = lazyPage(() => import('@/features/driver/pages/DriverJobsPage'), 'DriverJobsPage')
const DriverRegisterPage = lazyPage(() => import('@/features/driver/pages/DriverRegisterPage'), 'DriverRegisterPage')
const HouseDetailsPage = lazyPage(() => import('@/features/houses/pages/HouseDetailsPage'), 'HouseDetailsPage')
const BookingConfirmationPage = lazyPage(() => import('@/features/houses/pages/BookingConfirmationPage'), 'BookingConfirmationPage')
const ListingDetailPage = lazyPage(() => import('@/features/marketplace/pages/ListingDetailPage'), 'ListingDetailPage')
const MarketplaceDemoPage = lazyPage(() => import('@/features/marketplace/demo/MarketplaceDemoPage'), 'MarketplaceDemoPage')
const MarketplacePolicyPage = lazyPage(() => import('@/features/marketplace/pages/MarketplacePolicyPage'), 'MarketplacePolicyPage')
const MarketplaceSearchPage = lazyPage(() => import('@/features/marketplace/pages/MarketplaceSearchPage'), 'MarketplaceSearchPage')
const MovingOutSalePage = lazyPage(() => import('@/features/marketplace/pages/MovingOutSalePage'), 'MovingOutSalePage')
const LegacySellerPlansRedirect = lazyPage(() => import('@/features/marketplace/pages/MyMarketplacePage'), 'LegacySellerPlansRedirect')
const MyBoostsPage = lazyPage(() => import('@/features/marketplace/pages/MyMarketplacePage'), 'MyBoostsPage')
const MyInquiriesPage = lazyPage(() => import('@/features/marketplace/pages/MyMarketplacePage'), 'MyInquiriesPage')
const MyInsightsPage = lazyPage(() => import('@/features/marketplace/pages/MyMarketplacePage'), 'MyInsightsPage')
const MyMarketplaceLayout = lazyPage(() => import('@/features/marketplace/pages/MyMarketplacePage'), 'MyMarketplaceLayout')
const MyMarketplaceOverviewPage = lazyPage(() => import('@/features/marketplace/pages/MyMarketplacePage'), 'MyMarketplaceOverviewPage')
const MyProductsPage = lazyPage(() => import('@/features/marketplace/pages/MyMarketplacePage'), 'MyProductsPage')
const MySellerPlansPage = lazyPage(() => import('@/features/marketplace/pages/MyMarketplacePage'), 'MySellerPlansPage')
const MySubscriptionPage = lazyPage(() => import('@/features/marketplace/pages/MyMarketplacePage'), 'MySubscriptionPage')
const SellerProfilePage = lazyPage(() => import('@/features/marketplace/pages/SellerProfilePage'), 'SellerProfilePage')
const SellerCheckoutPage = lazyPage(() => import('@/features/marketplace/pages/SellerPlansPages'), 'SellerCheckoutPage')
const SellItemPage = lazyPage(() => import('@/features/marketplace/pages/SellItemPage'), 'SellItemPage')
const HireMovingPage = lazyPage(() => import('@/features/moving/pages/HireMovingPage'), 'HireMovingPage')
const MovingRequestDetailPage = lazyPage(() => import('@/features/moving/pages/MovingRequestDetailPage'), 'MovingRequestDetailPage')
const MovingStatusListPage = lazyPage(() => import('@/features/moving/pages/MovingStatusListPage'), 'MovingStatusListPage')
const MovingStatusPage = lazyPage(() => import('@/features/moving/pages/MovingStatusPage'), 'MovingStatusPage')
const MovingReceiptPage = lazyPage(() => import('@/features/moving/pages/MovingReceiptPage'), 'MovingReceiptPage')
const HistoryPage = lazyPage(() => import('@/features/profile/pages/HistoryPage'), 'HistoryPage')
const ProfilePage = lazyPage(() => import('@/features/profile/pages/ProfilePage'), 'ProfilePage')
const WishlistPage = lazyPage(() => import('@/features/profile/pages/WishlistPage'), 'WishlistPage')
const AboutUsPage = lazyPage(() => import('@/features/public/pages/AboutUsPage'), 'AboutUsPage')
const FindingRoommatesPage = lazyPage(() => import('@/features/roommates/pages/FindingRoommatesPage'), 'FindingRoommatesPage')

export const publicRoutes: RouteObject = {
  path: '/',
  element: <PublicLayout />,
  errorElement: <RouteError />,
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
    { path: 'moving-status/:id/receipt', element: <MovingReceiptPage /> },
    { path: 'finding-roommates', element: <FindingRoommatesPage /> },
    { path: 'marketplace', element: <MarketplaceHomePage /> },
    // Sample-data demo; it redirects to the Marketplace unless the build enables it.
    { path: 'marketplace/demo', element: <MarketplaceDemoPage /> },
    { path: 'marketplace/search', element: <MarketplaceSearchPage /> },
    { path: 'marketplace/items/:id', element: <ListingDetailPage /> },
    { path: 'marketplace/sellers/:sellerId', element: <SellerProfilePage /> },
    { path: 'marketplace/moving-out-sales/:saleId', element: <MovingOutSalePage /> },
    { path: 'marketplace/policy', element: <MarketplacePolicyPage /> },
    { path: 'marketplace/sell', element: <SellItemPage /> },
    {
      // My Marketplace: the Marketplace seller's own dashboard (separate from the agent dashboard).
      path: 'marketplace/my',
      element: <MyMarketplaceLayout />,
      children: [
        { index: true, element: <MyMarketplaceOverviewPage /> },
        { path: 'products', element: <MyProductsPage /> },
        { path: 'inquiries', element: <MyInquiriesPage /> },
        { path: 'insights', element: <MyInsightsPage /> },
        { path: 'boosts', element: <MyBoostsPage /> },
        { path: 'plans', element: <MySellerPlansPage /> },
        { path: 'subscription', element: <MySubscriptionPage /> },
      ],
    },
    { path: 'marketplace/my/listings/:id/edit', element: <SellItemPage /> },
    { path: 'marketplace/plans', element: <LegacySellerPlansRedirect /> },
    { path: 'marketplace/checkout/:reference', element: <SellerCheckoutPage /> },
    { path: 'profile', element: <ProfilePage /> },
    { path: 'profile/wishlist', element: <WishlistPage /> },
    { path: 'profile/history', element: <HistoryPage /> },
    { path: 'driver/jobs', element: <DriverJobsPage /> },
    { path: 'driver/jobs/:id', element: <DriverJobsPage /> },
    { path: '*', element: <NotFoundPage /> },
  ],
}

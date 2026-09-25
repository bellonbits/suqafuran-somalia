import { useEffect, useState, lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { Onboarding, hasSeenOnboarding } from './components/Onboarding'
import { isCapacitorApp } from './lib/capacitor-utils'
import { configureStatusBar } from './lib/status-bar'
import { Header } from './components/shared/Header'
import { Footer } from './components/shared/Footer'
import { AuthModal } from './components/shared/AuthModal'
import { AISupportChat } from './components/shared/AISupportChat'
import ProtectedRoute from './components/ProtectedRoute'
import { SellerLayout } from './components/SellerLayout'
const HomePage = lazy(() => import('./pages/HomePage'))
const ShopsPage = lazy(() => import('./pages/ShopsPage'))
const ShopDetailPage = lazy(() => import('./pages/ShopDetailPage'))
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'))
const CategoryPage = lazy(() => import('./pages/CategoryPage'))
const SearchPage = lazy(() => import('./pages/SearchPage'))
const ListingDetailPage = lazy(() => import('./pages/ListingDetailPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const SignupPage = lazy(() => import('./pages/SignupPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const AccountPage = lazy(() => import('./pages/AccountPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const NotificationSettingsPage = lazy(() => import('./pages/NotificationSettingsPage'))
const SecurityLogsPage = lazy(() => import('./pages/SecurityLogsPage'))
const MessagesPage = lazy(() => import('./pages/MessagesPage'))
const OrdersPage = lazy(() => import('./pages/OrdersPage'))
const FavoritesPage = lazy(() => import('./pages/FavoritesPage'))
const SavedSearchesPage = lazy(() => import('./pages/SavedSearchesPage'))
const PriceAlertsPage = lazy(() => import('./pages/PriceAlertsPage'))
const FollowingPage = lazy(() => import('./pages/FollowingPage'))
const PostAdPage = lazy(() => import('./pages/PostAdPage'))
const SellerDashboardPage = lazy(() => import('./pages/SellerDashboardPage'))
const SellerShopPage = lazy(() => import('./pages/SellerShopPage'))
const SellerProductsPage = lazy(() => import('./pages/SellerProductsPage'))
const SellerBulkImportPage = lazy(() => import('./pages/SellerBulkImportPage'))
const SellerOrdersPage = lazy(() => import('./pages/SellerOrdersPage'))
const SellerMessagesPage = lazy(() => import('./pages/SellerMessagesPage'))
const SellerCustomersPage = lazy(() => import('./pages/SellerCustomersPage'))
const SellerFinancePage = lazy(() => import('./pages/SellerFinancePage'))
const SellerAnalyticsPage = lazy(() => import('./pages/SellerAnalyticsPage'))
const SellerInventoryPage = lazy(() => import('./pages/SellerInventoryPage'))
const SellerMarketingPage = lazy(() => import('./pages/SellerMarketingPage'))
const SellerFeaturedAdsPage = lazy(() => import('./pages/SellerFeaturedAdsPage'))
const SellerReviewsPage = lazy(() => import('./pages/SellerReviewsPage'))
const SellerVerificationPage = lazy(() => import('./pages/SellerVerificationPage'))
const SellerSettingsPage = lazy(() => import('./pages/SellerSettingsPage'))
const SellerStaffPage = lazy(() => import('./pages/SellerStaffPage'))
const SellerSubscriptionPage = lazy(() => import('./pages/SellerSubscriptionPage'))
const SellerReportsPage = lazy(() => import('./pages/SellerReportsPage'))
const AdminDashboardMainPage = lazy(() => import('./pages/AdminDashboardMainPage'))
const AdminListingsPage = lazy(() => import('./pages/AdminListingsPage'))
const AdminSellersPage = lazy(() => import('./pages/AdminSellersPage'))
const AdminShopsPage = lazy(() => import('./pages/AdminShopsPage'))
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'))
const AdminCategoriesPage = lazy(() => import('./pages/AdminCategoriesPage'))
const AdminOrdersPage = lazy(() => import('./pages/AdminOrdersPage'))
const AdminDisputesPage = lazy(() => import('./pages/AdminDisputesPage'))
const AdminConversationsPage = lazy(() => import('./pages/AdminConversationsPage'))
const AdminFraudPage = lazy(() => import('./pages/AdminFraudPage'))
const AdminReportsPage = lazy(() => import('./pages/AdminReportsPage'))
const AdminSupportPage = lazy(() => import('./pages/AdminSupportPage'))
const AdminVerificationsPage = lazy(() => import('./pages/AdminVerificationsPage'))
const AdminUnusualAccountsPage = lazy(() => import('./pages/AdminUnusualAccountsPage'))
const AdminAnalyticsPage = lazy(() => import('./pages/AdminAnalyticsPage'))
const AdminAnalyticsMainPage = lazy(() => import('./pages/AdminAnalyticsMainPage'))
const AdminAnalyticsUsersPage = lazy(() => import('./pages/AdminAnalyticsUsersPage'))
const AdminAnalyticsSellersPage = lazy(() => import('./pages/AdminAnalyticsSellersPage'))
const AdminAnalyticsDevicesPage = lazy(() => import('./pages/AdminAnalyticsDevicesPage'))
const AdminAnalyticsGeographicPage = lazy(() => import('./pages/AdminAnalyticsGeographicPage'))
const AdminAnalyticsCommunicationPage = lazy(() => import('./pages/AdminAnalyticsCommunicationPage'))
const AdminAnalyticsAlertsPage = lazy(() => import('./pages/AdminAnalyticsAlertsPage'))
const AdminBulkProductsPage = lazy(() => import('./pages/AdminBulkProductsPage'))
const AdminHomepageBannersPage = lazy(() => import('./pages/AdminHomepageBannersPage'))
const AdminCustomerSegmentsPage = lazy(() => import('./pages/AdminCustomerSegmentsPage'))
const AdminEmailAnalyticsPage = lazy(() => import('./pages/AdminEmailAnalyticsPage'))
const AdminEmailTemplatesPage = lazy(() => import('./pages/AdminEmailTemplatesPage'))
const AdminFeaturedAdsPage = lazy(() => import('./pages/AdminFeaturedAdsPage'))
const AdminSubscriptionsPage = lazy(() => import('./pages/AdminSubscriptionsPage'))
const AdminSystemMessagesPage = lazy(() => import('./pages/AdminSystemMessagesPage'))
const AdminUserLifecyclePage = lazy(() => import('./pages/AdminUserLifecyclePage'))
const AdminMonitoringAlertsPage = lazy(() => import('./pages/AdminMonitoringAlertsPage'))
const AdminMonitoringKafkaPage = lazy(() => import('./pages/AdminMonitoringKafkaPage'))
const AdminMonitoringLivePage = lazy(() => import('./pages/AdminMonitoringLivePage'))
const AdminMonitoringNotificationsPage = lazy(() => import('./pages/AdminMonitoringNotificationsPage'))
const AdminMonitoringTracesPage = lazy(() => import('./pages/AdminMonitoringTracesPage'))
const AdminShopsAltPage = lazy(() => import('./pages/AdminShopsAltPage'))
const AdminMonitoringAlertsAltPage = lazy(() => import('./pages/AdminMonitoringAlertsAltPage'))
const AdminMonitoringKafkaAltPage = lazy(() => import('./pages/AdminMonitoringKafkaAltPage'))
const AdminMonitoringLiveAltPage = lazy(() => import('./pages/AdminMonitoringLiveAltPage'))
const AdminMonitoringNotificationsAltPage = lazy(() => import('./pages/AdminMonitoringNotificationsAltPage'))
const AdminMonitoringTracesAltPage = lazy(() => import('./pages/AdminMonitoringTracesAltPage'))
const AgentDashboardPage = lazy(() => import('./pages/AgentDashboardPage'))
const AgentEarningsPage = lazy(() => import('./pages/AgentEarningsPage'))
const AgentAnalyticsPage = lazy(() => import('./pages/AgentAnalyticsPage'))
const AgentInquiriesPage = lazy(() => import('./pages/AgentInquiriesPage'))
const AgentListingsPage = lazy(() => import('./pages/AgentListingsPage'))
const AgentShopsPage = lazy(() => import('./pages/AgentShopsPage'))
const HelpCenterPage = lazy(() => import('./pages/HelpCenterPage'))
const SafeTradingTipsPage = lazy(() => import('./pages/SafeTradingTipsPage'))
const TermsOfUsePage = lazy(() => import('./pages/TermsOfUsePage'))

const AdminDashboardPagePlaceholder = () => (
  <div className="w-full">
    <div className="px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Admin Dashboard</h1>
      <p className="text-gray-600">Loading admin dashboard...</p>
    </div>
  </div>
)

// Shown briefly while a lazy-loaded route's chunk downloads. Every page
// import above is now code-split (was previously one ~2MB bundle covering
// every storefront and admin page at once), so this fires on first visit
// to each route and essentially never again once the chunk is cached.
const RouteLoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
  </div>
)

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-black">
      <Header />
      <div style={{ height: 'calc(env(safe-area-inset-top, 0px) + 3rem)' }} className="shrink-0 w-full md:hidden" />
      <div className="shrink-0 w-full hidden md:block h-16" />

      <div className="flex flex-1 min-w-0">
        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-1">
            {children}
          </main>
          <Footer />
        </div>
      </div>
      <AuthModal />
      <AISupportChat />
    </div>
  )
}

// React Router doesn't reset scroll position on navigation by default (unlike
// a traditional multi-page site) -- without this, clicking through to a new
// page keeps whatever scroll offset the previous page was left at.
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  const [showOnboarding, setShowOnboarding] = useState(() => isCapacitorApp() && !hasSeenOnboarding())

  useEffect(() => {
    configureStatusBar()
  }, [])

  // Route-level code splitting keeps the initial bundle small, but it means
  // the very first tap on a product/shop card -- by far the most common
  // action on the site -- has to fetch that page's JS chunk before it can
  // even start rendering, which reads as "slow to open" even though the
  // actual page is fast once loaded. Prefetch those two chunks in the
  // background once the browser is idle, well after the homepage itself has
  // painted, so by the time someone taps a card the chunk is usually already
  // cached and the navigation is instant.
  useEffect(() => {
    const prefetch = () => {
      import('./pages/ListingDetailPage')
      import('./pages/ShopDetailPage')
    }
    const idleId = (window as any).requestIdleCallback
      ? (window as any).requestIdleCallback(prefetch, { timeout: 3000 })
      : setTimeout(prefetch, 2000)
    return () => {
      if ((window as any).cancelIdleCallback) (window as any).cancelIdleCallback(idleId)
      else clearTimeout(idleId)
    }
  }, [])

  if (showOnboarding) {
    return <Onboarding onComplete={() => setShowOnboarding(false)} />
  }

  return (
    <>
    <ScrollToTop />
    <Suspense fallback={<RouteLoadingFallback />}>
    <Routes>
      {/* Marketplace Pages */}
      <Route element={<AppLayout><HomePage /></AppLayout>} path="/" />
      <Route element={<AppLayout><ShopsPage /></AppLayout>} path="/shops" />
      <Route element={<AppLayout><ShopDetailPage /></AppLayout>} path="/shop" />
      <Route element={<AppLayout><ShopDetailPage /></AppLayout>} path="/shop/:slug" />
      <Route element={<AppLayout><SearchPage /></AppLayout>} path="/search" />
      <Route element={<AppLayout><ListingDetailPage /></AppLayout>} path="/listing/:id" />
      <Route element={<AppLayout><CheckoutPage /></AppLayout>} path="/checkout" />

      {/* Support & Legal Pages */}
      <Route element={<AppLayout><HelpCenterPage /></AppLayout>} path="/help-center" />
      <Route element={<AppLayout><SafeTradingTipsPage /></AppLayout>} path="/safe-trading-tips" />
      <Route element={<AppLayout><TermsOfUsePage /></AppLayout>} path="/terms-of-use" />

      <Route element={<AppLayout><CategoryPage /></AppLayout>} path="/:category" />

      {/* Authentication Pages */}
      <Route element={<AppLayout><LoginPage /></AppLayout>} path="/login" />
      <Route element={<AppLayout><SignupPage /></AppLayout>} path="/signup" />
      <Route element={<AppLayout><ResetPasswordPage /></AppLayout>} path="/reset-password" />

      {/* User Account Pages */}
      <Route element={<AppLayout><AccountPage /></AppLayout>} path="/account" />
      <Route element={<AppLayout><SettingsPage /></AppLayout>} path="/settings" />
      <Route element={<AppLayout><NotificationSettingsPage /></AppLayout>} path="/settings/notifications" />
      <Route element={<AppLayout><SecurityLogsPage /></AppLayout>} path="/security-logs" />
      <Route element={<AppLayout><MessagesPage /></AppLayout>} path="/messages" />
      <Route element={<AppLayout><OrdersPage /></AppLayout>} path="/orders" />
      <Route element={<AppLayout><FavoritesPage /></AppLayout>} path="/favorites" />
      <Route element={<AppLayout><SavedSearchesPage /></AppLayout>} path="/saved-searches" />
      <Route element={<AppLayout><PriceAlertsPage /></AppLayout>} path="/price-alerts" />
      <Route element={<AppLayout><FollowingPage /></AppLayout>} path="/following" />

      {/* Seller Dashboard Pages */}
      <Route element={<SellerLayout><SellerDashboardPage /></SellerLayout>} path="/seller-dashboard" />
      <Route element={<SellerLayout><SellerShopPage /></SellerLayout>} path="/seller-dashboard/shop" />
      <Route element={<SellerLayout><SellerProductsPage /></SellerLayout>} path="/seller-dashboard/products" />
      <Route element={<SellerLayout><PostAdPage /></SellerLayout>} path="/seller-dashboard/products/add" />
      <Route element={<SellerLayout><SellerBulkImportPage /></SellerLayout>} path="/seller-dashboard/products/bulk-import" />
      <Route element={<SellerLayout><SellerOrdersPage /></SellerLayout>} path="/seller-dashboard/orders" />
      <Route element={<SellerLayout><SellerMessagesPage /></SellerLayout>} path="/seller-dashboard/messages" />
      <Route element={<SellerLayout><SellerCustomersPage /></SellerLayout>} path="/seller-dashboard/customers" />
      <Route element={<SellerLayout><SellerFinancePage /></SellerLayout>} path="/seller-dashboard/finance" />
      <Route element={<SellerLayout><SellerAnalyticsPage /></SellerLayout>} path="/seller-dashboard/analytics" />
      <Route element={<SellerLayout><SellerInventoryPage /></SellerLayout>} path="/seller-dashboard/inventory" />
      <Route element={<SellerLayout><SellerMarketingPage /></SellerLayout>} path="/seller-dashboard/marketing" />
      <Route element={<SellerLayout><SellerFeaturedAdsPage /></SellerLayout>} path="/seller-dashboard/featured-ads" />
      <Route element={<SellerLayout><SellerReviewsPage /></SellerLayout>} path="/seller-dashboard/reviews" />
      <Route element={<SellerLayout><SellerVerificationPage /></SellerLayout>} path="/seller-dashboard/verification" />
      <Route element={<SellerLayout><SellerSettingsPage /></SellerLayout>} path="/seller-dashboard/settings" />
      <Route element={<SellerLayout><SellerStaffPage /></SellerLayout>} path="/seller-dashboard/settings/staff" />
      <Route element={<SellerLayout><SellerSubscriptionPage /></SellerLayout>} path="/seller-dashboard/subscription" />
      <Route element={<SellerLayout><SellerReportsPage /></SellerLayout>} path="/seller-dashboard/reports" />

      {/* Admin Panel - Main Pages - Protected */}
      <Route element={<ProtectedRoute requiredRole="admin"><AdminDashboardMainPage /></ProtectedRoute>} path="/admin-dashboard" />
      <Route element={<ProtectedRoute requiredRole="admin"><AccountPage /></ProtectedRoute>} path="/admin-dashboard/settings" />
      <Route element={<ProtectedRoute requiredRole="admin"><AdminListingsPage /></ProtectedRoute>} path="/admin-listings" />
      <Route element={<ProtectedRoute requiredRole="admin"><AdminSellersPage /></ProtectedRoute>} path="/admin-sellers" />
      <Route element={<ProtectedRoute requiredRole="admin"><AdminShopsPage /></ProtectedRoute>} path="/admin-shops" />
      <Route element={<ProtectedRoute requiredRole="admin"><AdminUsersPage /></ProtectedRoute>} path="/admin-users" />
      <Route element={<ProtectedRoute requiredRole="admin"><AdminCategoriesPage /></ProtectedRoute>} path="/admin-categories" />
      <Route element={<ProtectedRoute requiredRole="admin"><AdminOrdersPage /></ProtectedRoute>} path="/admin-orders" />
      <Route element={<ProtectedRoute requiredRole="admin"><AdminDisputesPage /></ProtectedRoute>} path="/admin-disputes" />
      <Route element={<ProtectedRoute requiredRole="admin"><AdminConversationsPage /></ProtectedRoute>} path="/admin-messages" />
      <Route element={<ProtectedRoute requiredRole="admin"><AdminFraudPage /></ProtectedRoute>} path="/admin-fraud" />
      <Route element={<ProtectedRoute requiredRole="admin"><AdminReportsPage /></ProtectedRoute>} path="/admin-reports" />
      <Route element={<ProtectedRoute requiredRole="admin"><AdminSupportPage /></ProtectedRoute>} path="/admin-support" />
      <Route element={<ProtectedRoute requiredRole="admin"><AdminVerificationsPage /></ProtectedRoute>} path="/admin-verifications" />
      <Route element={<ProtectedRoute requiredRole="admin"><AdminUnusualAccountsPage /></ProtectedRoute>} path="/admin-unusual-accounts" />
      <Route element={<ProtectedRoute requiredRole="admin"><AdminAnalyticsPage /></ProtectedRoute>} path="/admin-analytics" />

      {/* Admin Dashboard Analytics */}
      <Route element={<AdminAnalyticsMainPage />} path="/admin-dashboard/analytics" />
      <Route element={<AdminAnalyticsUsersPage />} path="/admin-dashboard/analytics/users" />
      <Route element={<AdminAnalyticsSellersPage />} path="/admin-dashboard/analytics/sellers" />
      <Route element={<AdminAnalyticsDevicesPage />} path="/admin-dashboard/analytics/devices" />
      <Route element={<AdminAnalyticsGeographicPage />} path="/admin-dashboard/analytics/geographic" />
      <Route element={<AdminAnalyticsAlertsPage />} path="/admin-dashboard/analytics/alerts" />
      <Route element={<AdminAnalyticsCommunicationPage />} path="/admin-dashboard/analytics/communication" />

      {/* Admin Dashboard Features */}
      <Route element={<ProtectedRoute requiredRole="admin"><AdminHomepageBannersPage /></ProtectedRoute>} path="/admin-dashboard/marketing/banners" />
      <Route element={<AdminBulkProductsPage />} path="/admin-dashboard/bulk-products" />
      <Route element={<AdminCustomerSegmentsPage />} path="/admin-dashboard/customer-segments" />
      <Route element={<AdminEmailAnalyticsPage />} path="/admin-dashboard/email-analytics" />
      <Route element={<AdminEmailTemplatesPage />} path="/admin-dashboard/email-templates" />
      <Route element={<AdminFeaturedAdsPage />} path="/admin-dashboard/featured-ads" />
      <Route element={<AdminSubscriptionsPage />} path="/admin-dashboard/subscriptions" />
      <Route element={<AdminSystemMessagesPage />} path="/admin-dashboard/system-messages" />
      <Route element={<AdminUserLifecyclePage />} path="/admin-dashboard/user-lifecycle" />

      {/* Admin Dashboard Monitoring */}
      <Route element={<AdminMonitoringAlertsPage />} path="/admin-dashboard/monitoring/alerts" />
      <Route element={<AdminMonitoringKafkaPage />} path="/admin-dashboard/monitoring/kafka" />
      <Route element={<AdminMonitoringLivePage />} path="/admin-dashboard/monitoring/live" />
      <Route element={<ProtectedRoute requiredRole="admin"><AdminMonitoringNotificationsPage /></ProtectedRoute>} path="/admin-dashboard/monitoring/notifications" />
      <Route element={<ProtectedRoute requiredRole="admin"><AdminMonitoringNotificationsPage /></ProtectedRoute>} path="/admin-monitoring/notifications" />
      <Route element={<AdminMonitoringTracesPage />} path="/admin-dashboard/monitoring/traces" />

      {/* Admin Alt Routes - Protected */}
      <Route element={<ProtectedRoute requiredRole="admin"><AdminShopsAltPage /></ProtectedRoute>} path="/admin/shops" />
      <Route element={<ProtectedRoute requiredRole="admin"><AdminMonitoringAlertsAltPage /></ProtectedRoute>} path="/admin/monitoring/alerts" />
      <Route element={<ProtectedRoute requiredRole="admin"><AdminMonitoringKafkaAltPage /></ProtectedRoute>} path="/admin/monitoring/kafka" />
      <Route element={<ProtectedRoute requiredRole="admin"><AdminMonitoringLiveAltPage /></ProtectedRoute>} path="/admin/monitoring/live" />
      <Route element={<ProtectedRoute requiredRole="admin"><AdminMonitoringNotificationsAltPage /></ProtectedRoute>} path="/admin/monitoring/notifications" />
      <Route element={<ProtectedRoute requiredRole="admin"><AdminMonitoringTracesAltPage /></ProtectedRoute>} path="/admin/monitoring/traces" />

      {/* Agent Pages - Protected */}
      <Route element={<ProtectedRoute requiredRole="agent"><AgentDashboardPage /></ProtectedRoute>} path="/agent-dashboard" />
      <Route element={<ProtectedRoute requiredRole="agent"><AgentEarningsPage /></ProtectedRoute>} path="/agent-earnings" />
      <Route element={<ProtectedRoute requiredRole="agent"><AgentAnalyticsPage /></ProtectedRoute>} path="/agent-analytics" />
      <Route element={<ProtectedRoute requiredRole="agent"><AgentInquiriesPage /></ProtectedRoute>} path="/agent-inquiries" />
      <Route element={<ProtectedRoute requiredRole="agent"><AgentListingsPage /></ProtectedRoute>} path="/agent-listings" />
      <Route element={<ProtectedRoute requiredRole="agent"><AgentShopsPage /></ProtectedRoute>} path="/agent-shops" />
    </Routes>
    </Suspense>
    </>
  )
}

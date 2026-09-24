/**
 * ============================================
 * App
 * ============================================
 * Routing and the top-level error boundary.
 *
 * Feature screens are code-split with `lazy`. The dashboard and sign-in are
 * imported eagerly because they are the first thing every session renders, and
 * a loading flash on the very first paint reads as slowness.
 */

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import MainLayout from './components/layout/MainLayout.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import ErrorBoundary from './components/common/ErrorBoundary.jsx';
import RouteFallback from './components/common/RouteFallback.jsx';
import { screens } from './routes/screens.js';

// Eager - first paint
import LoginPage from './pages/LoginPage.jsx';
import SetupPage from './pages/SetupPage.jsx';
import DashboardPage from './features/dashboard/DashboardPage.jsx';

// Lazy - split out of the first download, then preloaded in the background
// (routes/screens.js) so switching tabs never shows a loading placeholder.
const InventoryPage = lazy(screens.inventory);
const CategoriesPage = lazy(screens.categories);
const CustomersPage = lazy(screens.customers);
const SuppliersPage = lazy(screens.suppliers);
const PurchasesPage = lazy(screens.purchases);
const SalesPage = lazy(screens.sales);
const InstallmentsPage = lazy(screens.installments);
const PaymentsPage = lazy(screens.payments);
const ExpensesPage = lazy(screens.expenses);
const ReturnsPage = lazy(screens.returns);
const PartnersPage = lazy(screens.partners);
const InvestorsPage = lazy(screens.investors);
const AgreementsPage = lazy(screens.agreements);
const ZakatPage = lazy(screens.zakat);
const CalculatorPage = lazy(screens.calculator);
const ReportsPage = lazy(screens.reports);
const UsersPage = lazy(screens.users);
const SettingsPage = lazy(screens.settings);

/**
 * Every protected screen names the permission it needs. ProtectedRoute turns a
 * missing permission into a clear "no access" screen rather than a blank page.
 */
const PROTECTED_ROUTES = [
  { path: 'inventory', element: <InventoryPage />, permission: 'products' },
  { path: 'categories', element: <CategoriesPage />, permission: 'categories' },
  { path: 'customers', element: <CustomersPage />, permission: 'customers' },
  { path: 'suppliers', element: <SuppliersPage />, permission: 'suppliers' },
  { path: 'purchases', element: <PurchasesPage />, permission: 'purchases' },
  { path: 'sales', element: <SalesPage />, permission: 'sales' },
  { path: 'installments', element: <InstallmentsPage />, permission: 'installments' },
  { path: 'payments', element: <PaymentsPage />, permission: 'payments' },
  { path: 'expenses', element: <ExpensesPage />, permission: 'expenses' },
  { path: 'returns', element: <ReturnsPage />, permission: 'returns' },
  { path: 'partners', element: <PartnersPage />, permission: 'partners' },
  { path: 'investors', element: <InvestorsPage />, permission: 'investors' },
  { path: 'agreements', element: <AgreementsPage />, permission: 'agreements' },
  { path: 'zakat', element: <ZakatPage />, permission: 'zakat' },
  { path: 'calculator', element: <CalculatorPage />, permission: 'calculator' },
  { path: 'reports', element: <ReportsPage />, permission: 'reports' },
  { path: 'users', element: <UsersPage />, permission: 'users' },
  { path: 'settings', element: <SettingsPage />, permission: null }, // Everyone has a profile
];

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* ---- Public ---- */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/setup" element={<SetupPage />} />

          {/* ---- Authenticated ---- */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />

            {/* Products was renamed Inventory; old links and bookmarks still land. */}
            <Route path="products" element={<Navigate to="/inventory" replace />} />

            <Route
              path="dashboard"
              element={
                <ProtectedRoute permission="dashboard">
                  <DashboardPage />
                </ProtectedRoute>
              }
            />

            {PROTECTED_ROUTES.map(({ path, element, permission }) => (
              <Route
                key={path}
                path={path}
                element={
                  <ProtectedRoute permission={permission}>
                    <Suspense fallback={<RouteFallback />}>{element}</Suspense>
                  </ProtectedRoute>
                }
              />
            ))}
          </Route>

          {/* Unknown paths land on the dashboard, which then redirects to
              /login if there is no session. */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

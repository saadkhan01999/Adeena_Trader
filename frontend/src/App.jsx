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
import { PageSkeleton } from './components/common/Skeleton.jsx';

// Eager - first paint
import LoginPage from './pages/LoginPage.jsx';
import SetupPage from './pages/SetupPage.jsx';
import DashboardPage from './features/dashboard/DashboardPage.jsx';

// Lazy - loaded on first navigation
const ProductsPage = lazy(() => import('./features/products/ProductsPage.jsx'));
const CategoriesPage = lazy(() => import('./features/categories/CategoriesPage.jsx'));
const CustomersPage = lazy(() => import('./features/customers/CustomersPage.jsx'));
const SuppliersPage = lazy(() => import('./features/suppliers/SuppliersPage.jsx'));
const PurchasesPage = lazy(() => import('./features/purchases/PurchasesPage.jsx'));
const SalesPage = lazy(() => import('./features/sales/SalesPage.jsx'));
const InstallmentsPage = lazy(() => import('./features/installments/InstallmentsPage.jsx'));
const PaymentsPage = lazy(() => import('./features/payments/PaymentsPage.jsx'));
const ExpensesPage = lazy(() => import('./features/expenses/ExpensesPage.jsx'));
const ReturnsPage = lazy(() => import('./features/returns/ReturnsPage.jsx'));
const PartnersPage = lazy(() => import('./features/partners/PartnersPage.jsx'));
const InvestorsPage = lazy(() => import('./features/investors/InvestorsPage.jsx'));
const AgreementsPage = lazy(() => import('./features/agreements/AgreementsPage.jsx'));
const ZakatPage = lazy(() => import('./features/zakat/ZakatPage.jsx'));
const CalculatorPage = lazy(() => import('./features/calculator/CalculatorPage.jsx'));
const ReportsPage = lazy(() => import('./features/reports/ReportsPage.jsx'));
const UsersPage = lazy(() => import('./features/users/UsersPage.jsx'));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage.jsx'));

/**
 * Every protected screen names the permission it needs. ProtectedRoute turns a
 * missing permission into a clear "no access" screen rather than a blank page.
 */
const PROTECTED_ROUTES = [
  { path: 'products', element: <ProductsPage />, permission: 'products' },
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
                    <Suspense fallback={<PageSkeleton />}>{element}</Suspense>
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

/**
 * ============================================
 * Screens
 * ============================================
 * Every lazily loaded screen, in one place, so App.jsx can route to them and
 * MainLayout can preload them.
 *
 * They stay split out of the first download - the sign-in page should not wait
 * on the Zakat calculator - and are then fetched in the background once the
 * first screen has painted, so by the time anyone clicks a tab its code is
 * already here and the screen appears at once.
 */

export const screens = {
  inventory: () => import('../features/inventory/InventoryPage.jsx'),
  categories: () => import('../features/categories/CategoriesPage.jsx'),
  customers: () => import('../features/customers/CustomersPage.jsx'),
  suppliers: () => import('../features/suppliers/SuppliersPage.jsx'),
  purchases: () => import('../features/purchases/PurchasesPage.jsx'),
  sales: () => import('../features/sales/SalesPage.jsx'),
  installments: () => import('../features/installments/InstallmentsPage.jsx'),
  payments: () => import('../features/payments/PaymentsPage.jsx'),
  expenses: () => import('../features/expenses/ExpensesPage.jsx'),
  returns: () => import('../features/returns/ReturnsPage.jsx'),
  partners: () => import('../features/partners/PartnersPage.jsx'),
  investors: () => import('../features/investors/InvestorsPage.jsx'),
  agreements: () => import('../features/agreements/AgreementsPage.jsx'),
  zakat: () => import('../features/zakat/ZakatPage.jsx'),
  calculator: () => import('../features/calculator/CalculatorPage.jsx'),
  reports: () => import('../features/reports/ReportsPage.jsx'),
  users: () => import('../features/users/UsersPage.jsx'),
  settings: () => import('../features/settings/SettingsPage.jsx'),
};

/**
 * Fetch every screen's code once the first screen has painted and the browser
 * is idle. Each import is cached by the browser module loader, so the later
 * lazy() call resolves immediately.
 */
let preloaded = false;
export function preloadScreens() {
  if (preloaded || typeof window === 'undefined') return;
  preloaded = true;
  const run = () => Object.values(screens).forEach((load) => load().catch(() => {}));
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 2500 });
  else setTimeout(run, 1200);
}


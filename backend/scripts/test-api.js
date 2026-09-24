/**
 * ============================================
 * End-to-end API test
 * ============================================
 * Drives a RUNNING server through real HTTP calls, the way the app does, and
 * checks every figure that comes back: stock, balances, the wallet, the
 * dashboard, deletes with linked records, uploads, settings.
 *
 *   npm run test:api                          # http://localhost:5000, admin / Admin@12345
 *   API_URL=https://... ADMIN_LOGIN=... ADMIN_PASSWORD=... npm run test:api
 *
 * It creates its own records (every name carries a run tag) and deletes them
 * again at the end. Point it at a TEST deployment: it performs real deletes.
 */

const API = (process.env.API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
const LOGIN = process.env.ADMIN_LOGIN || 'admin';
const PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@12345';
const RUN = `e2e${Date.now().toString().slice(-6)}`;

let token = '';
let passed = 0;
const failures = [];

const check = (label, condition, detail = '') => {
  if (condition) {
    passed += 1;
    console.log(`   PASS  ${label}${detail !== '' ? `  ${detail}` : ''}`);
  } else {
    failures.push(label);
    console.log(`   FAIL  ${label}${detail !== '' ? `  ${detail}` : ''}`);
  }
};

const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.5;

/** One request. Returns { status, body } and never throws on an HTTP error. */
const call = async (method, path, body, { auth = token, form } = {}) => {
  const headers = {};
  if (auth) headers.Authorization = `Bearer ${auth}`;
  if (body && !form) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API}${path}`, {
    method,
    headers,
    body: form || (body ? JSON.stringify(body) : undefined),
  });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: response.status, body: json };
};

const get = (path, opts) => call('GET', path, undefined, opts);
const post = (path, body, opts) => call('POST', path, body, opts);
const put = (path, body, opts) => call('PUT', path, body, opts);
const del = (path, opts) => call('DELETE', path, undefined, opts);

/** Fail loudly when a setup step does not succeed - later checks depend on it. */
const must = (result, what) => {
  if (result.status >= 300) {
    const detail = Array.isArray(result.body?.errors)
      ? ` - ${result.body.errors.map((e) => `${e.field || e.path}: ${e.message}`).join('; ')}`
      : '';
    throw new Error(`${what} failed (${result.status}): ${result.body?.message || JSON.stringify(result.body).slice(0, 200)}${detail}`);
  }
  return result.body.data;
};

/** A real 1x1 PNG, for the upload checks. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

const main = async () => {
  console.log(`\nAPI ${API}  ·  run ${RUN}\n`);

  const login = await post('/auth/login', { identifier: LOGIN, password: PASSWORD }, { auth: null });
  token = must(login, 'Sign in').accessToken;
  const me = login.body.data.user;
  check('signed in as an administrator', me.role === 'admin', me.username);

  const created = { categories: [], products: [], customers: [], suppliers: [], users: [], investors: [] };

  try {
    // =====================================================================
    console.log('\n1. Categories, with a picture');
    // =====================================================================
    const mobiles = must(await post('/categories', { name: `${RUN} Mobiles`, icon: 'Smartphone' }), 'Create category').category;
    const solar = must(await post('/categories', { name: `${RUN} Solar (Panels)`, icon: 'Sun' }), 'Create category').category;
    created.categories.push(mobiles._id, solar._id);
    check('two categories created', Boolean(mobiles._id && solar._id));

    const form = new FormData();
    form.append('image', new Blob([PNG], { type: 'image/png' }), 'mobiles.png');
    const upload = await call('POST', `/categories/${mobiles._id}/image`, null, { form });
    const imageUrl = upload.body?.data?.category?.image;
    check('category picture uploaded', upload.status === 201 || upload.status === 200, imageUrl);

    const host = API.replace(/\/api$/, '');
    const picture = await fetch(`${host}${imageUrl}`);
    check('the picture is served back', picture.ok && picture.headers.get('content-type') === 'image/png',
      `${picture.status} ${picture.headers.get('content-type')}`);

    const categoryList = must(await get('/categories'), 'List categories').categories;
    check('a name with brackets does not break search',
      (await get(`/categories?search=${encodeURIComponent('Solar (Pan')}`)).status === 200);
    check('category list includes the new ones', categoryList.some((c) => c._id === mobiles._id));

    // =====================================================================
    console.log('\n2. Inventory');
    // =====================================================================
    const phone = must(await post('/products', {
      name: `${RUN} Tecno Spark (8GB)`, category: mobiles._id, brand: 'Tecno',
      purchasePrice: 20000, cashPrice: 28000, installmentPrice: 33600, stock: 10, lowStockThreshold: 3,
    }), 'Create item').product;
    created.products.push(phone._id);
    check('new item comes back with its category name', phone.category?.name === `${RUN} Mobiles`, phone.category?.name);

    const panel = must(await post('/products', {
      name: `${RUN} Solar 550W`, category: solar._id, purchasePrice: 30000, cashPrice: 38000,
      stock: 2, lowStockThreshold: 5,
    }), 'Create item').product;
    created.products.push(panel._id);

    const search = must(await get(`/products?search=${encodeURIComponent('Spark (8GB')}`), 'Search');
    check('search with brackets finds the item', search.products.some((p) => p._id === phone._id));
    check('inventory list carries summary figures', typeof search.summary?.costValue === 'number');

    const low = must(await get('/products/low-stock'), 'Low stock');
    check('an item under its own threshold is flagged low',
      low.lowStock.some((p) => p._id === panel._id), `${low.counts.lowStock} low`);
    const lowFilter = must(await get('/products?lowStock=true&limit=100'), 'Low filter');
    check('the low-stock filter uses each item\'s own threshold',
      lowFilter.products.some((p) => p._id === panel._id) && !lowFilter.products.some((p) => p._id === phone._id));

    const edited = must(await put(`/products/${phone._id}`, { cashPrice: 28000, stock: 10 }), 'Edit item').product;
    check('edited item comes back with its category', edited.category?.name === `${RUN} Mobiles`);

    const detail = must(await get(`/products/${phone._id}`), 'Item detail');
    check('item detail includes its stock history', Array.isArray(detail.movements) && detail.movements.length >= 1,
      `${detail.movements?.length} movement(s)`);

    // =====================================================================
    console.log('\n3. Customer and supplier');
    // =====================================================================
    const customer = must(await post('/customers', {
      name: `${RUN} Ali Khan`, mobile1: '0300-1234567', address: 'Mardan',
      guarantorName: 'Guarantor', guarantorPhone: '0311-7654321',
    }), 'Create customer').customer;
    created.customers.push(customer._id);

    const supplier = must(await post('/suppliers', { name: `${RUN} Hall Road Traders`, openingBalance: 5000 }), 'Create supplier').supplier;
    created.suppliers.push(supplier._id);
    check('supplier opening balance is owed', near(supplier.payable, 5000), supplier.payable);

    // =====================================================================
    console.log('\n4. Purchase - 5 phones, part paid by bank');
    // =====================================================================
    const purchase = must(await post('/purchases', {
      supplier: supplier._id, paymentMethod: 'bank', paid: 40000,
      items: [{ product: phone._id, productName: phone.name, quantity: 5, purchasePrice: 20000 }],
    }), 'Purchase').purchase;
    check('purchase payable = 100,000 - 40,000', near(purchase.payable, 60000), purchase.payable);
    const afterPurchase = must(await get(`/products/${phone._id}`), 'Item').product;
    check('stock rose by exactly 5', afterPurchase.stock === 15, afterPurchase.stock);
    const supplierAfter = must(await get(`/suppliers/${supplier._id}`), 'Supplier').supplier;
    check('supplier now owed 65,000', near(supplierAfter.payable, 65000), supplierAfter.payable);

    // =====================================================================
    console.log('\n5. Cash sale by JazzCash, sent as the form sends it');
    // =====================================================================
    const cashSale = must(await post('/sales', {
      customer: customer._id, saleType: 'cash', paymentMethod: 'jazzcash',
      items: [{ product: phone._id, productName: phone.name, quantity: 1, price: 28000, total: 28000 }],
      subtotal: 28000, grandTotal: 28000, advance: 0, amountReceived: 28000,
    }), 'Cash sale').sale;
    const custAfterCash = must(await get(`/customers/${customer._id}`), 'Customer').customer;
    check('a cash sale leaves the customer owing nothing', near(custAfterCash.outstanding, 0), custAfterCash.outstanding);
    check('stock fell by exactly 1', must(await get(`/products/${phone._id}`), 'Item').product.stock === 14);

    // =====================================================================
    console.log('\n6. Instalment sale, advance by EasyPaisa, then a cash instalment');
    // =====================================================================
    const plan = must(await post('/sales', {
      customer: customer._id, saleType: 'installment', installmentPlan: 6, paymentMethod: 'easypaisa',
      items: [{ product: phone._id, productName: phone.name, quantity: 1, price: 33600, total: 33600 }],
      subtotal: 33600, grandTotal: 33600, advance: 6000,
    }), 'Instalment sale').sale;
    check('balance after advance = 27,600', near(plan.remainingBalance, 27600), plan.remainingBalance);
    check('six monthly instalments of 4,600', plan.installments.length === 6 && near(plan.monthlyInstallment, 4600),
      `${plan.installments.length} x ${plan.monthlyInstallment}`);

    const pay = must(await post('/payments', { customer: customer._id, paymentAmount: 5000, paymentMethod: 'cash' }), 'Payment');
    check('instalment payment allocated in full', near(pay.totalAllocated ?? pay.payment?.paymentAmount, 5000));
    const custAfterPay = must(await get(`/customers/${customer._id}`), 'Customer').customer;
    check('customer now owes 22,600', near(custAfterPay.outstanding, 22600), custAfterPay.outstanding);

    // =====================================================================
    console.log('\n7. Expense, and paying the supplier later');
    // =====================================================================
    must(await post('/expenses', { category: 'Transport', amount: 1500, paymentMethod: 'cash', description: `${RUN} rickshaw` }), 'Expense');

    const tooMuch = await post(`/suppliers/${supplier._id}/payments`, { amount: 999999, paymentMethod: 'cash' });
    check('paying more than is owed is refused', tooMuch.status === 400, tooMuch.body.message);

    const supplierPay = must(await post(`/suppliers/${supplier._id}/payments`, { amount: 30000, paymentMethod: 'cash' }), 'Supplier payment');
    check('supplier owed 35,000 after paying 30,000', near(supplierPay.supplier.payable, 35000), supplierPay.supplier.payable);
    const purchaseAfterPay = must(await get(`/purchases/${purchase._id}`), 'Purchase').purchase;
    check('the payment was applied to the purchase', near(purchaseAfterPay.payable, 30000) && purchaseAfterPay.status === 'partial_payment',
      `${purchaseAfterPay.payable} ${purchaseAfterPay.status}`);

    const blocked = await del(`/purchases/${purchase._id}`);
    check('a purchase with a supplier payment on it cannot be deleted first', blocked.status === 400, blocked.body.message?.slice(0, 60));

    // =====================================================================
    console.log('\n8. Wallet and dashboard');
    // =====================================================================
    const wallet = must(await get('/dashboard/wallet?range=today'), 'Wallet');
    const m = Object.fromEntries(wallet.methods.map((row) => [row.method, row]));
    // Other records may exist on this database, so each check is "at least".
    check('JazzCash received the cash sale', m.jazzcash.in >= 28000, m.jazzcash.in);
    check('EasyPaisa received the advance', m.easypaisa.in >= 6000, m.easypaisa.in);
    check('cash received the instalment', m.cash.in >= 5000, m.cash.in);
    check('cash paid out the expense and supplier', m.cash.out >= 31500, m.cash.out);
    check('bank paid out at purchase', m.bank.out >= 40000, m.bank.out);
    check('wallet totals add up', near(wallet.totals.net, wallet.totals.in - wallet.totals.out));

    const dash = must(await get('/dashboard'), 'Dashboard');
    check("today's sales include both sales", dash.kpis.todaysSales >= 61600, dash.kpis.todaysSales);
    check("today's collection includes all three receipts", dash.kpis.todaysCollection >= 39000, dash.kpis.todaysCollection);

    // =====================================================================
    console.log('\n9. Deletes that touch other records');
    // =====================================================================
    const catDelete = await del(`/categories/${mobiles._id}`);
    check('deleting a category with items is held for confirmation',
      catDelete.status === 409 && catDelete.body.code === 'HAS_LINKED_RECORDS', catDelete.body.message);
    const moved = await del(`/categories/${mobiles._id}?moveTo=${solar._id}`);
    check('deleting it with "move items" works', moved.status === 200, moved.body.message);
    check('the items moved to the other category',
      must(await get(`/products/${phone._id}`), 'Item').product.category?._id === solar._id);
    created.categories = created.categories.filter((id) => id !== mobiles._id);

    // A salesman must not be able to force a cascade.
    const salesman = must(await post('/users', {
      name: `${RUN} Salesman`, username: `${RUN}.sales`, email: `${RUN}@example.com`, password: 'Sales@12345', role: 'salesman',
    }), 'Create user').user;
    created.users.push(salesman._id || salesman.id);
    const salesLogin = await post('/auth/login', { identifier: `${RUN}.sales`, password: 'Sales@12345' }, { auth: null });
    const salesToken = salesLogin.body?.data?.accessToken;
    const salesmanDelete = await del(`/customers/${customer._id}?force=true`, { auth: salesToken });
    check('a salesman cannot delete a customer', salesmanDelete.status === 403, salesmanDelete.status);

    const custDelete = await del(`/customers/${customer._id}`);
    check('deleting a customer with sales is held for confirmation',
      custDelete.status === 409 && custDelete.body.errors?.links?.length > 0,
      (custDelete.body.errors?.links || []).map((l) => `${l.count} ${l.label}`).join(', '));
    const custForce = await del(`/customers/${customer._id}?force=true`);
    check('confirmed customer delete succeeds', custForce.status === 200, custForce.body.message);
    check('the customer is really gone', (await get(`/customers/${customer._id}`)).status === 404);
    check('their sales are gone', (await get(`/sales/${cashSale._id}`)).status === 404 && (await get(`/sales/${plan._id}`)).status === 404);
    check('stock from both sales came back', must(await get(`/products/${phone._id}`), 'Item').product.stock === 15);
    created.customers = [];

    const supDelete = await del(`/suppliers/${supplier._id}`);
    check('deleting a supplier with purchases is held for confirmation', supDelete.status === 409);
    check('confirmed supplier delete succeeds', (await del(`/suppliers/${supplier._id}?force=true`)).status === 200);
    const keptPurchase = must(await get(`/purchases/${purchase._id}`), 'Purchase').purchase;
    check('the purchase stays, filed under the supplier name', keptPurchase.supplierName === supplier.name, keptPurchase.supplierName);
    created.suppliers = [];

    // =====================================================================
    console.log('\n10. Users');
    // =====================================================================
    const selfDelete = await del(`/users/${me.id || me._id}`);
    check('an admin cannot delete their own account', selfDelete.status === 403);
    const userDelete = await del(`/users/${salesman._id || salesman.id}`);
    check('admin deletes a user permanently', userDelete.status === 200, userDelete.body.message);
    check('the user is really gone', (await get(`/users/${salesman._id || salesman.id}`)).status === 404);
    created.users = [];

    // =====================================================================
    console.log('\n11. Investors - investment and its delete');
    // =====================================================================
    const investor = must(await post('/investors', { name: `${RUN} Investor`, phone: '0300-0000000', totalInvestment: 0 }), 'Investor').investor;
    created.investors.push(investor._id);
    const investment = must(await post(`/investors/${investor._id}/investments`, { amount: 100000 }), 'Investment');
    check('investment raises capital', near(investment.investor.totalInvestment, 100000), investment.investor.totalInvestment);
    const undo = must(await del(`/investors/${investor._id}/investments/${investment.investment._id}`), 'Delete investment');
    check('deleting the investment takes it back', near(undo.investor.totalInvestment, 0), undo.investor.totalInvestment);

    // =====================================================================
    console.log('\n12. Settings - theme, Urdu, printing');
    // =====================================================================
    const before = must(await get('/settings'), 'Settings').settings;
    check('Urdu is off unless switched on', before.display?.urdu === false || before.display?.urdu === undefined, before.display?.urdu);
    const saved = must(await put('/settings', {
      display: { theme: 'blue', urdu: true },
      print: { invoiceSize: 'thermal80', receiptSize: 'thermal58' },
    }), 'Save settings').settings;
    check('theme saved', saved.display.theme === 'blue');
    check('Urdu switch saved', saved.display.urdu === true);
    check('print sizes saved', saved.print.invoiceSize === 'thermal80' && saved.print.receiptSize === 'thermal58');
    check('saving one group leaves the others alone', saved.installment.defaultPlan === before.installment.defaultPlan);
    must(await put('/settings', { display: before.display || { theme: 'gold', urdu: false }, print: before.print || {} }), 'Restore settings');

    // =====================================================================
    console.log('\n13. Inventory item delete');
    // =====================================================================
    const itemDelete = await del(`/products/${panel._id}`);
    check('an item with stock deletes permanently', itemDelete.status === 200, itemDelete.body.message);
    check('it is really gone', (await get(`/products/${panel._id}`)).status === 404);
    created.products = created.products.filter((id) => id !== panel._id);
  } finally {
    // -----------------------------------------------------------------
    // Cleanup - whatever is left of this run.
    // -----------------------------------------------------------------
    console.log('\nCleaning up…');
    for (const id of created.customers) await del(`/customers/${id}?force=true`);
    for (const id of created.suppliers) await del(`/suppliers/${id}?force=true`);
    for (const id of created.products) await del(`/products/${id}`);
    for (const id of created.categories) await del(`/categories/${id}?force=true`);
    for (const id of created.users) await del(`/users/${id}`);
    for (const id of created.investors) await del(`/investors/${id}?force=true`);
    // The purchase kept after the supplier was deleted.
    const leftovers = (await get(`/purchases?search=${RUN}`)).body?.data?.purchases || [];
    for (const p of leftovers) await del(`/purchases/${p._id}`);
    const expenses = (await get(`/expenses?search=${RUN}`)).body?.data?.expenses || [];
    for (const e of expenses) await del(`/expenses/${e._id}`);
  }

  console.log(`\n${failures.length === 0 ? 'ALL PASSED' : `${failures.length} FAILED`}  (${passed} checks)\n`);
  if (failures.length) {
    failures.forEach((f) => console.log(`   - ${f}`));
    process.exit(1);
  }
};

main().catch((error) => {
  console.error('\nThe test run itself failed:', error.message);
  process.exit(1);
});

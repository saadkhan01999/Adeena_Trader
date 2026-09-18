/**
 * ============================================
 * Reversal Integration Test
 * ============================================
 * Exercises cancel and delete for sales, payments, purchases and returns
 * against a real MongoDB, end to end: it creates records through the same
 * services the application uses, reverses them, and checks that stock,
 * ledgers, balances and supplier payables all came back to where they started.
 *
 * Run it:
 *
 *   cd backend
 *   TEST_MONGODB_URI="mongodb+srv://.../adeena_test" npm run test:reversal
 *
 * Why a script and not a unit test
 * --------------------------------
 * There is nothing to usefully unit-test here. The whole risk in a reversal is
 * whether the database ends up in the right state across six collections, and
 * a mocked model layer would assert that the code calls what it calls - the
 * exact thing that cannot go wrong - while saying nothing about whether the
 * customer's balance is right afterwards. This creates real documents, reads
 * them back, and compares numbers.
 *
 * Safety
 * ------
 * Refuses to run against a database whose name does not contain "test" unless
 * --force is passed, because the most likely accident is pointing it at the
 * live shop. Everything it creates is tagged with a unique run id and removed
 * at the end, including after a failure.
 */

import mongoose from 'mongoose';
import env from '../src/config/env.js';

import Customer from '../src/models/Customer.js';
import Product from '../src/models/Product.js';
import Supplier from '../src/models/Supplier.js';
import Sale from '../src/models/Sale.js';
import Payment from '../src/models/Payment.js';
import Purchase from '../src/models/Purchase.js';
import Return from '../src/models/Return.js';
import LedgerEntry from '../src/models/LedgerEntry.js';
import StockMovement from '../src/models/StockMovement.js';
import User from '../src/models/User.js';

import {
  createSaleWithRelations, recordPaymentWithAllocation, createPurchaseWithStock,
} from '../src/services/financial.service.js';
import {
  cancelSale, deleteSale, reversePayment, deletePayment,
  cancelPurchase, deletePurchase, cancelReturn,
} from '../src/services/reversal.service.js';

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------
const RUN = `revtest-${Date.now()}`;
const force = process.argv.includes('--force');

let passed = 0;
const failures = [];

const check = (label, condition, detail = '') => {
  if (condition) {
    passed += 1;
    console.log(`   PASS  ${label}${detail ? `  ${detail}` : ''}`);
  } else {
    failures.push(label);
    console.log(`   FAIL  ${label}${detail ? `  ${detail}` : ''}`);
  }
};

const near = (a, b, tolerance = 0.01) => Math.abs(Number(a) - Number(b)) <= tolerance;

/** Every created id, so cleanup removes exactly what this run made. */
const made = { customers: [], products: [], suppliers: [], sales: [], payments: [], purchases: [], returns: [], users: [] };

const makeCustomer = async (name) => {
  const c = await Customer.create({ name: `${RUN} ${name}`, mobile1: '03001234567', address: 'Test' });
  made.customers.push(c._id);
  return c;
};

const makeProduct = async (name, stock, cash = 10000) => {
  const p = await Product.create({
    name: `${RUN} ${name}`, stock, cashPrice: cash, installmentPrice: cash * 1.2,
    purchasePrice: cash * 0.7, lowStockThreshold: 1,
  });
  made.products.push(p._id);
  return p;
};

const stockOf = async (id) => (await Product.findById(id)).stock;
const freshCustomer = async (id) => Customer.findById(id);

// ---------------------------------------------------------------------------
const main = async () => {
  const uri = process.env.TEST_MONGODB_URI || env.MONGODB_URI;
  const dbName = (uri.split('/').pop() || '').split('?')[0];

  if (!/test/i.test(dbName) && !force) {
    console.error(
      `\nRefusing to run against database "${dbName}".\n` +
      'This creates and deletes records. Point TEST_MONGODB_URI at a scratch\n' +
      'database whose name contains "test", or pass --force if you are certain.\n'
    );
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  console.log(`\nConnected to "${dbName}"  ·  run tag ${RUN}\n`);

  // A user id is stamped on everything these services create.
  const actor = await User.create({
    name: `${RUN} tester`, username: `${RUN}`, email: `${RUN}@test.local`,
    password: 'TestPassword123!', role: 'admin',
  });
  made.users.push(actor._id);
  const user = { id: actor._id };

  try {
    // =====================================================================
    console.log('1. Cancel a cash sale');
    // =====================================================================
    {
      const customer = await makeCustomer('Cash Buyer');
      const product = await makeProduct('Cash Item', 10);
      const before = await stockOf(product._id);

      const sale = await createSaleWithRelations({
        customer: customer._id, saleType: 'cash',
        items: [{ product: product._id, productName: product.name, quantity: 3,
                  price: 10000, total: 30000 }],
        subtotal: 30000, grandTotal: 30000, advance: 30000, paymentMethod: 'cash',
      }, user);
      made.sales.push(sale._id);

      check('stock fell when the sale was made', await stockOf(product._id) === before - 3,
        `${before} -> ${await stockOf(product._id)}`);

      await cancelSale(sale._id, user, 'integration test');

      const after = await Sale.findById(sale._id);
      const cust = await freshCustomer(customer._id);
      check('stock came back', await stockOf(product._id) === before, `${await stockOf(product._id)}`);
      check('sale is marked cancelled', after.status === 'cancelled');
      check('cancelledBy recorded', String(after.cancelledBy) === String(actor._id));
      check('customer total sales back to zero', near(cust.totalSales, 0), `${cust.totalSales}`);
      check('customer paid back to zero', near(cust.totalPaid, 0), `${cust.totalPaid}`);
      check('sale ledger entries removed',
        (await LedgerEntry.countDocuments({ referenceType: 'sale', referenceId: sale._id })) === 0);
      check('the advance receipt was reversed',
        (await Payment.countDocuments({ 'allocations.sale': sale._id, status: 'completed' })) === 0);
      check('a reversing stock movement was written',
        (await StockMovement.countDocuments({ referenceId: sale._id, type: 'adjustment' })) > 0);
    }

    // =====================================================================
    console.log('\n2. A sale with a payment against it refuses to cancel');
    // =====================================================================
    {
      const customer = await makeCustomer('Instalment Buyer');
      const product = await makeProduct('Instalment Item', 10);

      const sale = await createSaleWithRelations({
        customer: customer._id, saleType: 'installment', installmentPlan: 6,
        items: [{ product: product._id, productName: product.name, quantity: 1,
                  price: 60000, total: 60000 }],
        subtotal: 60000, grandTotal: 60000, advance: 12000, paymentMethod: 'cash',
      }, user);
      made.sales.push(sale._id);

      // The service answers with { payment, totalAllocated, remainingPayment },
      // not the document itself.
      const { payment } = await recordPaymentWithAllocation({
        customer: customer._id, sale: sale._id, paymentAmount: 8000, paymentMethod: 'cash',
      }, user);
      made.payments.push(payment._id);

      let refused = false;
      let message = '';
      try {
        await cancelSale(sale._id, user, 'should not work');
      } catch (error) {
        refused = true;
        message = error.message;
      }
      check('cancel is refused while a payment is attached', refused);
      check('the refusal names the receipt', message.includes(payment.receiptNumber),
        message.slice(0, 80));

      // ---- reverse the payment, then the sale ----
      const beforeBalance = (await Sale.findById(sale._id)).remainingBalance;
      await reversePayment(payment._id, user, 'integration test');

      const saleAfter = await Sale.findById(sale._id);
      const custAfter = await freshCustomer(customer._id);
      check('reversing the payment restores the balance',
        near(saleAfter.remainingBalance, beforeBalance + 8000),
        `${beforeBalance} -> ${saleAfter.remainingBalance}`);
      check('payment is marked reversed',
        (await Payment.findById(payment._id)).status === 'reversed');
      check('reversed payment is excluded from the customer total',
        near(custAfter.totalPaid, 12000), `${custAfter.totalPaid}`);
      check('payment ledger entry removed',
        (await LedgerEntry.countDocuments({ referenceType: 'payment', referenceId: payment._id })) === 0);

      await cancelSale(sale._id, user, 'integration test');
      check('the sale cancels once the payment is reversed',
        (await Sale.findById(sale._id)).status === 'cancelled');
    }

    // =====================================================================
    console.log('\n3. A payment spread across two sales survives deleting one');
    // =====================================================================
    {
      const customer = await makeCustomer('Two Invoice Buyer');
      const product = await makeProduct('Shared Item', 20);

      const saleA = await createSaleWithRelations({
        customer: customer._id, saleType: 'installment', installmentPlan: 6,
        items: [{ product: product._id, productName: product.name, quantity: 1, price: 60000, total: 60000 }],
        subtotal: 60000, grandTotal: 60000, advance: 12000, paymentMethod: 'cash',
      }, user);
      made.sales.push(saleA._id);

      const saleB = await createSaleWithRelations({
        customer: customer._id, saleType: 'installment', installmentPlan: 6,
        items: [{ product: product._id, productName: product.name, quantity: 1, price: 60000, total: 60000 }],
        subtotal: 60000, grandTotal: 60000, advance: 12000, paymentMethod: 'cash',
      }, user);
      made.sales.push(saleB._id);

      // No invoice named, so the allocator walks every open instalment the
      // customer has - across both sales - which is the case that made
      // deleting one sale able to erase money paid against the other.
      const { payment: big } = await recordPaymentWithAllocation({
        customer: customer._id, paymentAmount: 40000, paymentMethod: 'cash',
      }, user);
      made.payments.push(big._id);

      const spansBoth = new Set((big.allocations || []).map((a) => String(a.sale))).size > 1;
      console.log(`   note: payment spans ${new Set((big.allocations || []).map((a) => String(a.sale))).size} sale(s)`);

      if (spansBoth) {
        const paidToB = (big.allocations || [])
          .filter((a) => String(a.sale) === String(saleB._id))
          .reduce((s, a) => s + a.allocatedAmount, 0);

        // Reverse the shared payment first so sale A will delete.
        await reversePayment(big._id, user, 'integration test');
        await deleteSale(saleA._id, user);

        const survivor = await Payment.findById(big._id);
        check('the shared payment was not deleted with sale A', Boolean(survivor));
        if (survivor) {
          const stillB = (survivor.allocations || [])
            .filter((a) => String(a.sale) === String(saleB._id))
            .reduce((s, a) => s + a.allocatedAmount, 0);
          check("sale B's share of the payment survived", near(stillB, paidToB),
            `${paidToB} -> ${stillB}`);
          check("sale A's allocations were removed",
            !(survivor.allocations || []).some((a) => String(a.sale) === String(saleA._id)));
        }
      } else {
        console.log('   skipped: this settings profile allocates to a single sale');
      }
    }

    // =====================================================================
    console.log('\n4. Delete a sale outright');
    // =====================================================================
    {
      const customer = await makeCustomer('Delete Me');
      const product = await makeProduct('Delete Item', 8);
      const before = await stockOf(product._id);

      const sale = await createSaleWithRelations({
        customer: customer._id, saleType: 'cash',
        items: [{ product: product._id, productName: product.name, quantity: 2, price: 10000, total: 20000 }],
        subtotal: 20000, grandTotal: 20000, advance: 20000, paymentMethod: 'cash',
      }, user);

      await deleteSale(sale._id, user);

      check('the sale is gone', (await Sale.findById(sale._id)) === null);
      check('stock came back', await stockOf(product._id) === before);
      check('its ledger entries are gone',
        (await LedgerEntry.countDocuments({ referenceId: sale._id })) === 0);
      check('customer totals are back to zero',
        near((await freshCustomer(customer._id)).totalSales, 0));
    }

    // =====================================================================
    console.log('\n5. Purchases');
    // =====================================================================
    {
      const supplier = await Supplier.create({ name: `${RUN} Supplier`, phone: '03001112222' });
      made.suppliers.push(supplier._id);
      const product = await makeProduct('Purchased Item', 5);
      const before = await stockOf(product._id);

      const purchase = await createPurchaseWithStock({
        supplier: supplier._id, sourceType: 'registered_supplier',
        items: [{ product: product._id, productName: product.name, quantity: 10,
                  purchasePrice: 7000, total: 70000 }],
        paid: 30000,
      }, user);
      made.purchases.push(purchase._id);

      check('stock rose on purchase', await stockOf(product._id) === before + 10);
      const supAfter = await Supplier.findById(supplier._id);
      check('supplier payable rose', near(supAfter.payable, 40000), `${supAfter.payable}`);

      await cancelPurchase(purchase._id, user, 'integration test');

      check('stock came back down', await stockOf(product._id) === before);
      const supReversed = await Supplier.findById(supplier._id);
      check('supplier payable cleared', near(supReversed.payable, 0), `${supReversed.payable}`);
      check('supplier paid cleared', near(supReversed.totalPaid, 0), `${supReversed.totalPaid}`);
      check('purchase marked cancelled',
        (await Purchase.findById(purchase._id)).status === 'cancelled');

      await deletePurchase(purchase._id, user);
      check('purchase deleted', (await Purchase.findById(purchase._id)) === null);
    }

    // =====================================================================
    console.log('\n6. Returns, including an exchange');
    // =====================================================================
    {
      const customer = await makeCustomer('Returner');
      const sold = await makeProduct('Returned Item', 10);
      const replacement = await makeProduct('Replacement Item', 10);

      const sale = await createSaleWithRelations({
        customer: customer._id, saleType: 'cash',
        items: [{ product: sold._id, productName: sold.name, quantity: 2, price: 10000, total: 20000 }],
        subtotal: 20000, grandTotal: 20000, advance: 20000, paymentMethod: 'cash',
      }, user);
      made.sales.push(sale._id);

      const soldStock = await stockOf(sold._id);
      const replStock = await stockOf(replacement._id);

      // Built directly, mirroring what the controller writes, so the reversal
      // is tested against the shape the application actually stores.
      const ret = await Return.create({
        returnNumber: `${RUN}-R1`, sale: sale._id, invoiceNumber: sale.invoiceNumber,
        customer: customer._id, customerName: customer.name, returnType: 'exchange',
        items: [{ product: sold._id, productName: sold.name, quantity: 2, price: 10000,
                  exchangeProduct: replacement._id, exchangeProductName: replacement.name }],
        reason: 'integration test', createdBy: actor._id,
      });
      made.returns.push(ret._id);

      // Apply the same stock effects createReturn would have.
      await Product.findByIdAndUpdate(sold._id, { $inc: { stock: 2 } });
      await Product.findByIdAndUpdate(replacement._id, { $inc: { stock: -1 } });
      await Sale.findByIdAndUpdate(sale._id, { status: 'returned' });

      await cancelReturn(ret._id, user, 'integration test');

      check('returned goods went back out', await stockOf(sold._id) === soldStock,
        `${await stockOf(sold._id)} (expected ${soldStock})`);
      check('the exchange replacement came back into stock',
        await stockOf(replacement._id) === replStock,
        `${await stockOf(replacement._id)} (expected ${replStock})`);
      check('return marked reversed', (await Return.findById(ret._id)).status === 'reversed');
      check('the sale no longer reads as returned',
        (await Sale.findById(sale._id)).status !== 'returned');
    }

    // =====================================================================
    console.log('\n7. Reversing twice is refused');
    // =====================================================================
    {
      const customer = await makeCustomer('Double Reverse');
      const product = await makeProduct('Double Item', 5);
      const sale = await createSaleWithRelations({
        customer: customer._id, saleType: 'cash',
        items: [{ product: product._id, productName: product.name, quantity: 1, price: 10000, total: 10000 }],
        subtotal: 10000, grandTotal: 10000, advance: 10000, paymentMethod: 'cash',
      }, user);
      made.sales.push(sale._id);

      await cancelSale(sale._id, user, 'first');
      const stockAfterFirst = await stockOf(product._id);

      let refused = false;
      try { await cancelSale(sale._id, user, 'second'); } catch { refused = true; }
      check('a second cancel is refused', refused);
      check('stock was not credited twice', await stockOf(product._id) === stockAfterFirst,
        `${await stockOf(product._id)}`);
    }
  } finally {
    // -----------------------------------------------------------------
    // Cleanup - runs whether the tests passed, failed or threw.
    // -----------------------------------------------------------------
    console.log('\nCleaning up…');
    const tag = new RegExp(`^${RUN}`);
    await Promise.all([
      Sale.deleteMany({ _id: { $in: made.sales } }),
      Payment.deleteMany({ _id: { $in: made.payments } }),
      Purchase.deleteMany({ _id: { $in: made.purchases } }),
      Return.deleteMany({ _id: { $in: made.returns } }),
      Customer.deleteMany({ name: tag }),
      Product.deleteMany({ name: tag }),
      Supplier.deleteMany({ name: tag }),
      User.deleteMany({ username: tag }),
      LedgerEntry.deleteMany({ entityId: { $in: made.customers } }),
      StockMovement.deleteMany({ product: { $in: made.products } }),
      Payment.deleteMany({ customer: { $in: made.customers } }),
      Sale.deleteMany({ customer: { $in: made.customers } }),
    ]);
    await mongoose.disconnect();
  }

  console.log(
    `\n${failures.length === 0 ? 'ALL PASSED' : `${failures.length} FAILED`}  (${passed} checks)\n`
  );
  if (failures.length > 0) {
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
};

main().catch(async (error) => {
  console.error('\nThe test run itself failed:', error.message);
  console.error(error.stack?.split('\n').slice(1, 4).join('\n'));
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

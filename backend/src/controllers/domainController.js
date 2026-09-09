const { query, transaction } = require('../config/db');
const { getEntity } = require('../models/registry');
const svc = require('../services/entityService');
const orders = require('../services/orderService');
const { badRequest, notFound } = require('../utils/errors');

const asyncH = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// ---------------- Orders ----------------

const nextNumber = asyncH(async (_req, res) => {
  res.json({ order_number: await orders.nextOrderNumber() });
});

const createOrder = asyncH(async (req, res) => {
  res.status(201).json(await orders.createOrder(req.body, req.user));
});

const updateOrder = asyncH(async (req, res) => {
  res.json(await orders.updateOrder(req.params.id, req.body, req.user));
});

/** Order + its payments + customer, for the detail and invoice screens. */
const orderDetail = asyncH(async (req, res) => {
  const [order] = await query('SELECT * FROM orders WHERE id = ? LIMIT 1', [req.params.id]);
  if (!order) throw notFound('অর্ডার পাওয়া যায়নি');
  const [payments, customer, setting] = await Promise.all([
    query('SELECT * FROM payments WHERE order_id = ? AND archived = 0 ORDER BY date, created_date', [order.id]),
    order.customer_id
      ? query('SELECT * FROM customers WHERE id = ? LIMIT 1', [order.customer_id])
      : [],
    query('SELECT * FROM settings LIMIT 1'),
  ]);
  res.json({
    order: svc.serialize(getEntity('Order'), order),
    payments,
    customer: customer[0] || null,
    setting: setting[0] || null,
    items: (() => { try { return JSON.parse(order.items_json || '[]'); } catch { return []; } })(),
  });
});

const updateOrderStatus = asyncH(async (req, res) => {
  const { status } = req.body || {};
  const allowed = ['New', 'In Progress', 'Ready', 'Delivered', 'Cancelled'];
  if (!allowed.includes(status)) throw badRequest(`status must be one of ${allowed.join(', ')}`);
  const order = await svc.update(getEntity('Order'), req.params.id, { status });
  await orders.audit(null, req.user, `Order status → ${status}`, 'Order', order.id, null, { status });
  res.json(order);
});

// ---------------- Payments ----------------

const createPayment = asyncH(async (req, res) => {
  res.status(201).json(await orders.createPayment(req.body, req.user));
});

const deletePayment = asyncH(async (req, res) => {
  res.json(await orders.deletePayment(req.params.id, req.user));
});

// ---------------- Customers ----------------

const createCustomer = asyncH(async (req, res) => {
  const Customer = getEntity('Customer');
  const data = { ...req.body };
  if (!data.name) throw badRequest('কাস্টমারের নাম দিন');
  if (!data.customer_id) data.customer_id = await orders.nextCustomerCode();
  if (data.branch_id) {
    const [b] = await query('SELECT name FROM branches WHERE id = ? LIMIT 1', [data.branch_id]);
    data.branch_name = b ? b.name : '';
  }
  const customer = await svc.create(Customer, data, req.user.id);
  await orders.audit(null, req.user, 'Customer created', 'Customer', customer.id, null,
    { name: customer.name });
  res.status(201).json(customer);
});

const updateCustomer = asyncH(async (req, res) => {
  const Customer = getEntity('Customer');
  const data = { ...req.body };
  if (data.branch_id !== undefined) {
    const [b] = await query('SELECT name FROM branches WHERE id = ? LIMIT 1', [data.branch_id]);
    data.branch_name = b ? b.name : '';
  }
  res.json(await svc.update(Customer, req.params.id, data));
});

/** Customer + orders + payments + running due, for the customer detail screen. */
const customerDetail = asyncH(async (req, res) => {
  const [customer] = await query('SELECT * FROM customers WHERE id = ? LIMIT 1', [req.params.id]);
  if (!customer) throw notFound('কাস্টমার পাওয়া যায়নি');
  const [orderRows, paymentRows] = await Promise.all([
    query('SELECT * FROM orders WHERE customer_id = ? AND archived = 0 ORDER BY created_date DESC', [req.params.id]),
    query('SELECT * FROM payments WHERE customer_id = ? AND archived = 0 ORDER BY created_date DESC', [req.params.id]),
  ]);
  const billed = orderRows.reduce((a, o) => a + Number(o.total_selling), 0);
  const paid = paymentRows.reduce((a, p) => a + Number(p.amount), 0);
  res.json({
    customer,
    orders: orderRows,
    payments: paymentRows,
    summary: {
      orders: orderRows.length,
      billed,
      paid,
      due: billed + Number(customer.opening_due || 0) - paid,
    },
  });
});

// ---------------- Purchases ----------------

const createPurchase = asyncH(async (req, res) => {
  const Purchase = getEntity('Purchase');
  const data = { ...req.body };
  const total = Number(data.quantity || 0) * Number(data.unit_cost || 0);
  data.total_cost = Math.round(total * 100) / 100;
  data.due = Math.round((total - Number(data.paid || 0)) * 100) / 100;
  if (data.supplier_id) {
    const [s] = await query('SELECT name FROM suppliers WHERE id = ? LIMIT 1', [data.supplier_id]);
    data.supplier_name = s ? s.name : '';
  }
  if (data.branch_id) {
    const [b] = await query('SELECT name FROM branches WHERE id = ? LIMIT 1', [data.branch_id]);
    data.branch_name = b ? b.name : '';
  }
  res.status(201).json(await svc.create(Purchase, data, req.user.id));
});

/**
 * Supplier ledger.
 *
 * The balance runs forward through time: the opening due carries in, every
 * purchase adds its full bill, and every payment — whether it was paid at the
 * time of purchase or handed over later — subtracts. So today's bill always
 * lands on top of whatever was owed before, and a later payment clears the
 * oldest debt first.
 */
const supplierDetail = asyncH(async (req, res) => {
  const [supplier] = await query('SELECT * FROM suppliers WHERE id = ? LIMIT 1', [req.params.id]);
  if (!supplier) throw notFound('সরবরাহকারী পাওয়া যায়নি');

  const [purchases, payments] = await Promise.all([
    query('SELECT * FROM purchases WHERE supplier_id = ? ORDER BY date, created_date', [req.params.id]),
    query('SELECT * FROM supplier_payments WHERE supplier_id = ? ORDER BY date, created_date', [req.params.id]),
  ]);

  const entries = [
    ...purchases.flatMap((p) => {
      const rows = [{
        date: p.date,
        type: 'purchase',
        ref: p.material || '',
        description: `${p.quantity} ${p.unit} × ${Number(p.unit_cost)}`,
        debit: Number(p.total_cost),
        credit: 0,
        source_id: p.id,
      }];
      // Cash handed over at the counter is a payment in its own right.
      if (Number(p.paid) > 0) {
        rows.push({
          date: p.date,
          type: 'purchase_paid',
          ref: p.material || '',
          description: 'ক্রয়ের সময় পরিশোধ',
          debit: 0,
          credit: Number(p.paid),
          source_id: p.id,
        });
      }
      return rows;
    }),
    ...payments.map((p) => ({
      date: p.date,
      type: 'payment',
      ref: p.reference || '',
      description: p.notes || p.method,
      debit: 0,
      credit: Number(p.amount),
      source_id: p.id,
    })),
  ].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const openingDue = Number(supplier.opening_due || 0);
  let balance = openingDue;
  const ledger = entries.map((e) => {
    balance += e.debit - e.credit;
    return { ...e, balance };
  });

  const billed = purchases.reduce((a, p) => a + Number(p.total_cost), 0);
  const paidAtPurchase = purchases.reduce((a, p) => a + Number(p.paid), 0);
  const paidLater = payments.reduce((a, p) => a + Number(p.amount), 0);

  res.json({
    supplier,
    purchases: [...purchases].reverse(),
    payments: [...payments].reverse(),
    ledger,
    summary: {
      purchases: purchases.length,
      opening_due: openingDue,
      billed,
      paid: paidAtPurchase + paidLater,
      paid_at_purchase: paidAtPurchase,
      paid_later: paidLater,
      due: balance,
    },
  });
});

/** Record a payment against the supplier's running balance. */
const createSupplierPayment = asyncH(async (req, res) => {
  const SupplierPayment = getEntity('SupplierPayment');
  const supplierId = req.params.id;
  if (!Number(req.body?.amount)) throw badRequest('পরিমাণ দিন');

  const [supplier] = await query('SELECT name FROM suppliers WHERE id = ? LIMIT 1', [supplierId]);
  if (!supplier) throw notFound('সরবরাহকারী পাওয়া যায়নি');

  const payment = await svc.create(SupplierPayment, {
    ...req.body, supplier_id: supplierId, supplier_name: supplier.name,
  }, req.user.id);
  await orders.audit(null, req.user, 'Supplier payment added', 'SupplierPayment', payment.id,
    null, { supplier: supplier.name, amount: payment.amount });
  res.status(201).json(payment);
});

const deleteSupplierPayment = asyncH(async (req, res) => {
  const payment = await svc.get(getEntity('SupplierPayment'), req.params.paymentId);
  await svc.remove(getEntity('SupplierPayment'), req.params.paymentId);
  await orders.audit(null, req.user, 'Supplier payment deleted', 'SupplierPayment',
    payment.id, { amount: payment.amount }, null);
  res.json({ id: payment.id, deleted: true });
});

/** Every supplier with what they are still owed — the ক্রয় বাকি screen. */
const supplierDueList = asyncH(async (_req, res) => {
  const rows = await query(
    `SELECT s.id, s.name, s.mobile, s.business, s.opening_due,
            COALESCE(p.billed, 0)      AS billed,
            COALESCE(p.paid, 0)        AS paid_at_purchase,
            COALESCE(sp.paid, 0)       AS paid_later,
            COALESCE(p.purchases, 0)   AS purchases,
            p.last_purchase
       FROM suppliers s
       LEFT JOIN (
         SELECT supplier_id, COUNT(*) AS purchases, SUM(total_cost) AS billed,
                SUM(paid) AS paid, MAX(date) AS last_purchase
           FROM purchases GROUP BY supplier_id
       ) p ON p.supplier_id = s.id
       LEFT JOIN (
         SELECT supplier_id, SUM(amount) AS paid
           FROM supplier_payments GROUP BY supplier_id
       ) sp ON sp.supplier_id = s.id
      ORDER BY s.name`,
  );

  res.json(rows.map((r) => {
    const due = Number(r.opening_due) + Number(r.billed)
      - Number(r.paid_at_purchase) - Number(r.paid_later);
    return {
      id: r.id,
      name: r.name,
      mobile: r.mobile,
      business: r.business,
      purchases: Number(r.purchases),
      billed: Number(r.billed),
      paid: Number(r.paid_at_purchase) + Number(r.paid_later),
      opening_due: Number(r.opening_due),
      last_purchase: r.last_purchase,
      due,
    };
  }));
});

// ---------------- Loans ----------------

/** Loan + transactions; the balance is recomputed from the transaction rows. */
const loanDetail = asyncH(async (req, res) => {
  const [loan] = await query('SELECT * FROM loans WHERE id = ? LIMIT 1', [req.params.id]);
  if (!loan) throw notFound('হিসাব পাওয়া যায়নি');
  const txns = await query(
    'SELECT * FROM loan_txns WHERE loan_id = ? ORDER BY date, created_date', [req.params.id],
  );
  let balance = 0;
  const ledger = txns.map((t) => {
    balance += t.flow === 'increase' ? Number(t.amount) : -Number(t.amount);
    return { ...t, amount: Number(t.amount), balance };
  });
  res.json({ loan: { ...loan, balance }, ledger });
});

const createLoanTxn = asyncH(async (req, res) => {
  const LoanTxn = getEntity('LoanTxn');
  const loanId = req.params.id;
  const [loan] = await query('SELECT * FROM loans WHERE id = ? LIMIT 1', [loanId]);
  if (!loan) throw notFound('হিসাব পাওয়া যায়নি');

  const result = await transaction(async (conn) => {
    const txn = await svc.create(LoanTxn, {
      ...req.body, loan_id: loanId, person_name: loan.name,
    }, req.user.id, conn);
    const delta = txn.flow === 'increase' ? txn.amount : -txn.amount;
    await conn.execute('UPDATE loans SET balance = balance + ? WHERE id = ?', [delta, loanId]);
    return txn;
  });
  res.status(201).json(result);
});

// ---------------- Stock ----------------

const createStockItem = asyncH(async (req, res) => {
  const StockItem = getEntity('StockItem');
  const data = { ...req.body };
  if (data.current_stock === undefined) data.current_stock = Number(data.opening_stock || 0);
  res.status(201).json(await svc.create(StockItem, data, req.user.id));
});

/** Adjust stock by a signed quantity and log the adjustment. */
const adjustStock = asyncH(async (req, res) => {
  const { quantity, reason, notes, date } = req.body || {};
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty === 0) throw badRequest('পরিমাণ দিন');

  const [item] = await query('SELECT * FROM stock_items WHERE id = ? LIMIT 1', [req.params.id]);
  if (!item) throw notFound('স্টক আইটেম পাওয়া যায়নি');

  const result = await transaction(async (conn) => {
    await conn.execute('UPDATE stock_items SET current_stock = current_stock + ? WHERE id = ?',
      [qty, item.id]);
    await svc.create(getEntity('StockAdjustment'), {
      stock_id: item.id,
      stock_name: item.name,
      date: date || new Date().toISOString().slice(0, 10),
      quantity: qty,
      reason: reason || '',
      notes: notes || '',
    }, req.user.id, conn);
    const [rows] = await conn.execute('SELECT * FROM stock_items WHERE id = ?', [item.id]);
    return rows[0];
  });
  res.json(svc.serialize(getEntity('StockItem'), result));
});

// ---------------- Quotations ----------------

const nextQuote = asyncH(async (_req, res) => {
  res.json({ quote_number: await orders.nextQuoteNumber() });
});

const createQuotation = asyncH(async (req, res) => {
  const Quotation = getEntity('Quotation');
  const data = { ...req.body };
  if (!data.quote_number) data.quote_number = await orders.nextQuoteNumber();
  if (data.customer_id) {
    const [c] = await query('SELECT name, mobile FROM customers WHERE id = ? LIMIT 1', [data.customer_id]);
    data.customer_name = c ? c.name : '';
    data.customer_mobile = c ? c.mobile : '';
  }
  const items = Array.isArray(data.items) ? data.items
    : (() => { try { return JSON.parse(data.items_json || '[]'); } catch { return []; } })();
  const subtotal = items.reduce(
    (a, i) => a + Number(i.selling_price || 0) * Number(i.quantity || 0), 0,
  );
  let discount = Number(data.discount || 0);
  if (data.discount_type === 'Percent') discount = subtotal * (discount / 100);
  data.items_json = JSON.stringify(items);
  data.subtotal = Math.round(subtotal * 100) / 100;
  data.total = Math.round((subtotal - discount + Number(data.other_cost || 0)) * 100) / 100;
  res.status(201).json(await svc.create(Quotation, data, req.user.id));
});

/** Turn an accepted quotation into a real order. */
const convertQuotation = asyncH(async (req, res) => {
  const [q] = await query('SELECT * FROM quotations WHERE id = ? LIMIT 1', [req.params.id]);
  if (!q) throw notFound('কোটেশন পাওয়া যায়নি');
  if (q.status === 'Converted') throw badRequest('এই কোটেশন আগেই অর্ডারে রূপান্তরিত');

  const items = (() => { try { return JSON.parse(q.items_json || '[]'); } catch { return []; } })();
  const order = await orders.createOrder({
    customer_id: q.customer_id,
    order_date: new Date().toISOString().slice(0, 10),
    order_type: items[0]?.category || 'Thai Glass',
    description: q.notes || '',
    discount: Number(q.discount),
    discount_type: q.discount_type,
    other_cost: Number(q.other_cost),
    items_json: JSON.stringify(items),
    advance: 0,
  }, req.user);

  await svc.update(getEntity('Quotation'), q.id, { status: 'Converted' });
  res.status(201).json(order);
});

// ---------------- Salary ----------------

/** Expense category every staff advance is booked under. */
const ADVANCE_CATEGORY = 'স্টাফ অগ্রিম';

/**
 * Hand an advance to a staff member.
 *
 * One dated row in staff_advances, plus a matching expense so the cash leaving
 * the counter shows up in the খরচ ledger the same day — both in one
 * transaction, so an advance can never exist without its expense.
 */
const createStaffAdvance = asyncH(async (req, res) => {
  const StaffAdvance = getEntity('StaffAdvance');
  const Expense = getEntity('Expense');
  const amount = Number(req.body?.amount);
  if (!amount || amount <= 0) throw badRequest('অগ্রিমের পরিমাণ দিন');

  const [staff] = await query('SELECT * FROM staff WHERE id = ? LIMIT 1', [req.body.staff_id]);
  if (!staff) throw notFound('কর্মী পাওয়া যায়নি');

  const date = req.body.date || new Date().toISOString().slice(0, 10);
  const [year, month] = date.split('-').map(Number);

  const advance = await transaction(async (conn) => {
    const expense = await svc.create(Expense, {
      date,
      category: ADVANCE_CATEGORY,
      description: `${staff.name} — অগ্রিম`,
      amount,
      method: req.body.method || 'Cash',
      person: staff.name,
      branch_id: req.body.branch_id || '',
      notes: req.body.notes || '',
    }, req.user.id, conn);

    const row = await svc.create(StaffAdvance, {
      staff_id: staff.id,
      staff_name: staff.name,
      date,
      year,
      month,
      amount,
      method: req.body.method || 'Cash',
      expense_id: expense.id,
      notes: req.body.notes || '',
    }, req.user.id, conn);

    await orders.audit(conn, req.user, 'Staff advance paid', 'StaffAdvance', row.id, null,
      { staff: staff.name, amount });
    return row;
  });

  res.status(201).json(advance);
});

/** Removing an advance also removes the expense it booked. */
const deleteStaffAdvance = asyncH(async (req, res) => {
  const StaffAdvance = getEntity('StaffAdvance');
  const advance = await svc.get(StaffAdvance, req.params.id);

  await transaction(async (conn) => {
    if (advance.expense_id) {
      await conn.execute('DELETE FROM expenses WHERE id = ?', [advance.expense_id]);
    }
    await svc.remove(StaffAdvance, advance.id, conn);
    await orders.audit(conn, req.user, 'Staff advance deleted', 'StaffAdvance', advance.id,
      { staff: advance.staff_name, amount: advance.amount }, null);
  });

  res.json({ id: advance.id, deleted: true });
});

/**
 * Advances for one month (or a whole year when month is omitted):
 * every hand-out with its date, plus a per-staff total.
 */
const staffAdvanceReport = asyncH(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = req.query.month ? Number(req.query.month) : null;

  const rows = month
    ? await query(
      'SELECT * FROM staff_advances WHERE year = ? AND month = ? ORDER BY date, created_date',
      [year, month],
    )
    : await query(
      'SELECT * FROM staff_advances WHERE year = ? ORDER BY date, created_date', [year],
    );

  const byStaff = new Map();
  for (const r of rows) {
    const cur = byStaff.get(r.staff_id)
      || { staff_id: r.staff_id, staff_name: r.staff_name, count: 0, total: 0, months: {} };
    cur.count += 1;
    cur.total += Number(r.amount);
    cur.months[r.month] = (cur.months[r.month] || 0) + Number(r.amount);
    byStaff.set(r.staff_id, cur);
  }

  res.json({
    year,
    month,
    entries: rows.map((r) => ({ ...r, amount: Number(r.amount) })),
    by_staff: [...byStaff.values()].sort((a, b) => b.total - a.total),
    total: rows.reduce((a, r) => a + Number(r.amount), 0),
  });
});

/** Advances taken by each staff member in one month, keyed by staff id. */
async function advanceTotals(year, month) {
  const rows = await query(
    `SELECT staff_id, COALESCE(SUM(amount), 0) AS total
       FROM staff_advances WHERE year = ? AND month = ? GROUP BY staff_id`,
    [year, month],
  );
  return new Map(rows.map((r) => [r.staff_id, Number(r.total)]));
}

/**
 * Salary sheet for one month: every active staff member with their entry,
 * defaults filled in from the staff record when no entry exists yet.
 *
 * The advance column is not typed in — it is the sum of the dated advances
 * actually handed out that month, so the sheet and the খরচ ledger can never
 * disagree.
 */
const salarySheet = asyncH(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  const [staff, entries, setting, advances] = await Promise.all([
    query('SELECT * FROM staff WHERE active = 1 ORDER BY created_date'),
    query('SELECT * FROM salary_entries WHERE year = ? AND month = ?', [year, month]),
    query('SELECT lunch_rate FROM settings LIMIT 1'),
    advanceTotals(year, month),
  ]);
  const lunchRate = Number(setting[0]?.lunch_rate || 0);
  const byStaff = new Map(entries.map((e) => [e.staff_id, e]));

  res.json({
    year, month, lunch_rate: lunchRate,
    rows: staff.map((s) => {
      const e = byStaff.get(s.id);
      return {
        staff_id: s.id,
        staff_name: s.name,
        position: s.position,
        entry_id: e?.id || null,
        base_salary_snapshot: Number(e?.base_salary_snapshot ?? s.base_salary),
        duty_days: Number(e?.duty_days ?? 0),
        absent_days: Number(e?.absent_days ?? 0),
        friday_count: Number(e?.friday_count ?? 0),
        lunch_days: Number(e?.lunch_days ?? 0),
        lunch_allowance: Number(e?.lunch_allowance ?? 0),
        advance: advances.get(s.id) || 0,
        owner_due: Number(e?.owner_due ?? 0),
        previous_due: Number(e?.previous_due ?? 0),
        net_payment: Number(e?.net_payment ?? 0),
        due_amount: Number(e?.due_amount ?? 0),
      };
    }),
  });
});

/** Upsert the whole month's sheet in one request. */
const saveSalarySheet = asyncH(async (req, res) => {
  const SalaryEntry = getEntity('SalaryEntry');
  const { year, month, rows } = req.body || {};
  if (!year || !month || !Array.isArray(rows)) throw badRequest('year, month ও rows দিন');

  const [setting] = await query('SELECT lunch_rate FROM settings LIMIT 1');
  const lunchRate = Number(setting?.lunch_rate || 0);
  // Advances come from the dated hand-outs, never from the submitted sheet.
  const advances = await advanceTotals(Number(year), Number(month));

  const saved = await transaction(async (conn) => {
    const out = [];
    for (const row of rows) {
      const base = Number(row.base_salary_snapshot || 0);
      const lunch = Number(row.lunch_days || 0) * lunchRate;
      const advance = advances.get(row.staff_id) || 0;
      const net = base + lunch
        - advance
        - Number(row.owner_due || 0)
        + Number(row.previous_due || 0);
      const payload = {
        staff_id: row.staff_id,
        staff_name: row.staff_name,
        position: row.position,
        year: Number(year),
        month: Number(month),
        base_salary_snapshot: base,
        duty_days: Number(row.duty_days || 0),
        absent_days: Number(row.absent_days || 0),
        friday_count: Number(row.friday_count || 0),
        lunch_days: Number(row.lunch_days || 0),
        lunch_allowance: lunch,
        advance,
        owner_due: Number(row.owner_due || 0),
        previous_due: Number(row.previous_due || 0),
        net_payment: Math.round(net * 100) / 100,
        due_amount: Number(row.due_amount || 0),
      };
      const [existing] = await conn.execute(
        'SELECT id FROM salary_entries WHERE staff_id = ? AND year = ? AND month = ? LIMIT 1',
        [row.staff_id, year, month],
      );
      out.push(existing.length
        ? await svc.update(SalaryEntry, existing[0].id, payload, conn)
        : await svc.create(SalaryEntry, payload, req.user.id, conn));
    }
    return out;
  });
  res.json({ year: Number(year), month: Number(month), rows: saved });
});

// ---------------- Price lists ----------------

/** Everything the calculators and the order form need, in one round trip. */
const priceCatalog = asyncH(async (_req, res) => {
  const [profile, ss, glass, accessory, labour] = await Promise.all([
    query('SELECT * FROM aluminium_profiles WHERE active = 1 ORDER BY profile_name'),
    query('SELECT * FROM ss_materials WHERE active = 1 ORDER BY material_name'),
    query('SELECT * FROM glass_prices WHERE active = 1 ORDER BY glass_type'),
    query('SELECT * FROM accessories WHERE active = 1 ORDER BY name'),
    query('SELECT * FROM labour_settings WHERE active = 1 ORDER BY label'),
  ]);
  res.json({ profile, ss, glass, accessory, labour });
});

module.exports = {
  nextNumber, createOrder, updateOrder, orderDetail, updateOrderStatus,
  createPayment, deletePayment,
  createCustomer, updateCustomer, customerDetail,
  createPurchase, supplierDetail, createSupplierPayment, deleteSupplierPayment,
  supplierDueList,
  loanDetail, createLoanTxn,
  createStockItem, adjustStock,
  nextQuote, createQuotation, convertQuotation,
  salarySheet, saveSalarySheet,
  createStaffAdvance, deleteStaffAdvance, staffAdvanceReport,
  priceCatalog, ADVANCE_CATEGORY,
};

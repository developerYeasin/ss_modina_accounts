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

/** Supplier + their purchases + outstanding, for the supplier detail screen. */
const supplierDetail = asyncH(async (req, res) => {
  const [supplier] = await query('SELECT * FROM suppliers WHERE id = ? LIMIT 1', [req.params.id]);
  if (!supplier) throw notFound('সরবরাহকারী পাওয়া যায়নি');
  const purchases = await query(
    'SELECT * FROM purchases WHERE supplier_id = ? ORDER BY date DESC', [req.params.id],
  );
  res.json({
    supplier,
    purchases,
    summary: {
      purchases: purchases.length,
      total: purchases.reduce((a, p) => a + Number(p.total_cost), 0),
      paid: purchases.reduce((a, p) => a + Number(p.paid), 0),
      due: purchases.reduce((a, p) => a + Number(p.due), 0),
    },
  });
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

/**
 * Salary sheet for one month: every active staff member with their entry,
 * defaults filled in from the staff record when no entry exists yet.
 */
const salarySheet = asyncH(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  const [staff, entries, setting] = await Promise.all([
    query('SELECT * FROM staff WHERE active = 1 ORDER BY created_date'),
    query('SELECT * FROM salary_entries WHERE year = ? AND month = ?', [year, month]),
    query('SELECT lunch_rate FROM settings LIMIT 1'),
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
        advance: Number(e?.advance ?? 0),
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

  const saved = await transaction(async (conn) => {
    const out = [];
    for (const row of rows) {
      const base = Number(row.base_salary_snapshot || 0);
      const lunch = Number(row.lunch_days || 0) * lunchRate;
      const net = base + lunch
        - Number(row.advance || 0)
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
        advance: Number(row.advance || 0),
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
  createPurchase, supplierDetail,
  loanDetail, createLoanTxn,
  createStockItem, adjustStock,
  nextQuote, createQuotation, convertQuotation,
  salarySheet, saveSalarySheet,
  priceCatalog,
};

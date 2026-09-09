const { query, transaction } = require('../config/db');
const { getEntity } = require('../models/registry');
const svc = require('./entityService');
const { badRequest, notFound } = require('../utils/errors');

const Order = getEntity('Order');
const Payment = getEntity('Payment');

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const parseItems = (items) => {
  if (Array.isArray(items)) return items;
  if (typeof items === 'string' && items.trim()) {
    try { return JSON.parse(items); } catch { return []; }
  }
  return [];
};

/**
 * Order money, computed the same way the order form does it:
 *   gross      = Σ selling_price × quantity
 *   discount   = fixed amount, or a percent of gross
 *   selling    = gross − discount
 *   cost       = Σ material_cost (+ the explicit cost columns, when given)
 *   profit     = selling − cost
 *   due        = selling − total paid
 */
function computeTotals(payload, itemsInput, paidOverride) {
  const items = parseItems(itemsInput);

  let materialCost = 0;
  let gross = 0;
  for (const it of items) {
    materialCost += num(it.material_cost);
    gross += num(it.selling_price) * num(it.quantity);
  }

  const extraCost = ['aluminium_cost', 'ss_cost', 'glass_cost', 'accessory_cost',
    'labour_cost', 'fitting_cost', 'transport_cost', 'other_cost']
    .reduce((sum, key) => sum + num(payload[key]), 0);

  let discount = num(payload.discount);
  if (payload.discount_type === 'Percent') discount = gross * (discount / 100);

  const totalSelling = gross - discount;
  const totalCost = materialCost + extraCost;
  const profit = totalSelling - totalCost;
  const profitPercent = totalSelling > 0 ? (profit / totalSelling) * 100 : 0;
  const totalPaid = paidOverride !== undefined ? num(paidOverride) : num(payload.advance);
  const due = totalSelling - totalPaid;

  return {
    material_cost: round(materialCost),
    total_cost: round(totalCost),
    total_selling: round(totalSelling),
    estimated_profit: round(profit),
    profit_percent: round(profitPercent),
    total_paid: round(totalPaid),
    due: round(due),
  };
}

const round = (n) => Math.round(num(n) * 100) / 100;

/** Next order number for the configured prefix, e.g. SMTG-000003. */
async function nextOrderNumber() {
  const [setting] = await query('SELECT order_prefix FROM settings LIMIT 1');
  const prefix = setting?.order_prefix || 'SMTG';
  const rows = await query(
    `SELECT order_number FROM orders WHERE order_number LIKE ?
      ORDER BY order_number DESC LIMIT 1`,
    [`${prefix}-%`],
  );
  const last = rows.length ? Number(String(rows[0].order_number).split('-').pop()) : 0;
  return `${prefix}-${String((Number.isFinite(last) ? last : 0) + 1).padStart(6, '0')}`;
}

async function nextQuoteNumber() {
  const rows = await query(
    `SELECT quote_number FROM quotations WHERE quote_number LIKE 'QT-%'
      ORDER BY quote_number DESC LIMIT 1`,
  );
  const last = rows.length ? Number(String(rows[0].quote_number).split('-').pop()) : 0;
  return `QT-${String((Number.isFinite(last) ? last : 0) + 1).padStart(6, '0')}`;
}

async function nextCustomerCode() {
  const rows = await query(
    `SELECT customer_id FROM customers WHERE customer_id LIKE 'CUST-%'
      ORDER BY customer_id DESC LIMIT 1`,
  );
  const last = rows.length ? Number(String(rows[0].customer_id).split('-').pop()) : 0;
  return `CUST-${String((Number.isFinite(last) ? last : 0) + 1).padStart(5, '0')}`;
}

/** Denormalised customer/branch/staff labels the list views read straight off the order. */
async function withRelatedNames(payload) {
  const out = { ...payload };
  if (payload.customer_id) {
    const [c] = await query(
      'SELECT name, mobile, address FROM customers WHERE id = ? LIMIT 1', [payload.customer_id],
    );
    if (!c) throw badRequest('কাস্টমার পাওয়া যায়নি');
    out.customer_name = c.name;
    out.customer_mobile = c.mobile || '';
    out.customer_address = c.address || '';
  }
  if (payload.branch_id) {
    const [b] = await query('SELECT name FROM branches WHERE id = ? LIMIT 1', [payload.branch_id]);
    out.branch_name = b ? b.name : '';
  } else {
    out.branch_name = '';
  }
  if (payload.assigned_staff_id) {
    const [s] = await query('SELECT name FROM staff WHERE id = ? LIMIT 1', [payload.assigned_staff_id]);
    out.assigned_staff_name = s ? s.name : '';
  }
  return out;
}

/**
 * Create an order and, when an advance was collected, the matching payment —
 * both in one transaction so an order is never left with a phantom advance.
 */
async function createOrder(payload, user) {
  const base = await withRelatedNames(payload);
  if (!base.customer_id) throw badRequest('কাস্টমার নির্বাচন করুন');

  const items = parseItems(payload.items_json ?? payload.items);
  if (!items.length) throw badRequest('অন্তত একটি আইটেম যোগ করুন');

  const order_number = payload.order_number || (await nextOrderNumber());
  const totals = computeTotals(base, items);

  const data = {
    ...base,
    order_number,
    items_json: JSON.stringify(items),
    price_snapshot: payload.price_snapshot
      || JSON.stringify({ order_type: base.order_type, savedAt: new Date().toISOString(), items }),
    ...totals,
  };

  return transaction(async (conn) => {
    const order = await svc.create(Order, data, user.id, conn);

    if (num(payload.advance) > 0) {
      await svc.create(Payment, {
        order_id: order.id,
        order_number: order.order_number,
        customer_id: order.customer_id,
        customer_name: order.customer_name,
        branch_id: order.branch_id,
        branch_name: order.branch_name,
        date: order.order_date,
        amount: num(payload.advance),
        method: payload.advance_method || 'Cash',
        received_by: user.full_name,
        notes: 'Advance with order',
      }, user.id, conn);
    }

    await audit(conn, user, 'Order created', 'Order', order.id, null, {
      order_number: order.order_number, total_selling: order.total_selling,
    });
    return order;
  });
}

async function updateOrder(id, payload, user) {
  const before = await svc.get(Order, id);
  const base = await withRelatedNames({ ...before, ...payload });
  const items = parseItems(payload.items_json ?? payload.items ?? before.items_json);

  // Payments already recorded stay authoritative for total_paid.
  const [{ paid }] = await query(
    'SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE order_id = ? AND archived = 0',
    [id],
  );

  const totals = computeTotals(base, items, num(paid) || num(base.advance));
  const order = await svc.update(Order, id, {
    ...base, items_json: JSON.stringify(items), ...totals,
  });
  await audit(null, user, 'Order updated', 'Order', id, before, payload);
  return order;
}

/** Recompute total_paid/due from the payment rows — the single source of truth. */
async function syncOrderPaid(orderId, conn) {
  const runner = conn || { execute: (sql, p) => query(sql, p).then((r) => [r]) };
  const [rows] = await runner.execute(
    'SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE order_id = ? AND archived = 0',
    [orderId],
  );
  const paid = num(rows[0].paid);
  await runner.execute(
    'UPDATE orders SET total_paid = ?, due = GREATEST(total_selling - ?, 0) WHERE id = ?',
    [paid, paid, orderId],
  );
  return paid;
}

async function createPayment(payload, user) {
  if (!num(payload.amount)) throw badRequest('পেমেন্টের পরিমাণ দিন');

  return transaction(async (conn) => {
    const data = { ...payload, received_by: payload.received_by || user.full_name };

    if (payload.order_id) {
      const [o] = await query('SELECT * FROM orders WHERE id = ? LIMIT 1', [payload.order_id]);
      if (!o) throw notFound('অর্ডার পাওয়া যায়নি');
      data.order_number = o.order_number;
      data.customer_id = o.customer_id;
      data.customer_name = o.customer_name;
      data.branch_id = data.branch_id || o.branch_id;
      data.branch_name = data.branch_name || o.branch_name;
    } else if (payload.customer_id) {
      const [c] = await query('SELECT name FROM customers WHERE id = ? LIMIT 1', [payload.customer_id]);
      data.customer_name = c ? c.name : '';
    }

    const payment = await svc.create(Payment, data, user.id, conn);
    if (payment.order_id) await syncOrderPaid(payment.order_id, conn);
    await audit(conn, user, 'Payment added', 'Payment', payment.id, null,
      { amount: payment.amount });
    return payment;
  });
}

async function deletePayment(id, user) {
  const payment = await svc.get(Payment, id);
  return transaction(async (conn) => {
    await svc.remove(Payment, id, conn);
    if (payment.order_id) await syncOrderPaid(payment.order_id, conn);
    await audit(conn, user, 'Payment deleted', 'Payment', id, { amount: payment.amount }, null);
    return { id, deleted: true };
  });
}

/** Fire-and-forget audit row; never blocks the caller's write. */
async function audit(conn, user, action, recordType, recordId, oldValue, newValue) {
  const AuditLog = getEntity('AuditLog');
  const payload = {
    action,
    record_type: recordType,
    record_id: recordId,
    old_value: oldValue ? JSON.stringify(oldValue) : '',
    new_value: newValue ? JSON.stringify(newValue) : '',
    user_name: user?.full_name || '',
    datetime: new Date(),
  };
  try {
    await svc.create(AuditLog, payload, user?.id, conn || undefined);
  } catch (err) {
    console.error('audit failed:', err.message);
  }
}

module.exports = {
  computeTotals, nextOrderNumber, nextQuoteNumber, nextCustomerCode,
  createOrder, updateOrder, createPayment, deletePayment, syncOrderPaid, audit,
};

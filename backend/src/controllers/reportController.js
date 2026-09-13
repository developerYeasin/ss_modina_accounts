const { query } = require('../config/db');

const asyncH = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;

/** GET /api/reports/dashboard — the cards and chart on the home screen. */
const dashboard = asyncH(async (req, res) => {
  const day = req.query.date || today();
  const from = req.query.month_from || monthStart(new Date(day));
  const to = req.query.month_to || day;

  const [
    [todaySales], [todayPayments], [todayExpenses],
    [monthSales], [monthExpenses], [monthPayments],
    [totalDue], [orderCount], [customerCount], [purchaseDue],
    branchSales, statusBreakdown,
  ] = await Promise.all([
    query('SELECT COALESCE(SUM(total_selling),0) AS v FROM orders WHERE order_date = ? AND archived = 0', [day]),
    query('SELECT COALESCE(SUM(amount),0) AS v FROM payments WHERE date = ? AND archived = 0', [day]),
    query('SELECT COALESCE(SUM(amount),0) AS v FROM expenses WHERE date = ? AND archived = 0', [day]),
    query('SELECT COALESCE(SUM(total_selling),0) AS v FROM orders WHERE order_date BETWEEN ? AND ? AND archived = 0', [from, to]),
    query('SELECT COALESCE(SUM(amount),0) AS v FROM expenses WHERE date BETWEEN ? AND ? AND archived = 0', [from, to]),
    query('SELECT COALESCE(SUM(amount),0) AS v FROM payments WHERE date BETWEEN ? AND ? AND archived = 0', [from, to]),
    query('SELECT COALESCE(SUM(due),0) AS v FROM orders WHERE archived = 0'),
    query('SELECT COUNT(*) AS v FROM orders WHERE archived = 0'),
    query('SELECT COUNT(*) AS v FROM customers'),
    query('SELECT COALESCE(SUM(due),0) AS v FROM purchases'),
    query(`SELECT COALESCE(NULLIF(branch_name,''),'অন্যান্য') AS branch,
                  COALESCE(SUM(total_selling),0) AS total
             FROM orders WHERE archived = 0 GROUP BY branch ORDER BY total DESC`),
    query(`SELECT status, COUNT(*) AS count, COALESCE(SUM(total_selling),0) AS total
             FROM orders WHERE archived = 0 GROUP BY status`),
  ]);

  const n = (r) => Number(r.v);
  const [flow, before] = await Promise.all([cashFlow('=', day), cashFlow('<', day)]);
  res.json({
    date: day,
    today: {
      sales: n(todaySales),
      payments: n(todayPayments),
      expenses: n(todayExpenses),
      cash: before.net + flow.net,
    },
    month: {
      from, to,
      sales: n(monthSales),
      payments: n(monthPayments),
      expenses: n(monthExpenses),
      profit: n(monthSales) - n(monthExpenses),
    },
    totals: {
      due: n(totalDue),
      purchase_due: n(purchaseDue),
      orders: n(orderCount),
      customers: n(customerCount),
    },
    branch_sales: branchSales.map((r) => ({ branch: r.branch, total: Number(r.total) })),
    status_breakdown: statusBreakdown.map((r) => ({
      status: r.status, count: Number(r.count), total: Number(r.total),
    })),
  });
});

/**
 * Every movement of cash through the drawer, summed for one date condition.
 *
 *   in  = customer collections + owner investment + bank withdrawal + loan taken / loan repaid to us
 *   out = expenses (staff advance & salary are booked as expenses) + cash paid on purchases
 *       + supplier payments + owner withdrawal + bank deposit + loan given / loan repaid by us
 *
 * The daily sheet and its opening balance both come from here, so the জের carried
 * into tomorrow is always exactly today's closing cash.
 */
async function cashFlow(op, day) {
  const w = `date ${op} ?`;
  const [r] = await query(
      `SELECT
         (SELECT COALESCE(SUM(amount),0) FROM payments WHERE archived = 0 AND ${w}) AS collected,
         (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE archived = 0 AND ${w}) AS expenses,
         (SELECT COALESCE(SUM(paid),0) FROM purchases WHERE ${w}) AS purchase_paid,
         (SELECT COALESCE(SUM(amount),0) FROM supplier_payments WHERE ${w}) AS supplier_paid,
         (SELECT COALESCE(SUM(amount),0) FROM owner_txns WHERE flow = 'invest' AND ${w}) AS owner_invest,
         (SELECT COALESCE(SUM(amount),0) FROM owner_txns WHERE flow = 'withdraw' AND ${w}) AS owner_withdraw,
         (SELECT COALESCE(SUM(amount),0) FROM bank_txns WHERE flow = 'withdraw' AND ${w}) AS bank_withdraw,
         (SELECT COALESCE(SUM(amount),0) FROM bank_txns WHERE flow = 'deposit' AND ${w}) AS bank_deposit,
         (SELECT COALESCE(SUM(t.amount),0) FROM loan_txns t JOIN loans l ON l.id = t.loan_id
           WHERE t.${w} AND ((l.type = 'Borrowed' AND t.flow = 'increase')
                          OR (l.type = 'Lent' AND t.flow <> 'increase'))) AS loan_in,
         (SELECT COALESCE(SUM(t.amount),0) FROM loan_txns t JOIN loans l ON l.id = t.loan_id
           WHERE t.${w} AND ((l.type = 'Lent' AND t.flow = 'increase')
                          OR (l.type = 'Borrowed' AND t.flow <> 'increase'))) AS loan_out`,
    Array(11).fill(day),
  );
  const v = Object.fromEntries(Object.entries(r).map(([k, x]) => [k, Number(x)]));
  v.cash_in = v.collected + v.owner_invest + v.bank_withdraw + v.loan_in;
  v.cash_out = v.expenses + v.purchase_paid + v.supplier_paid + v.owner_withdraw
    + v.bank_deposit + v.loan_out;
  v.net = v.cash_in - v.cash_out;
  return v;
}

/** GET /api/reports/daily?date= — the "দৈনিক রিপোর্ট" screen. */
const daily = asyncH(async (req, res) => {
  const day = req.query.date || today();
  const [
    orders, payments, expenses, purchases, supplierPayments, ownerTxns, bankTxns, loanTxns,
    flow, before,
  ] = await Promise.all([
    query('SELECT * FROM orders WHERE order_date = ? AND archived = 0 ORDER BY created_date DESC', [day]),
    query('SELECT * FROM payments WHERE date = ? AND archived = 0 ORDER BY created_date DESC', [day]),
    query('SELECT * FROM expenses WHERE date = ? AND archived = 0 ORDER BY created_date DESC', [day]),
    query('SELECT * FROM purchases WHERE date = ? ORDER BY created_date DESC', [day]),
    query('SELECT * FROM supplier_payments WHERE date = ? ORDER BY created_date DESC', [day]),
    query('SELECT * FROM owner_txns WHERE date = ? ORDER BY created_date DESC', [day]),
    query('SELECT * FROM bank_txns WHERE date = ? ORDER BY created_date DESC', [day]),
    query(`SELECT t.*, l.type AS loan_type FROM loan_txns t JOIN loans l ON l.id = t.loan_id
            WHERE t.date = ? ORDER BY t.created_date DESC`, [day]),
    cashFlow('=', day),
    // গতকালের জের: every earlier day's cash in minus cash out.
    cashFlow('<', day),
  ]);
  const sum = (rows, key) => rows.reduce((a, r) => a + Number(r[key] || 0), 0);
  const openingCash = before.net;
  res.json({
    date: day,
    orders, payments, expenses, purchases,
    supplier_payments: supplierPayments,
    owner_txns: ownerTxns,
    bank_txns: bankTxns,
    loan_txns: loanTxns,
    summary: {
      sales: sum(orders, 'total_selling'),
      new_due: sum(orders, 'due'),
      purchases: sum(purchases, 'total_cost'),
      ...flow,
      opening_cash: openingCash,
      net_cash: flow.net,
      closing_cash: openingCash + flow.net,
    },
  });
});

/** GET /api/reports/range?from=&to=&branch_id= — the রিপোর্ট tabs. */
const range = asyncH(async (req, res) => {
  const from = req.query.from || monthStart();
  const to = req.query.to || today();
  const branch = req.query.branch_id || null;
  const bClause = branch ? ' AND branch_id = ?' : '';
  const bArg = branch ? [branch] : [];

  const [sales, payments, expenses, byType, byDay, topCustomers] = await Promise.all([
    query(`SELECT COUNT(*) AS orders, COALESCE(SUM(total_selling),0) AS sales,
                  COALESCE(SUM(total_cost),0) AS cost,
                  COALESCE(SUM(estimated_profit),0) AS profit,
                  COALESCE(SUM(due),0) AS due
             FROM orders WHERE archived = 0 AND order_date BETWEEN ? AND ?${bClause}`,
    [from, to, ...bArg]),
    query(`SELECT COALESCE(SUM(amount),0) AS collected FROM payments
             WHERE archived = 0 AND date BETWEEN ? AND ?${bClause}`, [from, to, ...bArg]),
    query(`SELECT category, COALESCE(SUM(amount),0) AS total FROM expenses
             WHERE archived = 0 AND date BETWEEN ? AND ?${bClause}
             GROUP BY category ORDER BY total DESC`, [from, to, ...bArg]),
    query(`SELECT order_type, COUNT(*) AS orders, COALESCE(SUM(total_selling),0) AS total
             FROM orders WHERE archived = 0 AND order_date BETWEEN ? AND ?${bClause}
             GROUP BY order_type`, [from, to, ...bArg]),
    query(`SELECT order_date AS date, COALESCE(SUM(total_selling),0) AS sales,
                  COUNT(*) AS orders
             FROM orders WHERE archived = 0 AND order_date BETWEEN ? AND ?${bClause}
             GROUP BY order_date ORDER BY order_date`, [from, to, ...bArg]),
    query(`SELECT customer_id, customer_name,
                  COUNT(*) AS orders,
                  COALESCE(SUM(total_selling),0) AS total,
                  COALESCE(SUM(due),0) AS due
             FROM orders WHERE archived = 0 AND order_date BETWEEN ? AND ?${bClause}
             GROUP BY customer_id, customer_name ORDER BY total DESC LIMIT 20`,
    [from, to, ...bArg]),
  ]);

  const expenseTotal = expenses.reduce((a, r) => a + Number(r.total), 0);
  res.json({
    from, to, branch_id: branch,
    summary: {
      orders: Number(sales[0].orders),
      sales: Number(sales[0].sales),
      cost: Number(sales[0].cost),
      profit: Number(sales[0].profit),
      due: Number(sales[0].due),
      collected: Number(payments[0].collected),
      expenses: expenseTotal,
      net: Number(payments[0].collected) - expenseTotal,
    },
    expense_breakdown: expenses.map((r) => ({ category: r.category, total: Number(r.total) })),
    by_type: byType.map((r) => ({
      order_type: r.order_type, orders: Number(r.orders), total: Number(r.total),
    })),
    by_day: byDay.map((r) => ({
      date: r.date, sales: Number(r.sales), orders: Number(r.orders),
    })),
    top_customers: topCustomers.map((r) => ({
      customer_id: r.customer_id, customer_name: r.customer_name,
      orders: Number(r.orders), total: Number(r.total), due: Number(r.due),
    })),
  });
});

/** GET /api/reports/due — outstanding balance per customer. */
const dueList = asyncH(async (_req, res) => {
  const rows = await query(
    `SELECT o.customer_id, o.customer_name, c.mobile, c.village, c.branch_name,
            COUNT(*) AS orders, COALESCE(SUM(o.due),0) AS due,
            MAX(o.order_date) AS last_order
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.archived = 0 AND o.due > 0
      GROUP BY o.customer_id, o.customer_name, c.mobile, c.village, c.branch_name
      ORDER BY due DESC`,
  );
  res.json(rows.map((r) => ({ ...r, orders: Number(r.orders), due: Number(r.due) })));
});

/** GET /api/reports/customer/:id/statement — ledger for one customer. */
const customerStatement = asyncH(async (req, res) => {
  const id = req.params.id;
  const [customer] = await query('SELECT * FROM customers WHERE id = ? LIMIT 1', [id]);
  if (!customer) return res.status(404).json({ error: true, message: 'কাস্টমার পাওয়া যায়নি' });

  const [orders, payments] = await Promise.all([
    query('SELECT * FROM orders WHERE customer_id = ? AND archived = 0 ORDER BY order_date, created_date', [id]),
    query('SELECT * FROM payments WHERE customer_id = ? AND archived = 0 ORDER BY date, created_date', [id]),
  ]);

  const entries = [
    ...orders.map((o) => ({
      date: o.order_date, type: 'order', ref: o.order_number,
      description: o.description || o.order_type, debit: Number(o.total_selling), credit: 0,
    })),
    ...payments.map((p) => ({
      date: p.date, type: 'payment', ref: p.order_number || '',
      description: p.notes || p.method, debit: 0, credit: Number(p.amount),
    })),
  ].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  let balance = Number(customer.opening_due || 0);
  const ledger = entries.map((e) => {
    balance += e.debit - e.credit;
    return { ...e, balance };
  });

  res.json({
    customer,
    opening_due: Number(customer.opening_due || 0),
    ledger,
    totals: {
      billed: orders.reduce((a, o) => a + Number(o.total_selling), 0),
      paid: payments.reduce((a, p) => a + Number(p.amount), 0),
      balance,
    },
  });
});

/**
 * GET /api/reports/expense-monthly?year=&category=
 *
 * Category × month grid for one year: how much গাড়ি ভাড়া, দোকান ভাড়া, লাঞ্চ
 * and every other head cost each month, with row and column totals — the
 * monthly view that sits on top of the daily খরচ entries.
 */
const expenseMonthly = asyncH(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const category = req.query.category || null;

  const params = [year];
  let filter = '';
  if (category) {
    filter = ' AND category = ?';
    params.push(category);
  }

  const rows = await query(
    `SELECT category, MONTH(date) AS month,
            COALESCE(SUM(amount), 0) AS total, COUNT(*) AS entries
       FROM expenses
      WHERE archived = 0 AND YEAR(date) = ?${filter}
      GROUP BY category, MONTH(date)
      ORDER BY category`,
    params,
  );

  // category -> { months: [12], total, entries }
  const byCategory = new Map();
  const monthTotals = Array(12).fill(0);

  for (const r of rows) {
    const cur = byCategory.get(r.category)
      || { category: r.category, months: Array(12).fill(0), total: 0, entries: 0 };
    const idx = Number(r.month) - 1;
    cur.months[idx] += Number(r.total);
    cur.total += Number(r.total);
    cur.entries += Number(r.entries);
    byCategory.set(r.category, cur);
    monthTotals[idx] += Number(r.total);
  }

  const categories = [...byCategory.values()].sort((a, b) => b.total - a.total);

  res.json({
    year,
    category,
    categories,
    month_totals: monthTotals,
    total: monthTotals.reduce((a, b) => a + b, 0),
    // Handy for the chart: one row per month with every category as a key.
    by_month: monthTotals.map((total, i) => {
      const row = { month: i + 1, total };
      categories.forEach((c) => { row[c.category] = c.months[i]; });
      return row;
    }),
  });
});

/**
 * GET /api/reports/expense-category?category=&from=&to=
 * Every entry under one head, for the drill-down from the monthly grid.
 */
const expenseByCategory = asyncH(async (req, res) => {
  const { category } = req.query;
  if (!category) return res.status(400).json({ error: true, message: 'category দিন' });
  const from = req.query.from || `${new Date().getFullYear()}-01-01`;
  const to = req.query.to || today();

  const rows = await query(
    `SELECT * FROM expenses
      WHERE archived = 0 AND category = ? AND date BETWEEN ? AND ?
      ORDER BY date DESC, created_date DESC`,
    [category, from, to],
  );
  res.json({
    category,
    from,
    to,
    entries: rows,
    total: rows.reduce((a, r) => a + Number(r.amount), 0),
  });
});

/** GET /api/reports/search?q= — the global search screen. */
const globalSearch = asyncH(async (req, res) => {
  const q = `%${String(req.query.q || '').trim()}%`;
  if (q === '%%') return res.json({ customers: [], orders: [], suppliers: [] });
  const [customers, orders, suppliers] = await Promise.all([
    query(`SELECT * FROM customers
            WHERE name LIKE ? OR mobile LIKE ? OR customer_id LIKE ? OR village LIKE ?
            LIMIT 25`, [q, q, q, q]),
    query(`SELECT * FROM orders
            WHERE order_number LIKE ? OR customer_name LIKE ? OR customer_mobile LIKE ?
            ORDER BY created_date DESC LIMIT 25`, [q, q, q]),
    query('SELECT * FROM suppliers WHERE name LIKE ? OR mobile LIKE ? LIMIT 25', [q, q]),
  ]);
  res.json({ customers, orders, suppliers });
});

module.exports = {
  dashboard, daily, range, dueList, customerStatement, globalSearch,
  expenseMonthly, expenseByCategory,
};

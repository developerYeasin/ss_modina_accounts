const { Router } = require('express');
const rateLimit = require('express-rate-limit');

const { authenticate, requireRole } = require('../middleware/auth');
const auth = require('../controllers/authController');
const entity = require('../controllers/entityController');
const domain = require('../controllers/domainController');
const reports = require('../controllers/reportController');
const { registry } = require('../models/registry');

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: true, message: 'অনেকবার চেষ্টা করা হয়েছে, কিছুক্ষণ পরে আবার দিন' },
});

// ---------------- public ----------------
router.get('/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
router.post('/auth/register', loginLimiter, auth.register);
router.post('/auth/login', loginLimiter, auth.login);

// everything below needs a token
router.use(authenticate);

// ---------------- account ----------------
router.get('/auth/me', auth.me);
router.patch('/auth/me', auth.updateMe);
router.post('/auth/change-password', auth.changePassword);

// ---------------- users (admin) ----------------
router.get('/users', requireRole('admin'), auth.listUsers);
router.post('/users', requireRole('admin'), auth.createUser);
router.patch('/users/:id', requireRole('admin'), auth.updateUser);
router.delete('/users/:id', requireRole('admin'), auth.deleteUser);

// ---------------- reports ----------------
router.get('/reports/dashboard', reports.dashboard);
router.get('/reports/daily', reports.daily);
router.get('/reports/range', reports.range);
router.get('/reports/due', reports.dueList);
router.get('/reports/expense-monthly', reports.expenseMonthly);
router.get('/reports/expense-category', reports.expenseByCategory);
router.get('/reports/customer/:id/statement', reports.customerStatement);
router.get('/search', reports.globalSearch);

// ---------------- domain routes (business rules live here) ----------------
router.get('/orders/next-number', domain.nextNumber);
router.post('/orders', domain.createOrder);
router.get('/orders/:id/detail', domain.orderDetail);
router.patch('/orders/:id', domain.updateOrder);
router.patch('/orders/:id/status', domain.updateOrderStatus);

router.post('/payments', domain.createPayment);
router.delete('/payments/:id', domain.deletePayment);

router.post('/customers', domain.createCustomer);
router.patch('/customers/:id', domain.updateCustomer);
router.get('/customers/:id/detail', domain.customerDetail);

router.post('/purchases', domain.createPurchase);
router.get('/suppliers/due', domain.supplierDueList);
router.get('/suppliers/:id/detail', domain.supplierDetail);
router.post('/suppliers/:id/payments', domain.createSupplierPayment);
router.delete('/suppliers/:id/payments/:paymentId', domain.deleteSupplierPayment);

router.get('/loans/:id/detail', domain.loanDetail);
router.post('/loans/:id/txns', domain.createLoanTxn);

router.post('/stock', domain.createStockItem);
router.post('/stock/:id/adjust', domain.adjustStock);

router.get('/quotations/next-number', domain.nextQuote);
router.post('/quotations', domain.createQuotation);
router.post('/quotations/:id/convert', domain.convertQuotation);

router.get('/salary/sheet', domain.salarySheet);
router.post('/salary/sheet', requireRole('manager'), domain.saveSalarySheet);
router.get('/salary/advances', domain.staffAdvanceReport);
router.post('/salary/advances', requireRole('manager'), domain.createStaffAdvance);
router.delete('/salary/advances/:id', requireRole('manager'), domain.deleteStaffAdvance);

router.get('/price-catalog', domain.priceCatalog);

// ---------------- generic entity CRUD ----------------
router.get('/entities', (_req, res) => {
  res.json(Object.entries(registry).map(([name, def]) => ({
    name,
    table: def.table,
    fields: Object.keys(def.fields),
    sort: def.sort || '-created_date',
    searchable: def.search || [],
  })));
});

router.use('/entities/:entity', entity.resolveEntity);
router.get('/entities/:entity', entity.listRecords);
router.get('/entities/:entity/count', entity.countRecords);
router.get('/entities/:entity/:id', entity.getRecord);
router.post('/entities/:entity', entity.createRecord);
router.patch('/entities/:entity/:id', entity.updateRecord);
router.put('/entities/:entity/:id', entity.updateRecord);
router.delete('/entities/:entity/:id', entity.deleteRecord);

module.exports = router;

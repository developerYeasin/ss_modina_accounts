import { api, toQuery } from './client';

/**
 * One thin client per entity, generated from the entity name.
 *
 *   Order.list('-created_date', 500)
 *   Order.filter({ status: 'New' }, '-order_date')
 *   Order.get(id) / create(data) / update(id, data) / delete(id)
 */
function entityClient(name) {
  const base = `/entities/${name}`;
  return {
    name,
    list: (sort, limit = 500) => api.get(`${base}${toQuery({ sort, limit })}`),
    filter: (filter, sort, limit = 500) => api.get(`${base}${toQuery({ filter, sort, limit })}`),
    search: (search, sort, limit = 100) => api.get(`${base}${toQuery({ search, sort, limit })}`),
    count: (filter) => api.get(`${base}/count${toQuery({ filter })}`).then((r) => r.count),
    get: (id) => api.get(`${base}/${id}`),
    create: (data) => api.post(base, data),
    bulkCreate: (rows) => api.post(base, rows),
    update: (id, data) => api.patch(`${base}/${id}`, data),
    delete: (id) => api.del(`${base}/${id}`),
  };
}

export const Setting = entityClient('Setting');
export const Branch = entityClient('Branch');
export const Customer = entityClient('Customer');
export const Staff = entityClient('Staff');
export const Supplier = entityClient('Supplier');
export const Order = entityClient('Order');
export const Payment = entityClient('Payment');
export const Expense = entityClient('Expense');
export const Purchase = entityClient('Purchase');
export const Loan = entityClient('Loan');
export const LoanTxn = entityClient('LoanTxn');
export const StockItem = entityClient('StockItem');
export const StockAdjustment = entityClient('StockAdjustment');
export const AluminiumProfile = entityClient('AluminiumProfile');
export const SSMaterial = entityClient('SSMaterial');
export const GlassPrice = entityClient('GlassPrice');
export const Accessory = entityClient('Accessory');
export const LabourSetting = entityClient('LabourSetting');
export const PriceHistory = entityClient('PriceHistory');
export const SalaryEntry = entityClient('SalaryEntry');
export const Quotation = entityClient('Quotation');
export const StaffAdvance = entityClient('StaffAdvance');
export const SupplierPayment = entityClient('SupplierPayment');
export const AuditLog = entityClient('AuditLog');
export const OwnerTxn = entityClient('OwnerTxn');
export const BankAccount = entityClient('BankAccount');
export const BankTxn = entityClient('BankTxn');
export const BranchTransfer = entityClient('BranchTransfer');

/** Endpoints that carry business rules, so the UI never recomputes them. */
export const Auth = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  updateMe: (data) => api.patch('/auth/me', data),
  changePassword: (data) => api.post('/auth/change-password', data),
};

export const Users = {
  list: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.patch(`/users/${id}`, data),
  delete: (id) => api.del(`/users/${id}`),
};

export const Orders = {
  nextNumber: () => api.get('/orders/next-number'),
  create: (data) => api.post('/orders', data),
  update: (id, data) => api.patch(`/orders/${id}`, data),
  detail: (id) => api.get(`/orders/${id}/detail`),
  setStatus: (id, status) => api.patch(`/orders/${id}/status`, { status }),
};

export const Payments = {
  create: (data) => api.post('/payments', data),
  update: (id, data) => api.patch(`/payments/${id}`, data),
  receipt: (id) => api.get(`/payments/${id}/receipt`),
  delete: (id) => api.del(`/payments/${id}`),
};

export const Customers = {
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.patch(`/customers/${id}`, data),
  detail: (id) => api.get(`/customers/${id}/detail`),
  statement: (id) => api.get(`/reports/customer/${id}/statement`),
};

export const Purchases = {
  create: (data) => api.post('/purchases', data),
  update: (id, data) => api.patch(`/purchases/${id}`, data),
};

export const Suppliers = {
  detail: (id) => api.get(`/suppliers/${id}/detail`),
  dueList: () => api.get('/suppliers/due'),
  addPayment: (id, data) => api.post(`/suppliers/${id}/payments`, data),
  updatePayment: (paymentId, data) => api.patch(`/entities/SupplierPayment/${paymentId}`, data),
  deletePayment: (id, paymentId) => api.del(`/suppliers/${id}/payments/${paymentId}`),
};

export const Loans = {
  detail: (id) => api.get(`/loans/${id}/detail`),
  addTxn: (id, data) => api.post(`/loans/${id}/txns`, data),
  updateTxn: (id, txnId, data) => api.patch(`/loans/${id}/txns/${txnId}`, data),
  deleteTxn: (id, txnId) => api.del(`/loans/${id}/txns/${txnId}`),
};

export const Stock = {
  create: (data) => api.post('/stock', data),
  adjust: (id, data) => api.post(`/stock/${id}/adjust`, data),
};

export const Quotations = {
  nextNumber: () => api.get('/quotations/next-number'),
  create: (data) => api.post('/quotations', data),
  update: (id, data) => api.patch(`/quotations/${id}`, data),
  convert: (id) => api.post(`/quotations/${id}/convert`),
};

export const Salary = {
  sheet: (year, month) => api.get(`/salary/sheet${toQuery({ year, month })}`),
  save: (payload) => api.post('/salary/sheet', payload),
  advances: (year, month) => api.get(`/salary/advances${toQuery({ year, month })}`),
  addAdvance: (data) => api.post('/salary/advances', data),
  updateAdvance: (id, data) => api.patch(`/salary/advances/${id}`, data),
  deleteAdvance: (id) => api.del(`/salary/advances/${id}`),
};

export const Reports = {
  dashboard: (params) => api.get(`/reports/dashboard${toQuery(params)}`),
  daily: (date) => api.get(`/reports/daily${toQuery({ date })}`),
  range: (params) => api.get(`/reports/range${toQuery(params)}`),
  due: () => api.get('/reports/due'),
  expenseMonthly: (params) => api.get(`/reports/expense-monthly${toQuery(params)}`),
  expenseCategory: (params) => api.get(`/reports/expense-category${toQuery(params)}`),
};

export const Search = { global: (q) => api.get(`/search${toQuery({ q })}`) };
export const PriceCatalog = { get: () => api.get('/price-catalog') };

/**
 * Entity registry.
 *
 * Every entity exposed at /api/entities/:Entity is declared here. The generic
 * CRUD controller reads this metadata, so adding an entity is a config change,
 * not new controller code.
 *
 *   table   - MySQL table name
 *   fields  - writable columns and their coercion type
 *   search  - columns scanned by ?search=
 *   sort    - default ORDER BY when the caller does not pass one
 *   roles   - { write, delete } minimum role, defaults to 'user'
 */

const N = 'number';
const S = 'string';
const B = 'boolean';
const D = 'date';
const T = 'datetime';
const J = 'json'; // stored as LONGTEXT, transported as a JSON string

const registry = {
  Setting: {
    table: 'settings',
    singleton: true,
    roles: { write: 'admin', delete: 'admin' },
    fields: {
      business_name: S, short_name: S, subtitle: S, logo_url: S, address: S,
      phone: S, proprietor: S, proprietor_phone: S, manager: S, manager_phone: S,
      currency: S, order_prefix: S, invoice_footer: S, expense_categories: J,
      lunch_rate: N, default_tax: N, rounding: S,
    },
  },

  Branch: {
    table: 'branches',
    sort: 'name',
    search: ['name', 'address', 'manager'],
    roles: { write: 'manager', delete: 'admin' },
    fields: { name: S, address: S, phone: S, manager: S, notes: S, active: B },
  },

  Customer: {
    table: 'customers',
    sort: '-created_date',
    search: ['name', 'mobile', 'alt_mobile', 'customer_id', 'village', 'area', 'address'],
    fields: {
      customer_id: S, name: S, mobile: S, alt_mobile: S, address: S, village: S,
      area: S, branch_id: S, branch_name: S, type: S, status: S, opening_due: N,
      photo_url: S, notes: S,
    },
  },

  Staff: {
    table: 'staff',
    sort: '-created_date',
    search: ['name', 'position', 'phone'],
    roles: { write: 'manager', delete: 'admin' },
    fields: { name: S, position: S, phone: S, base_salary: N, joined_date: D, active: B, notes: S },
  },

  Supplier: {
    table: 'suppliers',
    sort: '-created_date',
    search: ['name', 'mobile', 'business', 'materials_supplied'],
    fields: {
      name: S, mobile: S, address: S, business: S, materials_supplied: S,
      opening_due: N, notes: S,
    },
  },

  SupplierPayment: {
    table: 'supplier_payments',
    sort: '-date',
    search: ['supplier_name', 'reference', 'notes'],
    fields: {
      supplier_id: S, supplier_name: S, date: D, amount: N, method: S,
      reference: S, notes: S,
    },
  },

  StaffAdvance: {
    table: 'staff_advances',
    sort: '-date',
    search: ['staff_name', 'notes'],
    roles: { write: 'manager', delete: 'manager' },
    fields: {
      staff_id: S, staff_name: S, date: D, year: N, month: N, amount: N,
      method: S, expense_id: S, notes: S,
    },
  },

  Order: {
    table: 'orders',
    sort: '-created_date',
    search: ['order_number', 'customer_name', 'customer_mobile', 'description'],
    fields: {
      order_number: S, customer_id: S, customer_name: S, customer_mobile: S,
      customer_address: S, branch_id: S, branch_name: S, order_date: D,
      expected_delivery: D, order_type: S, status: S, description: S, notes: S,
      assigned_staff_id: S, assigned_staff_name: S, items_json: J, price_snapshot: J,
      material_cost: N, aluminium_cost: N, ss_cost: N, glass_cost: N, accessory_cost: N,
      labour_cost: N, fitting_cost: N, transport_cost: N, other_cost: N,
      total_cost: N, total_selling: N, discount: N, discount_type: S, advance: N,
      total_paid: N, due: N, estimated_profit: N, profit_percent: N,
      is_draft: B, archived: B,
    },
  },

  Payment: {
    table: 'payments',
    sort: '-created_date',
    search: ['order_number', 'customer_name', 'reference', 'received_by'],
    fields: {
      order_id: S, order_number: S, customer_id: S, customer_name: S, branch_id: S,
      branch_name: S, date: D, amount: N, method: S, reference: S, received_by: S,
      notes: S, archived: B,
    },
  },

  Expense: {
    table: 'expenses',
    sort: '-created_date',
    search: ['category', 'description', 'person'],
    fields: {
      date: D, category: S, description: S, amount: N, method: S, person: S,
      branch_id: S, branch_name: S, notes: S, archived: B,
    },
  },

  Purchase: {
    table: 'purchases',
    sort: '-created_date',
    search: ['material', 'supplier_name'],
    fields: {
      supplier_id: S, supplier_name: S, branch_id: S, branch_name: S, date: D,
      material: S, quantity: N, unit: S, unit_cost: N, total_cost: N, paid: N,
      due: N, notes: S,
    },
  },

  Loan: {
    table: 'loans',
    sort: '-created_date',
    search: ['name', 'mobile', 'address'],
    fields: { name: S, mobile: S, address: S, type: S, balance: N, notes: S },
  },

  LoanTxn: {
    table: 'loan_txns',
    sort: '-created_date',
    search: ['person_name', 'notes'],
    fields: { loan_id: S, person_name: S, date: D, flow: S, amount: N, method: S, notes: S },
  },

  StockItem: {
    table: 'stock_items',
    sort: 'name',
    search: ['name', 'category'],
    fields: {
      name: S, category: S, unit: S, opening_stock: N, current_stock: N,
      minimum_stock: N, price: N, notes: S,
    },
  },

  StockAdjustment: {
    table: 'stock_adjustments',
    sort: '-created_date',
    search: ['stock_name', 'reason'],
    fields: {
      stock_id: S, stock_name: S, date: D, quantity: N, type: S, rate: N, amount: N,
      payment_id: S, reason: S, notes: S,
    },
  },

  OwnerTxn: {
    table: 'owner_txns',
    sort: '-date',
    search: ['owner_name', 'notes'],
    roles: { write: 'manager', delete: 'manager' },
    fields: { date: D, flow: S, amount: N, method: S, owner_name: S, notes: S },
  },

  BankAccount: {
    table: 'bank_accounts',
    sort: 'name',
    search: ['name', 'bank_name', 'account_no'],
    roles: { write: 'manager', delete: 'admin' },
    fields: {
      name: S, bank_name: S, account_no: S, branch: S, opening_balance: N, notes: S, active: B,
    },
  },

  BankTxn: {
    table: 'bank_txns',
    sort: '-date',
    search: ['account_name', 'reference', 'notes'],
    roles: { write: 'manager', delete: 'manager' },
    fields: {
      account_id: S, account_name: S, date: D, flow: S, amount: N, reference: S, notes: S,
    },
  },

  BranchTransfer: {
    table: 'branch_transfers',
    sort: '-date',
    search: ['from_branch_name', 'to_branch_name', 'sent_by', 'notes'],
    roles: { write: 'user', delete: 'manager' },
    fields: {
      date: D, from_branch_id: S, from_branch_name: S, to_branch_id: S, to_branch_name: S,
      items_json: J, total_amount: N, sent_by: S, notes: S,
    },
  },

  AluminiumProfile: {
    table: 'aluminium_profiles',
    sort: 'profile_name',
    search: ['profile_name', 'profile_type'],
    roles: { write: 'manager', delete: 'admin' },
    fields: {
      profile_name: S, profile_type: S, formula: S, price_per_foot: N, price_per_kg: N,
      price_per_piece: N, length_per_piece: N, pieces_per_window: N,
      cutting_deduction: N, waste_percent: N, description: S, notes: S, active: B,
    },
  },

  SSMaterial: {
    table: 'ss_materials',
    sort: 'material_name',
    search: ['material_name', 'grade', 'size', 'supplier'],
    roles: { write: 'manager', delete: 'admin' },
    fields: {
      material_name: S, grade: S, size: S, length: N, unit: S, price_type: S,
      price: N, supplier: S, notes: S, active: B,
    },
  },

  GlassPrice: {
    table: 'glass_prices',
    sort: 'glass_type',
    search: ['glass_type', 'thickness'],
    roles: { write: 'manager', delete: 'admin' },
    fields: {
      glass_type: S, thickness: S, rate: N, rate_unit: S, cutting_cost: N,
      fitting_cost: N, notes: S, active: B,
    },
  },

  Accessory: {
    table: 'accessories',
    sort: 'name',
    search: ['name'],
    roles: { write: 'manager', delete: 'admin' },
    fields: { name: S, unit: S, unit_price: N, notes: S, active: B },
  },

  LabourSetting: {
    table: 'labour_settings',
    sort: 'label',
    search: ['label', 'category'],
    roles: { write: 'manager', delete: 'admin' },
    fields: { label: S, category: S, rate: N, rate_unit: S, notes: S, active: B },
  },

  PriceHistory: {
    table: 'price_history',
    sort: '-created_date',
    search: ['item_name', 'entity_type'],
    fields: {
      entity_type: S, item_id: S, item_name: S, field: S, old_value: S,
      new_value: S, changed_by: S, datetime: T,
    },
  },

  SalaryEntry: {
    table: 'salary_entries',
    sort: '-created_date',
    search: ['staff_name', 'position'],
    roles: { write: 'manager', delete: 'admin' },
    fields: {
      staff_id: S, staff_name: S, position: S, year: N, month: N,
      base_salary_snapshot: N, duty_days: N, absent_days: N, friday_count: N,
      lunch_days: N, lunch_allowance: N, advance: N, owner_due: N,
      previous_due: N, net_payment: N, due_amount: N,
    },
  },

  Quotation: {
    table: 'quotations',
    sort: '-created_date',
    search: ['quote_number', 'customer_name', 'customer_mobile'],
    fields: {
      quote_number: S, customer_id: S, customer_name: S, customer_mobile: S,
      date: D, valid_until: D, status: S, items_json: J, subtotal: N,
      discount: N, discount_type: S, other_cost: N, total: N, notes: S,
    },
  },

  AuditLog: {
    table: 'audit_logs',
    sort: '-created_date',
    search: ['action', 'record_type', 'user_name'],
    roles: { write: 'user', delete: 'admin' },
    fields: {
      action: S, record_type: S, record_id: S, old_value: S, new_value: S,
      user_name: S, datetime: T,
    },
  },
};

/** Case-insensitive lookup so /entities/order and /entities/Order both work. */
function getEntity(name) {
  if (!name) return null;
  if (registry[name]) return { name, ...registry[name] };
  const key = Object.keys(registry).find((k) => k.toLowerCase() === String(name).toLowerCase());
  return key ? { name: key, ...registry[key] } : null;
}

module.exports = { registry, getEntity, types: { N, S, B, D, T, J } };

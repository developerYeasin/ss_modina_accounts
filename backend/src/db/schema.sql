-- ============================================================
-- SS Modina হিসাব — MySQL schema
-- ============================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------- Users & Auth ----------
CREATE TABLE IF NOT EXISTS users (
  id            CHAR(24) NOT NULL PRIMARY KEY,
  full_name     VARCHAR(150) NOT NULL,
  email         VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin','manager','user') NOT NULL DEFAULT 'user',
  phone         VARCHAR(30) NULL,
  photo_url     VARCHAR(500) NULL,
  branch_id     CHAR(24) NULL,
  active        TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_id CHAR(24) NULL,
  INDEX idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Settings ----------
CREATE TABLE IF NOT EXISTS settings (
  id                 CHAR(24) NOT NULL PRIMARY KEY,
  business_name      VARCHAR(190) NULL,
  short_name         VARCHAR(120) NULL,
  subtitle           VARCHAR(190) NULL,
  logo_url           VARCHAR(500) NULL,
  address            VARCHAR(255) NULL,
  phone              VARCHAR(60) NULL,
  proprietor         VARCHAR(150) NULL,
  proprietor_phone   VARCHAR(60) NULL,
  manager            VARCHAR(150) NULL,
  manager_phone      VARCHAR(60) NULL,
  currency           VARCHAR(10) NOT NULL DEFAULT '৳',
  order_prefix       VARCHAR(20) NOT NULL DEFAULT 'SMTG',
  invoice_footer     TEXT NULL,
  expense_categories LONGTEXT NULL,
  lunch_rate         DECIMAL(14,2) NOT NULL DEFAULT 0,
  default_tax        DECIMAL(8,2) NOT NULL DEFAULT 0,
  rounding           VARCHAR(20) NOT NULL DEFAULT 'None',
  created_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_id CHAR(24) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Branches ----------
CREATE TABLE IF NOT EXISTS branches (
  id        CHAR(24) NOT NULL PRIMARY KEY,
  name      VARCHAR(190) NOT NULL,
  address   VARCHAR(255) NULL,
  phone     VARCHAR(60) NULL,
  manager   VARCHAR(150) NULL,
  notes     TEXT NULL,
  active    TINYINT(1) NOT NULL DEFAULT 1,
  created_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_id CHAR(24) NULL,
  INDEX idx_branch_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Customers ----------
CREATE TABLE IF NOT EXISTS customers (
  id           CHAR(24) NOT NULL PRIMARY KEY,
  customer_id  VARCHAR(30) NULL,
  name         VARCHAR(190) NOT NULL,
  mobile       VARCHAR(30) NULL,
  alt_mobile   VARCHAR(30) NULL,
  address      VARCHAR(255) NULL,
  village      VARCHAR(150) NULL,
  area         VARCHAR(150) NULL,
  branch_id    CHAR(24) NULL,
  branch_name  VARCHAR(190) NULL,
  type         VARCHAR(40) NOT NULL DEFAULT 'Regular',
  status       VARCHAR(20) NOT NULL DEFAULT 'Active',
  opening_due  DECIMAL(14,2) NOT NULL DEFAULT 0,
  photo_url    VARCHAR(500) NULL,
  notes        TEXT NULL,
  created_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_id CHAR(24) NULL,
  UNIQUE KEY uq_customer_code (customer_id),
  INDEX idx_customer_name (name),
  INDEX idx_customer_mobile (mobile),
  INDEX idx_customer_branch (branch_id),
  CONSTRAINT fk_customer_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Staff ----------
CREATE TABLE IF NOT EXISTS staff (
  id          CHAR(24) NOT NULL PRIMARY KEY,
  name        VARCHAR(190) NOT NULL,
  position    VARCHAR(120) NULL,
  phone       VARCHAR(30) NULL,
  base_salary DECIMAL(14,2) NOT NULL DEFAULT 0,
  joined_date DATE NULL,
  active      TINYINT(1) NOT NULL DEFAULT 1,
  notes       TEXT NULL,
  created_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_id CHAR(24) NULL,
  INDEX idx_staff_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Suppliers ----------
CREATE TABLE IF NOT EXISTS suppliers (
  id                 CHAR(24) NOT NULL PRIMARY KEY,
  name               VARCHAR(190) NOT NULL,
  mobile             VARCHAR(30) NULL,
  address            VARCHAR(255) NULL,
  business           VARCHAR(190) NULL,
  materials_supplied VARCHAR(255) NULL,
  notes              TEXT NULL,
  created_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_id CHAR(24) NULL,
  INDEX idx_supplier_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Orders ----------
CREATE TABLE IF NOT EXISTS orders (
  id                 CHAR(24) NOT NULL PRIMARY KEY,
  order_number       VARCHAR(40) NOT NULL,
  customer_id        CHAR(24) NULL,
  customer_name      VARCHAR(190) NULL,
  customer_mobile    VARCHAR(30) NULL,
  customer_address   VARCHAR(255) NULL,
  branch_id          CHAR(24) NULL,
  branch_name        VARCHAR(190) NULL,
  order_date         DATE NULL,
  expected_delivery  DATE NULL,
  order_type         VARCHAR(40) NOT NULL DEFAULT 'Thai Glass',
  status             VARCHAR(30) NOT NULL DEFAULT 'New',
  description        TEXT NULL,
  notes              TEXT NULL,
  assigned_staff_id  CHAR(24) NULL,
  assigned_staff_name VARCHAR(190) NULL,
  items_json         LONGTEXT NULL,
  price_snapshot     LONGTEXT NULL,
  material_cost      DECIMAL(14,2) NOT NULL DEFAULT 0,
  aluminium_cost     DECIMAL(14,2) NOT NULL DEFAULT 0,
  ss_cost            DECIMAL(14,2) NOT NULL DEFAULT 0,
  glass_cost         DECIMAL(14,2) NOT NULL DEFAULT 0,
  accessory_cost     DECIMAL(14,2) NOT NULL DEFAULT 0,
  labour_cost        DECIMAL(14,2) NOT NULL DEFAULT 0,
  fitting_cost       DECIMAL(14,2) NOT NULL DEFAULT 0,
  transport_cost     DECIMAL(14,2) NOT NULL DEFAULT 0,
  other_cost         DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_cost         DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_selling      DECIMAL(14,2) NOT NULL DEFAULT 0,
  discount           DECIMAL(14,2) NOT NULL DEFAULT 0,
  discount_type      VARCHAR(20) NOT NULL DEFAULT 'Fixed',
  advance            DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_paid         DECIMAL(14,2) NOT NULL DEFAULT 0,
  due                DECIMAL(14,2) NOT NULL DEFAULT 0,
  estimated_profit   DECIMAL(14,2) NOT NULL DEFAULT 0,
  profit_percent     DECIMAL(8,2) NOT NULL DEFAULT 0,
  is_draft           TINYINT(1) NOT NULL DEFAULT 0,
  archived           TINYINT(1) NOT NULL DEFAULT 0,
  created_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_id CHAR(24) NULL,
  UNIQUE KEY uq_order_number (order_number),
  INDEX idx_order_customer (customer_id),
  INDEX idx_order_date (order_date),
  INDEX idx_order_status (status),
  INDEX idx_order_branch (branch_id),
  CONSTRAINT fk_order_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_order_branch   FOREIGN KEY (branch_id)   REFERENCES branches(id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Payments ----------
CREATE TABLE IF NOT EXISTS payments (
  id            CHAR(24) NOT NULL PRIMARY KEY,
  order_id      CHAR(24) NULL,
  order_number  VARCHAR(40) NULL,
  customer_id   CHAR(24) NULL,
  customer_name VARCHAR(190) NULL,
  branch_id     CHAR(24) NULL,
  branch_name   VARCHAR(190) NULL,
  date          DATE NOT NULL,
  amount        DECIMAL(14,2) NOT NULL DEFAULT 0,
  method        VARCHAR(30) NOT NULL DEFAULT 'Cash',
  reference     VARCHAR(120) NULL,
  received_by   VARCHAR(190) NULL,
  notes         TEXT NULL,
  archived      TINYINT(1) NOT NULL DEFAULT 0,
  created_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_id CHAR(24) NULL,
  INDEX idx_payment_order (order_id),
  INDEX idx_payment_customer (customer_id),
  INDEX idx_payment_date (date),
  CONSTRAINT fk_payment_order    FOREIGN KEY (order_id)    REFERENCES orders(id)    ON DELETE SET NULL,
  CONSTRAINT fk_payment_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Expenses ----------
CREATE TABLE IF NOT EXISTS expenses (
  id          CHAR(24) NOT NULL PRIMARY KEY,
  date        DATE NOT NULL,
  category    VARCHAR(120) NOT NULL DEFAULT 'Labour',
  description VARCHAR(255) NULL,
  amount      DECIMAL(14,2) NOT NULL DEFAULT 0,
  method      VARCHAR(30) NOT NULL DEFAULT 'Cash',
  person      VARCHAR(190) NULL,
  branch_id   CHAR(24) NULL,
  branch_name VARCHAR(190) NULL,
  notes       TEXT NULL,
  archived    TINYINT(1) NOT NULL DEFAULT 0,
  created_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_id CHAR(24) NULL,
  INDEX idx_expense_date (date),
  INDEX idx_expense_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Purchases ----------
CREATE TABLE IF NOT EXISTS purchases (
  id            CHAR(24) NOT NULL PRIMARY KEY,
  supplier_id   CHAR(24) NULL,
  supplier_name VARCHAR(190) NULL,
  branch_id     CHAR(24) NULL,
  branch_name   VARCHAR(190) NULL,
  date          DATE NOT NULL,
  material      VARCHAR(190) NULL,
  quantity      DECIMAL(14,3) NOT NULL DEFAULT 0,
  unit          VARCHAR(20) NOT NULL DEFAULT 'ft',
  unit_cost     DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_cost    DECIMAL(14,2) NOT NULL DEFAULT 0,
  paid          DECIMAL(14,2) NOT NULL DEFAULT 0,
  due           DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes         TEXT NULL,
  created_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_id CHAR(24) NULL,
  INDEX idx_purchase_supplier (supplier_id),
  INDEX idx_purchase_date (date),
  CONSTRAINT fk_purchase_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Loans (ধার হিসাব) ----------
CREATE TABLE IF NOT EXISTS loans (
  id      CHAR(24) NOT NULL PRIMARY KEY,
  name    VARCHAR(190) NOT NULL,
  mobile  VARCHAR(30) NULL,
  address VARCHAR(255) NULL,
  type    VARCHAR(20) NOT NULL DEFAULT 'Borrowed',
  balance DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes   TEXT NULL,
  created_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_id CHAR(24) NULL,
  INDEX idx_loan_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS loan_txns (
  id          CHAR(24) NOT NULL PRIMARY KEY,
  loan_id     CHAR(24) NOT NULL,
  person_name VARCHAR(190) NULL,
  date        DATE NOT NULL,
  flow        VARCHAR(20) NOT NULL DEFAULT 'increase',
  amount      DECIMAL(14,2) NOT NULL DEFAULT 0,
  method      VARCHAR(30) NOT NULL DEFAULT 'Cash',
  notes       TEXT NULL,
  created_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_id CHAR(24) NULL,
  INDEX idx_loantxn_loan (loan_id),
  CONSTRAINT fk_loantxn_loan FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Stock ----------
CREATE TABLE IF NOT EXISTS stock_items (
  id            CHAR(24) NOT NULL PRIMARY KEY,
  name          VARCHAR(190) NOT NULL,
  category      VARCHAR(60) NOT NULL DEFAULT 'Aluminium',
  unit          VARCHAR(20) NOT NULL DEFAULT 'ft',
  opening_stock DECIMAL(14,3) NOT NULL DEFAULT 0,
  current_stock DECIMAL(14,3) NOT NULL DEFAULT 0,
  minimum_stock DECIMAL(14,3) NOT NULL DEFAULT 0,
  price         DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes         TEXT NULL,
  created_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_id CHAR(24) NULL,
  INDEX idx_stock_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stock_adjustments (
  id         CHAR(24) NOT NULL PRIMARY KEY,
  stock_id   CHAR(24) NOT NULL,
  stock_name VARCHAR(190) NULL,
  date       DATE NOT NULL,
  quantity   DECIMAL(14,3) NOT NULL DEFAULT 0,
  reason     VARCHAR(190) NULL,
  notes      TEXT NULL,
  created_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_id CHAR(24) NULL,
  INDEX idx_stockadj_stock (stock_id),
  CONSTRAINT fk_stockadj_stock FOREIGN KEY (stock_id) REFERENCES stock_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Price lists ----------
CREATE TABLE IF NOT EXISTS aluminium_profiles (
  id                CHAR(24) NOT NULL PRIMARY KEY,
  profile_name      VARCHAR(190) NOT NULL,
  profile_type      VARCHAR(120) NULL,
  formula           VARCHAR(60) NOT NULL DEFAULT 'perimeter',
  price_per_foot    DECIMAL(14,2) NOT NULL DEFAULT 0,
  price_per_kg      DECIMAL(14,2) NOT NULL DEFAULT 0,
  price_per_piece   DECIMAL(14,2) NOT NULL DEFAULT 0,
  length_per_piece  DECIMAL(14,3) NOT NULL DEFAULT 0,
  pieces_per_window DECIMAL(10,2) NOT NULL DEFAULT 0,
  cutting_deduction DECIMAL(14,3) NOT NULL DEFAULT 0,
  waste_percent     DECIMAL(8,2) NOT NULL DEFAULT 0,
  description       TEXT NULL,
  notes             TEXT NULL,
  active            TINYINT(1) NOT NULL DEFAULT 1,
  created_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_id CHAR(24) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ss_materials (
  id            CHAR(24) NOT NULL PRIMARY KEY,
  material_name VARCHAR(190) NOT NULL,
  grade         VARCHAR(40) NULL,
  size          VARCHAR(60) NULL,
  length        DECIMAL(14,3) NOT NULL DEFAULT 0,
  unit          VARCHAR(20) NOT NULL DEFAULT 'ft',
  price_type    VARCHAR(40) NOT NULL DEFAULT 'Per Foot',
  price         DECIMAL(14,2) NOT NULL DEFAULT 0,
  supplier      VARCHAR(190) NULL,
  notes         TEXT NULL,
  active        TINYINT(1) NOT NULL DEFAULT 1,
  created_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_id CHAR(24) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS glass_prices (
  id           CHAR(24) NOT NULL PRIMARY KEY,
  glass_type   VARCHAR(120) NOT NULL,
  thickness    VARCHAR(40) NULL,
  rate         DECIMAL(14,2) NOT NULL DEFAULT 0,
  rate_unit    VARCHAR(40) NOT NULL DEFAULT 'Per Sqft',
  cutting_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  fitting_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes        TEXT NULL,
  active       TINYINT(1) NOT NULL DEFAULT 1,
  created_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_id CHAR(24) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS accessories (
  id         CHAR(24) NOT NULL PRIMARY KEY,
  name       VARCHAR(190) NOT NULL,
  unit       VARCHAR(30) NOT NULL DEFAULT 'Piece',
  unit_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes      TEXT NULL,
  active     TINYINT(1) NOT NULL DEFAULT 1,
  created_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_id CHAR(24) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS labour_settings (
  id        CHAR(24) NOT NULL PRIMARY KEY,
  label     VARCHAR(190) NOT NULL,
  category  VARCHAR(60) NOT NULL DEFAULT 'Labour',
  rate      DECIMAL(14,2) NOT NULL DEFAULT 0,
  rate_unit VARCHAR(40) NOT NULL DEFAULT 'Per Sqft',
  notes     TEXT NULL,
  active    TINYINT(1) NOT NULL DEFAULT 1,
  created_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_id CHAR(24) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS price_history (
  id          CHAR(24) NOT NULL PRIMARY KEY,
  entity_type VARCHAR(60) NOT NULL,
  item_id     CHAR(24) NULL,
  item_name   VARCHAR(190) NULL,
  field       VARCHAR(60) NULL,
  old_value   VARCHAR(190) NULL,
  new_value   VARCHAR(190) NULL,
  changed_by  VARCHAR(190) NULL,
  datetime    DATETIME NULL,
  created_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_id CHAR(24) NULL,
  INDEX idx_pricehist_item (entity_type, item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Salary ----------
CREATE TABLE IF NOT EXISTS salary_entries (
  id                   CHAR(24) NOT NULL PRIMARY KEY,
  staff_id             CHAR(24) NULL,
  staff_name           VARCHAR(190) NULL,
  position             VARCHAR(120) NULL,
  year                 INT NOT NULL,
  month                INT NOT NULL,
  base_salary_snapshot DECIMAL(14,2) NOT NULL DEFAULT 0,
  duty_days            DECIMAL(8,2) NOT NULL DEFAULT 0,
  absent_days          DECIMAL(8,2) NOT NULL DEFAULT 0,
  friday_count         DECIMAL(8,2) NOT NULL DEFAULT 0,
  lunch_days           DECIMAL(8,2) NOT NULL DEFAULT 0,
  lunch_allowance      DECIMAL(14,2) NOT NULL DEFAULT 0,
  advance              DECIMAL(14,2) NOT NULL DEFAULT 0,
  owner_due            DECIMAL(14,2) NOT NULL DEFAULT 0,
  previous_due         DECIMAL(14,2) NOT NULL DEFAULT 0,
  net_payment          DECIMAL(14,2) NOT NULL DEFAULT 0,
  due_amount           DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_id CHAR(24) NULL,
  UNIQUE KEY uq_salary_period (staff_id, year, month),
  CONSTRAINT fk_salary_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Quotations ----------
CREATE TABLE IF NOT EXISTS quotations (
  id              CHAR(24) NOT NULL PRIMARY KEY,
  quote_number    VARCHAR(40) NOT NULL,
  customer_id     CHAR(24) NULL,
  customer_name   VARCHAR(190) NULL,
  customer_mobile VARCHAR(30) NULL,
  date            DATE NOT NULL,
  valid_until     DATE NULL,
  status          VARCHAR(30) NOT NULL DEFAULT 'Draft',
  items_json      LONGTEXT NULL,
  subtotal        DECIMAL(14,2) NOT NULL DEFAULT 0,
  discount        DECIMAL(14,2) NOT NULL DEFAULT 0,
  discount_type   VARCHAR(20) NOT NULL DEFAULT 'Fixed',
  other_cost      DECIMAL(14,2) NOT NULL DEFAULT 0,
  total           DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes           TEXT NULL,
  created_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_id CHAR(24) NULL,
  UNIQUE KEY uq_quote_number (quote_number),
  INDEX idx_quote_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Audit log ----------
CREATE TABLE IF NOT EXISTS audit_logs (
  id          CHAR(24) NOT NULL PRIMARY KEY,
  action      VARCHAR(120) NOT NULL,
  record_type VARCHAR(60) NULL,
  record_id   CHAR(24) NULL,
  old_value   LONGTEXT NULL,
  new_value   LONGTEXT NULL,
  user_name   VARCHAR(190) NULL,
  datetime    DATETIME NULL,
  created_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_id CHAR(24) NULL,
  INDEX idx_audit_record (record_type, record_id),
  INDEX idx_audit_datetime (datetime)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- Staff advances & supplier payments
-- ============================================================

-- ---------- Staff advance (মাসিক অগ্রিম) ----------
-- Each row is one dated hand-out. The month's salary sheet reads the sum of
-- these as its advance, and every row also books an expense so the cash shows
-- up in the খরচ ledger.
CREATE TABLE IF NOT EXISTS staff_advances (
  id          CHAR(24) NOT NULL PRIMARY KEY,
  staff_id    CHAR(24) NOT NULL,
  staff_name  VARCHAR(190) NULL,
  date        DATE NOT NULL,
  year        INT NOT NULL,
  month       INT NOT NULL,
  amount      DECIMAL(14,2) NOT NULL DEFAULT 0,
  method      VARCHAR(30) NOT NULL DEFAULT 'Cash',
  expense_id  CHAR(24) NULL,
  notes       TEXT NULL,
  created_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_id CHAR(24) NULL,
  INDEX idx_advance_staff (staff_id),
  INDEX idx_advance_period (year, month),
  INDEX idx_advance_date (date),
  CONSTRAINT fk_advance_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Supplier payment (সরবরাহকারীকে পরিশোধ) ----------
-- Payments made against the supplier's running balance, not against one
-- purchase — so an old due and today's bill settle from the same pot.
CREATE TABLE IF NOT EXISTS supplier_payments (
  id            CHAR(24) NOT NULL PRIMARY KEY,
  supplier_id   CHAR(24) NOT NULL,
  supplier_name VARCHAR(190) NULL,
  date          DATE NOT NULL,
  amount        DECIMAL(14,2) NOT NULL DEFAULT 0,
  method        VARCHAR(30) NOT NULL DEFAULT 'Cash',
  reference     VARCHAR(120) NULL,
  notes         TEXT NULL,
  created_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_id CHAR(24) NULL,
  INDEX idx_suppay_supplier (supplier_id),
  INDEX idx_suppay_date (date),
  CONSTRAINT fk_suppay_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Owner account, bank accounts, branch transfers
-- ============================================================

-- ---------- মালিকের হিসাব ----------
-- flow = 'withdraw' (মালিক দোকান থেকে নিলেন) | 'invest' (মালিক দোকানে দিলেন)
CREATE TABLE IF NOT EXISTS owner_txns (
  id          CHAR(24) NOT NULL PRIMARY KEY,
  date        DATE NOT NULL,
  flow        VARCHAR(20) NOT NULL DEFAULT 'withdraw',
  amount      DECIMAL(14,2) NOT NULL DEFAULT 0,
  method      VARCHAR(30) NOT NULL DEFAULT 'Cash',
  owner_name  VARCHAR(190) NULL,
  notes       TEXT NULL,
  created_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_id CHAR(24) NULL,
  INDEX idx_owner_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- ব্যাংক ----------
CREATE TABLE IF NOT EXISTS bank_accounts (
  id              CHAR(24) NOT NULL PRIMARY KEY,
  name            VARCHAR(190) NOT NULL,
  bank_name       VARCHAR(190) NULL,
  account_no      VARCHAR(60) NULL,
  branch          VARCHAR(190) NULL,
  opening_balance DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes           TEXT NULL,
  active          TINYINT(1) NOT NULL DEFAULT 1,
  created_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_id CHAR(24) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- flow = 'deposit' (দোকানের ক্যাশ থেকে ব্যাংকে জমা) | 'withdraw' (ব্যাংক থেকে উঠিয়ে ক্যাশে)
CREATE TABLE IF NOT EXISTS bank_txns (
  id           CHAR(24) NOT NULL PRIMARY KEY,
  account_id   CHAR(24) NOT NULL,
  account_name VARCHAR(190) NULL,
  date         DATE NOT NULL,
  flow         VARCHAR(20) NOT NULL DEFAULT 'deposit',
  amount       DECIMAL(14,2) NOT NULL DEFAULT 0,
  reference    VARCHAR(120) NULL,
  notes        TEXT NULL,
  created_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_id CHAR(24) NULL,
  INDEX idx_banktxn_account (account_id),
  INDEX idx_banktxn_date (date),
  CONSTRAINT fk_banktxn_account FOREIGN KEY (account_id) REFERENCES bank_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- শাখা থেকে শাখায় মাল পাঠানো / আনা ----------
-- Goods only — the amount is the value of the goods, not cash, so it never
-- touches the daily cash sheet.
CREATE TABLE IF NOT EXISTS branch_transfers (
  id               CHAR(24) NOT NULL PRIMARY KEY,
  date             DATE NOT NULL,
  from_branch_id   CHAR(24) NULL,
  from_branch_name VARCHAR(190) NULL,
  to_branch_id     CHAR(24) NULL,
  to_branch_name   VARCHAR(190) NULL,
  items_json       LONGTEXT NULL,
  total_amount     DECIMAL(14,2) NOT NULL DEFAULT 0,
  sent_by          VARCHAR(190) NULL,
  notes            TEXT NULL,
  created_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_id CHAR(24) NULL,
  INDEX idx_transfer_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

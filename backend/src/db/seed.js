/**
 * Seeds the reference data the app needs to be usable: an admin account,
 * business settings, branches, price lists and staff.
 * Idempotent — rows are only inserted when the table is still empty.
 */
const bcrypt = require('bcryptjs');
const { pool, query } = require('../config/db');
const { newId } = require('../utils/id');

const ADMIN = {
  full_name: 'MD: ARIFUL ISLAM',
  email: 'jihadkazi66@gmail.com',
  password: 'Hw3LP8Jjvfzkpb4',
  role: 'admin',
};

const SETTING = {
  business_name: 'SS MODINA METAL & THAI GLASS',
  short_name: 'SS Modina হিসাব',
  subtitle: 'METAL & THAI GLASS',
  logo_url: 'https://media.base44.com/images/public/6a8c1cbaca4630d017a8f8a0/64df9ffbf_1775449430575.png',
  address: 'Haluaghat Road, Phulpur, Mymensingh',
  phone: '01879-368965',
  proprietor: 'MD: UMOR FARUQUE',
  proprietor_phone: '01879-368965',
  manager: 'MD: ARIFUL ISLAM',
  manager_phone: '01896-502520',
  currency: '৳',
  order_prefix: 'SMTG',
  invoice_footer: 'মালের গাড়ি ভাড়া কাস্টমার বহন করিবে',
  expense_categories: JSON.stringify([
    'গাড়ি ভাড়া', 'বিদ্যুত বিল', 'ওযাই ফাই বিল', 'চা-পান-নাস্তা',
    'বাইকের-পেট্রোল+মেরামত', 'সাইড খরচ', 'মোবাইল রিচার্জ', 'যন্ত্রপাতি মেরামত',
    'দোকান ভাড়া', 'দৈনিক-সাপ্তাহিক-দান', 'অন্যান্য ও বিকাশ খরচ',
  ]),
  lunch_rate: 70,
  default_tax: 0,
  rounding: 'None',
};

const BRANCHES = [
  { name: 'Fulpur Upazila', address: 'Fulpur Upazila', notes: 'প্রধান শাখা' },
  { name: 'Dharabazar, Haluaghat', address: 'Dharabazar, Haluaghat', notes: '' },
];

const STAFF = [
  { name: 'মোঃ ওমর ফারুক', position: 'প্রোপাইটর', phone: '০১৮৭৯-৩৬৮৯৬৫', base_salary: 30000 },
  { name: 'নুর মোঃ আলী', position: 'ফ্লোরম্যান', phone: '০১৬৭৬-৫৯৪২২০', base_salary: 15000 },
];

const GLASS = [
  ['Clear', '5mm'], ['Clear', '8mm'], ['Frosted', '5mm'],
  ['Tinted', '5mm'], ['Reflective', '5mm'], ['Mirror', '5mm'],
];

const SS = [
  ['SS Pipe', '304'], ['SS Round Pipe', '304'], ['SS Square Pipe', '304'],
  ['SS Sheet', '304'], ['SS Pipe', '202'],
];

const PROFILES = Array.from({ length: 6 }, (_, i) => `Profile ${i + 1}`);

const ACCESSORIES = [
  ['Silicone', 'Tube'], ['Handle', 'Piece'], ['Lock', 'Piece'],
  ['Roller', 'Piece'], ['Screw', 'Packet'], ['Rubber Beading', 'Roll'],
  ['Mohair', 'Roll'],
];

const LABOUR = [
  ['Labour per Sqft', 'Per Sqft'], ['Labour per Rft', 'Per Rft'],
  ['Fitting per Sqft', 'Per Sqft'], ['Transport', 'Fixed'],
];

async function isEmpty(table) {
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM \`${table}\``);
  return Number(total) === 0;
}

async function insert(table, rows) {
  for (const row of rows) {
    const cols = ['id', ...Object.keys(row)];
    const vals = [newId(), ...Object.values(row)];
    await query(
      `INSERT INTO \`${table}\` (${cols.map((c) => `\`${c}\``).join(',')})
       VALUES (${cols.map(() => '?').join(',')})`,
      vals,
    );
  }
  console.log(`   • ${table}: ${rows.length} rows`);
}

async function run() {
  console.log('→ seeding reference data');

  let adminId = null;
  if (await isEmpty('users')) {
    adminId = newId();
    await query(
      `INSERT INTO users (id, full_name, email, password_hash, role)
       VALUES (?, ?, ?, ?, ?)`,
      [adminId, ADMIN.full_name, ADMIN.email, await bcrypt.hash(ADMIN.password, 10), ADMIN.role],
    );
    console.log(`   • users: admin ${ADMIN.email}`);
  } else {
    console.log('   • users: already present, skipped');
  }

  if (await isEmpty('settings')) await insert('settings', [SETTING]);
  else console.log('   • settings: already present, skipped');

  if (await isEmpty('branches')) await insert('branches', BRANCHES);
  if (await isEmpty('staff')) await insert('staff', STAFF);

  if (await isEmpty('glass_prices')) {
    await insert('glass_prices', GLASS.map(([glass_type, thickness]) => ({
      glass_type, thickness, rate: 0, rate_unit: 'Per Sqft',
    })));
  }

  if (await isEmpty('ss_materials')) {
    await insert('ss_materials', SS.map(([material_name, grade]) => ({
      material_name, grade, unit: 'ft', price_type: 'Per Foot', price: 0,
    })));
  }

  if (await isEmpty('aluminium_profiles')) {
    await insert('aluminium_profiles', PROFILES.map((profile_name) => ({
      profile_name, formula: 'perimeter', pieces_per_window: 2, waste_percent: 5,
    })));
  }

  if (await isEmpty('accessories')) {
    await insert('accessories', ACCESSORIES.map(([name, unit]) => ({ name, unit, unit_price: 0 })));
  }

  if (await isEmpty('labour_settings')) {
    await insert('labour_settings', LABOUR.map(([label, rate_unit]) => ({
      label, category: 'Labour', rate_unit, rate: 0,
    })));
  }

  console.log('✔ seed complete');
  console.log(`\n  login: ${ADMIN.email} / ${ADMIN.password}\n`);
  await pool.end();
}

run().catch(async (err) => {
  console.error('✖ seed failed:', err.message);
  await pool.end();
  process.exit(1);
});

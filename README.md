# SS Modina হিসাব

Metal & Thai Glass ব্যবসার হিসাব ব্যবস্থাপনা — React (frontend) + Node/Express (backend) + MySQL।
`modina-metal-flow.base44.app` এর সম্পূর্ণ ফিচার-সমতুল্য নিজস্ব সংস্করণ।

```
ss_modina_accounts/
├── backend/          Node.js + Express + MySQL REST API
└── frontend/         React + Vite + Tailwind SPA
```

## চালু করার নিয়ম

### ১. Backend

```bash
cd backend
npm install
npm run migrate     # ২৩টি টেবিল তৈরি (পুনরায় চালানো নিরাপদ)
npm run seed        # অ্যাডমিন, সেটিংস, শাখা ও মূল্য তালিকা
npm run dev         # http://localhost:5055/api
```

`.env` (ইতিমধ্যে তৈরি):

```
PORT=5055
DB_HOST=88.222.241.192
DB_PORT=3306
DB_USER=mini_social_user
DB_PASSWORD=mini_social123456
DB_NAME=ss_modina_accounts
JWT_SECRET=...            # প্রোডাকশনে অবশ্যই পরিবর্তন করুন
CORS_ORIGIN=http://localhost:5173,http://localhost:5174
```

### ২. Frontend

```bash
cd frontend
npm install
npm run dev         # http://localhost:5173
npm run build       # dist/ তৈরি
```

`.env`: `VITE_API_URL=http://localhost:5055/api`

### লগইন

```
ইমেইল:    jihadkazi66@gmail.com
পাসওয়ার্ড: Hw3LP8Jjvfzkpb4
```

## Backend আর্কিটেকচার

```
backend/src/
├── config/         env, mysql2 connection pool + transaction helper
├── db/             schema.sql, migrate.js, seed.js
├── models/         registry.js — ২২ এন্টিটির মেটাডেটা (টেবিল, ফিল্ড, টাইপ, রোল)
├── middleware/      auth (JWT + রোল), error handler
├── services/
│   ├── queryBuilder.js    filter/sort/limit → নিরাপদ SQL (whitelist করা কলাম)
│   ├── entityService.js   জেনেরিক CRUD + টাইপ কোয়ার্শন + সিরিয়ালাইজেশন
│   └── orderService.js    অর্ডারের হিসাব, নম্বর জেনারেশন, পেমেন্ট সিঙ্ক, অডিট
├── controllers/    auth, entity (জেনেরিক), domain (ব্যবসায়িক নিয়ম), report
└── routes/         সব রুট এক জায়গায়
```

**মূল ধারণা:** ২২টি এন্টিটি একটি রেজিস্ট্রি-চালিত জেনেরিক CRUD লেয়ার শেয়ার করে
(`/api/entities/:Entity`), আর যেখানে ব্যবসায়িক নিয়ম আছে (অর্ডার, পেমেন্ট, স্টক,
স্যালারি, কোটেশন) সেখানে আলাদা ডোমেইন রুট — যাতে হিসাব সবসময় সার্ভারেই হয়।

### API সারসংক্ষেপ

| রুট | কাজ |
|---|---|
| `POST /auth/login`, `/auth/register`, `GET /auth/me` | অথেনটিকেশন (JWT) |
| `GET/POST/PATCH/DELETE /entities/:Entity` | ২২ এন্টিটির জেনেরিক CRUD |
| `GET /entities/:Entity?filter={...}&sort=-date&limit=500&search=` | ফিল্টার/সর্ট/সার্চ |
| `POST /orders`, `PATCH /orders/:id`, `GET /orders/:id/detail` | অর্ডার (হিসাব সার্ভারে) |
| `PATCH /orders/:id/status`, `GET /orders/next-number` | অবস্থা, পরবর্তী নম্বর |
| `POST /payments`, `DELETE /payments/:id` | পেমেন্ট (অর্ডারের বাকি অটো-সিঙ্ক) |
| `POST /customers`, `GET /customers/:id/detail` | কাস্টমার (অটো CUST-কোড) |
| `POST /purchases`, `GET /suppliers/:id/detail` | ক্রয় ও সরবরাহকারী |
| `GET /loans/:id/detail`, `POST /loans/:id/txns` | ধার হিসাব ও লেজার |
| `POST /stock`, `POST /stock/:id/adjust` | স্টক ও সমন্বয় |
| `GET/POST /salary/sheet?year&month` | মাসিক স্যালারি শিট (upsert) |
| `POST /quotations`, `POST /quotations/:id/convert` | কোটেশন → অর্ডার |
| `GET /reports/dashboard`, `/daily`, `/range`, `/due` | রিপোর্ট |
| `GET /reports/customer/:id/statement` | গ্রাহক লেজার |
| `GET /search?q=`, `GET /price-catalog` | গ্লোবাল সার্চ, দর ক্যাটালগ |
| `GET/POST/PATCH/DELETE /users` | ইউজার ব্যবস্থাপনা (অ্যাডমিন) |

### হিসাবের ফর্মুলা (সার্ভারে প্রয়োগ)

```
gross          = Σ (selling_price × quantity)
discount       = Fixed হলে সরাসরি, Percent হলে gross-এর %
total_selling  = gross − discount
total_cost     = Σ material_cost + (labour, fitting, transport, other …)
estimated_profit = total_selling − total_cost
profit_percent = profit / total_selling × 100
total_paid     = পেমেন্ট রো-গুলোর যোগফল (একমাত্র সত্য উৎস)
due            = total_selling − total_paid

স্যালারি net  = base + (lunch_days × lunch_rate) − advance − owner_due + previous_due
```

## Frontend আর্কিটেকচার

```
frontend/src/
├── api/            client.js (fetch + JWT), entities.js (প্রতি এন্টিটির ক্লায়েন্ট)
├── components/
│   ├── ui/         Button, Card, Input, Select, Dialog, Tabs, Badge, Toast …
│   ├── layout/     AppLayout (সাইডবার + মোবাইল ড্রয়ার), Sidebar
│   └── shared/     PageHeader, StatCard, DataTable, StatusBadge, InfoRow
├── hooks/          useAuth, useSettings
├── lib/utils.js    money, bnDate, isoDate, downloadCsv, parseJson
├── pages/          ২৫টি স্ক্রিন
└── styles/         থিম টোকেন (সবুজ + অ্যাম্বার, Hind Siliguri)
```

- **রাউটিং:** react-router; ভারী পেজগুলো lazy-load
- **ডেটা:** TanStack Query — ক্যাশ, invalidate, রিফেচ
- **রেসপন্সিভ:** ডেস্কটপে টেবিল, মোবাইলে কার্ড (`DataTable` একই কোডে দুটোই)
- **প্রিন্ট:** ইনভয়েস, কোটেশন ও স্টেটমেন্টে প্রিন্ট-অপ্টিমাইজড CSS
- **CSV:** প্রতিটি তালিকা থেকে এক্সপোর্ট

## স্ক্রিন তালিকা

ড্যাশবোর্ড · অর্ডার (তালিকা/ফর্ম/বিস্তারিত/ইনভয়েস) · কাস্টমার (তালিকা/ফর্ম/বিস্তারিত/স্টেটমেন্ট) ·
দৈনিক রিপোর্ট · রিপোর্ট (৫ ট্যাব: সারসংক্ষেপ, বিক্রি, খরচ, বাকি, কাস্টমার) · খরচ · পেমেন্ট ·
ক্রয় · সরবরাহকারী · ধার হিসাব · স্টক · মূল্য তালিকা (৫ ট্যাব) · স্যালারি · কোটেশন ·
ক্যালকুলেটর (থাই গ্লাস / অ্যালুমিনিয়াম / এসএস) · খুঁজুন · সেটিংস · প্রোফাইল · ইউজার

## ডাটাবেস

২৩টি টেবিল — `users, settings, branches, customers, staff, suppliers, orders, payments,
expenses, purchases, loans, loan_txns, stock_items, stock_adjustments, aluminium_profiles,
ss_materials, glass_prices, accessories, labour_settings, price_history, salary_entries,
quotations, audit_logs`

- সব আইডি `CHAR(24)` (ObjectId-আকৃতির, সময়-ক্রমানুসারে সাজানো যায়)
- `utf8mb4` — বাংলা লেখা সম্পূর্ণ সমর্থিত
- ফরেন কী + ইনডেক্স; টাকার হিসাব `DECIMAL(14,2)`
- অর্ডার+অগ্রিম, পেমেন্ট+বাকি, স্টক সমন্বয় — সব ট্রানজেকশনে

## প্রোডাকশনে দেওয়ার সময়

1. `JWT_SECRET` পরিবর্তন করুন
2. `CORS_ORIGIN` এ আসল ডোমেইন দিন
3. `cd frontend && npm run build` → `dist/` যেকোনো স্ট্যাটিক হোস্টে
4. ব্যাকএন্ড `npm start` (pm2 বা systemd দিয়ে চালান)
5. SPA রাউটিংয়ের জন্য অজানা পাথ `index.html` এ ফেরত দিন

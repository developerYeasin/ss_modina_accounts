/**
 * ম্যাপ ক্যালকুলেটরের হিসাব — জানালা (থাই স্লাইডিং), কার্টেন ওয়াল, সিলিং।
 * শুধু হিসাব, কোনো UI নেই — তাই একই মাপ দিয়ে alfalak-এর ফলাফলের সাথে মেলানো যায়।
 *
 * মাপের নিয়ম (দোকানের প্রচলিত শর্টহ্যান্ড): 4'-5" = 4.5 — ইঞ্চি দশমিকের ঘরে বসে,
 * ১২ দিয়ে ভাগ হয় না। 4-5, 4'-5", 4 5 সবই চলে।
 *
 * Product row (map_products): { item_type, slide_category, product_code, product_name,
 *   company, colour, quality, purchase_rate, sell_rate, glass_mm }
 */

const lc = (v) => String(v ?? '').trim().toLowerCase();
const r2 = (n) => Math.round(n * 100) / 100;
const num = (v) => Number(String(v ?? '').replace(/,/g, '')) || 0;

export const COLOUR_ORDER = ['Silver', 'Bronze', 'Black', 'SS', 'PC', 'Golden', 'Wooden'];
export const sortColours = (list) => [...list].sort((a, b) => {
  const ia = COLOUR_ORDER.indexOf(a), ib = COLOUR_ORDER.indexOf(b);
  if (ia === -1 && ib === -1) return a.localeCompare(b);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
});

/* ------------------------------------------------------------------ মাপ */
export function parseFeetInchParts(str) {
  const nums = String(str || '').match(/\d+/g);
  if (!nums) return { feet: 0, inch: 0 };
  return { feet: parseInt(nums[0], 10), inch: nums.length > 1 ? parseInt(nums[1], 10) : 0 };
}
/** "4-5" → 4.5 (শর্টহ্যান্ড) */
export function parseFeetInches(str) {
  if (str == null || String(str).trim() === '') return 0;
  const { feet, inch } = parseFeetInchParts(str);
  return parseFloat(`${feet}.${inch}`) || feet;
}
/** 4.5 → 4'-5" */
export function fmtFt(d) {
  d = Number(d) || 0;
  const feet = Math.floor(d + 1e-9);
  return `${feet}'-${Math.round((d - feet) * 10)}"`;
}
/** ভগ্নাংশ থাকলে (8.75) → 8'-7.5" */
export function fmtLen(d) {
  d = r2(d);
  const ft = Math.floor(d + 1e-9);
  return `${ft}'-${Math.round((d - ft) * 100) / 10}"`;
}

/* ============================================================ জানালা */
export const WINDOW_CATEGORIES = [
  { value: '3inch', label: '৩" স্লাইডিং' },
  { value: '4inch', label: '৪" স্লাইডিং নেট ছাড়া' },
  { value: '4inch_net', label: '৪" স্লাইডিং নেট সহ' },
];
export const defaultFittingCharge = (cat) => (cat === '3inch' ? 30 : cat === '4inch_net' ? 40 : 0);

export function defaultBom(category) {
  const bom = {
    profile: [
      { key: 'outerSide', name: 'Sliding Outer Side', basis: 'H', mult: 2 },
      { key: 'shutterLock', name: 'Sliding Shutter Lock', basis: 'H', mult: 2 },
      { key: 'shutterIn', name: 'Sliding Shutter Inter Lock', basis: 'H', mult: 2 },
      { key: 'outerTop', name: 'Sliding Outer Top', basis: 'W', mult: 1 },
      { key: 'outerBottom', name: 'Sliding Outer High Bottom', basis: 'W', mult: 1 },
      { key: 'shutterTop', name: 'Sliding Shutter Top', basis: 'W', mult: 1 },
      { key: 'shutterBottom', name: 'Sliding Shutter Bottom', basis: 'W', mult: 1 },
    ],
    hardware: [
      { key: 'slLock', name: 'SL Lock', unit: 'পিস', fixedQty: 2 },
      { key: 'mohiyer', name: 'SL মহিয়ার', unit: 'ফুট', hMult: 2, wMult: 2 },
      { key: 'rover', name: 'SL Rabar', unit: 'ফুট', hMult: 4, wMult: 2 },
      { key: 'screws', name: 'স্ক্রু', unit: 'পিস', fixedQty: 28 },
      { key: 'halfScrew', name: '১/২" স্ক্রু', unit: 'পিস', fixedQty: 8 },
      { key: 'slWheel', name: 'SL হুইল', unit: 'পিস', fixedQty: 4 },
    ],
  };
  if (category === '4inch_net') {
    bom.profile.push({ key: 'netSection', name: 'Net Section', basis: 'HW', hMult: 2, wMult: 1 });
    bom.hardware.push(
      { key: 'net', name: 'Net', unit: 'বর্গফুট', isArea: true },
      { key: 'netWheel', name: 'Net Wheel', unit: 'পিস', fixedQty: 2 },
      { key: 'netAngle', name: 'Net Angle', unit: 'পিস', fixedQty: 4 },
      { key: 'netRover', name: 'Net Rover', unit: 'ফুট', hMult: 2, wMult: 1 },
      { key: 'rivets', name: 'Rivets', unit: 'পিস', fixedQty: 20 },
    );
  }
  return bom;
}

/** এই ক্যাটাগরির জানালায় যে প্রোফাইলগুলো চলে (৪" নেট সহ = ৪" + নেটের লাইন) */
export function profilesForCategory(products, cat) {
  const prof = products.filter((p) => p.item_type === 'profile');
  if (!cat) return prof;
  if (cat === '4inch_net') return prof.filter((p) => p.slide_category === '4inch' || p.slide_category === '4inch_net');
  return prof.filter((p) => p.slide_category === cat);
}
export const companiesFor = (list) => [...new Set(list.map((p) => p.company).filter(Boolean))].sort();
export const coloursFor = (list, company) => {
  const sub = company ? list.filter((p) => lc(p.company) === lc(company)) : list;
  return sortColours([...new Set(sub.map((p) => p.colour).filter(Boolean))]);
};

function findProfile(list, company, colour, itemName) {
  if (!company) return null;
  const mine = list.filter((p) => lc(p.company) === lc(company));
  const name = lc(itemName);
  // নাম হুবহু, না মিললে আংশিক — তারপর একই কোডের মধ্যে কালার মিলিয়ে
  let hit = mine.find((p) => lc(p.product_name) === name)
    || mine.find((p) => { const pn = lc(p.product_name); return pn && (pn.includes(name) || name.includes(pn)); });
  if (!hit) return null;
  const sameCode = mine.filter((p) => lc(p.product_code) === lc(hit.product_code));
  if (colour) hit = sameCode.find((p) => lc(p.colour) === lc(colour)) || sameCode[0];
  else hit = sameCode[0];
  return hit;
}

export function findHardware(products, key, override = {}) {
  const hw = products.filter((p) => p.item_type === 'hardware');
  const list = hw.filter((p) => p.slide_category === key);
  if (!list.length) return null;
  if (key !== 'slLock' && key !== 'slWheel') return list[0];
  const company = lc(override.company || 'kai');
  const byCo = list.filter((p) => lc(p.company) === company);
  const work = byCo.length ? byCo : list;
  const quality = lc(override.quality || 'general');
  return work.find((p) => lc(p.quality) === quality) || work[0];
}

export const glassColours = (products) =>
  [...new Set(products.filter((p) => p.item_type === 'glass').map((p) => p.product_name).filter(Boolean))];
export const glassMMs = (products, colour) =>
  [...new Set(products.filter((p) => p.item_type === 'glass' && (!colour || lc(p.product_name) === lc(colour)))
    .map((p) => p.glass_mm).filter(Boolean))].sort();
export function glassRate(products, colour, mm) {
  if (!colour && !mm) return null;
  let m = products.filter((p) => p.item_type === 'glass');
  if (colour) { const c = m.filter((p) => lc(p.product_name) === lc(colour)); if (c.length) m = c; }
  if (mm) { const c = m.filter((p) => lc(p.glass_mm) === lc(mm)); if (c.length) m = c; }
  return m.length ? num(m[0].purchase_rate) : null;
}

/* ---- বার প্ল্যান: কাটিং কোন বারে বসবে, সবচেয়ে কম বিল ---- */
const BAR_SIZES = { H: [21, 18.5], W: [21] };
const LEFTOVER_ROUNDUP = { H: { from: 17.5, inclusive: true }, W: { from: 18, inclusive: false } };

function leftoverBill(C, basis) {
  const sizes = (BAR_SIZES[basis] || BAR_SIZES.W).slice().sort((a, b) => a - b);
  const rule = LEFTOVER_ROUNDUP[basis] || LEFTOVER_ROUNDUP.W;
  const roundUp = rule.inclusive ? C >= rule.from - 1e-9 : C > rule.from + 1e-9;
  if (!roundUp) return { cut: C, bar: 0 };
  const bar = sizes.find((b) => C <= b + 1e-9);
  return bar ? { cut: 0, bar } : null;
}
function bestFill(types, capU) {
  const k = types.length;
  const reach = new Array(capU + 1).fill(null);
  reach[0] = new Array(k).fill(0);
  for (let t = 0; t < k; t++) {
    const { u, n } = types[t];
    if (!(n > 0) || !(u > 0)) continue;
    for (let s = u; s <= capU; s++) {
      if (reach[s] === null && reach[s - u] !== null && reach[s - u][t] < n) {
        const v = reach[s - u].slice(); v[t]++; reach[s] = v;
      }
    }
  }
  for (let s = capU; s > 0; s--) if (reach[s] !== null) return { sum: s, vec: reach[s] };
  return null;
}
export function packPieces(pieces, basis) {
  const U = 100;
  const sizes = (BAR_SIZES[basis] || BAR_SIZES.W).slice().sort((a, b) => b - a);
  const maxU = Math.round(sizes[0] * U);
  const merged = {};
  for (const p of pieces) {
    if (!(p.len > 0) || !(p.n > 0)) continue;
    if (Math.abs(p.n - Math.round(p.n)) > 1e-9) return null;
    const u = Math.round(p.len * U);
    if (u <= 0 || u > maxU) return null;
    merged[u] = (merged[u] || 0) + Math.round(p.n);
  }
  let cur = Object.keys(merged).map(Number).sort((a, b) => b - a).map((u) => ({ u, n: merged[u] }));
  if (!cur.length) return null;
  const totalU = (ts) => ts.reduce((s, t) => s + t.u * t.n, 0);
  const subtract = (ts, vec, times) => ts.map((t, i) => ({ u: t.u, n: t.n - vec[i] * times }));
  const addFull = (map, bar, n) => { map[bar] = (map[bar] || 0) + n; };
  const bestBin = (ts) => {
    let best = null;
    sizes.forEach((B) => {
      const f = bestFill(ts, Math.round(B * U));
      if (!f) return;
      const util = f.sum / (B * U);
      if (!best || util > best.util + 1e-9) best = { bar: B, sum: f.sum, vec: f.vec, util };
    });
    return best;
  };
  const full = {};
  let guard = 0;
  while (totalU(cur) > 2 * maxU && guard++ < 10000) {
    const b = bestBin(cur);
    if (!b) return null;
    let rep = Infinity;
    b.vec.forEach((c, i) => { if (c > 0) rep = Math.min(rep, Math.floor(cur[i].n / c)); });
    rep = Math.max(1, Math.min(rep, Math.floor((totalU(cur) - 2 * maxU) / b.sum)));
    addFull(full, b.bar, rep);
    cur = subtract(cur, b.vec, rep);
  }
  const rec = (ts, depth) => {
    const T = totalU(ts);
    if (T === 0) return { cost: 0, bars: 0, full: {}, cutU: 0 };
    const opts = [];
    if (T <= maxU) {
      const lb = leftoverBill(T / U, basis);
      if (lb) opts.push(lb.bar ? { cost: lb.bar * U, bars: 1, full: { [lb.bar]: 1 }, cutU: 0 } : { cost: T, bars: 0, full: {}, cutU: T });
    }
    if (depth < 8) {
      sizes.forEach((B) => {
        const f = bestFill(ts, Math.round(B * U));
        if (!f) return;
        const r = rec(subtract(ts, f.vec, 1), depth + 1);
        if (!r) return;
        const fm = { ...r.full }; addFull(fm, B, 1);
        opts.push({ cost: B * U + r.cost, bars: r.bars + 1, full: fm, cutU: r.cutU });
      });
    }
    if (!opts.length) return null;
    opts.sort((a, b) => (a.cost - b.cost) || (a.bars - b.bars));
    return opts[0];
  };
  const r = rec(cur, 0);
  if (!r) return null;
  Object.keys(r.full).forEach((b) => addFull(full, Number(b), r.full[b]));
  const cut = Math.round(r.cutU) / U;
  let feet = cut, fullBars = 0;
  Object.keys(full).forEach((b) => { feet += Number(b) * full[b]; fullBars += full[b]; });
  return { full, cut, fullBars, billedFeet: r2(feet) };
}
/** বার প্ল্যান লেখা: 21'-0" = 2 পিস, 9'-0" = 1 পিস */
export function barLines(plan) {
  if (!plan) return [];
  const lines = Object.keys(plan.full).map(Number).sort((a, b) => b - a)
    .filter((b) => plan.full[b] > 0).map((b) => `${fmtLen(b)} = ${plan.full[b]} পিস`);
  if (plan.cut > 0) lines.push(`${fmtLen(plan.cut)} = 1 পিস`);
  return lines;
}

/**
 * একটা জানালা: { heightRaw, widthRaw, qty, category, company, colour, discountPct,
 *   fittingCharge, glassColour, glassMM, glassRate (খালি হলে DB থেকে), netWheelQty,
 *   rateOverrides: { [key]: rate } }
 */
export function computeWindow(win, products, hwOverride = {}) {
  const hp = parseFeetInchParts(win.heightRaw), wp = parseFeetInchParts(win.widthRaw);
  const H = parseFloat(`${hp.feet}.${hp.inch}`) || hp.feet;
  const W = parseFloat(`${wp.feet}.${wp.inch}`) || wp.feet;
  const qty = num(win.qty);
  const bom = defaultBom(win.category);
  const profList = profilesForCategory(products, win.category);
  const ov = win.rateOverrides || {};

  const profileRows = bom.profile.map((item) => {
    const p = findProfile(profList, win.company, win.colour, item.name);
    const rate = ov['p:' + item.key] != null && ov['p:' + item.key] !== '' ? num(ov['p:' + item.key]) : (p ? num(p.sell_rate) : 0);
    const perWindowQty = item.basis === 'HW'
      ? r2(H * item.hMult + W * item.wMult)
      : r2((item.basis === 'H' ? H : W) * item.mult);
    const usedFeet = r2(perWindowQty * qty);
    let plan = null;
    if (qty > 0) {
      if (item.basis === 'H' || item.basis === 'W') {
        plan = packPieces([{ len: item.basis === 'H' ? H : W, n: item.mult * qty }], item.basis);
      } else if (item.basis === 'HW') {
        const halfW = r2(W / 2);
        plan = packPieces([{ len: H, n: item.hMult * qty }, { len: halfW, n: item.wMult * 2 * qty }]
          .filter((c) => c.len > 0 && c.n > 0), 'W');
      }
    }
    const totalQty = plan ? plan.billedFeet : usedFeet;
    return { ...item, code: p?.product_code || '', rate, perWindowQty, usedFeet, plan, totalQty, amount: totalQty * rate };
  });

  const hardwareRows = bom.hardware.map((item) => {
    const p = findHardware(products, item.key, hwOverride[item.key]);
    const rate = ov['h:' + item.key] != null && ov['h:' + item.key] !== '' ? num(ov['h:' + item.key]) : (p ? num(p.purchase_rate) : 0);
    let perWindowQty;
    if (item.isArea) perWindowQty = r2(H * W / 2);
    else if (item.fixedQty !== undefined) perWindowQty = item.key === 'netWheel' ? (num(win.netWheelQty) || 2) : item.fixedQty;
    else perWindowQty = r2(H * item.hMult + W * item.wMult);
    const totalQty = r2(perWindowQty * qty);
    return { ...item, code: p?.product_code || '', rate, perWindowQty, totalQty, amount: totalQty * rate };
  });

  const profileAmount = profileRows.reduce((s, x) => s + x.amount, 0);
  const hardwareAmount = hardwareRows.reduce((s, x) => s + x.amount, 0);
  const perWindowSqft = r2(H * W);
  const totalSqft = r2(perWindowSqft * qty);
  const gDb = glassRate(products, win.glassColour, win.glassMM);
  const gRate = win.glassRate !== '' && win.glassRate != null ? num(win.glassRate) : (gDb ?? 0);
  const glassAmount = totalSqft * gRate;
  const materialSubtotal = profileAmount + hardwareAmount + glassAmount;
  const discountAmount = profileAmount * (num(win.discountPct) / 100); // শুধু প্রোফাইলে
  const fittingRate = win.fittingCharge === '' || win.fittingCharge == null ? defaultFittingCharge(win.category) : num(win.fittingCharge);
  const fittingTotal = totalSqft * fittingRate;
  const grandTotal = materialSubtotal - discountAmount + fittingTotal;
  return {
    H, W, qty, sizeLabel: `${fmtFt(H)} X ${fmtFt(W)}`, profileRows, hardwareRows, profileAmount,
    hardwareAmount, perWindowSqft, totalSqft, glassRate: gRate, glassAmount, materialSubtotal,
    discountAmount, fittingRate, fittingTotal, grandTotal, perSqft: totalSqft > 0 ? grandTotal / totalSqft : 0,
  };
}

/* ============================================================ কার্টেন ওয়াল */
export const CW_COLOURS = [
  { key: 'silver', label: 'সিলভার' }, { key: 'bronze', label: 'ব্রোঞ্জ' }, { key: 'black', label: 'ব্ল্যাক' },
  { key: 'ss', label: 'এস.এস' }, { key: 'pc', label: 'পি.সি' }, { key: 'golden', label: 'গোল্ডেন' },
  { key: 'wooden', label: 'উডেন' },
];
export const CW_ANGLE_INCHES = [2, 3, 4, 5];
export const CW_BAR_LENGTHS = [21, 18.5];
export const CW_HW_ITEMS = [
  { key: 'clamp', label: 'Clamp', unit: 'পিস' },
  { key: 'royalBolt', label: 'Royal Bolt', unit: 'পিস' },
  { key: 'screw', label: '৩" স্ক্রু', unit: 'পিস' },
  { key: 'rivet', label: 'রিভেট', unit: 'পিস' },
  { key: 'masking', label: 'মাস্কিং টেপ', unit: 'ফুট' },
  { key: 'notan', label: 'নটন টেপ', unit: 'ফুট' },
  { key: 'gum', label: 'সিলিকন গাম', unit: 'পিস' },
];

function breakPieces(total, bar) {
  if (!bar || bar <= 0 || total <= 0) return { fullPieces: 0, barLength: bar || 0, remaining: 0 };
  const fullPieces = Math.floor(total / bar);
  const remaining = r2(total - fullPieces * bar);
  return { fullPieces, barLength: bar, remaining: remaining > 0.05 ? remaining : 0 };
}
export const piecesText = (p) => {
  if (!p || (!p.fullPieces && !p.remaining)) return '—';
  const parts = [];
  if (p.fullPieces > 0) parts.push(`${fmtFt(p.barLength)} × ${p.fullPieces} পিস`);
  if (p.remaining > 0) parts.push(`${fmtFt(p.remaining)} × ১ পিস`);
  return parts.join(' + ');
};
export const cwCompanies = (dies) => [...new Set(dies.map((p) => p.company).filter(Boolean))].sort();
export const cwMatchDies = (dies, company, type, inch) =>
  dies.filter((p) => lc(p.company) === lc(company) && p.section_type === type && Number(p.inch) === Number(inch));
export function cwRatePerFt(die, colourKey) {
  if (!die || !colourKey) return null;
  const price = num(die['price_' + colourKey]);
  const barFt = num(die.bar_ft) || 21;
  return price > 0 ? price / barFt : null;
}
function cwHwRate(hwRows, key) {
  const h = hwRows.find((x) => x.item_key === key);
  if (!h) return 0;
  const rate = num(h.rate);
  if (key === 'masking' || key === 'notan') { const q = num(h.pack_qty); return q > 0 ? rate / q : 0; }
  return rate;
}

/**
 * row: { heightRaw, widthRaw, qty, hCount, wCount, middleType ('sbit'|'dbit'), halfDie, mullionDie,
 *        maskingFeet, notanFeet }
 * s (সব জানালার সেটিং): { company, colour, angleInch, barLength, gumTotal, glassRate,
 *        discountPct, fitPerSqft, rates: {key: manual} }
 * allRows — সিলিকন গাম মোট থাকলে গ্লাস-সংখ্যা অনুপাতে ভাগ করতে
 */
export function computeCurtainWall(row, s, dies, hwRows, products, allRows = [row]) {
  const H = parseFeetInches(row.heightRaw), W = parseFeetInches(row.widthRaw);
  const qty = num(row.qty);
  const rows = Math.max(Math.round(num(row.hCount)), 0);
  const cols = Math.max(Math.round(num(row.wCount)), 0);
  const bar = num(s.barLength) || 21;
  const hMid = Math.max(rows - 1, 0), vMid = Math.max(cols - 1, 0);

  const frameAll = r2(r2(2 * (H + W)) * qty);
  const framePieces = breakPieces(frameAll, bar);
  const middleAll = r2(r2(hMid * W + vMid * H) * qty);
  const middlePieces = breakPieces(middleAll, bar);

  const glassCountAll = rows * cols * qty;
  const cellH = rows > 0 ? r2(H / rows) : 0, cellW = cols > 0 ? r2(W / cols) : 0;
  const glassSqftAll = r2(r2(H * W) * qty);
  const clampQty = (vMid + 2) * 2 * qty;
  const screwQty = glassCountAll;
  const angleCount = (vMid * rows * 2 + hMid * 4) * qty;
  const rivetQty = angleCount * 4;
  const angleInch = num(s.angleInch);
  const angleFeet = r2(angleCount * angleInch / 12);
  const angleWhole = Math.floor(angleCount * angleInch / 12);
  const angleLabel = `${angleWhole}'-${Math.round((angleCount * angleInch / 12 - angleWhole) * 12)}"`;
  const tapeAuto = r2(r2(2 * (cellH + cellW)) * glassCountAll);
  const masking = num(row.maskingFeet) > 0 ? num(row.maskingFeet) : tapeAuto;
  const notan = num(row.notanFeet) > 0 ? num(row.notanFeet) : tapeAuto;
  let gum = Math.round(glassCountAll / 2 * 1.5);
  if (num(s.gumTotal) > 0) {
    const allGlass = allRows.reduce((a, r) => a + Math.max(Math.round(num(r.hCount)), 0) * Math.max(Math.round(num(r.wCount)), 0) * num(r.qty), 0);
    gum = allGlass > 0 ? Math.round(num(s.gumTotal) * glassCountAll / allGlass) : 0;
  }

  // ---- টাকা ----
  const inch = angleInch;
  const pick = (type, over) => {
    const m = s.company ? cwMatchDies(dies, s.company, type, inch) : [];
    return (over && m.find((p) => p.die_no === over)) || m[0] || null;
  };
  const halfDie = pick('half', row.halfDie);
  const mullionDie = pick(row.middleType || 'sbit', row.mullionDie);
  const halfRate = cwRatePerFt(halfDie, s.colour);
  const mullionRate = cwRatePerFt(mullionDie, s.colour);
  const halfCost = halfRate != null ? Math.round(frameAll * halfRate) : 0;
  const mullionCost = mullionRate != null ? Math.round(middleAll * mullionRate) : 0;
  const angleDie = s.company ? dies.find((p) => lc(p.company) === lc(s.company) && p.section_type === 'angle') : null;

  const man = s.rates || {};
  const rateOf = (key, dbRate) => (num(man[key]) > 0 ? num(man[key]) : dbRate > 0 ? dbRate : null);
  const gDb = s.glassRate !== '' && s.glassRate != null ? num(s.glassRate) : glassRate(products, s.glassColour, s.glassMM) || 0;
  const R = {
    angle: rateOf('angle', cwRatePerFt(angleDie, s.colour) || 0),
    glass: rateOf('glass', gDb),
  };
  CW_HW_ITEMS.forEach((it) => { R[it.key] = rateOf(it.key, cwHwRate(hwRows, it.key)); });

  const missing = [];
  if (!s.company || !s.colour) { if (frameAll > 0 || middleAll > 0) missing.push('কোম্পানি ও কালার বাছুন'); } else {
    if (halfRate == null && frameAll > 0) missing.push('Half সেকশন রেট');
    if (mullionRate == null && middleAll > 0) missing.push('Mullion সেকশন রেট');
  }
  const line = (key, label, unit, q) => {
    const rate = R[key];
    if (rate == null && q > 0) missing.push(label);
    return { key, label, unit, qty: q, rate, amount: rate != null ? Math.round(q * rate) : 0 };
  };
  const lines = [
    { key: 'half', label: `Half সেকশন ${halfDie ? '(' + halfDie.die_no + ')' : ''}`, unit: 'ফুট', qty: frameAll, rate: halfRate, amount: halfCost, pieces: framePieces },
    { key: 'mullion', label: `Mullion ${(row.middleType || 'sbit') === 'dbit' ? 'D.Bit' : 'S.Bit'} ${mullionDie ? '(' + mullionDie.die_no + ')' : ''}`, unit: 'ফুট', qty: middleAll, rate: mullionRate, amount: mullionCost, pieces: middlePieces },
    line('angle', 'ফিটিং অ্যাঙ্গেল', 'ফুট', angleFeet),
    line('glass', 'গ্লাস', 'Sq.Ft', glassSqftAll),
    line('clamp', 'Clamp', 'পিস', clampQty),
    line('royalBolt', 'Royal Bolt', 'পিস', clampQty),
    line('screw', '৩" স্ক্রু', 'পিস', screwQty),
    line('rivet', 'রিভেট', 'পিস', rivetQty),
    line('masking', 'মাস্কিং টেপ', 'ফুট', masking),
    line('notan', 'নটন টেপ', 'ফুট', notan),
    line('gum', 'সিলিকন গাম', 'পিস', gum),
  ].filter((l) => l.qty > 0);
  const sub = lines.reduce((a, l) => a + l.amount, 0);
  const angleAmt = lines.find((l) => l.key === 'angle')?.amount || 0;
  const dp = Math.min(Math.max(num(s.discountPct), 0), 100);
  const disc = Math.round((halfCost + mullionCost + angleAmt) * dp / 100); // শুধু প্রোফাইলে
  const fit = Math.round(num(s.fitPerSqft) * glassSqftAll);
  const total = sub - disc + fit;
  return {
    H, W, qty, rows, cols, sizeLabel: `${fmtFt(H)} X ${fmtFt(W)}`, cellH, cellW, hMid, vMid,
    frameAll, framePieces, middleAll, middlePieces, glassCountAll, glassSqftAll, angleCount, angleFeet,
    angleLabel, halfDie, mullionDie, halfCost, mullionCost, lines, sub, disc, fit, total,
    perSqft: glassSqftAll > 0 ? total / glassSqftAll : 0, missing: [...new Set(missing)],
  };
}

/* ============================================================ সিলিং */
const BOX_IN = 24, SCREW_EVERY_IN = 24, SCREW_EXTRA = 30, RIVET_PER = 2, RIVET_EXTRA = 50;
export const CEILING_PROFILE_CODES = { ceilAngle: '1432', ceilCrossT: '9504' };
export const ceilFmt = (inches) => { inches = Math.round(Number(inches) || 0); return `${Math.floor(inches / 12)}'-${inches % 12}"`; };
const ceilIn = (v) => { const { feet, inch } = parseFeetInchParts(v); return feet * 12 + inch; };
function ceilBreak(totalIn, barIn) {
  totalIn = Math.max(Math.round(totalIn), 0);
  if (totalIn <= 0 || barIn <= 0) return { full: 0, rem: 0, totalIn, barIn };
  const full = Math.floor(totalIn / barIn);
  return { full, rem: totalIn - full * barIn, totalIn, barIn };
}
export const ceilBreakText = (b) => {
  const parts = [];
  if (b.full > 0) parts.push(`${ceilFmt(b.barIn)} × ${b.full} পিস`);
  if (b.rem > 0) parts.push(`${ceilFmt(b.rem)} × ১ পিস (অবশিষ্ট)`);
  return parts.join(' + ') || '—';
};
export const ceilingProfiles = (products) =>
  products.filter((p) => p.item_type === 'profile' && Object.values(CEILING_PROFILE_CODES).includes(String(p.product_code).trim()));

function ceilingRate(key, products, s) {
  if (CEILING_PROFILE_CODES[key]) {
    if (!s.company) return null;
    let m = ceilingProfiles(products).filter((p) => String(p.product_code).trim() === CEILING_PROFILE_CODES[key] && lc(p.company) === lc(s.company));
    if (s.colour) m = m.filter((p) => lc(p.colour) === lc(s.colour));
    const r = m.length ? num(m[0].sell_rate) : 0;
    return r > 0 ? r : null;
  }
  const panel = products.filter((p) => p.slide_category === 'thaiCeiling' || p.slide_category === 'থাই সিলিং');
  const nm = (x) => `${x.product_name || ''} ${x.product_code || ''}`;
  const isScrew = (n) => /screw|serew|\bsr\b|স্ক্রু/i.test(n), isPlug = (n) => /plug|royal|প্লাগ|রয়্যাল/i.test(n), isRivet = (n) => /rivet|রিভেট/i.test(n);
  const ok = (x) => num(x.purchase_rate) > 0 || num(x.sell_rate) > 0;
  const board = s.board ? (n) => new RegExp(s.board === 'pvc' ? 'pvc|পিভিসি' : 'gypsum|jipsum|জিপসাম', 'i').test(n) : null;
  const pick = key === 'ceilScrew' ? panel.find((x) => ok(x) && isScrew(nm(x)))
    : key === 'ceilPlug' ? panel.find((x) => ok(x) && isPlug(nm(x)))
    : key === 'ceilRivet' ? panel.find((x) => ok(x) && isRivet(nm(x)))
    : panel.find((x) => ok(x) && !isScrew(nm(x)) && !isPlug(nm(x)) && !isRivet(nm(x)) && (!board || board(nm(x))));
  return pick ? (num(pick.purchase_rate) || num(pick.sell_rate)) : null;
}

/**
 * rooms: [{ lengthRaw, widthRaw, qty }]
 * s: { barFt (21), xtInch (27), company, colour, discountPct, carrying, fittingPerSqft, guna, board, rates }
 */
export function computeCeiling(rooms, s, products) {
  const barIn = Math.round((num(s.barFt) || 21) * 12) || 252;
  const xtIn = num(s.xtInch) > 0 ? num(s.xtInch) : 27;
  const out = [];
  let sqft = 0, panels = 0, angTotal = 0, crossTotal = 0, xtPieces = 0, mainPieces = 0, screwBase = 0, ceilings = 0;
  rooms.forEach((r) => {
    const Lin = ceilIn(r.lengthRaw), Win = ceilIn(r.widthRaw);
    if (Lin <= 0 || Win <= 0) return;
    const q = parseInt(r.qty, 10) >= 1 ? parseInt(r.qty, 10) : 1;
    const bl = Math.ceil(Lin / BOX_IN - 1e-9), bw = Math.ceil(Win / BOX_IN - 1e-9);
    const lines = Math.max(bw - 1, 0);
    const c = { Lin, Win, qty: q, sqft: Lin * Win / 144, bl, bw, panels: bl * bw, angleIn: 2 * (Lin + Win),
      lines, crossTotalIn: lines * Lin, xtCount: bl * lines, uneven: Lin % BOX_IN !== 0 || Win % BOX_IN !== 0 };
    out.push(c);
    ceilings += q; sqft += c.sqft * q; panels += c.panels * q;
    angTotal += c.angleIn * q; crossTotal += c.crossTotalIn * q; xtPieces += c.xtCount * q;
    mainPieces += c.lines * q;
    screwBase += Math.ceil(c.angleIn / SCREW_EVERY_IN) * q;
  });
  const angle = ceilBreak(angTotal, barIn);
  const mainT = ceilBreak(crossTotal, barIn);
  mainT.bars = mainT.full + (mainT.rem > 0 ? 1 : 0);
  const xT = ceilBreak(xtPieces * xtIn, barIn);
  const powder = s.category === 'powder';
  const rivetRows = out.reduce((a, c) => a + (c.bl + c.bw) * c.qty, 0);
  const screwTotal = screwBase + SCREW_EXTRA * ceilings;
  // পাউডার কোড: Rivet = (দৈর্ঘ্যের সারি + প্রস্থের সারি) × ২, Cross T-র Rivet আলাদা নেই
  const rivetTotal = powder
    ? rivetRows * RIVET_PER + RIVET_EXTRA * ceilings
    : mainPieces * RIVET_PER + xtPieces * RIVET_PER + RIVET_EXTRA * ceilings;
  const q = { panelSqft: panels * 4, angleFt: angTotal / 12, crossFt: (crossTotal + xtPieces * xtIn) / 12,
    screw: screwTotal, plug: screwTotal, rivet: rivetTotal };
  const ITEMS = [
    { key: 'ceilAngle', label: 'Wall/Ceiling Angle (1432)', unit: 'ফুট', group: 'profile', q: 'angleFt' },
    { key: 'ceilCrossT', label: 'Main T + Cross T (9504)', unit: 'ফুট', group: 'profile', q: 'crossFt' },
    { key: 'ceilScrew', label: 'Screw', unit: 'পিস', group: 'hw', q: 'screw' },
    { key: 'ceilPlug', label: 'Royal Plug', unit: 'পিস', group: 'hw', q: 'plug' },
    { key: 'ceilRivet', label: 'Rivet', unit: 'পিস', group: 'hw', q: 'rivet' },
    { key: 'ceilPanel', label: "সিলিং প্যানেল / বোর্ড (২'×২')", unit: 'Sq.Ft', group: 'hw', q: 'panelSqft' },
  ];
  const man = s.rates || {};
  // পাউডার কোড: প্রোফাইল পিস হিসেবে — Wall Angle 10'-0", Main T 12'-0", Cross T 2'-0"; রেট প্রতি পিস
  const powderLines = powder ? [
    ['powderAngle', "Wall Angle (10'-0\")", 120, angTotal, /angle|অ্যাঙ্গেল|এঙ্গেল/i],
    ['powderMain', "Main T (12'-0\")", 144, crossTotal, /main|মেইন/i],
    ['powderCross', "Cross T (2'-0\")", 24, xtPieces * 24, /cross|ক্রস/i],
  ].map(([key, label, size, totalIn, re]) => {
    const qty = totalIn > 0 ? Math.ceil(totalIn / size - 1e-9) : 0;
    const list = products.filter((p) => (p.slide_category === 'powderCode' || p.slide_category === 'পাউডার কোড')
      && (num(p.sell_rate) > 0 || num(p.purchase_rate) > 0));
    const nm = (x) => `${x.product_name || ''} ${x.product_code || ''}`;
    const hit = list.find((x) => re.test(nm(x)) && (key !== 'powderCross' || !/main|মেইন/i.test(nm(x))));
    const dbRate = hit ? (num(hit.sell_rate) || num(hit.purchase_rate)) : null;
    const rate = num((s.rates || {})[key]) > 0 ? num(s.rates[key]) : dbRate;
    return { key, label, unit: 'পিস', group: 'profile', qty, rate, amount: qty * (rate || 0) };
  }) : null;
  const costLines = ITEMS.filter((it) => !powder || it.group !== 'profile').map((it) => {
    const qty = q[it.q] || 0;
    const rate = num(man[it.key]) > 0 ? num(man[it.key]) : ceilingRate(it.key, products, s);
    return { ...it, qty, rate, amount: qty * (rate || 0) };
  });
  if (powderLines) costLines.unshift(...powderLines);
  const sum = (g) => costLines.filter((l) => l.group === g).reduce((a, l) => a + l.amount, 0);
  const profileGross = sum('profile');
  const discount = profileGross * num(s.discountPct) / 100;
  const hw = sum('hw');
  const fitting = num(s.fittingPerSqft) * sqft;
  const grand = profileGross - discount + hw + num(s.guna) + num(s.carrying) + fitting;
  return {
    rooms: out, ceilings, sqft, panels, barIn, xtIn, angle, mainT, xT, xtPieces, mainPieces,
    screwTotal, rivetTotal, costLines, profileGross, discount, hw, fitting,
    carrying: num(s.carrying), guna: num(s.guna), grand, perSqft: sqft > 0 ? grand / sqft : 0,
    missing: costLines.filter((l) => l.rate == null && l.qty > 0).map((l) => l.label),
  };
}

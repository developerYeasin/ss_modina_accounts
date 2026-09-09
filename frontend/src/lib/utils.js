import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs) => twMerge(clsx(inputs));

export const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** ৳ 12,500 — amounts keep Latin digits, matching the original app. */
export function money(value, currency = '৳') {
  const n = num(value);
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
  return `${n < 0 ? '-' : ''}${currency} ${formatted}`;
}

export const qty = (value, unit) => {
  const n = num(value);
  const s = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return unit ? `${s} ${unit}` : s;
};

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
export const toBnDigits = (v) => String(v).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);

const BN_MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
const BN_DAYS = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];

export const BN_MONTH_NAMES = BN_MONTHS;

const asDate = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** ৯ সেপ্টেম্বর, ২০২৬ */
export function bnDate(value) {
  const d = asDate(value);
  if (!d) return '—';
  return `${toBnDigits(d.getDate())} ${BN_MONTHS[d.getMonth()]}, ${toBnDigits(d.getFullYear())}`;
}

/** বুধবার, ৯ সেপ্টেম্বর, ২০২৬ */
export function bnDateWithDay(value) {
  const d = asDate(value);
  if (!d) return '—';
  return `${BN_DAYS[d.getDay()]}, ${bnDate(d)}`;
}

/** yyyy-MM-dd, the shape every date column uses. */
export function isoDate(value = new Date()) {
  const d = asDate(value) || new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const monthStart = (d = new Date()) =>
  isoDate(new Date(d.getFullYear(), d.getMonth(), 1));
export const monthEnd = (d = new Date()) =>
  isoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0));

export function parseJson(value, fallback = []) {
  if (Array.isArray(value) || (value && typeof value === 'object')) return value;
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

export const sum = (rows, key) => rows.reduce((a, r) => a + num(typeof key === 'function' ? key(r) : r[key]), 0);

/** Download an array of objects as a CSV file (Excel-friendly, UTF-8 BOM). */
export function downloadCsv(filename, rows, columns) {
  if (!rows.length) return;
  const cols = columns || Object.keys(rows[0]).map((key) => ({ key, label: key }));
  const escape = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    cols.map((c) => escape(c.label)).join(','),
    ...rows.map((r) => cols.map((c) => escape(c.format ? c.format(r) : r[c.key])).join(',')),
  ].join('\n');

  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

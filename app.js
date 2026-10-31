'use strict';
/* My Finances — personal balance sheet, monthly planner and ISA tracker.
   All data lives in this browser's storage on this device. */

const KEY = 'myfinances.v1';
const APP_VERSION = '9';
const COLORS = ['#1E5E52', '#2F6F9F', '#B5651D', '#6B5B95', '#8E3B2F', '#7A6A55', '#C9A04F', '#3F7F3A'];
/* Layout colour themes: accent and its soft tint, for light and dark mode. All pass 4.5:1 with white text. */
const THEMES = {
  green: { name: 'Green', light: ['#1E5E52', '#E3F0EB', '#D5E8E2', '#4F8A7D'], dark: ['#23705F', '#1B3A33', '#CDE6DE', '#4F8A7D'] },
  blue: { name: 'Blue', light: ['#2C5A8C', '#E4ECF6', '#D6E3F3', '#5C82AD'], dark: ['#2F6AA3', '#1B2C40', '#D6E3F3', '#5C82AD'] },
  teal: { name: 'Ocean', light: ['#14636F', '#E0F0F2', '#CFE8EB', '#4E8E98'], dark: ['#187482', '#173539', '#CFE8EB', '#4E8E98'] },
  plum: { name: 'Plum', light: ['#5B3F7A', '#EEE8F5', '#E2D8EE', '#8A6FA8'], dark: ['#6E4E93', '#2C2238', '#E2D8EE', '#8A6FA8'] },
  clay: { name: 'Clay', light: ['#93452A', '#F6E9E3', '#F1DCD2', '#B97760'], dark: ['#A5543A', '#3A2219', '#F1DCD2', '#B97760'] },
  slate: { name: 'Slate', light: ['#3D4A57', '#E8ECEF', '#DCE2E8', '#6E7C8A'], dark: ['#4E5D6C', '#232A31', '#DCE2E8', '#6E7C8A'] }
};
const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
function applyTheme() {
  const pref = (S && S.settings.appearance) || 'system';
  const dark = pref === 'dark' || (pref === 'system' && darkQuery && darkQuery.matches);
  const root = document.documentElement;
  root.dataset.theme = dark ? 'dark' : 'light';
  const t = THEMES[(S && S.settings.accent) || 'green'] || THEMES.green;
  const [accent, soft, sub, rule] = dark ? t.dark : t.light;
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-soft', soft);
  root.style.setProperty('--accent-sub', sub);
  root.style.setProperty('--accent-rule', rule);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0F1412' : accent);
}
if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener('change', () => applyTheme());

/* ---------------- helpers ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => Date.now();
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const clone = (o) => JSON.parse(JSON.stringify(o));
const cleanNote = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 300);
const cleanName = (s) => String(s || '').replace(/[\[\]{}@]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);

/* ---------------- months ---------------- */
const monthOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const mDate = (id) => { const [y, m] = id.split('-').map(Number); return new Date(y, m - 1, 1); };
const addM = (id, n) => { const d = mDate(id); return monthOf(new Date(d.getFullYear(), d.getMonth() + n, 1)); };
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const mParts = (id) => id.split('-').map(Number);
const mShort = (id) => MON[mParts(id)[1] - 1];
const mLabel = (id) => `${mShort(id)} ${mParts(id)[0]}`;
const mLong = (id) => `${MONL[mParts(id)[1] - 1]} ${mParts(id)[0]}`;
const curM = () => monthOf(new Date());
const taxYear = (id) => { const [y, m] = mParts(id); return m >= 4 ? y : y - 1; };
const tyName = (y) => `${y}/${pad((y + 1) % 100)}`;
function monthRange(a, b) { const out = []; for (let x = a; x <= b && out.length < 600; x = addM(x, 1)) out.push(x); return out; }
function parseMonthLabel(s) {
  const m = /^([a-z]+)\.?\s+(\d{4})$/i.exec(String(s).trim());
  if (!m) return null;
  const i = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
  return i < 0 ? null : `${m[2]}-${pad(i + 1)}`;
}

/* ---------------- formatting ---------------- */
function fmt(n, ccy = 'GBP', dp) {
  if (n == null || typeof n !== 'number' || !isFinite(n)) return '—';
  const d = dp == null ? S.settings.decimals : dp;
  const s = Math.abs(n).toLocaleString(ccy === 'INR' ? 'en-IN' : 'en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
  const neg = n < 0 && Math.abs(n) >= Math.pow(10, -d) / 2;
  return (neg ? '−' : '') + (ccy === 'INR' ? '₹' : '£') + s;
}
const stamp = (t) => {
  if (!t) return '—';
  const d = new Date(t);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};
function parseAmount(str) {
  const t = String(str == null ? '' : str).replace(/[£₹,\s]/g, '').replace(/−/g, '-');
  if (t === '') return null;
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return NaN;
  return parseFloat(t);
}

/* ---------------- state ---------------- */
let S = null;
let undoStack = [];
const ui = { spendOpen: {}, projOpen: false, tab: 'overview', m: null, sheet: null, edit: { s: false, l: false }, ovMore: false, showHidden: { s: false, l: false }, planShowEmpty: {}, justAdded: new Set() };

function blankState() {
  const m = curM();
  const mk = (name, ccy, kind, color, isa) => ({ id: uid(), name, ccy, kind, color, isa, hidden: false, bold: false, flexible: false, dp: null, isaPrior: {}, at: now() });
  const cats = [
    mk('Stocks & Shares', 'GBP', 'held', '#2F6F9F', 'ss'),
    mk('Cash ISA / Fixed Deposit', 'GBP', 'held', '#1E5E52', 'cash'),
    mk('Indian Account', 'INR', 'held', '#B5651D', null),
    mk('Future Incoming', 'GBP', 'expected', '#C9A04F', null)
  ];
  const line = (sec, name, link = null) => ({ id: uid(), sec, name, link, behaviour: 'normal', opening: 0, bold: false, entries: {}, at: now() });
  return {
    v: 1, createdAt: now(), updatedAt: null,
    settings: {
      firstMonth: m, forecastMonths: 4, hiddenMonths: [], showPast: false, decimals: 0,
      rates: { INR: { perGBP: 111, at: null } }, under65: true, allowances: {}, carryLeft: false, lastBackup: null,
      appearance: 'system', accent: 'green', checkIn: m, changes: 0,
      proj: { rate: null, cats: null, line: true }
    },
    cats, catCells: {},
    savTotal: { f: 'SUM(' + cats.filter((c) => c.kind === 'held').map((c) => `{s:${c.id}}`).join(', ') + ')', at: now() },
    liabs: [], liabCells: {}, liabTotal: { f: 'SUM()', at: now() },
    lines: [
      line('income', 'Salary (net)'),
      line('expense', 'Rent / mortgage'), line('expense', 'Bills & utilities'), line('expense', 'Groceries'),
      line('expense', 'Transport'), line('expense', 'Other spending'),
      line('saving', 'Stocks & Shares ISA', cats[0].id), line('saving', 'Cash ISA', cats[1].id)
    ],
    repay: {}, isaOv: {}, goals: [], borrow: {}
  };
}

function migrate(d) {
  // Fill in anything missing so older or hand-edited backups still load.
  const b = blankState();
  d.settings = Object.assign({}, b.settings, d.settings || {});
  d.settings.rates = Object.assign({}, b.settings.rates, d.settings.rates || {});
  if (!d.settings.rates.INR || !(d.settings.rates.INR.perGBP > 0)) d.settings.rates.INR = { perGBP: 111, at: null };
  if (!Array.isArray(d.settings.hiddenMonths)) d.settings.hiddenMonths = [];
  d.settings.forecastMonths = Math.min(36, Math.max(0, parseInt(d.settings.forecastMonths, 10) || 0));
  if (!/^\d{4}-\d{2}$/.test(d.settings.firstMonth || '')) d.settings.firstMonth = curM();
  ['cats', 'liabs', 'lines', 'goals'].forEach((k) => { if (!Array.isArray(d[k])) d[k] = []; });
  d.goals.forEach((g) => {
    if (!Array.isArray(g.rows)) g.rows = [];
    if (g.target && typeof g.target !== 'object') g.target = null;
    if (!Array.isArray(g.spend)) g.spend = blankSpend();
  });
  ['catCells', 'liabCells', 'repay', 'isaOv', 'borrow'].forEach((k) => { if (!d[k] || typeof d[k] !== 'object') d[k] = {}; });
  // Existing data: start month check-ins from now, so nobody is asked about a month already under way.
  if (!/^\d{4}-\d{2}$/.test(d.settings.checkIn || '')) d.settings.checkIn = curM();
  if (typeof d.settings.changes !== 'number') d.settings.changes = 0;
  if (!d.settings.proj || typeof d.settings.proj !== 'object') d.settings.proj = { rate: null, cats: null, line: true };
  d.cats.forEach((c) => { c.isaPrior = c.isaPrior || {}; if (c.ccy !== 'INR') c.ccy = 'GBP'; if (c.kind !== 'expected') c.kind = 'held'; });
  d.lines.forEach((l) => { l.entries = l.entries || {}; if (!['income', 'expense', 'saving'].includes(l.sec)) l.sec = 'expense'; });
  if (!d.savTotal || typeof d.savTotal.f !== 'string') d.savTotal = { f: b.savTotal.f.replace(/\{s:[^}]+\}(, )?/g, ''), at: now() };
  if (!d.liabTotal || typeof d.liabTotal.f !== 'string') d.liabTotal = { f: 'SUM(' + d.liabs.map((l) => `{l:${l.id}}`).join(', ') + ')', at: now() };
  d.v = 1;
  return d;
}

let loadWarning = null;
function load() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) { loadWarning = 'This device is blocking storage, so changes may not be kept. Export backups often.'; }
  if (raw) {
    try { S = migrate(JSON.parse(raw)); return; }
    catch (e) {
      // Never overwrite unreadable data: keep a copy so it can be recovered from a backup or by hand.
      const copyKey = `${KEY}.unreadable-${Date.now()}`;
      try { localStorage.setItem(copyKey, raw); } catch (_) {}
      loadWarning = 'Saved data could not be read, so the app started empty. A copy was kept. Restore your latest backup in Settings.';
    }
  }
  S = blankState();
  save();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('Could not save on this device. Export a backup now.'); }
}
function mutate(fn, msg) {
  undoStack.push(JSON.stringify(S));
  if (undoStack.length > 80) undoStack.shift();
  fn();
  S.settings.changes = (S.settings.changes || 0) + 1;
  S.updatedAt = now();
  save();
  if (msg) toast(msg);
}

const rate = () => S.settings.rates.INR.perGBP;
const firstM = () => (S.settings.firstMonth <= curM() ? S.settings.firstMonth : curM());
const lastM = () => addM(curM(), S.settings.forecastMonths);
const allMonths = () => monthRange(firstM(), lastM());
function visibleMonths() {
  const start = S.settings.showPast ? firstM() : curM();
  return monthRange(start, lastM()).filter((m) => m === curM() || !S.settings.hiddenMonths.includes(m));
}
const catById = (id) => S.cats.find((c) => c.id === id);
const liabById = (id) => S.liabs.find((l) => l.id === id);
const lineById = (id) => S.lines.find((l) => l.id === id);
const goalById = (id) => S.goals.find((g) => g.id === id);
// Each goal has a simple spending plan: item name + projected spend. Starts with six empty rows.
const blankSpend = (n = 6) => Array.from({ length: n }, () => ({ id: uid(), name: '', amt: null }));
const spendSum = (g) => (g.spend || []).reduce((t, r) => t + (typeof r.amt === 'number' && isFinite(r.amt) ? r.amt : 0), 0);
const spendCount = (g) => (g.spend || []).filter((r) => typeof r.amt === 'number' && r.amt !== 0).length;
const hasTarget = (g) => spendSum(g) !== 0 || !!g.target;
const catDp = (c) => (c && c.dp != null ? c.dp : S.settings.decimals);

/* ---------------- formula engine ---------------- */
class FErr extends Error {}
const FUNCS = {
  SUM: (a) => a.reduce((x, y) => x + y, 0),
  MIN: (a) => { if (!a.length) throw new FErr('MIN needs at least one value'); return Math.min(...a); },
  MAX: (a) => { if (!a.length) throw new FErr('MAX needs at least one value'); return Math.max(...a); },
  AVERAGE: (a) => { if (!a.length) throw new FErr('AVERAGE needs at least one value'); return a.reduce((x, y) => x + y, 0) / a.length; },
  ROUND: (a) => { if (a.length < 1 || a.length > 2) throw new FErr('ROUND takes a value and optional decimal places'); const f = Math.pow(10, Math.round(a[1] || 0)); return Math.round(a[0] * f) / f; },
  ABS: (a) => { if (a.length !== 1) throw new FErr('ABS takes one value'); return Math.abs(a[0]); }
};

function tokenize(src) {
  const t = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '{') {
      const j = src.indexOf('}', i);
      if (j < 0) throw new FErr('A reference is not closed');
      const m = /^([a-zA-Z]):([^@]*)(?:@(.+))?$/.exec(src.slice(i + 1, j));
      if (!m) throw new FErr('A reference is not valid');
      t.push({ type: 'ref', kind: m[1], id: m[2], at: m[3] || null });
      i = j + 1; continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const s = src.slice(i, j);
      if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) throw new FErr(`“${s}” is not a number`);
      t.push({ type: 'num', v: parseFloat(s) });
      i = j; continue;
    }
    if (/[A-Za-z]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z]/.test(src[j])) j++;
      t.push({ type: 'fn', name: src.slice(i, j).toUpperCase() });
      i = j; continue;
    }
    const map = { '×': '*', '÷': '/', '−': '-', 'x': '*' };
    if ('+-*/^%(),×÷−'.includes(c)) { t.push({ type: 'op', v: map[c] || c }); i++; continue; }
    if (c === '£') { i++; continue; }
    if (c === '₹') throw new FErr('Formulas work in £. Refer to an INR category instead of typing ₹ amounts.');
    if (c === '[' || c === ']') throw new FErr('Check the square brackets around references');
    throw new FErr(`Unexpected “${c}”`);
  }
  return t;
}
function resolveAt(at, m) {
  if (!at) return m;
  if (at === 'prev') return addM(m, -1);
  if (at === 'next') return addM(m, 1);
  if (/^\d{4}-\d{2}$/.test(at)) return at;
  throw new FErr('A month in a reference is not valid');
}
function evaluate(src, month, get) {
  const t = tokenize(src);
  let p = 0;
  const peek = () => t[p];
  const isOp = (v) => peek() && peek().type === 'op' && peek().v === v;
  const expect = (v, msg) => { if (!isOp(v)) throw new FErr(msg); p++; };
  function expr() {
    let v = term();
    while (isOp('+') || isOp('-')) { const o = t[p++].v; const r = term(); v = o === '+' ? v + r : v - r; }
    return v;
  }
  function term() {
    let v = unary();
    while (isOp('*') || isOp('/')) {
      const o = t[p++].v; const r = unary();
      if (o === '/') { if (r === 0) throw new FErr('Division by zero'); v /= r; } else v *= r;
    }
    return v;
  }
  function unary() {
    if (isOp('-')) { p++; return -unary(); }
    if (isOp('+')) { p++; return unary(); }
    return power();
  }
  function power() {
    const v = postfix();
    if (isOp('^')) { p++; return Math.pow(v, unary()); }
    return v;
  }
  function postfix() {
    let v = primary();
    while (isOp('%')) { p++; v /= 100; }
    return v;
  }
  function primary() {
    const tk = t[p++];
    if (!tk) throw new FErr('The formula ends too early');
    if (tk.type === 'num') return tk.v;
    if (tk.type === 'ref') return get(tk.kind, tk.id, resolveAt(tk.at, month));
    if (tk.type === 'op' && tk.v === '(') { const v = expr(); expect(')', 'A “)” is missing'); return v; }
    if (tk.type === 'fn') {
      const F = FUNCS[tk.name];
      if (!F) throw new FErr(`Unknown function “${tk.name}”. Use SUM, MIN, MAX, AVERAGE, ROUND or ABS.`);
      expect('(', `${tk.name} needs brackets, like ${tk.name}(…)`);
      const args = [];
      if (!isOp(')')) { args.push(expr()); while (isOp(',')) { p++; args.push(expr()); } }
      expect(')', 'A “)” is missing');
      return F(args);
    }
    if (tk.type === 'op' && tk.v === ',') throw new FErr('Unexpected comma. Write 1200, not 1,200');
    throw new FErr(`Unexpected “${tk.v}”`);
  }
  if (!t.length) throw new FErr('The formula is empty');
  const v = expr();
  if (p < t.length) {
    const tk = t[p];
    if (tk.type === 'op' && tk.v === ',') throw new FErr('Unexpected comma. Write 1200, not 1,200');
    if (tk.type === 'op' && tk.v === ')') throw new FErr('There is an extra “)”');
    throw new FErr('Something is missing between values. Add +, −, × or ÷');
  }
  if (!isFinite(v)) throw new FErr('The result is not a number');
  return v;
}

/* Calculation cache with circular-reference detection */
let memo = new Map();
let stack = [];
function resetCalc() { memo = new Map(); stack = []; }
function keyLabel(k) {
  const [kind, id, m] = k.split('|');
  const ml = m && m !== '_' ? ` (${mShort(m)})` : '';
  const names = {
    s: () => 'Savings: ' + (catById(id) || {}).name, l: () => 'Liability: ' + (liabById(id) || {}).name,
    p: () => 'Plan: ' + (lineById(id) || {}).name, pu: () => 'Plan: ' + (lineById(id) || {}).name,
    rp: () => 'Repayment: ' + (liabById(id) || {}).name, ru: () => 'Repayment: ' + (liabById(id) || {}).name,
    T: () => 'Total savings', L: () => 'Total liabilities', PS: () => 'Plan summary',
    g: () => 'Goal: ' + (goalById(id) || {}).name, gt: () => 'Goal target: ' + (goalById(id) || {}).name,
    gr: () => { const g = S.goals.find((x) => x.rows.some((r) => r.id === id)); const r = g && g.rows.find((x) => x.id === id); return g ? `Goal: ${g.name} › ${r.label}` : 'Goal line'; }
  };
  return (names[kind] ? names[kind]() : kind) + ml;
}
function calc(key, fn) {
  if (memo.has(key)) { const r = memo.get(key); if (r instanceof FErr) throw r; return r; }
  const at = stack.indexOf(key);
  if (at >= 0) {
    const chain = stack.slice(at).concat(key).map(keyLabel);
    const uniq = chain.filter((x, i) => i === 0 || x !== chain[i - 1]);
    throw new FErr('Circular reference: ' + uniq.join(' → '));
  }
  if (stack.length > 4000) throw new FErr('This calculation is too deeply nested');
  stack.push(key);
  try { const v = fn(); memo.set(key, v); return v; }
  catch (e) { const err = e instanceof FErr ? e : new FErr(e && e.message ? e.message : String(e)); memo.set(key, err); throw err; }
  finally { stack.pop(); }
}
function safe(fn) { try { return fn(); } catch (e) { return e instanceof FErr ? e : new FErr(String(e && e.message || e)); } }

function getRef(kind, id, m) {
  switch (kind) {
    case 's': if (!catById(id)) throw new FErr('Missing reference: a savings category used here was deleted'); return catGBP(id, m);
    case 'l': if (!liabById(id)) throw new FErr('Missing reference: a liability used here was deleted'); return liabVal(id, m);
    case 'p': if (!lineById(id)) throw new FErr('Missing reference: a plan row used here was deleted'); return lineUsed(lineById(id), m);
    case 'r': if (!liabById(id)) throw new FErr('Missing reference: a liability used here was deleted'); return repayUsed(id, m);
    case 'g': if (!goalById(id)) throw new FErr('Missing reference: a goal used here was deleted'); return goalAvail(id, m);
    case 'T': return savTotal(m);
    case 'L': return liabTotal(m);
    case 'x': return rate();
    default: throw new FErr('Unknown reference');
  }
}
const evalIn = (f, m) => evaluate(f, m, getRef);

/* Savings */
function catNative(id, m) {
  return calc(`s|${id}|${m}`, () => {
    const cat = catById(id);
    if (!cat) throw new FErr('Missing reference');
    if (m < firstM()) return 0;
    const cell = (S.catCells[id] || {})[m];
    const toNative = (g) => (cat.ccy === 'INR' ? g * rate() : g);
    if (cell && cell.f) return toNative(evalIn(cell.f, m));
    if (cell && cell.v != null) return cell.v;
    if (m === firstM()) return 0;
    let v = catNative(id, addM(m, -1));
    v += catGrowth(id, m);
    for (const ln of S.lines) if (ln.sec === 'saving' && ln.link === id) v += toNative(lineUsed(ln, m));
    return v;
  });
}
// Expected investment growth: an annual % turned into a monthly rate on last month's balance.
const monthlyRate = (pct) => Math.pow(1 + (Number(pct) || 0) / 100, 1 / 12) - 1;
function catGrowth(id, m) {
  const c = catById(id);
  if (!c || !c.growth || m <= firstM()) return 0;
  const cell = (S.catCells[id] || {})[m];
  if (cell && (cell.f || cell.v != null)) return 0;
  return catNative(id, addM(m, -1)) * monthlyRate(c.growth);
}
/* "What if" growth projection on investments (Overview only; never changes the main forecast).
   The yearly rate becomes the monthly rate that compounds to exactly that rate over 12 months.
   Each month: last month's projected balance grows by one month, then that month's saving is added,
   so every saving starts growing from the month after it goes in. */
function projCats() {
  const p = S.settings.proj || {};
  if (Array.isArray(p.cats)) return p.cats.filter((id) => catById(id));
  return S.cats.filter((c) => c.kind === 'held' && (c.isa === 'ss' || /stock|share|invest|fund/i.test(c.name))).map((c) => c.id);
}
const projRate = () => { const r = (S.settings.proj || {}).rate; return typeof r === 'number' && isFinite(r) ? r : null; };
function projNative(id, m) {
  return calc(`pj|${id}|${m}`, () => {
    const cat = catById(id);
    if (m <= curM() || projRate() == null) return catNative(id, m);
    const cell = (S.catCells[id] || {})[m];
    if (cell && (cell.f || cell.v != null)) return catNative(id, m);
    const toNative = (g) => (cat.ccy === 'INR' ? g * rate() : g);
    let v = projNative(id, addM(m, -1)) * (1 + monthlyRate(projRate()));
    for (const ln of S.lines) if (ln.sec === 'saving' && ln.link === id) v += toNative(lineUsed(ln, m));
    return v;
  });
}
function projTotal(m) {
  return calc(`PT|_|${m}`, () => {
    const set = new Set(projCats());
    return evaluate(S.savTotal.f || '0', m, (k, id, mm) => {
      if (k === 's' && set.has(id)) { const c = catById(id); const v = projNative(id, mm); return c.ccy === 'INR' ? v / rate() : v; }
      return getRef(k, id, mm);
    });
  });
}
function catGBP(id, m) { const c = catById(id); const v = catNative(id, m); return c.ccy === 'INR' ? v / rate() : v; }
const savTotal = (m) => calc(`T|_|${m}`, () => evalIn(S.savTotal.f || '0', m));

/* Liabilities */
function liabVal(id, m) {
  return calc(`l|${id}|${m}`, () => {
    if (m < firstM()) return 0;
    const cell = (S.liabCells[id] || {})[m];
    if (cell && cell.f) return evalIn(cell.f, m);
    if (cell && cell.v != null) return cell.v;
    // First month with no typed balance: only this month's borrowing counts.
    if (m === firstM()) return Math.max(0, borrowAmt(id, m) - repayUsed(id, m));
    return Math.max(0, liabVal(id, addM(m, -1)) + borrowAmt(id, m) - repayUsed(id, m));
  });
}
const liabTotal = (m) => calc(`L|_|${m}`, () => evalIn(S.liabTotal.f || '0', m));

/* Plan amounts: an entry is one-off (this month only) or recurring (this month onwards). */
function findEntry(entries, m) {
  const e = (entries || {})[m];
  if (e && (e.f || e.amt != null)) return { e, from: m };
  for (let k = addM(m, -1); k >= firstM(); k = addM(k, -1)) {
    const x = (entries || {})[k];
    if (x && (x.f || x.amt != null) && !x.once) return { e: x, from: k };
  }
  return null;
}
// A plan row exists from its start month (when it was added) until its end month (when it was removed).
const lineActive = (ln, m) => (!ln.start || m >= ln.start) && (!ln.end || m < ln.end);
function linePlanned(ln, m) {
  return calc(`p|${ln.id}|${m}`, () => {
    if (m < firstM() || !lineActive(ln, m)) return 0;
    const r = findEntry(ln.entries, m);
    if (!r) return 0;
    return r.e.f ? evalIn(r.e.f, m) : r.e.amt;
  });
}
function lineUsed(ln, m) {
  return calc(`pu|${ln.id}|${m}`, () => {
    if (!lineActive(ln, m)) return 0;
    const e = (ln.entries || {})[m];
    return e && e.actual != null ? e.actual : linePlanned(ln, m);
  });
}
function lineClosing(ln, m) {
  let v = Number(ln.opening) || 0;
  for (const k of monthRange(firstM(), m)) v += lineUsed(ln, k);
  return v;
}

/* Repayments: every liability appears in the plan; switch it on or off per month. */
// New borrowing on a liability in a month (e.g. spending on a card). Raises the balance and funds the plan.
// `amt` is borrowing you entered; `over` is an overspend covered with borrowing (flagged in red).
function borrowAmt(id, m) {
  const e = (S.borrow[id] || {})[m];
  if (!e) return 0;
  return (Number(e.amt) > 0 ? Number(e.amt) : 0) + (Number(e.over) > 0 ? Number(e.over) : 0);
}
function manualBorrow(id, m) {
  const e = (S.borrow[id] || {})[m];
  return e && Number(e.amt) > 0 ? Number(e.amt) : 0;
}
function overAmt(id, m) {
  const e = (S.borrow[id] || {})[m];
  return e && Number(e.over) > 0 ? Number(e.over) : 0;
}
// Overspend still sitting in a liability's balance by month m (never more than the balance).
function overInBalance(id, m) {
  let tot = 0;
  for (const k of monthRange(firstM(), m)) tot += overAmt(id, k);
  if (!tot) return 0;
  const bal = safe(() => liabVal(id, m));
  return typeof bal === 'number' ? Math.min(tot, bal) : tot;
}
function repayOn(id, m) {
  const e = (S.repay[id] || {})[m];
  if (e && e.on != null) return e.on;
  const l = liabById(id);
  return !!(l && l.autoPay);
}
function repayAmountRaw(id, m) {
  const l = liabById(id);
  const r = findEntry(S.repay[id], m);
  if (!r) return Number(l.repay) || 0;
  return r.e.f ? evalIn(r.e.f, m) : r.e.amt;
}
function repayPlanned(id, m) {
  return calc(`rp|${id}|${m}`, () => {
    if (m < firstM() || !repayOn(id, m)) return 0;
    const amt = Math.max(0, repayAmountRaw(id, m));
    if (m === firstM()) return amt;
    return Math.min(amt, Math.max(0, liabVal(id, addM(m, -1)) + borrowAmt(id, m)));
  });
}
function repayUsed(id, m) {
  return calc(`ru|${id}|${m}`, () => {
    const e = (S.repay[id] || {})[m];
    return e && e.actual != null ? e.actual : repayPlanned(id, m);
  });
}

function planSummary(m) {
  return calc(`PS|_|${m}`, () => {
    const r = { income: 0, expense: 0, saving: 0, repay: 0, pIncome: 0, pExpense: 0, pSaving: 0, pRepay: 0, bf: 0 };
    for (const ln of S.lines) {
      r[ln.sec] += lineUsed(ln, m);
      r['p' + ln.sec[0].toUpperCase() + ln.sec.slice(1)] += linePlanned(ln, m);
    }
    r.borrow = 0; r.over = 0;
    for (const l of S.liabs) { r.repay += repayUsed(l.id, m); r.pRepay += repayPlanned(l.id, m); r.borrow += borrowAmt(l.id, m); r.over += overAmt(l.id, m); }
    if (S.settings.carryLeft && m > firstM()) r.bf = Math.max(0, planSummary(addM(m, -1)).left);
    r.left = r.income + r.bf + r.borrow - r.expense - r.saving - r.repay;
    return r;
  });
}

/* Goals: fully manual lines; any amount can be a formula that pulls from other tabs. */
function goalRowVal(g, r, m) {
  return calc(`gr|${r.id}|${m}`, () => (r.f ? evalIn(r.f, m) : Number(r.v) || 0));
}
function goalAvail(id, m) {
  return calc(`g|${id}|${m}`, () => { const g = goalById(id); return g.rows.reduce((t, r) => t + goalRowVal(g, r, m), 0); });
}
function goalTarget(g, m) {
  // The spending plan total is the target whenever it has amounts.
  if (spendSum(g) !== 0) return spendSum(g);
  if (!g.target) return null;
  return calc(`gt|${g.id}|${m}`, () => (g.target.f ? evalIn(g.target.f, m) : Number(g.target.v) || 0));
}
function monthsUntil(target) {
  if (!target) return null;
  const [y1, m1] = mParts(curM()), [y2, m2] = mParts(target);
  return (y2 - y1) * 12 + (m2 - m1);
}

/* ISA */
function allowance(ty) {
  const a = S.settings.allowances[ty] || {};
  return {
    overall: a.overall != null ? a.overall : 20000,
    cash: a.cash !== undefined ? a.cash : (ty >= 2027 && S.settings.under65 ? 12000 : null),
    lisa: a.lisa != null ? a.lisa : 4000
  };
}
const isaCats = () => S.cats.filter((c) => c.isa);
function isaLinked(cat, m) {
  let v = 0;
  for (const ln of S.lines) if (ln.sec === 'saving' && ln.link === cat.id) { const x = safe(() => lineUsed(ln, m)); if (typeof x === 'number') v += x; }
  return v;
}
function isaContribution(cat, m) {
  const ov = (S.isaOv[cat.id] || {})[m];
  if (ov && ov.amt != null) return ov.amt;
  return isaLinked(cat, m);
}
function isaYear(ty) {
  const months = allMonths().filter((m) => taxYear(m) === ty);
  let used = 0, cash = 0, lisa = 0;
  for (const c of isaCats()) {
    const prior = Number(c.isaPrior[ty]) || 0;
    used += prior; if (c.isa === 'cash') cash += prior; if (c.isa === 'lisa') lisa += prior;
  }
  const rows = months.map((m) => {
    let add = 0, wdCounted = 0, parts = [], ov = false;
    for (const c of isaCats()) {
      const v = isaContribution(c, m);
      const o = (S.isaOv[c.id] || {})[m];
      if (o && o.amt != null) ov = true;
      const wd = (o && o.wd) || 0;
      const back = c.flexible ? wd : 0;
      add += v; wdCounted += back;
      used += v - back;
      if (c.isa === 'cash') cash += v - back;
      if (c.isa === 'lisa') lisa += v - back;
      if (v) parts.push(`${c.name} ${fmt(v)}`);
    }
    return { m, add, wd: wdCounted, used, cash, lisa, parts, ov };
  });
  return { ty, rows, used, cash, lisa, a: allowance(ty) };
}

/* Readable references */
function refName(kind, id) {
  switch (kind) {
    case 's': return 'Savings: ' + ((catById(id) || {}).name || '(deleted)');
    case 'l': return 'Liability: ' + ((liabById(id) || {}).name || '(deleted)');
    case 'p': return 'Plan: ' + ((lineById(id) || {}).name || '(deleted)');
    case 'r': return 'Repayment: ' + ((liabById(id) || {}).name || '(deleted)');
    case 'g': return 'Goal: ' + ((goalById(id) || {}).name || '(deleted)');
    case 'T': return 'Total savings';
    case 'L': return 'Total liabilities';
    case 'x': return 'Rate ₹ per £';
    default: return '?';
  }
}
function atLabel(at) {
  if (!at) return '';
  if (at === 'prev') return ' @ previous month';
  if (at === 'next') return ' @ next month';
  return ' @ ' + mLabel(at);
}
const REF_RE = /\{([a-zA-Z]):([^}@]*)(?:@([^}]+))?\}/g;
function toDisplay(f) { return String(f || '').replace(REF_RE, (_, k, id, at) => '[' + refName(k, id) + atLabel(at) + ']'); }
function findRefByName(name) {
  const n = name.trim().toLowerCase();
  if (n === 'total savings') return { kind: 'T', id: '_' };
  if (n === 'total liabilities') return { kind: 'L', id: '_' };
  if (n === 'rate ₹ per £' || n === 'rate inr per gbp' || n === 'rate') return { kind: 'x', id: 'INR' };
  const m = /^(savings|liability|plan|repayment|goal)\s*:\s*(.+)$/i.exec(name.trim());
  if (!m) return null;
  const nm = m[2].trim().toLowerCase();
  const by = (arr) => arr.find((x) => x.name.trim().toLowerCase() === nm);
  const t = m[1].toLowerCase();
  if (t === 'savings') { const c = by(S.cats); return c && { kind: 's', id: c.id }; }
  if (t === 'liability') { const c = by(S.liabs); return c && { kind: 'l', id: c.id }; }
  if (t === 'plan') { const c = by(S.lines); return c && { kind: 'p', id: c.id }; }
  if (t === 'repayment') { const c = by(S.liabs); return c && { kind: 'r', id: c.id }; }
  if (t === 'goal') { const c = by(S.goals); return c && { kind: 'g', id: c.id }; }
  return null;
}
function toInternal(text) {
  let src = String(text || '').trim();
  if (src.startsWith('=')) src = src.slice(1);
  if (/[{}]/.test(src)) throw new FErr('Curly brackets aren’t allowed. Use [ ] for references');
  const out = src.replace(/\[([^\]]*)\]/g, (_, inner) => {
    const parts = inner.split('@');
    const name = parts[0].trim();
    let atId = null;
    if (parts.length > 2) throw new FErr(`Only one month allowed in “[${inner}]”`);
    if (parts.length === 2) {
      const a = parts[1].trim().toLowerCase();
      if (a === 'previous month' || a === 'prev' || a === 'previous') atId = 'prev';
      else if (a === 'next month' || a === 'next') atId = 'next';
      else { atId = parseMonthLabel(a); if (!atId) throw new FErr(`Unknown month “${parts[1].trim()}”. Use e.g. “Nov 2026” or “previous month”`); }
    }
    if (!name) throw new FErr('An empty [ ] reference');
    const r = findRefByName(name);
    if (!r) throw new FErr(`Missing reference: nothing is called “${name}”`);
    return '{' + r.kind + ':' + r.id + (atId ? '@' + atId : '') + '}';
  });
  if (/[\[\]]/.test(out)) throw new FErr('Check the square brackets around references');
  // Two references side by side are added together.
  return out.replace(/\}\s*(?=\{)/g, '} + ').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  return out.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
}
function usesRef(f, kind, id) { return typeof f === 'string' && new RegExp(`\\{${kind}:${id}(@[^}]*)?\\}`).test(f); }
function removeRefFromSum(f, kind, id) {
  let r = String(f || '').replace(new RegExp(`\\{${kind}:${id}(@[^}]*)?\\}`, 'g'), '');
  for (let i = 0; i < 5; i++) r = r.replace(/\(\s*,\s*/g, '(').replace(/,\s*,/g, ',').replace(/,\s*\)/g, ')').replace(/\+\s*\+/g, '+').replace(/^\s*\+\s*/, '').replace(/\s*\+\s*$/, '');
  return r.trim() || 'SUM()';
}
function addRefToSum(f, ref) {
  const s = String(f || '').trim();
  if (/^SUM\(\s*\)$/i.test(s) || s === '' || s === '0') return `SUM(${ref})`;
  const m = /^SUM\((.*)\)$/i.exec(s);
  if (m && balanced(m[1])) return `SUM(${m[1]}, ${ref})`;
  return `${s} + ${ref}`;
}
function balanced(s) { let d = 0; for (const c of s) { if (c === '(') d++; if (c === ')') { d--; if (d < 0) return false; } } return d === 0; }
function allFormulas() {
  const out = [];
  const push = (where, f) => { if (f) out.push({ where, f }); };
  push('Total savings formula', S.savTotal.f);
  push('Total liabilities formula', S.liabTotal.f);
  for (const c of S.cats) for (const [m, cell] of Object.entries(S.catCells[c.id] || {})) push(`Savings › ${c.name} › ${mLabel(m)}`, cell.f);
  for (const l of S.liabs) for (const [m, cell] of Object.entries(S.liabCells[l.id] || {})) push(`Liabilities › ${l.name} › ${mLabel(m)}`, cell.f);
  for (const ln of S.lines) for (const [m, e] of Object.entries(ln.entries)) push(`Plan › ${mLabel(m)} › ${ln.name}`, e.f);
  for (const l of S.liabs) for (const [m, e] of Object.entries(S.repay[l.id] || {})) push(`Plan › ${mLabel(m)} › Repayment ${l.name}`, e.f);
  for (const g of S.goals) {
    if (g.target) push(`Goals › ${g.name} › Target`, g.target.f);
    for (const r of g.rows) push(`Goals › ${g.name} › ${r.label}`, r.f);
  }
  return out;
}
function usagesOf(kind, id) {
  return allFormulas().filter((x) => usesRef(x.f, kind, id)).map((x) => x.where);
}

/* ---------------- UI helpers ---------------- */
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.h);
  toast.h = setTimeout(() => t.classList.remove('show'), Math.max(2600, msg.length * 60));
}
const ICON = {
  overview: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  savings: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  liab: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
  plan: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  isa: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 9 9h-9z"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  goals: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  down: '<path d="M12 5v14M19 12l-7 7-7-7"/>'
};
const svg = (name, size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;

function header(title) {
  const d = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return `<header class="top"><div><div class="date">${esc(d)}</div><h1>${esc(title)}</h1></div>
    <div class="actions"><button class="iconbtn" data-act="undo" aria-label="Undo last change" ${undoStack.length ? '' : 'disabled'}>${svg('undo')}</button>
    <button class="iconbtn" data-act="openSettings" aria-label="Settings, backup and export">${svg('gear')}</button></div></header>
    <div class="stamp">${S.updatedAt ? 'Last change: ' + esc(stamp(S.updatedAt)) : 'No changes yet'}</div>${backupBanner()}`;
}
function monthChip(m) { return m === curM() ? 'Now' : mShort(m) + (mParts(m)[0] !== mParts(curM())[0] ? ` ’${String(mParts(m)[0]).slice(2)}` : ''); }
function chips() {
  return `<div class="chips" role="tablist" aria-label="Month">${visibleMonths().map((m) =>
    `<button class="chip ${m === ui.m ? 'on' : ''}" data-act="pickMonth" data-m="${m}" role="tab" aria-selected="${m === ui.m}">${esc(monthChip(m))}</button>`).join('')}
    <button class="chip add" data-act="openMonths" aria-label="Add, hide or show months">+</button></div>`;
}
/* Inline amount fields: type straight into the list; ⋯ opens the advanced editor. */
function numStr(n, dp) {
  if (typeof n !== 'number' || !isFinite(n)) return '';
  const d = dp == null ? 2 : Math.min(2, dp);
  return n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: d, useGrouping: true });
}
function inlineInput(o) {
  const key = `${o.kind}|${o.k || ''}|${o.id}|${o.m}`;
  return `<span class="inl ${o.cls}"><span class="cur" aria-hidden="true">${o.ccy === 'INR' ? '₹' : '£'}</span><input class="num" data-inl="${o.kind}" data-k="${o.k || ''}" data-id="${esc(o.id)}" data-m="${o.m}" data-key="${esc(key)}" data-orig="${esc(o.value)}" value="${esc(o.value)}" placeholder="${esc(o.ph || '0')}" inputmode="decimal" enterkeyhint="done" autocomplete="off" aria-label="${esc(o.label)}"${o.bold ? ' style="font-weight:800"' : ''}></span>`;
}
function moreBtn(act, data, name) {
  const attrs = Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ');
  return `<button class="morebtn" data-act="${act}" ${attrs} aria-label="Advanced options for ${esc(name)}: formula, one-off or recurring, more">⋯</button>`;
}
function commitInline(el) {
  const d = el.dataset;
  if (el.value.trim() === d.orig.trim()) return false;
  if (d.inl === 'spname') {
    const name = String(el.value).replace(/\s+/g, ' ').trim().slice(0, 60);
    d.orig = el.value;
    mutate(() => { const g = goalById(d.id); const r = g && g.spend.find((x) => x.id === d.k); if (r) r.name = name; });
    return true;
  }
  const n = parseAmount(el.value);
  if (n != null && isNaN(n)) { toast(`“${el.value}” isn’t a number`); el.value = d.orig; return false; }
  if (n != null && n < 0 && (d.inl === 'repay' || d.inl === 'spamt' || d.k === 'l')) { toast('Use a positive amount'); el.value = d.orig; return false; }
  if (d.inl === 'projRate' && n != null && (n < -50 || n > 50)) { toast('Use a yearly return between −50% and 50%'); el.value = d.orig; return false; }
  const m = d.m;
  d.orig = el.value; // stops a second save when the field then loses focus
  if (d.inl === 'cell') {
    const store = d.k === 's' ? S.catCells : S.liabCells;
    mutate(() => {
      store[d.id] = store[d.id] || {};
      if (n == null) delete store[d.id][m]; else store[d.id][m] = { v: n, f: null, at: now() };
    }, n == null ? (m > firstM() ? 'Back to automatic' : 'Cleared') : null);
  } else if (d.inl === 'plan' || d.inl === 'actual') {
    const ln = lineById(d.id);
    if (!ln) return false;
    mutate(() => {
      const e = Object.assign({ amt: null, f: null, once: false, actual: null }, ln.entries[m] || {});
      if (d.inl === 'plan') { e.amt = n; e.f = null; } else e.actual = n;
      e.at = now();
      if (e.amt == null && !e.f && e.actual == null) delete ln.entries[m]; else ln.entries[m] = e;
      ln.at = now();
    }, d.inl === 'plan' && n == null ? 'Using the recurring amount' : null);
  } else if (d.inl === 'spamt') {
    mutate(() => { const g = goalById(d.id); const r = g && g.spend.find((x) => x.id === d.k); if (r) r.amt = n; });
  } else if (d.inl === 'projRate') {
    mutate(() => { S.settings.proj = Object.assign({ cats: null, line: true }, S.settings.proj, { rate: n }); }, n == null ? 'Growth projection off' : null);
  } else if (d.inl === 'grow' || d.inl === 'gtarget') {
    const g = goalById(d.id);
    if (!g) return false;
    mutate(() => {
      const gg = goalById(d.id);
      if (d.inl === 'gtarget') gg.target = n == null ? null : { v: n, f: null };
      else { const r = gg.rows.find((x) => x.id === d.k); if (r) { r.v = n; r.f = null; r.at = now(); } }
      gg.at = now();
    }, d.inl === 'gtarget' && n == null ? 'Target removed' : null);
  } else if (d.inl === 'repay') {
    const l = liabById(d.id);
    if (!l) return false;
    mutate(() => {
      S.repay[d.id] = S.repay[d.id] || {};
      const e = Object.assign({}, S.repay[d.id][m] || {});
      e.amt = n; e.f = null; e.at = now();
      if (n != null && n > 0) e.on = true; // typing an amount means "pay this"
      if (e.amt == null && e.actual == null && e.on == null) delete S.repay[d.id][m]; else S.repay[d.id][m] = e;
    });
  }
  return true;
}
let inlineTimer = null;
function scheduleRender() { clearTimeout(inlineTimer); inlineTimer = setTimeout(() => render(), 0); }
function valOrErr(fn, show) {
  const r = safe(fn);
  if (r instanceof FErr) return { err: r.message, html: `<span class="v err">⚠ Error</span>` };
  return { v: r, html: show(r) };
}

/* ---------------- screens ---------------- */
function forecastList(fn) {
  const months = visibleMonths().filter((m) => m > curM());
  const shown = ui.ovMore ? months : months.slice(0, 4);
  let html = shown.map((m) => { const r = safe(() => fn(m)); return `<div class="fr num"><span>${esc(mShort(m))} ${mParts(m)[0] !== mParts(curM())[0] ? '’' + String(mParts(m)[0]).slice(2) : ''}</span><span>${r instanceof FErr ? '⚠' : esc(fmt(r))}</span></div>`; }).join('');
  if (!months.length) html = '<div class="fr"><span>No forecast months</span></div>';
  return { html, extra: months.length - 4 };
}
function projCard() {
  const p = S.settings.proj || {};
  const r = projRate();
  const cats = projCats().map((id) => catById(id).name);
  const months = visibleMonths().filter((m) => m > curM());
  const rateField = `<span class="inl manual" style="width:96px"><input class="num" data-inl="projRate" data-id="proj" data-m="${curM()}" data-key="projRate" data-orig="${r == null ? '' : esc(String(r))}" value="${r == null ? '' : esc(String(r))}" placeholder="e.g. 8" inputmode="decimal" enterkeyhint="done" autocomplete="off" aria-label="Yearly return in percent"><span class="cur" aria-hidden="true">%</span></span>`;
  let body = '';
  if (!cats.length) body = `<p class="note" style="margin:0">No investment category found. <button class="linkbtn" data-act="openProjCats">Choose which savings grow ›</button></p>`;
  else if (r == null) body = `<p class="note" style="margin:0">What yearly return are you assuming for ${esc(cats.join(', '))}? Enter a %, e.g. 8.</p>`;
  else if (!months.length) body = '<p class="note" style="margin:0">Add forecast months to see a projection.</p>';
  else {
    const rows = months.map((m) => { const a = safe(() => savTotal(m)), b = safe(() => projTotal(m)); const bad = a instanceof FErr || b instanceof FErr;
      return `<div class="pjrow"><span>${esc(monthChip(m))}</span><span class="num">${bad ? '⚠' : esc(fmt(a))}</span><span class="num" style="font-weight:700">${bad ? '⚠' : esc(fmt(b))}</span><span class="num" style="color:var(--accent);font-weight:600">${bad ? '' : esc((b - a >= 0 ? '+' : '−') + fmt(Math.abs(b - a)).replace('−', ''))}</span></div>`; }).join('');
    const lastM = months[months.length - 1];
    const a = safe(() => savTotal(lastM)), b = safe(() => projTotal(lastM));
    const sum = a instanceof FErr || b instanceof FErr ? '' : `At ${r}% a year, savings could reach <b>${esc(fmt(b))}</b> by ${esc(mLabel(lastM))}, which is ${esc(fmt(b - a))} more than without growth.`;
    body = `<p class="note" style="margin:0;color:var(--ink)">${sum}</p>
      ${ui.projOpen ? `<div class="pjtable"><div class="pjrow h"><span>MONTH</span><span>FORECAST</span><span>WITH GROWTH</span><span>GROWTH</span></div>${rows}</div>
      <p class="note" style="margin:0">Growth applies to ${esc(cats.join(', '))} only. ${r}% a year compounds monthly (${(monthlyRate(r) * 100).toFixed(3)}% a month); each month’s saving starts growing the month after it goes in. Your main forecast doesn’t change. Returns aren’t guaranteed. <button class="linkbtn" style="min-height:32px" data-act="openProjCats">Change which savings grow ›</button></p>` : ''}
      <button class="more" style="text-decoration:underline;min-height:36px;border:0;background:none;color:var(--accent);font-weight:600;padding:0;text-align:left" data-act="projToggle">${ui.projOpen ? 'Hide table' : 'Show month by month'}</button>`;
  }
  return `<section class="card pad" style="display:flex;flex-direction:column;gap:10px">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><span style="display:flex;flex-direction:column;gap:2px"><span class="cap2">WITH INVESTMENT GROWTH</span><span class="small muted">Yearly return</span></span>${rateField}</div>
    ${body}</section>`;
}
function trendChart() {
  const months = visibleMonths();
  if (months.length < 2) return '';
  const val = (fn, m) => { const v = safe(() => fn(m)); return typeof v === 'number' ? v : null; };
  const sv = months.map((m) => val(savTotal, m)), lv = months.map((m) => val(liabTotal, m));
  const showP = projRate() != null && projCats().length && (S.settings.proj || {}).line !== false;
  const pv = projRate() != null && projCats().length ? months.map((m) => val(projTotal, m)) : [];
  const all = sv.concat(lv).concat(showP ? pv : []).filter((v) => v != null);
  if (!all.length) return '';
  const max = Math.max(1, ...all) * 1.08, min = Math.min(0, ...all);
  const W = 320, H = 150, pl = 6, pr = 6, pt = 10, pb = 22;
  const x = (i) => pl + ((W - pl - pr) * i) / (months.length - 1);
  const y = (v) => pt + (H - pt - pb) * (1 - (v - min) / (max - min || 1));
  const pts = (arr) => arr.map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean).join(' ');
  const dots = (arr, cls) => arr.map((v, i) => (v == null ? '' : `<circle class="${cls}" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3"/>`)).join('');
  const step = Math.ceil(months.length / 6);
  const labels = months.map((m, i) => (i % step === 0 || i === months.length - 1 ? `<text x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === months.length - 1 ? 'end' : 'middle'}" class="ch-t">${esc(m === curM() ? 'Now' : mShort(m))}</text>` : '')).join('');
  const first = (a) => a.find((v) => v != null), last = (a) => [...a].reverse().find((v) => v != null);
  const desc = `Savings ${fmt(first(sv))} now to ${fmt(last(sv))} in ${mLabel(months[months.length - 1])}; liabilities ${fmt(first(lv))} to ${fmt(last(lv))}.`;
  return `<section class="card pad" style="display:flex;flex-direction:column;gap:8px">
    <span class="cap2">TREND</span>
    <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(desc)}">
      <line x1="${pl}" x2="${W - pr}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" class="ch-base"/>
      ${showP ? `<polyline points="${pts(pv)}" class="ch-p"/>` : ''}
      <polyline points="${pts(sv)}" class="ch-s"/><polyline points="${pts(lv)}" class="ch-l"/>
      ${dots(sv, 'ch-sd')}${dots(lv, 'ch-ld')}${labels}</svg>
    <div class="legend"><span><i style="background:var(--accent)"></i>Savings ${esc(fmt(first(sv)))} → ${esc(fmt(last(sv)))}</span><span><i style="background:var(--liab)"></i>Liabilities (dashed) ${esc(fmt(first(lv)))} → ${esc(fmt(last(lv)))}</span>${showP ? `<span><i style="background:var(--accent-rule)"></i>With ${projRate()}% growth (dotted) → ${esc(fmt(last(pv)))}</span>` : ''}</div>
    ${pv.length ? `<div class="check" style="min-height:40px"><span style="font-size:14px">Show growth line</span><button class="switch" role="switch" aria-checked="${showP ? 'true' : 'false'}" aria-label="Show growth line on the trend chart" data-act="projLine"></button></div>` : ''}
  </section>`;
}
function backupBanner() {
  const n = S.settings.changes || 0;
  const old = S.settings.lastBackup && now() - S.settings.lastBackup > 30 * 864e5;
  if (n < 10 && !(n > 0 && (old || !S.settings.lastBackup) && S.updatedAt && now() - S.createdAt > 7 * 864e5)) return '';
  return `<div class="banner"><span>${n} change${n === 1 ? '' : 's'} since your ${S.settings.lastBackup ? 'last backup' : 'start (no backup yet)'}. Your data is only on this device.</span><button data-act="exportJSON">Back up</button></div>`;
}
const needCheckIn = () => curM() > (S.settings.checkIn || curM()) && curM() > firstM();
function screenOverview() {
  const cm = curM();
  const sav = safe(() => savTotal(cm)), lia = safe(() => liabTotal(cm));
  const fs = forecastList(savTotal), fl = forecastList(liabTotal);
  const toggle = fs.extra > 0 ? `<button class="more" data-act="ovMore">${ui.ovMore ? 'Show fewer months' : `Show ${fs.extra} more month${fs.extra > 1 ? 's' : ''}`}</button>` : '';
  const exp = S.cats.filter((c) => c.kind === 'expected' && !c.hidden);
  const ps = safe(() => planSummary(cm));
  const isa = safe(() => isaYear(taxYear(cm)));
  let isaLeft = '—';
  if (!(isa instanceof FErr) && isaCats().length) {
    const row = isa.rows.find((r) => r.m === cm);
    isaLeft = fmt(isa.a.overall - (row ? row.used : isa.used));
  }
  const noData = !Object.keys(S.catCells).some((k) => Object.keys(S.catCells[k]).length);
  return `<main class="screen">${header('Overview')}
    ${noData ? `<div class="banner"><span>Start by entering your current balances.</span><button data-act="tab" data-tab="savings">Savings</button></div>` : ''}
    ${needCheckIn() ? `<div class="banner" style="background:var(--calc);border-color:var(--calc);color:var(--calc-ink)"><span><b>New month.</b> Check your ${esc(mLong(curM()))} balances so forecasts stay accurate.</span><button data-act="openCheckIn">Check</button></div>` : ''}
    <div class="grid2">
      <section class="ov sav" aria-label="Savings">
        <span class="sub">Savings · now</span>
        <span class="big num">${sav instanceof FErr ? '⚠' : esc(fmt(sav))}</span>
        <div class="rule"></div><span class="cap">FORECAST</span>${fs.html}${toggle}
        <button data-act="inspect" data-k="s">Breakdown</button>
      </section>
      <section class="ov lia" aria-label="Liabilities">
        <span class="sub">Liabilities · now</span>
        <span class="big num">${lia instanceof FErr ? '⚠' : esc(fmt(lia))}</span>
        ${(() => { const o = S.liabs.reduce((t, l) => t + overInBalance(l.id, cm), 0); return o > 0.005 ? `<span class="tag over" style="align-self:flex-start">Includes ${esc(fmt(o))} overspend</span>` : ''; })()}
        <div class="rule"></div><span class="cap" style="color:var(--muted)">FORECAST</span>${fl.html}${toggle}
        <button data-act="inspect" data-k="l">Breakdown</button>
      </section>
    </div>
    <p class="note" style="margin:-4px 0 0">Shown separately. Liabilities are never subtracted from savings. Forecasts follow your Plan.</p>
    ${projCard()}
    ${trendChart()}
    ${exp.map((c) => { const r = safe(() => catNative(c.id, cm)); return `<button class="expected" data-act="tab" data-tab="savings"><span style="display:flex;flex-direction:column;gap:2px"><span class="tag" style="background:none;padding:0">EXPECTED · NOT COUNTED</span><span style="font-weight:600">${esc(c.name)}</span></span><span class="v num" style="border:0;background:none">${r instanceof FErr ? '⚠' : esc(fmt(r, c.ccy, catDp(c)))}</span></button>`; }).join('')}
    <div class="grid2">
      <button class="tile" data-act="tab" data-tab="plan"><span class="sub">${esc(mLong(cm).split(' ')[0])} plan</span><span class="val num">${ps instanceof FErr ? '⚠' : esc(fmt(ps.left))}</span><span class="sub small">left to allocate</span></button>
      <button class="tile" data-act="tab" data-tab="isa"><span class="sub">ISA allowance left</span><span class="val num">${esc(isaLeft)}</span><span class="sub small">Tax year ${tyName(taxYear(cm))}</span></button>
    </div>
    ${S.goals.length ? `<button class="card pad" data-act="tab" data-tab="goals" style="text-align:left;display:flex;flex-direction:column;gap:6px;color:var(--ink)"><span class="cap2">GOALS</span>
      ${S.goals.map((g) => { const a = safe(() => goalAvail(g.id, cm)); const t = hasTarget(g) ? safe(() => goalTarget(g, cm)) : null;
        return `<span class="kv" style="width:100%"><span>${esc(g.name)}</span><span class="num" style="font-weight:600">${a instanceof FErr ? '⚠' : esc(fmt(a))}${t != null ? ` <span class="muted" style="font-weight:400">of ${t instanceof FErr ? '⚠' : esc(fmt(t))}</span>` : ''}</span></span>`; }).join('')}</button>` : ''}
    <div class="legend" style="padding:4px 2px">
      <span><i style="background:var(--card);border:1px solid var(--field)"></i>Typed value</span>
      <span><i style="background:var(--calc)"></i>Calculated (ƒ)</span>
      <span><i style="background:var(--exp);border:1.5px dashed var(--exp-line)"></i>Expected</span>
      <span><i style="background:var(--err)"></i>Needs fixing</span>
    </div></main>`;
}

function catSource(c, m) {
  const cell = (S.catCells[c.id] || {})[m];
  if (cell && cell.f) return 'ƒ Formula';
  if (cell && cell.v != null) return 'Typed · ' + stamp(cell.at).split(',')[0];
  if (m <= firstM()) return 'Not entered yet · tap to enter';
  const linked = S.lines.filter((l) => l.sec === 'saving' && l.link === c.id);
  const g = c.growth ? ` + ${c.growth}%/yr growth` : '';
  return linked.length ? `ƒ Previous month${g} + Plan` : `ƒ Previous month${g}`;
}
function screenSavings() {
  const m = ui.m;
  const tot = safe(() => savTotal(m));
  const editing = ui.edit.s;
  const cats = S.cats.filter((c) => editing || ui.showHidden.s || !c.hidden);
  const hiddenCount = S.cats.filter((c) => c.hidden).length;
  const rows = cats.map((c, i) => {
    if (editing) {
      return `<div class="row ${c.hidden ? 'hiddenrow' : ''}"><span class="dot" style="background:${esc(c.color)}"></span>
        <span class="main"><span class="name">${esc(c.name)}</span><span class="meta">${c.kind === 'expected' ? 'Expected' : 'Held'} · ${c.ccy}${c.isa ? ' · ISA' : ''}${c.hidden ? ' · Hidden' : ''}</span></span>
        <button class="mini" data-act="moveCat" data-id="${c.id}" data-dir="-1" aria-label="Move ${esc(c.name)} up" ${i === 0 ? 'disabled' : ''}>${svg('up', 18)}</button>
        <button class="mini" data-act="moveCat" data-id="${c.id}" data-dir="1" aria-label="Move ${esc(c.name)} down" ${i === cats.length - 1 ? 'disabled' : ''}>${svg('down', 18)}</button>
        <button class="mini" data-act="editCat" data-id="${c.id}">Edit</button></div>`;
    }
    const cell = (S.catCells[c.id] || {})[m];
    const typed = cell && cell.v != null && !cell.f;
    const r = safe(() => catNative(c.id, m));
    const isErr = r instanceof FErr;
    const gbp = c.ccy === 'INR' && !isErr ? `≈ ${fmt(r / rate(), 'GBP', catDp(c))} at ₹${rate().toFixed(2)}/£` : '';
    const blankFirst = m <= firstM() && !cell;
    const control = isErr || (cell && cell.f)
      ? `<button class="v ${isErr ? 'err' : 'calc'}" data-act="editCell" data-k="s" data-id="${c.id}" data-m="${m}" aria-label="${esc(c.name)}: formula. Open to edit">${esc(isErr ? '⚠ Error' : 'ƒ ' + fmt(r, c.ccy, catDp(c)))}</button>`
      : inlineInput({ kind: 'cell', k: 's', id: c.id, m, ccy: c.ccy, bold: c.bold,
        value: typed ? numStr(cell.v) : blankFirst ? '' : numStr(r, catDp(c)),
        cls: c.kind === 'expected' ? 'exp' : typed || blankFirst ? 'manual' : 'calc',
        label: `${c.name}, ${mLong(m)}, amount in ${c.ccy === 'INR' ? 'rupees' : 'pounds'}` });
    return `<div class="row ${c.hidden ? 'hiddenrow' : ''}">
      <span class="dot" style="background:${esc(c.color)}"></span>
      <span class="main"><span class="name ${c.bold ? 'b' : ''}">${esc(c.name)}</span><span class="meta">${isErr ? esc(r.message) : esc((c.kind === 'expected' ? 'Expected · not in total · ' : '') + catSource(c, m))}</span>${gbp ? `<span class="meta num">${esc(gbp)}</span>` : ''}${c.note ? `<span class="meta rownote">${esc(c.note)}</span>` : ''}</span>
      ${control}${moreBtn('editCell', { k: 's', id: c.id, m }, c.name)}</div>`;
  }).join('');
  return `<main class="screen">${header('Savings')}
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:-6px">
      ${hiddenCount && !editing ? `<button class="mini" data-act="toggleHidden" data-k="s">${ui.showHidden.s ? 'Hide hidden' : `Show ${hiddenCount} hidden`}</button>` : ''}
      <button class="mini" data-act="toggleEdit" data-k="s" aria-pressed="${editing}">${editing ? 'Done' : 'Edit list'}</button></div>
    ${chips()}
    <button class="hero" data-act="editTotal" data-k="s">
      <span class="lab">Total savings · ${esc(m === curM() ? 'now' : mLong(m))}</span>
      <span class="big num">${tot instanceof FErr ? '⚠ Error' : esc(fmt(tot))}</span>
      <span class="fx">ƒ ${esc(toDisplay(S.savTotal.f))}</span>
      ${tot instanceof FErr ? `<span class="fx" style="color:#FFD9D2">${esc(tot.message)}</span>` : ''}
      <span class="edit">Edit total formula</span></button>
    <div class="card list">${rows || '<div class="row"><span class="main muted">No categories yet.</span></div>'}</div>
    <button class="addbtn" data-act="newCat">+ Add category</button>
    ${S.cats.some((c) => c.ccy === 'INR') ? `<button class="linkbtn" data-act="openRate">₹ → £ rate: ₹${rate().toFixed(2)} per £1 · ${S.settings.rates.INR.at ? 'changed ' + esc(stamp(S.settings.rates.INR.at)) : 'default, please check'} ›</button>` : ''}
  </main>`;
}

function liabSource(l, m) {
  const cell = (S.liabCells[l.id] || {})[m];
  if (cell && cell.f) return 'ƒ Formula';
  if (cell && cell.v != null) return 'Typed · ' + stamp(cell.at).split(',')[0];
  if (m <= firstM()) return 'Not entered yet · tap to enter';
  const prev = safe(() => liabVal(l.id, addM(m, -1)));
  const b = borrowAmt(l.id, m);
  if (b) { const r0 = safe(() => repayUsed(l.id, m)); const o = overAmt(l.id, m); return `ƒ Previous + borrowed ${fmt(b)}${o ? ` (${fmt(o)} overspend)` : ''}${typeof r0 === 'number' && r0 > 0 ? ' − repaid ' + fmt(r0) : ''}`; }
  if (prev === 0) return 'Paid off';
  const r = safe(() => repayUsed(l.id, m));
  if (typeof r === 'number' && r > 0) return `ƒ Previous − repayment ${fmt(r)}`;
  return `ƒ No repayment in ${mShort(m)}`;
}
function screenLiab() {
  const m = ui.m;
  const tot = safe(() => liabTotal(m));
  const editing = ui.edit.l;
  const items = S.liabs.filter((l) => editing || ui.showHidden.l || !l.hidden);
  const hiddenCount = S.liabs.filter((l) => l.hidden).length;
  const rows = items.map((l, i) => {
    if (editing) {
      return `<div class="row ${l.hidden ? 'hiddenrow' : ''}"><span class="dot" style="background:${esc(l.color)}"></span>
        <span class="main"><span class="name">${esc(l.name)}</span><span class="meta">Default repayment ${esc(fmt(Number(l.repay) || 0))}${l.autoPay ? ' · every month' : ''}${l.hidden ? ' · Hidden' : ''}</span></span>
        <button class="mini" data-act="moveLiab" data-id="${l.id}" data-dir="-1" aria-label="Move ${esc(l.name)} up" ${i === 0 ? 'disabled' : ''}>${svg('up', 18)}</button>
        <button class="mini" data-act="moveLiab" data-id="${l.id}" data-dir="1" aria-label="Move ${esc(l.name)} down" ${i === items.length - 1 ? 'disabled' : ''}>${svg('down', 18)}</button>
        <button class="mini" data-act="editLiab" data-id="${l.id}">Edit</button></div>`;
    }
    const cell = (S.liabCells[l.id] || {})[m];
    const typed = cell && cell.v != null && !cell.f;
    const r = safe(() => liabVal(l.id, m));
    const isErr = r instanceof FErr;
    const blankFirst = m <= firstM() && !cell;
    const control = isErr || (cell && cell.f)
      ? `<button class="v ${isErr ? 'err' : 'calc'}" data-act="editCell" data-k="l" data-id="${l.id}" data-m="${m}" aria-label="${esc(l.name)}: formula. Open to edit">${esc(isErr ? '⚠ Error' : 'ƒ ' + fmt(r))}</button>`
      : inlineInput({ kind: 'cell', k: 'l', id: l.id, m, ccy: 'GBP', bold: l.bold,
        value: typed ? numStr(cell.v) : blankFirst ? '' : numStr(r),
        cls: typed || blankFirst ? 'manual' : 'calc', label: `${l.name}, ${mLong(m)}, balance in pounds` });
    return `<div class="row ${l.hidden ? 'hiddenrow' : ''}">
      <span class="dot" style="background:${esc(l.color)}"></span>
      <span class="main"><span class="name ${l.bold ? 'b' : ''}">${esc(l.name)}</span>${(() => { const o = overInBalance(l.id, m); return o > 0.005 ? `<span class="tag over">Includes ${esc(fmt(o))} overspend</span>` : ''; })()}<span class="meta">${esc(isErr ? r.message : liabSource(l, m))}</span>${l.note ? `<span class="meta rownote">${esc(l.note)}</span>` : ''}</span>
      ${control}${moreBtn('editCell', { k: 'l', id: l.id, m }, l.name)}</div>`;
  }).join('');
  const rep = safe(() => S.liabs.reduce((t, l) => t + repayUsed(l.id, m), 0));
  return `<main class="screen">${header('Liabilities')}
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:-6px">
      ${hiddenCount && !editing ? `<button class="mini" data-act="toggleHidden" data-k="l">${ui.showHidden.l ? 'Hide hidden' : `Show ${hiddenCount} hidden`}</button>` : ''}
      <button class="mini" data-act="toggleEdit" data-k="l" aria-pressed="${editing}">${editing ? 'Done' : 'Edit list'}</button></div>
    ${chips()}
    <div class="hero liab compact">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <span class="lab">Total liabilities · ${esc(m === curM() ? 'now' : mLong(m))}</span>
        <button class="linkbtn" style="min-height:36px;font-size:13px" data-act="editTotal" data-k="l" aria-label="Edit total liabilities formula">ƒ Formula</button></div>
      <span class="big num">${tot instanceof FErr ? '⚠ Error' : esc(fmt(tot))}</span>
      ${tot instanceof FErr ? `<span class="fx" style="color:var(--err-ink)">${esc(tot.message)}</span>` : ''}</div>
    <div class="card list">${rows || '<div class="row"><span class="main muted">No liabilities. Add one if you have any.</span></div>'}</div>
    <button class="addbtn" data-act="newLiab">+ Add liability</button>
    ${S.liabs.length ? `<button class="card pad" data-act="tab" data-tab="plan" style="text-align:left;display:flex;justify-content:space-between;gap:12px;align-items:center;color:var(--ink)">
      <span><b style="font-size:15px">Repayments · ${esc(m === curM() ? 'this month' : mShort(m))}</b><br><span class="small muted">Each liability appears in Plan. Choose there which to pay.</span></span>
      <span class="num" style="font-weight:700;color:var(--calc-ink)">${rep instanceof FErr ? '⚠' : esc(fmt(rep))}</span></button>` : ''}
  </main>`;
}

function lineTag(ln, m) {
  if (ln.behaviour === 'carry') return '<span class="tag carry">Carry forward</span>';
  const e = ln.entries[m];
  if (e && (e.f || e.amt != null)) return e.once ? '<span class="tag once">One-off</span>' : '<span class="tag">Recurring</span>';
  const r = findEntry(ln.entries, m);
  if (r) return `<span class="tag">Recurring · from ${esc(mShort(r.from))}</span>`;
  return '<span class="tag none">Not set</span>';
}
function screenPlan() {
  const m = ui.m;
  const ps = safe(() => planSummary(m));
  const secs = [
    ['income', 'Income', 'Money coming in'],
    ['expense', 'Expenses', 'Spending'],
    ['saving', 'Savings allocations', 'Transfers to your own accounts. Not spending, and counted once'],
  ];
  const secHTML = secs.map(([k, title, note]) => {
    const lines = S.lines.filter((l) => l.sec === k && lineActive(l, m));
    const tot = ps instanceof FErr ? '⚠' : fmt(ps[k]);
    const isEmpty = (ln) => {
      if (ui.justAdded.has(ln.id)) return false;
      const f = findEntry(ln.entries, m);
      if (f && f.e.f) return false;
      const u = safe(() => lineUsed(ln, m));
      return typeof u === 'number' && Math.abs(u) < 0.005;
    };
    const shown = ui.planShowEmpty[k] ? lines : lines.filter((ln) => !isEmpty(ln));
    const hiddenN = lines.length - shown.length;
    const rows = shown.map((ln) => {
      const pl = safe(() => linePlanned(ln, m));
      const e = ln.entries[m] || {};
      const own = e.f || e.amt != null;
      const found = findEntry(ln.entries, m);
      const isF = found && found.e.f;
      const link = ln.sec === 'saving' ? (catById(ln.link) ? '→ ' + catById(ln.link).name : 'Not linked to a savings category') : '';
      const closing = ln.behaviour === 'carry' ? safe(() => lineClosing(ln, m)) : null;
      const sub = [link, closing != null ? `Closing ${closing instanceof FErr ? '⚠' : fmt(closing)} → next month` : ''].filter(Boolean).join(' · ');
      const planCtl = pl instanceof FErr || isF
        ? `<button class="v ${pl instanceof FErr ? 'err' : 'calc'}" data-act="editLine" data-id="${ln.id}" data-m="${m}" aria-label="${esc(ln.name)} planned: formula. Open to edit">${esc(pl instanceof FErr ? '⚠ Error' : 'ƒ ' + fmt(pl))}</button>`
        : inlineInput({ kind: 'plan', id: ln.id, m, ccy: 'GBP', value: own ? numStr(e.amt) : found ? numStr(pl) : '', cls: own || !found ? 'manual' : 'calc', label: `${ln.name}, ${mLong(m)}, planned amount` });
      const actNote = e.actual != null ? `Actual ${fmt(e.actual)} used instead (set in ⋯)` : '';
      const meta = [sub, actNote].filter(Boolean).join(' · ') + (ln.note ? `${sub || actNote ? ' · ' : ''}${ln.note}` : '');
      return `<div class="row prow1">
        <span class="main"><span class="pname" style="font-weight:${ln.bold ? 800 : 600}">${esc(ln.name)}</span>${lineTag(ln, m)}${meta ? `<span class="meta">${esc(meta)}</span>` : ''}</span>
        ${planCtl}${moreBtn('editLine', { id: ln.id, m }, ln.name)}</div>`;
    }).join('');
    const bf = k === 'income' && ps && !(ps instanceof FErr) && ps.bf ? `<div class="prow2"><div class="ptop"><span class="pname">Brought forward from ${esc(mShort(addM(m, -1)))}</span><span class="tag carry">Carry forward</span><span class="num" style="margin-left:auto;font-weight:600">${esc(fmt(ps.bf))}</span></div></div>` : '';
    const moreToggle = hiddenN > 0 || ui.planShowEmpty[k]
      ? (lines.some(isEmpty) ? `<button class="inlineadd muted" style="color:var(--muted)" data-act="planEmpty" data-sec="${k}">${ui.planShowEmpty[k] ? 'Hide empty rows' : `Show ${hiddenN} empty row${hiddenN > 1 ? 's' : ''}`}</button>` : '')
      : '';
    return `<section class="card sec"><div class="head"><div class="t"><h2>${title}</h2><span class="num" style="font-weight:700">${esc(tot)}</span></div><span class="small muted">${note}</span></div>
      ${bf}${rows}${moreToggle}<button class="inlineadd" data-act="newLine" data-sec="${k}">+ Add row</button></section>`;
  }).join('');

  const repAll = S.liabs.filter((l) => !l.hidden);
  const repEmpty = (l) => { const u = safe(() => repayUsed(l.id, m)); return typeof u === 'number' && Math.abs(u) < 0.005 && !borrowAmt(l.id, m); };
  // (rows with borrowing or an overspend are always shown)
  const repShown = ui.planShowEmpty.repay ? repAll : repAll.filter((l) => !repEmpty(l));
  const repHidden = repAll.length - repShown.length;
  const repRows = repShown.map((l) => {
    const on = repayOn(l.id, m);
    const prev = m > firstM() ? safe(() => liabVal(l.id, addM(m, -1))) : null;
    const used = safe(() => repayUsed(l.id, m));
    const raw = safe(() => repayAmountRaw(l.id, m));
    const e = (S.repay[l.id] || {})[m];
    const borrowed = borrowAmt(l.id, m);
    const paidOff = prev === 0 && !borrowed;
    let sub;
    if (paidOff) sub = 'Already paid off';
    else if (e && e.actual != null) sub = `Actual paid ${fmt(e.actual)} (used instead of plan)`;
    else if (on) { const after = safe(() => liabVal(l.id, m)); sub = m > firstM() ? `Paying · balance after ${after instanceof FErr ? '⚠' : fmt(after)}` : 'Paying this month'; }
    else sub = `Not paying in ${mShort(m)}`;
    const overM = overAmt(l.id, m);
    if (borrowed - overM > 0) sub = `Borrowed ${fmt(borrowed - overM)} · ` + sub;
    const overTag = overM ? `<span class="tag over">Overspend ${esc(fmt(overM))} added</span>` : '';
    const ownAmt = e && e.amt != null && !e.f;
    const isF = (e && e.f) || ((findEntry(S.repay[l.id], m) || { e: {} }).e.f);
    let ctl;
    if (paidOff) ctl = '<span class="v off" style="text-decoration:none">Paid off</span>';
    else if (used instanceof FErr || raw instanceof FErr || isF) ctl = `<button class="v ${used instanceof FErr || raw instanceof FErr ? 'err' : 'calc'}" data-act="editRepay" data-id="${l.id}" data-m="${m}" aria-label="${esc(l.name)} repayment: formula. Open to edit">${esc(used instanceof FErr || raw instanceof FErr ? '⚠ Error' : 'ƒ ' + fmt(on ? used : raw))}</button>`;
    else ctl = inlineInput({ kind: 'repay', id: l.id, m, ccy: 'GBP', value: numStr(on ? safe(() => repayPlanned(l.id, m)) : raw), cls: !on ? 'off' : ownAmt ? 'manual' : 'calc', label: `${l.name}, ${mLong(m)}, repayment in pounds` });
    return `<div class="rrow">
        <span style="flex:1 1 auto;display:flex;flex-direction:column;gap:3px;min-width:0"><span style="font-size:15px;font-weight:600">${esc(l.name)}</span>${overTag}<span class="small muted">${esc(sub)}</span></span>
        ${ctl}
        ${paidOff ? '' : `<button class="switch" role="switch" aria-checked="${on}" aria-label="Pay ${esc(l.name)} in ${esc(mLong(m))}" data-act="toggleRepay" data-id="${l.id}" data-m="${m}"></button>`}
        ${moreBtn('editRepay', { id: l.id, m }, l.name + ' repayment')}</div>`;
  }).join('');
  const left = ps instanceof FErr ? null : ps.left;
  const leftCls = left == null ? 'over' : Math.abs(left) < 0.005 ? 'ok' : left < 0 ? 'over' : 'spare';
  return `<main class="screen">${header('Plan')}${chips()}
    ${ps instanceof FErr ? `<div class="box bad">${esc(ps.message)}</div>` : ''}
    <div class="sum3">
      <div><span class="k">In${!(ps instanceof FErr) && ps.borrow ? ' (incl. borrowing)' : ''}</span><span class="n num">${ps instanceof FErr ? '⚠' : esc(fmt(ps.income + ps.bf + ps.borrow))}</span></div>
      <div><span class="k">Allocated</span><span class="n num">${ps instanceof FErr ? '⚠' : esc(fmt(ps.expense + ps.saving + ps.repay))}</span></div>
      <div class="${leftCls}"><span class="k" style="color:inherit">${left != null && left < -0.005 ? 'Over by' : 'Left'}</span><span class="n num">${left == null ? '⚠' : esc(fmt(Math.abs(left) < 0.005 ? 0 : Math.abs(left)))}</span></div>
    </div>
    ${left != null && left < -0.005 ? `<div class="overbox" role="alert"><span><b>Over by ${esc(fmt(-left))}</b> in ${esc(mLong(m))}. Cover it with borrowing so it’s tracked as a liability.</span><button data-act="openCover" data-m="${m}">Cover with borrowing</button></div>` : ''}
    ${!(ps instanceof FErr) && ps.over ? `<div class="overnote"><span><b>${esc(fmt(ps.over))} overspend</b> covered by borrowing on ${esc(S.liabs.filter((l) => overAmt(l.id, m)).map((l) => l.name).join(', '))}. Change it with ⋯ on that liability below.</span></div>` : ''}
    ${secHTML}
    <section class="card sec"><div class="head"><div class="t"><h2>Liability repayments</h2><span class="num" style="font-weight:700">${ps instanceof FErr ? '⚠' : esc(fmt(ps.repay))}</span></div>
      <span class="small muted">Every liability is listed automatically. Switch on to pay it this month. Tap ⋯ to record new borrowing (e.g. spending on a card): it raises the balance and counts as money in.</span>
      ${!(ps instanceof FErr) && ps.borrow ? `<span class="small" style="color:var(--liab);font-weight:600">Borrowed this month: ${esc(fmt(ps.borrow))}</span>` : ''}</div>
      ${repRows || (repAll.length ? '' : '<div class="rrow"><span class="muted small">No liabilities yet. Add them in the Liabilities tab.</span></div>')}
      ${repAll.some(repEmpty) ? `<button class="inlineadd" style="color:var(--muted)" data-act="planEmpty" data-sec="repay">${ui.planShowEmpty.repay ? 'Hide liabilities with nothing to pay' : `Show ${repHidden} with nothing to pay this month`}</button>` : ''}</section>
  </main>`;
}

function progressRing(pct, color) {
  const c = 2 * Math.PI * 22;
  return `<svg width="60" height="60" viewBox="0 0 52 52" role="img" aria-label="${Math.round(pct)}% of target" style="flex:0 0 auto">
    <circle cx="26" cy="26" r="22" fill="none" stroke="var(--line2)" stroke-width="6"/>
    <circle cx="26" cy="26" r="22" fill="none" stroke="${esc(color)}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${((pct / 100) * c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 26 26)"/>
    <text x="26" y="30" text-anchor="middle" font-size="12" font-weight="700" fill="var(--ink)">${Math.round(pct)}%</text></svg>`;
}
function goalLineCtl(g, r) {
  const v = safe(() => goalRowVal(g, r, curM()));
  if (v instanceof FErr || r.f) {
    return `<button class="v ${v instanceof FErr ? 'err' : 'calc'}" data-act="editGoalRow" data-gid="${g.id}" data-rid="${r.id}" aria-label="${esc(r.label)}: formula. Open to edit">${esc(v instanceof FErr ? '⚠ Error' : 'ƒ ' + fmt(v))}</button>`;
  }
  return inlineInput({ kind: 'grow', k: r.id, id: g.id, m: curM(), ccy: 'GBP', value: r.v == null ? '' : numStr(r.v), cls: 'manual', label: `${g.name}, ${r.label}, amount in pounds` });
}
function spendTable(g) {
  const open = !!ui.spendOpen[g.id];
  const sum = spendSum(g), n = spendCount(g);
  const rows = (g.spend || []).map((r, i) => `<div class="sprow">
      <input class="spname" data-inl="spname" data-id="${g.id}" data-k="${r.id}" data-m="${curM()}" data-key="spname|${r.id}" data-orig="${esc(r.name || '')}" value="${esc(r.name || '')}" placeholder="Item ${i + 1}" maxlength="60" autocomplete="off" enterkeyhint="next" aria-label="${esc(g.name)} spending item ${i + 1} name">
      <span class="inl manual"><span class="cur" aria-hidden="true">£</span><input class="num" data-inl="spamt" data-id="${g.id}" data-k="${r.id}" data-m="${curM()}" data-key="spamt|${r.id}" data-orig="${r.amt == null ? '' : esc(numStr(r.amt))}" value="${r.amt == null ? '' : esc(numStr(r.amt))}" placeholder="0" inputmode="decimal" enterkeyhint="done" autocomplete="off" aria-label="${esc(r.name || 'Item ' + (i + 1))} projected spend in pounds"></span></div>`).join('');
  return `<div class="sptable">
    <button class="sphead" data-act="spendToggle" data-id="${g.id}" aria-expanded="${open}">
      <span style="font-weight:700">Spending plan</span>
      <span class="num muted" style="margin-left:auto">${esc(fmt(sum))}${n ? ` · ${n} item${n > 1 ? 's' : ''}` : ''}</span>
      <span aria-hidden="true" style="width:18px;text-align:right">${open ? '▴' : '▾'}</span></button>
    ${open ? `<div class="sprow h"><span>ITEM</span><span style="text-align:right">PROJECTED SPEND</span></div>${rows}
      <div class="sprow" style="border-top:1px solid var(--line2);padding-top:10px"><span style="font-weight:700">Total = target</span><span class="num" style="font-weight:800;text-align:right">${esc(fmt(sum))}</span></div>
      <button class="inlineadd" style="border-top:0;padding:0" data-act="spendAdd" data-id="${g.id}">+ Add row</button>` : ''}
  </div>`;
}
function screenGoals() {
  const m = curM();
  const cards = S.goals.map((g) => {
    const avail = safe(() => goalAvail(g.id, m));
    const tgt = hasTarget(g) ? safe(() => goalTarget(g, m)) : null;
    const aErr = avail instanceof FErr, tErr = tgt instanceof FErr;
    const fromSpend = spendSum(g) !== 0;
    let tCtl;
    if (fromSpend) tCtl = `<span class="v calc" aria-label="Target from spending plan">${esc(fmt(tgt))}</span>`;
    else if (g.target && (tErr || g.target.f)) tCtl = `<button class="v ${tErr ? 'err' : 'calc'}" data-act="editGoal" data-id="${g.id}" aria-label="Target: formula. Open to edit">${esc(tErr ? '⚠ Error' : 'ƒ ' + fmt(tgt))}</button>`;
    else tCtl = inlineInput({ kind: 'gtarget', id: g.id, m, ccy: 'GBP', value: g.target ? numStr(g.target.v) : '', ph: 'None', cls: 'manual', label: `${g.name}, target in pounds (optional)` });
    let progress = '';
    if (hasTarget(g) && !aErr && !tErr) {
      const rem = tgt - avail;
      const pct = tgt > 0 ? Math.max(0, Math.min(100, (avail / tgt) * 100)) : 100;
      const mu = monthsUntil(g.date);
      let dateTxt = '';
      if (g.date) {
        if (rem <= 0) dateTxt = 'Target reached';
        else if (mu <= 0) dateTxt = 'Target date has passed';
        else dateTxt = `${fmt(rem / mu, 'GBP', 0)} a month for ${mu} month${mu > 1 ? 's' : ''}`;
      }
      progress = `<div class="bar" role="img" aria-label="${Math.round(pct)}% of target"><div style="width:${pct}%;background:${esc(g.color || 'var(--accent)')}"></div></div>
        <div class="kv"><span>${rem > 0.005 ? 'Still needed' : 'Target reached'}</span><b class="num">${esc(rem > 0.005 ? fmt(rem) : fmt(-rem) + ' spare')}</b></div>
        ${g.date ? `<div class="kv"><span>By ${esc(mLong(g.date))}</span><span class="num">${esc(dateTxt)}</span></div>` : ''}`;
    } else if (g.date) {
      progress = `<div class="kv"><span>Date</span><span>${esc(mLong(g.date))}</span></div>`;
    }
    const rows = g.rows.map((r) => `<div class="row" style="min-height:56px;padding:8px 0">
        <span class="main"><span class="name" style="font-size:15px;font-weight:500">${esc(r.label)}</span>${r.f ? `<span class="meta">${esc(toDisplay(r.f))}</span>` : ''}${r.note ? `<span class="meta rownote">${esc(r.note)}</span>` : ''}</span>
        ${goalLineCtl(g, r)}${moreBtn('editGoalRow', { gid: g.id, rid: r.id }, r.label)}</div>`).join('');
    return `<section class="card pad" style="display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;align-items:center;gap:10px"><span class="dot" style="background:${esc(g.color || 'var(--accent)')}"></span>
        <h2 style="margin:0;font-size:18px;font-weight:700;flex:1 1 auto;overflow-wrap:anywhere">${esc(g.name)}</h2>${moreBtn('editGoal', { id: g.id }, g.name)}</div>
      ${g.note ? `<span class="note rownote" style="margin-top:-6px">${esc(g.note)}</span>` : ''}
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
        <div style="display:flex;flex-direction:column;gap:2px;min-width:0"><span class="small muted">Money for this goal</span>
        <span class="num" style="font-size:32px;font-weight:800;letter-spacing:-0.02em;color:${aErr ? 'var(--err-ink)' : 'var(--ink)'}">${esc(aErr ? '⚠ ' + avail.message : fmt(avail))}</span></div>
        ${hasTarget(g) && !aErr && !tErr && tgt > 0 ? progressRing(Math.max(0, Math.min(100, (avail / tgt) * 100)), g.color || 'var(--accent)') : ''}</div>
      <div class="row" style="min-height:52px;padding:4px 0;border-bottom:0"><span class="main"><span class="name" style="font-size:15px">Target</span><span class="meta">${fromSpend ? 'Total of the spending plan below' : 'Optional. Leave blank, or fill in the spending plan.'}</span></span>${tCtl}${moreBtn('editGoal', { id: g.id }, g.name + ' target')}</div>
      ${tErr ? `<div class="box bad">${esc(tgt.message)}</div>` : ''}
      ${progress}
      ${spendTable(g)}
      <div class="cap2" style="margin-top:4px">MONEY FOR THIS GOAL (LINES ADDED UP)</div>
      <div class="list">${rows || '<span class="note">No lines yet.</span>'}</div>
      <button class="inlineadd" style="border-top:0;padding:0" data-act="newGoalRow" data-gid="${g.id}">+ Add line</button>
    </section>`;
  }).join('');
  return `<main class="screen">${header('Goals')}
    <p class="note" style="margin:0">Plan for anything, like a trip or a car. Type amounts directly, or tap ⋯ and use a formula to pull figures from other tabs, e.g. <span style="font-family:ui-monospace,Menlo,monospace">[Savings: Cash ISA / Fixed Deposit] * 30%</span>.</p>
    ${cards || '<div class="card pad note">No goals yet.</div>'}
    <button class="addbtn" data-act="newGoal">+ Add goal</button></main>`;
}

function screenIsa() {
  const cm = curM();
  const tys = Array.from(new Set(visibleMonths().map(taxYear)));
  const cats = isaCats();
  if (!cats.length) {
    return `<main class="screen">${header('ISA allowance')}<div class="card pad note">No ISA accounts yet. Edit a savings category and set its ISA type to track it here.</div>${isaSource()}</main>`;
  }
  const blocks = tys.map((ty) => {
    const y = safe(() => isaYear(ty));
    if (y instanceof FErr) return `<div class="box bad">${esc(y.message)}</div>`;
    const a = y.a;
    const nowRow = y.rows.find((r) => r.m === cm);
    const isCur = ty === taxYear(cm);
    const usedNow = isCur && nowRow ? nowRow.used : (y.rows.length ? (ty < taxYear(cm) ? y.used : (Object.values(cats).reduce((t, c) => t + (Number(c.isaPrior[ty]) || 0), 0))) : y.used);
    const endUsed = y.used;
    const priorTotal = cats.reduce((t, c) => t + (Number(c.isaPrior[ty]) || 0), 0);
    const pct = (v) => Math.max(0, Math.min(100, (v / a.overall) * 100));
    const visRows = y.rows.filter((r) => visibleMonths().includes(r.m));
    const over = endUsed > a.overall + 0.005;
    const cashOver = a.cash != null && y.cash > a.cash + 0.005;
    const lisaOver = y.lisa > a.lisa + 0.005;
    return `<section class="card" style="display:flex;flex-direction:column">
      <div class="pad" style="display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><b style="font-size:16px">Tax year ${tyName(ty)}</b>
          <button class="linkbtn" style="min-height:36px" data-act="editAllowance" data-ty="${ty}">Allowance ${esc(fmt(a.overall))} ›</button></div>
        <span class="small muted">6 Apr ${ty} – 5 Apr ${ty + 1}</span>
        <div style="display:flex;flex-direction:column;gap:2px"><span class="small muted">${isCur ? 'Remaining now' : 'Remaining at end of forecast'}</span>
          <span class="num" style="font-size:34px;font-weight:800;letter-spacing:-0.02em;color:${(isCur ? a.overall - usedNow : a.overall - endUsed) < 0 ? 'var(--err-ink)' : 'var(--accent)'}">${esc(fmt(isCur ? a.overall - usedNow : a.overall - endUsed))}</span></div>
        <div class="bar" role="img" aria-label="Used ${esc(fmt(isCur ? usedNow : endUsed))} of ${esc(fmt(a.overall))}">
          <div style="width:${pct(isCur ? usedNow : endUsed)}%;background:var(--accent)"></div>
          ${isCur ? `<div style="width:${Math.max(0, pct(endUsed) - pct(usedNow))}%;background:repeating-linear-gradient(45deg,var(--accent-rule) 0 4px,var(--accent-soft) 4px 8px)"></div>` : ''}</div>
        <div class="legend"><span><i style="background:var(--accent)"></i>Used ${esc(fmt(isCur ? usedNow : endUsed))}</span>${isCur ? `<span><i style="background:var(--accent-rule)"></i>Planned to ${esc(mShort(y.rows.length ? y.rows[y.rows.length - 1].m : cm))} ${esc(fmt(endUsed - usedNow))}</span>` : ''}</div>
        ${a.cash != null ? `<span class="small ${cashOver ? '' : 'muted'}" ${cashOver ? 'style="color:var(--err-ink);font-weight:600"' : ''}>Cash ISA limit ${esc(fmt(a.cash))}: ${esc(fmt(y.cash))} planned by end of forecast${cashOver ? ' — over the limit' : ''}</span>` : ''}
        ${y.lisa ? `<span class="small ${lisaOver ? '' : 'muted'}" ${lisaOver ? 'style="color:var(--err-ink);font-weight:600"' : ''}>Lifetime ISA limit ${esc(fmt(a.lisa))}: ${esc(fmt(y.lisa))}${lisaOver ? ' — over the limit' : ''}</span>` : ''}
        ${over ? `<div class="box bad">Planned contributions go over the ${esc(fmt(a.overall))} allowance by ${esc(fmt(endUsed - a.overall))}.</div>` : ''}
        ${priorTotal ? `<span class="small muted">Includes ${esc(fmt(priorTotal))} paid in before tracking started.</span>` : ''}
      </div>
      <div class="isarow h"><span>MONTH</span><span>PAID IN</span><span>USED</span><span>LEFT</span></div>
      ${visRows.map((r) => `<button class="isarow" data-act="editIsaMonth" data-m="${r.m}"><span style="font-weight:600">${esc(monthChip(r.m))}</span>
        <span class="num" style="font-weight:600;color:var(--calc-ink)">${esc(fmt(r.add))}<span class="src">${r.ov ? 'Override' : 'Linked from Plan'}${r.wd ? ` · −${esc(fmt(r.wd))} flexible` : ''}</span></span>
        <span class="num">${esc(fmt(r.used))}</span><span class="num" style="font-weight:700">${esc(fmt(a.overall - r.used))}</span></button>`).join('') || '<div class="isarow"><span class="muted small" style="grid-column:1/-1">No visible months in this tax year.</span></div>'}
    </section>`;
  }).join('');
  const cty = taxYear(cm);
  const list = cats.map((c) => {
    const y = safe(() => isaYear(cty));
    let contributed = Number(c.isaPrior[cty]) || 0;
    if (!(y instanceof FErr)) for (const m of allMonths().filter((x) => taxYear(x) === cty && x <= cm)) contributed += isaContribution(c, m);
    return `<button class="row" data-act="editCat" data-id="${c.id}"><span class="dot" style="background:${esc(c.color)}"></span>
      <span class="main"><span class="name">${esc(c.name)}</span><span class="meta">${{ ss: 'Stocks & Shares ISA', cash: 'Cash ISA', lisa: 'Lifetime ISA', other: 'Other ISA' }[c.isa]} · Flexible: ${c.flexible ? 'Yes' : 'No'} · Before tracking: ${esc(fmt(Number(c.isaPrior[cty]) || 0))}</span></span>
      <span class="v manual">${esc(fmt(contributed))}</span></button>`;
  }).join('');
  return `<main class="screen">${header('ISA allowance')}
    <p class="note" style="margin:0">Counts contributions only. Balances and growth are in Savings and don’t use allowance.</p>
    ${blocks}
    <div class="cap2">YOUR ISAS · CONTRIBUTED ${tyName(cty)} TO DATE</div>
    <div class="card list">${list}</div>
    <div class="box warn">Withdrawals only give allowance back if the ISA is flexible, and only within the same tax year. Check with each provider.</div>
    ${isaSource()}</main>`;
}
function isaSource() {
  return `<p class="note">Built-in rules: £20,000 allowance for 2026/27; from 6 April 2027 a £12,000 Cash ISA limit for under-65s within £20,000; flexible-ISA withdrawals. Sources: GOV.UK “Individual Savings Accounts” and “ISA reform 2027” factsheet, checked 31 Oct 2026. The over-65 rule is widely reported but not yet confirmed on GOV.UK. Each tax year’s limits can be edited.</p>`;
}

/* ---------------- sheets ---------------- */
function openSheet(sh) { sh.f = sh.f || {}; ui.sheet = sh; renderSheet(); }
function closeSheet() { ui.sheet = null; renderSheet(); render(); }
function collect() {
  if (!ui.sheet) return;
  $$('#sheet [data-field]').forEach((el) => { ui.sheet.f[el.dataset.field] = el.type === 'checkbox' ? el.checked : el.value; });
}
const fv = (name, dflt) => (ui.sheet.f[name] !== undefined ? ui.sheet.f[name] : dflt);
function phead(path, title) {
  return `<div class="grab"></div><div class="phead"><div style="display:flex;flex-direction:column;gap:2px;min-width:0">${path ? `<span class="path">${esc(path)}</span>` : ''}<h2 id="sheetTitle">${esc(title)}</h2></div>
    <button class="btn" data-act="closeSheet">Cancel</button></div>`;
}
function seg(field, options, value) {
  return `<div class="seg" role="group">${options.map(([v, l]) => `<button type="button" data-act="seg" data-field-name="${field}" data-v="${v}" aria-pressed="${String(v) === String(value)}">${l}</button>`).join('')}</div>`;
}
function swatches(field, value) {
  return `<div class="swatches">${COLORS.map((c) => `<button type="button" data-act="seg" data-field-name="${field}" data-v="${c}" aria-pressed="${c === value}" style="background:${c}" aria-label="Colour ${c}"></button>`).join('')}</div>`;
}
function sw(field, on, label, desc) {
  return `<div class="check"><span>${label}${desc ? `<span class="d">${desc}</span>` : ''}</span><button type="button" class="switch" role="switch" aria-checked="${!!on}" aria-label="${esc(label)}" data-act="segBool" data-field-name="${field}"></button></div>`;
}

function fxEditor(sh) {
  return `<div class="field"><span>Formula</span>
    <div class="fxwrap"><span class="eq">=</span><textarea id="fx" data-field="fx" rows="3" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Formula" placeholder="e.g. [Savings: Cash ISA / Fixed Deposit @ previous month] + 100">${esc(fv('fx', ''))}</textarea></div></div>
    <div id="fxPreview" class="fxprev">${fxPreviewHTML()}</div>
    <div class="keys">${['+', '−', '×', '÷', '%', '(', ')', 'SUM(', ',', '⌫'].map((k) => `<button type="button" class="key" data-act="fxKey" data-t="${esc(k)}" aria-label="${{ '⌫': 'Delete', '−': 'minus', '×': 'times', '÷': 'divide by' }[k] || esc(k)}">${esc(k)}</button>`).join('')}</div>
    <button type="button" class="linkbtn" data-act="fxPicker">${sh.picker ? 'Hide values ▲' : 'Tap a value to insert it ▼'}</button>
    ${sh.picker ? pickerHTML(sh) : ''}`;
}
function pickerHTML(sh) {
  const scope = fv('scope', '');
  const m = scope === '' ? sh.m : scope === 'prev' ? addM(sh.m, -1) : scope;
  const v = (fn) => { const r = safe(fn); return r instanceof FErr ? '⚠' : fmt(r); };
  const groups = [
    ['Savings (in £)', S.cats.map((c) => ({ k: 's', id: c.id, name: c.name + (c.ccy === 'INR' ? ' (converted to £)' : ''), val: v(() => catGBP(c.id, m)) }))],
    ['Liabilities', S.liabs.map((l) => ({ k: 'l', id: l.id, name: l.name, val: v(() => liabVal(l.id, m)) }))],
    ['Plan · ' + mLabel(m), S.lines.map((l) => ({ k: 'p', id: l.id, name: l.name, val: v(() => lineUsed(l, m)) }))],
    ['Repayments · ' + mLabel(m), S.liabs.map((l) => ({ k: 'r', id: l.id, name: l.name, val: v(() => repayUsed(l.id, m)) }))],
    ['Goals', S.goals.map((g) => ({ k: 'g', id: g.id, name: g.name, val: v(() => goalAvail(g.id, m)) }))],
    ['Totals and rate', [{ k: 'T', id: '_', name: 'Total savings', val: v(() => savTotal(m)) }, { k: 'L', id: '_', name: 'Total liabilities', val: v(() => liabTotal(m)) }, { k: 'x', id: 'INR', name: 'Rate ₹ per £', val: rate().toFixed(2) }]]
  ];
  const opts = [['', `Same month as this value (${mLabel(sh.m)})`], ['prev', 'Previous month']].concat(allMonths().map((x) => [x, mLabel(x)]));
  return `<div class="field"><label for="scopeSel">Which month</label><select id="scopeSel" data-field="scope">${opts.map(([val, l]) => `<option value="${val}" ${val === scope ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
    ${groups.filter(([, items]) => items.length).map(([g, items]) => `<div class="pickgrp"><span class="cap2">${esc(g.toUpperCase())}</span>
      ${items.map((it) => `<button type="button" class="pick" data-act="fxRef" data-k="${it.k}" data-id="${it.id}"><span>${esc(it.name)}</span><span>${esc(it.val)}</span></button>`).join('')}</div>`).join('')}`;
}
// Put S back to a snapshot without replacing the object, so code holding references to it stays valid.
function restoreS(snap) {
  const back = JSON.parse(snap);
  Object.keys(S).forEach((k) => { delete S[k]; });
  Object.assign(S, back);
}
function previewCompute(sh, internal) {
  const snap = JSON.stringify(S);
  try {
    applyFormula(sh, internal);
    resetCalc();
    return targetValue(sh);
  } finally { restoreS(snap); resetCalc(); }
}
function applyFormula(sh, internal) {
  if (sh.type === 'cell') {
    const store = sh.k === 's' ? S.catCells : S.liabCells;
    store[sh.id] = store[sh.id] || {};
    store[sh.id][sh.m] = { v: null, f: internal, at: now() };
  } else if (sh.type === 'total') {
    (sh.k === 's' ? S.savTotal : S.liabTotal).f = internal;
  } else if (sh.type === 'line') {
    const ln = lineById(sh.id) || sh.draftLine;
    if (!lineById(ln.id)) S.lines.push(ln);
    const e = lineById(ln.id).entries[sh.m] = Object.assign({}, lineById(ln.id).entries[sh.m] || {});
    e.f = internal; e.amt = null; e.once = fv('once', 'false') === 'true';
  } else if (sh.type === 'grow') {
    const g = goalById(sh.gid);
    let r = g.rows.find((x) => x.id === sh.rid);
    if (!r) { r = clone(sh.draftRow); g.rows.push(r); }
    r.f = internal; r.v = null;
  } else if (sh.type === 'goal') {
    let g = goalById(sh.id);
    if (!g) { g = clone(sh.draftGoal); S.goals.push(g); }
    g.target = { v: null, f: internal };
  } else if (sh.type === 'repay') {
    S.repay[sh.id] = S.repay[sh.id] || {};
    const e = S.repay[sh.id][sh.m] = Object.assign({}, S.repay[sh.id][sh.m] || {});
    e.f = internal; e.amt = null; e.once = fv('once', 'false') === 'true';
  }
}
function targetValue(sh) {
  if (sh.type === 'cell') return sh.k === 's' ? catNative(sh.id, sh.m) : liabVal(sh.id, sh.m);
  if (sh.type === 'total') return sh.k === 's' ? savTotal(sh.m) : liabTotal(sh.m);
  if (sh.type === 'line') return linePlanned(lineById(sh.id || sh.draftLine.id), sh.m);
  if (sh.type === 'repay') return repayAmountRaw(sh.id, sh.m);
  if (sh.type === 'grow') { const g = goalById(sh.gid); return goalRowVal(g, g.rows.find((x) => x.id === (sh.rid || sh.draftRow.id)), sh.m); }
  if (sh.type === 'goal') { const g = goalById(sh.id || sh.draftGoal.id); return goalTarget(g, sh.m); }
  return 0;
}
function targetCcy(sh) { return sh.type === 'cell' && sh.k === 's' ? catById(sh.id).ccy : 'GBP'; }
function fxPreviewHTML() {
  const sh = ui.sheet;
  const src = String(fv('fx', '')).trim();
  if (!src) return '<span class="muted">Type a formula, or tap values and keys below.</span>';
  try {
    const internal = toInternal(src);
    tokenize(internal);
    const v = previewCompute(sh, internal);
    // Also make sure nothing else that depends on this value now breaks (e.g. a loop through another cell).
    return `<span class="ok">✓ Valid</span><strong>${esc(fmt(v, targetCcy(sh)))}</strong>`;
  } catch (e) {
    return `<span class="bad">${esc(e.message)}</span>`;
  }
}
function validateFormula(sh, text) {
  const internal = toInternal(text);
  const snap = JSON.stringify(S);
  try {
    applyFormula(sh, internal);
    resetCalc();
    targetValue(sh);
    // Check that totals and forecasts across the window still calculate (catches loops through other cells).
    for (const m of allMonths()) { savTotal(m); liabTotal(m); planSummary(m); }
    for (const g of S.goals) { goalAvail(g.id, curM()); goalTarget(g, curM()); }
  } finally { restoreS(snap); resetCalc(); }
  return internal;
}
function insertAtCaret(text) {
  const el = $('#fx');
  if (!el) return;
  const s = ui.sheet.caret != null ? ui.sheet.caret : el.value.length;
  const e = ui.sheet.caretEnd != null ? ui.sheet.caretEnd : s;
  el.value = el.value.slice(0, s) + text + el.value.slice(e);
  const pos = s + text.length;
  ui.sheet.caret = ui.sheet.caretEnd = pos;
  try { el.setSelectionRange(pos, pos); } catch (_) {}
  ui.sheet.f.fx = el.value;
  $('#fxPreview').innerHTML = fxPreviewHTML();
}

function sheetCell(sh) {
  const isS = sh.k === 's';
  const item = isS ? catById(sh.id) : liabById(sh.id);
  if (!item) return '';
  const store = isS ? S.catCells : S.liabCells;
  const cell = (store[sh.id] || {})[sh.m];
  const canAuto = sh.m > firstM();
  const defMode = cell && cell.f ? 'formula' : cell && cell.v != null ? 'value' : canAuto ? 'auto' : 'value';
  const mode = fv('mode', defMode);
  const ccy = isS ? item.ccy : 'GBP';
  const autoTxt = (() => {
    if (!canAuto) return '';
    const prev = safe(() => (isS ? catNative(sh.id, addM(sh.m, -1)) : liabVal(sh.id, addM(sh.m, -1))));
    if (isS) {
      const links = S.lines.filter((l) => l.sec === 'saving' && l.link === sh.id);
      const add = links.reduce((t, l) => { const x = safe(() => lineUsed(l, sh.m)); return t + (typeof x === 'number' ? x : 0); }, 0);
      return `Previous month ${prev instanceof FErr ? '⚠' : fmt(prev, ccy)} + Plan allocations ${fmt(add)}${ccy === 'INR' ? ' (converted to ₹)' : ''}.${links.length ? '' : ' No Plan rows pay into this category yet.'}`;
    }
    const r = safe(() => repayUsed(sh.id, sh.m));
    return `Previous month ${prev instanceof FErr ? '⚠' : fmt(prev)} − repayment ${r instanceof FErr ? '⚠' : fmt(r)} from Plan.`;
  })();
  const curVal = safe(() => (isS ? catNative(sh.id, sh.m) : liabVal(sh.id, sh.m)));
  const modes = [['value', 'Typed value'], ['formula', 'Formula']];
  if (canAuto) modes.unshift(['auto', 'Automatic']);
  let body = '';
  if (mode === 'auto') body = `<div class="box info">${esc(autoTxt)}<br><b>Result: ${curVal instanceof FErr ? esc(curVal.message) : esc(fmt(curVal, ccy, isS ? catDp(item) : null))}</b></div>`;
  if (mode === 'value') {
    const v = fv('val', cell && cell.v != null ? String(cell.v) : '');
    body = `<div class="field"><label for="valIn">Amount in ${ccy === 'INR' ? '₹ (Indian rupees)' : '£'}</label><input id="valIn" data-field="val" inputmode="decimal" autocomplete="off" value="${esc(v)}" placeholder="0"></div>
      ${ccy === 'INR' ? `<div class="box info" id="inrPrev">${esc(inrPreview(v))}</div><button type="button" class="linkbtn" data-act="openRate">Change ₹ → £ rate ›</button>` : ''}`;
  }
  if (mode === 'formula') body = fxEditor(sh) + (ccy === 'INR' ? '<p class="note">Formulas give a £ result. It’s shown in ₹ using your rate.</p>' : '');
  return `${phead(`${isS ? 'Savings' : 'Liabilities'} › ${item.name}`, mLong(sh.m) + (sh.m === curM() ? ' · now' : ' forecast'))}
    ${seg('mode', modes, mode)}${body}
    <p class="note">Last updated: ${esc(cell ? stamp(cell.at) : 'never')}</p>
    <button class="btn primary wide" data-act="saveCell">Save</button>`;
}
function inrPreview(v) {
  const n = parseAmount(v);
  if (n == null) return `Enter the balance in rupees. Converted at ₹${rate().toFixed(2)} per £1 for totals.`;
  if (isNaN(n)) return 'That isn’t a number.';
  return `${fmt(n, 'INR')} ÷ ${rate().toFixed(2)} = ${fmt(n / rate(), 'GBP', 2)}. The ₹ amount is kept as you typed it.`;
}

function sheetTotal(sh) {
  const isS = sh.k === 's';
  return `${phead(isS ? 'Savings' : 'Liabilities', isS ? 'Total savings formula' : 'Total liabilities formula')}
    <p class="note">This formula is used for every month. References without a month use the month being shown.</p>
    ${fxEditor(sh)}
    <button class="btn wide" data-act="resetTotal">Reset to the sum of all ${isS ? 'held categories' : 'liabilities'}</button>
    <button class="btn primary wide" data-act="saveTotal">Save</button>`;
}

function sheetLine(sh) {
  const ln = lineById(sh.id) || sh.draftLine;
  const isNew = !lineById(sh.id);
  const e = ln.entries[sh.m] || {};
  const inherited = isNew ? null : findEntry(ln.entries, sh.m);
  const own = e.f || e.amt != null;
  const mode = fv('mode', e.f ? 'formula' : 'value');
  const once = fv('once', String(!!e.once));
  const inhTxt = !own && inherited ? `Currently ${fmt(safe(() => linePlanned(ln, sh.m)))}, recurring from ${mLabel(inherited.from)}. Leave blank to keep it.` : 'Leave blank for £0.';
  const secName = { income: 'Income', expense: 'Expenses', saving: 'Savings allocations' }[ln.sec];
  const users = isNew ? [] : usagesOf('p', ln.id);
  const linkCat = fv('link', ln.link || '');
  return `${phead(`Plan › ${mLong(sh.m)} › ${secName}`, isNew ? 'New row' : ln.name)}
    <div class="field"><label for="nameIn">Name</label><input id="nameIn" data-field="name" value="${esc(fv('name', ln.name))}" autocomplete="off" maxlength="60"></div>
    ${ln.sec === 'saving' ? `<div class="field"><label for="linkSel">Pays into savings category</label><select id="linkSel" data-field="link"><option value="">Not linked</option>${S.cats.map((c) => `<option value="${c.id}" ${c.id === linkCat ? 'selected' : ''}>${esc(c.name)}${c.ccy === 'INR' ? ' (₹, converted)' : ''}</option>`).join('')}</select><span class="hint">The forecast for that category adds this amount each month. Counted once, as a transfer.</span></div>` : ''}
    <span class="cap2">PLANNED AMOUNT FOR ${esc(mLong(sh.m).toUpperCase())}</span>
    ${seg('mode', [['value', 'Typed amount'], ['formula', 'Formula']], mode)}
    ${mode === 'value' ? `<div class="field"><input aria-label="Planned amount in pounds" data-field="amt" inputmode="decimal" autocomplete="off" value="${esc(fv('amt', e.amt != null ? String(e.amt) : ''))}" placeholder="${esc(inherited && !own ? String(safe(() => linePlanned(ln, sh.m))) : '0')}"><span class="hint">${esc(inhTxt)}</span></div>` : fxEditor(sh)}
    <span class="cap2">HOW THIS AMOUNT BEHAVES</span>
    <button type="button" class="opt" data-act="seg" data-field-name="once" data-v="true" aria-pressed="${once === 'true'}"><b>One-off</b><span>This month only</span></button>
    <button type="button" class="opt" data-act="seg" data-field-name="once" data-v="false" aria-pressed="${once !== 'true'}"><b>Recurring</b><span>This month and every month after, until changed</span></button>
    ${sw('carry', fv('carry', ln.behaviour === 'carry'), 'Carry forward a closing balance', 'Keeps a running balance: last month’s closing + this month’s amount')}
    ${fv('carry', ln.behaviour === 'carry') ? `<div class="field"><label for="openIn">Opening balance (before ${esc(mLabel(firstM()))})</label><input id="openIn" data-field="opening" inputmode="decimal" value="${esc(fv('opening', String(ln.opening || 0)))}"></div>` : ''}
    <span class="cap2">ADVANCED</span><div class="field"><label for="actIn">Actual amount, if different from plan (optional)</label><input id="actIn" data-field="actual" inputmode="decimal" autocomplete="off" value="${esc(fv('actual', e.actual != null ? String(e.actual) : ''))}" placeholder="Not yet"><span class="hint">Once entered, forecasts use the actual instead of the plan.</span></div>
    <div class="field"><label for="noteIn">Note (optional)</label><textarea id="noteIn" data-field="note" rows="2" maxlength="300" style="min-height:64px;padding:10px 12px;font-size:16px;font-weight:400">${esc(fv('note', ln.note || ''))}</textarea></div>
    ${sw('bold', fv('bold', !!ln.bold), 'Bold')}
    ${users.length ? `<div class="box info">Used in: ${esc(users.join('; '))}</div>` : ''}
    <p class="note">Last updated: ${esc(own || e.actual != null ? stamp(e.at) : stamp(ln.at))}</p>
    <button class="btn primary wide" data-act="saveLine">Save</button>
    ${!isNew && (own || e.actual != null) ? `<button class="btn wide" data-act="clearLineMonth">Clear ${esc(mShort(sh.m))} amount (use recurring)</button>` : ''}
    ${!isNew ? `<button class="btn danger wide" data-act="deleteLine">Remove row from ${esc(mLabel(sh.m))} onwards</button>` : ''}`;
}

function sheetRepay(sh) {
  const l = liabById(sh.id);
  const e = (S.repay[sh.id] || {})[sh.m] || {};
  const on = fv('on', repayOn(sh.id, sh.m));
  const mode = fv('mode', e.f ? 'formula' : 'value');
  const once = fv('once', String(!!e.once));
  const inh = findEntry(S.repay[sh.id], sh.m);
  const cur = safe(() => repayAmountRaw(sh.id, sh.m));
  const prev = sh.m > firstM() ? safe(() => liabVal(sh.id, addM(sh.m, -1))) : null;
  return `${phead(`Plan › ${mLong(sh.m)} › Repayments`, l.name)}
    ${sw('on', on, `Pay towards ${esc(l.name)} in ${esc(mShort(sh.m))}`, 'If off, the balance stays the same this month')}
    ${prev != null ? `<p class="note">Balance at end of ${esc(mShort(addM(sh.m, -1)))}: ${esc(prev instanceof FErr ? '⚠' : fmt(prev))}. Repayments are capped at the balance.</p>` : ''}
    <span class="cap2">AMOUNT</span>
    ${seg('mode', [['value', 'Typed amount'], ['formula', 'Formula']], mode)}
    ${mode === 'value' ? `<div class="field"><input aria-label="Repayment amount in pounds" data-field="amt" inputmode="decimal" value="${esc(fv('amt', e.amt != null ? String(e.amt) : ''))}" placeholder="${esc(cur instanceof FErr ? '0' : String(cur))}"><span class="hint">${inh && !(e.f || e.amt != null) ? `Currently ${esc(fmt(cur))}, recurring from ${esc(mLabel(inh.from))}.` : `Blank uses the default ${esc(fmt(Number(l.repay) || 0))}.`}</span></div>` : fxEditor(sh)}
    <button type="button" class="opt" data-act="seg" data-field-name="once" data-v="true" aria-pressed="${once === 'true'}"><b>One-off</b><span>This month only</span></button>
    <button type="button" class="opt" data-act="seg" data-field-name="once" data-v="false" aria-pressed="${once !== 'true'}"><b>Recurring</b><span>This month and after, until changed</span></button>
    <span class="cap2">NEW BORROWING</span>
    <div class="field"><label for="borIn">Borrowed on ${esc(l.name)} in ${esc(mLong(sh.m))} (£)</label><input id="borIn" data-field="borrow" inputmode="decimal" value="${esc(fv('borrow', manualBorrow(sh.id, sh.m) ? String(manualBorrow(sh.id, sh.m)) : ''))}" placeholder="0"><span class="hint">Adds to the balance this month and counts as money in for the plan, so spending it doesn’t show as overspent. This month only.</span></div>
    <div class="field"><label for="overIn" style="color:var(--err-ink)">Overspend covered by borrowing (£)</label><input id="overIn" data-field="over" inputmode="decimal" value="${esc(fv('over', overAmt(sh.id, sh.m) ? String(overAmt(sh.id, sh.m)) : ''))}" placeholder="0"><span class="hint">Set by “Cover with borrowing” in Plan. Shown in red. Clear it to remove.</span></div>
    <div class="field"><label for="actIn">Actual paid (optional)</label><input id="actIn" data-field="actual" inputmode="decimal" value="${esc(fv('actual', e.actual != null ? String(e.actual) : ''))}" placeholder="Not yet"></div>
    <p class="note">Last updated: ${esc(e.at ? stamp(e.at) : 'never')}</p>
    <button class="btn primary wide" data-act="saveRepay">Save</button>
    ${e.f || e.amt != null || e.actual != null || e.on != null || borrowAmt(sh.id, sh.m) ? `<button class="btn wide" data-act="clearRepayMonth">Reset ${esc(mShort(sh.m))} to default</button>` : ''}`;
}

function sheetCat(sh) {
  const c = catById(sh.id) || {};
  const isNew = !sh.id;
  const inTotal = isNew ? true : usesRef(S.savTotal.f, 's', c.id);
  const used = isNew ? [] : usagesOf('s', c.id).filter((w) => !w.startsWith('Savings › ' + c.name));
  const cty = taxYear(curM());
  return `${phead('Savings', isNew ? 'New category' : 'Edit category')}
    <div class="field"><label for="nameIn">Name</label><input id="nameIn" data-field="name" value="${esc(fv('name', c.name || ''))}" maxlength="60" autocomplete="off" placeholder="e.g. Premium Bonds"></div>
    <span class="cap2">TYPE</span>${seg('kind', [['held', 'Held now'], ['expected', 'Expected']], fv('kind', c.kind || 'held'))}
    <span class="cap2">CURRENCY</span>${seg('ccy', [['GBP', '£ GBP'], ['INR', '₹ INR']], fv('ccy', c.ccy || 'GBP'))}
    ${!isNew && fv('ccy', c.ccy) !== c.ccy ? '<div class="box warn">Changing currency keeps the numbers you typed. Check them afterwards.</div>' : ''}
    <span class="cap2">COLOUR</span>${swatches('color', fv('color', c.color || COLORS[S.cats.length % COLORS.length]))}
    ${sw('inTotal', fv('inTotal', isNew ? fv('kind', 'held') === 'held' : inTotal), 'Include in Total savings', 'Adds or removes it in the total formula')}
    <div class="field"><label for="isaSel">ISA type</label><select id="isaSel" data-field="isa">${[['', 'Not an ISA'], ['ss', 'Stocks & Shares ISA'], ['cash', 'Cash ISA'], ['lisa', 'Lifetime ISA'], ['other', 'Other ISA']].map(([v, l]) => `<option value="${v}" ${v === fv('isa', c.isa || '') ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    ${fv('isa', c.isa || '') ? `${sw('flexible', fv('flexible', !!c.flexible), 'Flexible ISA', 'Withdrawals can be replaced in the same tax year. Ask your provider.')}
      <div class="field"><label for="priorIn">Paid in ${tyName(cty)} before tracking started (£)</label><input id="priorIn" data-field="prior" inputmode="decimal" value="${esc(fv('prior', String((c.isaPrior || {})[cty] || '')))}" placeholder="0"></div>` : ''}
    ${fv('kind', c.kind || 'held') === 'held' ? `<div class="field"><label for="growIn">Expected growth % per year (optional)</label><input id="growIn" data-field="growth" inputmode="decimal" value="${esc(fv('growth', c.growth ? String(c.growth) : ''))}" placeholder="0"><span class="hint">Used only in forecast months, on last month’s balance. Contributions and ISA allowance are tracked separately.</span></div>` : ''}
    <div class="field"><label for="noteIn">Note (optional)</label><textarea id="noteIn" data-field="note" rows="2" maxlength="300" style="min-height:64px;padding:10px 12px;font-size:16px;font-weight:400">${esc(fv('note', c.note || ''))}</textarea></div>
    <span class="cap2">DECIMAL PLACES</span>${seg('dp', [['', 'Default'], ['0', '0'], ['2', '2']], fv('dp', c.dp == null ? '' : String(c.dp)))}
    ${sw('bold', fv('bold', !!c.bold), 'Bold')}
    ${!isNew ? sw('hidden', fv('hidden', !!c.hidden), 'Hide', 'Hidden categories keep their data, formulas and place in the total') : ''}
    ${used.length ? `<div class="box info">Used in: ${esc(used.join('; '))}</div>` : ''}
    <button class="btn primary wide" data-act="saveCat">${isNew ? 'Add category' : 'Save'}</button>
    ${!isNew ? '<button class="btn danger wide" data-act="deleteCat">Delete category</button>' : ''}`;
}
function sheetLiab(sh) {
  const l = liabById(sh.id) || {};
  const isNew = !sh.id;
  const used = isNew ? [] : usagesOf('l', l.id).concat(usagesOf('r', l.id));
  return `${phead('Liabilities', isNew ? 'New liability' : 'Edit liability')}
    <div class="field"><label for="nameIn">Name</label><input id="nameIn" data-field="name" value="${esc(fv('name', l.name || ''))}" maxlength="60" autocomplete="off" placeholder="e.g. Credit card"></div>
    ${isNew ? `<div class="field"><label for="balIn">Current balance (£)</label><input id="balIn" data-field="bal" inputmode="decimal" value="${esc(fv('bal', ''))}" placeholder="0"></div>` : ''}
    <div class="field"><label for="repIn">Default monthly repayment (£)</label><input id="repIn" data-field="repay" inputmode="decimal" value="${esc(fv('repay', l.repay != null ? String(l.repay) : ''))}" placeholder="0"><span class="hint">Shown in Plan every month. You can change it per month.</span></div>
    ${sw('autoPay', fv('autoPay', isNew ? true : !!l.autoPay), 'Pay every month by default', 'Switch individual months on or off in Plan')}
    <span class="cap2">COLOUR</span>${swatches('color', fv('color', l.color || COLORS[(S.liabs.length + 4) % COLORS.length]))}
    ${sw('inTotal', fv('inTotal', isNew ? true : usesRef(S.liabTotal.f, 'l', l.id)), 'Include in Total liabilities')}
    <div class="field"><label for="noteIn">Note (optional)</label><textarea id="noteIn" data-field="note" rows="2" maxlength="300" style="min-height:64px;padding:10px 12px;font-size:16px;font-weight:400">${esc(fv('note', l.note || ''))}</textarea></div>
    ${sw('bold', fv('bold', !!l.bold), 'Bold')}
    ${!isNew ? sw('hidden', fv('hidden', !!l.hidden), 'Hide', 'Hidden liabilities keep their data and place in the total') : ''}
    ${used.length ? `<div class="box info">Used in: ${esc(used.join('; '))}</div>` : ''}
    <button class="btn primary wide" data-act="saveLiab">${isNew ? 'Add liability' : 'Save'}</button>
    ${!isNew ? '<button class="btn danger wide" data-act="deleteLiab">Delete liability</button>' : ''}`;
}
function sheetProjCats() {
  const cur = projCats();
  return `${phead('Overview', 'Which savings grow?')}
    <p class="note">The growth projection applies your yearly return to these categories. Cash and expected income are usually left off.</p>
    ${S.cats.filter((c) => c.kind === 'held').map((c) => sw('pc_' + c.id, fv('pc_' + c.id, cur.includes(c.id)), esc(c.name), c.ccy === 'INR' ? 'In ₹, converted to £ for totals' : '')).join('')}
    <button class="btn primary wide" data-act="saveProjCats">Save</button>`;
}
function sheetCover(sh) {
  const m = sh.m;
  const ps = safe(() => planSummary(m));
  const short = ps instanceof FErr ? 0 : Math.max(0, -ps.left);
  const def = (S.liabs.find((l) => /over/i.test(l.name)) || S.liabs[0] || { id: '__new' }).id;
  const target = fv('target', def);
  const tl = liabById(target);
  const cell = tl ? (S.liabCells[tl.id] || {})[m] : null;
  const typedNow = m === firstM() && cell && cell.v != null && !cell.f;
  return `${phead(`Plan › ${mLong(m)}`, 'Cover overspend with borrowing')}
    <div class="box bad">This month is over by <b>${esc(fmt(short))}</b>. Covering it adds that amount to a liability, so it shows in Liabilities and its forecast like any other debt, flagged in red.</div>
    <div class="field"><label for="covAmt">Amount to cover (£)</label><input id="covAmt" data-field="amt" inputmode="decimal" value="${esc(fv('amt', short ? String(Math.round(short * 100) / 100) : ''))}"></div>
    <div class="field"><label for="covTo">Add it to</label><select id="covTo" data-field="target">${S.liabs.map((l) => `<option value="${l.id}" ${l.id === target ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}<option value="__new" ${target === '__new' ? 'selected' : ''}>New liability…</option></select></div>
    ${target === '__new' ? `<div class="field"><label for="covName">Name of new liability</label><input id="covName" data-field="name" value="${esc(fv('name', 'Overspend'))}" maxlength="60"></div>` : ''}
    ${typedNow ? sw('addBal', fv('addBal', true), `Also add to ${esc(tl.name)}’s current balance`, `You typed ${fmt(cell.v)} for ${mLong(m)}. Leave on unless that already includes this overspend.`) : ''}
    <button class="btn primary wide" data-act="saveCover" style="background:var(--err-ink);border-color:var(--err-ink);color:var(--card)">Cover with borrowing</button>`;
}
function sheetCheckIn() {
  const m = curM();
  const line = (kind, it, val, ccy, isF) => `<div class="row" style="min-height:56px;padding:6px 0">
    <span class="dot" style="background:${esc(it.color)}"></span><span class="main"><span class="name" style="font-size:15px">${esc(it.name)}</span>${isF ? '<span class="meta">Formula, kept as is</span>' : ''}</span>
    ${isF ? `<span class="v calc">${esc(fmt(val, ccy))}</span>` : `<span class="inl calc"><span class="cur" aria-hidden="true">${ccy === 'INR' ? '₹' : '£'}</span><input class="num" data-field="ci_${kind}_${it.id}" value="${esc(fv(`ci_${kind}_${it.id}`, numStr(val)))}" inputmode="decimal" aria-label="${esc(it.name)} balance"></span>`}</div>`;
  const cats = S.cats.filter((c) => !c.hidden).map((c) => { const v = safe(() => catNative(c.id, m)); const cell = (S.catCells[c.id] || {})[m]; return line('s', c, typeof v === 'number' ? v : 0, c.ccy, cell && cell.f); }).join('');
  const ls = S.liabs.filter((l) => !l.hidden).map((l) => { const v = safe(() => liabVal(l.id, m)); const cell = (S.liabCells[l.id] || {})[m]; return line('l', l, typeof v === 'number' ? v : 0, 'GBP', cell && cell.f); }).join('');
  return `${phead('New month', `Your ${mLong(m)} balances`)}
    <p class="note">Filled in from the forecast. Change any that differ from your real balances, then confirm. Confirmed figures are saved for ${esc(mLong(m))}, and later months forecast from them.</p>
    <span class="cap2">SAVINGS</span><div class="list">${cats || '<span class="note">None</span>'}</div>
    ${ls ? `<span class="cap2">LIABILITIES</span><div class="list">${ls}</div>` : ''}
    <button class="btn primary wide" data-act="saveCheckIn">Confirm balances</button>
    <button class="btn wide" data-act="skipCheckIn">Skip this month</button>`;
}
function sheetGoal(sh) {
  const g = goalById(sh.id) || sh.draftGoal;
  const isNew = !goalById(sh.id);
  const tmode = fv('tmode', g.target ? (g.target.f ? 'formula' : 'value') : 'none');
  const idx = S.goals.findIndex((x) => x.id === g.id);
  const used = isNew ? [] : usagesOf('g', g.id);
  return `${phead('Goals', isNew ? 'New goal' : 'Edit goal')}
    <div class="field"><label for="nameIn">Name</label><input id="nameIn" data-field="name" value="${esc(fv('name', g.name))}" maxlength="60" autocomplete="off" placeholder="e.g. India trip"></div>
    <span class="cap2">TARGET (OPTIONAL)</span>
    ${spendSum(g) !== 0 ? `<div class="box info">The target is the spending plan total (${esc(fmt(spendSum(g)))}). Clear the spending plan amounts to use a target set here instead.</div>` : ''}
    ${seg('tmode', [['none', 'No target'], ['value', 'Amount'], ['formula', 'Formula']], tmode)}
    ${tmode === 'value' ? `<div class="field"><input aria-label="Target amount in pounds" data-field="tval" inputmode="decimal" value="${esc(fv('tval', g.target && g.target.v != null ? String(g.target.v) : ''))}" placeholder="0"></div>` : ''}
    ${tmode === 'formula' ? fxEditor(sh) : ''}
    <div class="field"><label for="dateIn">Target date (optional)</label><input id="dateIn" type="month" data-field="date" value="${esc(fv('date', g.date || ''))}" min="${curM()}"><span class="hint">With a target and a date, the card shows how much to set aside each month.</span></div>
    <div class="field"><label for="noteIn">Note (optional)</label><textarea id="noteIn" data-field="note" rows="2" maxlength="300" style="min-height:64px;padding:10px 12px;font-size:16px;font-weight:400">${esc(fv('note', g.note || ''))}</textarea></div>
    <span class="cap2">COLOUR</span>${swatches('color', fv('color', g.color || COLORS[S.goals.length % COLORS.length]))}
    ${!isNew ? `<div class="btnrow"><button class="btn" data-act="moveGoal" data-dir="-1" ${idx <= 0 ? 'disabled' : ''}>Move up</button><button class="btn" data-act="moveGoal" data-dir="1" ${idx >= S.goals.length - 1 ? 'disabled' : ''}>Move down</button></div>` : ''}
    ${used.length ? `<div class="box info">Used in: ${esc(used.join('; '))}</div>` : ''}
    <button class="btn primary wide" data-act="saveGoal">${isNew ? 'Add goal' : 'Save'}</button>
    ${!isNew ? '<button class="btn danger wide" data-act="deleteGoal">Delete goal</button>' : ''}`;
}
function sheetGoalRow(sh) {
  const g = goalById(sh.gid);
  const r = g.rows.find((x) => x.id === sh.rid) || sh.draftRow;
  const isNew = !g.rows.some((x) => x.id === r.id);
  const mode = fv('mode', r.f ? 'formula' : 'value');
  return `${phead(`Goals › ${g.name}`, isNew ? 'New line' : 'Edit line')}
    <div class="field"><label for="labIn">Label</label><input id="labIn" data-field="label" value="${esc(fv('label', r.label))}" maxlength="60" autocomplete="off" placeholder="e.g. From Cash ISA, Flights booked"></div>
    ${seg('mode', [['value', 'Typed amount'], ['formula', 'Formula']], mode)}
    ${mode === 'value' ? `<div class="field"><input aria-label="Amount in pounds" data-field="val" inputmode="decimal" value="${esc(fv('val', r.v != null ? String(r.v) : ''))}" placeholder="0"><span class="hint">Use a minus amount for money already spent or set aside elsewhere.</span></div>` : fxEditor(sh)}
    <div class="field"><label for="noteIn">Note (optional)</label><textarea id="noteIn" data-field="note" rows="2" maxlength="300" style="min-height:64px;padding:10px 12px;font-size:16px;font-weight:400">${esc(fv('note', r.note || ''))}</textarea></div>
    <p class="note">Formulas use this month’s figures unless you pick a month. Lines are added up to give the money for this goal.</p>
    <button class="btn primary wide" data-act="saveGoalRow">${isNew ? 'Add line' : 'Save'}</button>
    ${!isNew ? '<button class="btn danger wide" data-act="deleteGoalRow">Delete line</button>' : ''}`;
}
function sheetMonths() {
  const months = monthRange(addM(curM(), 1), lastM());
  return `${phead('Months', 'Forecast months')}
    <div class="check"><span>Months after this one<span class="d">${esc(mLabel(addM(curM(), 1)))} to ${esc(mLabel(lastM()))}</span></span>
      <span style="display:flex;gap:8px;align-items:center"><button class="mini" data-act="fcount" data-d="-1" aria-label="One month fewer" ${S.settings.forecastMonths <= 0 ? 'disabled' : ''}>−</button><b class="num" style="min-width:24px;text-align:center">${S.settings.forecastMonths}</b><button class="mini" data-act="fcount" data-d="1" aria-label="One month more" ${S.settings.forecastMonths >= 36 ? 'disabled' : ''}>+</button></span></div>
    <p class="note">Removing months only hides them. Their data is kept and returns when you add them back.</p>
    <div class="card list">
      <div class="row" style="min-height:52px"><span class="main"><span class="name">${esc(mLong(curM()))}</span><span class="meta">Current month · always shown</span></span></div>
      ${months.map((m) => { const hid = S.settings.hiddenMonths.includes(m); return `<div class="row" style="min-height:52px"><span class="main"><span class="name" ${hid ? 'style="color:var(--muted)"' : ''}>${esc(mLong(m))}</span><span class="meta">${hid ? 'Hidden · still calculated' : 'Shown'}</span></span><button class="switch" role="switch" aria-checked="${!hid}" aria-label="Show ${esc(mLong(m))}" data-act="toggleMonth" data-m="${m}"></button></div>`; }).join('')}
    </div>
    ${firstM() < curM() ? `<div class="check"><span>Show past months<span class="d">From ${esc(mLabel(firstM()))}</span></span><button class="switch" role="switch" aria-checked="${S.settings.showPast}" aria-label="Show past months" data-act="toggleSetting" data-key="showPast"></button></div>` : ''}
    <button class="btn primary wide" data-act="closeSheet">Done</button>`;
}
function sheetRate() {
  const r = fv('rate', rate().toFixed(2));
  const n = parseAmount(r);
  const inr = S.cats.filter((c) => c.ccy === 'INR');
  return `${phead('Currency', '₹ INR → £ GBP rate')}
    <div class="field"><label for="rateIn">Rupees per £1</label>
      <span style="display:flex;gap:8px"><button type="button" class="key" style="width:56px" data-act="rateNudge" data-d="-0.5" aria-label="Lower by 0.5">−</button>
      <input id="rateIn" data-field="rate" inputmode="decimal" value="${esc(r)}" style="text-align:center">
      <button type="button" class="key" style="width:56px" data-act="rateNudge" data-d="0.5" aria-label="Raise by 0.5">+</button></span></div>
    <div class="box info" id="ratePrev">${esc(n > 0 ? `£1 = ₹${n.toFixed(2)} · ₹1 = £${(1 / n).toFixed(5)}` : 'Enter a number above 0')}${inr.map((c) => { const v = safe(() => catNative(c.id, curM())); return typeof v === 'number' && n > 0 ? `\n${c.name}: ${fmt(v, 'INR')} ≈ ${fmt(v / n, 'GBP', 2)}` : ''; }).join('')}</div>
    <p class="note">Last changed: ${esc(S.settings.rates.INR.at ? stamp(S.settings.rates.INR.at) : 'not yet (default value)')}. Changing the rate never changes your ₹ balances; it only changes the £ figures. One rate is used for every month.</p>
    <button class="btn primary wide" data-act="saveRate">Save rate</button>`;
}
function sheetAllowance(sh) {
  const a = allowance(sh.ty);
  return `${phead('ISA', `Allowance ${tyName(sh.ty)}`)}
    <div class="field"><label for="ovIn">Overall ISA allowance (£)</label><input id="ovIn" data-field="overall" inputmode="decimal" value="${esc(fv('overall', String(a.overall)))}"></div>
    <div class="field"><label for="cashIn">Cash ISA limit (£)</label><input id="cashIn" data-field="cash" inputmode="decimal" value="${esc(fv('cash', a.cash == null ? '' : String(a.cash)))}" placeholder="No separate limit"><span class="hint">Blank means cash can use the whole allowance.</span></div>
    <div class="field"><label for="lisaIn">Lifetime ISA limit (£)</label><input id="lisaIn" data-field="lisa" inputmode="decimal" value="${esc(fv('lisa', String(a.lisa)))}"></div>
    ${sh.ty >= 2027 ? sw('under65', fv('under65', S.settings.under65), 'I’m under 65', 'Sets the default £12,000 Cash ISA limit from 2027/28') : ''}
    ${isaSource()}
    <button class="btn primary wide" data-act="saveAllowance">Save</button>
    <button class="btn wide" data-act="resetAllowance">Use built-in defaults</button>`;
}
function sheetIsaMonth(sh) {
  const cats = isaCats();
  return `${phead(`ISA › ${tyName(taxYear(sh.m))}`, mLong(sh.m))}
    <p class="note">Contributions come from Plan rows that pay into each ISA. Type an amount to override; leave blank to keep the link.</p>
    ${cats.map((c) => { const o = (S.isaOv[c.id] || {})[sh.m] || {}; const linked = isaLinked(c, sh.m); return `<div class="card pad" style="display:flex;flex-direction:column;gap:10px">
      <b>${esc(c.name)}</b>
      <div class="field"><label for="ov_${c.id}">Contribution (linked: ${esc(fmt(linked))})</label><input id="ov_${c.id}" data-field="ov_${c.id}" inputmode="decimal" value="${esc(fv('ov_' + c.id, o.amt != null ? String(o.amt) : ''))}" placeholder="${esc(String(linked))}"></div>
      <div class="field"><label for="wd_${c.id}">Withdrawal (£)</label><input id="wd_${c.id}" data-field="wd_${c.id}" inputmode="decimal" value="${esc(fv('wd_' + c.id, o.wd ? String(o.wd) : ''))}" placeholder="0"><span class="hint">${c.flexible ? 'Flexible: gives allowance back this tax year.' : 'Not flexible: does not give allowance back.'}</span></div></div>`; }).join('')}
    <button class="btn primary wide" data-act="saveIsaMonth">Save</button>`;
}
function sheetInspect(sh) {
  const m = curM();
  const isS = sh.k === 's';
  const f = isS ? S.savTotal.f : S.liabTotal.f;
  const items = isS ? S.cats : S.liabs;
  const tot = safe(() => (isS ? savTotal(m) : liabTotal(m)));
  return `${phead('Now · ' + mLong(m), isS ? 'Savings breakdown' : 'Liabilities breakdown')}
    <div class="box info" style="font-family:ui-monospace,Menlo,monospace">= ${esc(toDisplay(f))}</div>
    <div class="card pad">${items.map((it) => { const r = safe(() => (isS ? catNative(it.id, m) : liabVal(it.id, m))); const inF = usesRef(f, isS ? 's' : 'l', it.id); const ccy = isS ? it.ccy : 'GBP';
      return `<div class="kv"><span>${esc(it.name)}<br><span class="small muted">${inF ? 'In total' : 'Not in total'}${isS && it.kind === 'expected' ? ' · expected' : ''}${ccy === 'INR' && typeof r === 'number' ? ` · ${fmt(r, 'INR')} ÷ ${rate().toFixed(2)}` : ''}</span></span><span class="num" style="font-weight:600">${r instanceof FErr ? '⚠' : esc(fmt(ccy === 'INR' ? r / rate() : r))}</span></div>`; }).join('') || '<span class="muted">Nothing here yet.</span>'}
      <div class="kv" style="font-weight:800;font-size:16px"><span>Total</span><span class="num">${tot instanceof FErr ? esc(tot.message) : esc(fmt(tot))}</span></div></div>
    <p class="note">${isS ? 'Liabilities are not subtracted.' : 'Shown on its own. Not subtracted from savings.'}</p>
    <button class="btn primary wide" data-act="closeSheet">Done</button>`;
}
function sheetSettings() {
  return `${phead('', 'Settings and backup')}
    <span class="cap2">CURRENCY</span>
    <button class="btn wide" data-act="openRate" style="text-align:left">₹ → £ rate: ₹${rate().toFixed(2)} per £1 ›</button>
    <span class="cap2">MONTHS</span>
    <button class="btn wide" data-act="openMonths" style="text-align:left">Forecast months, hidden months ›</button>
    <span class="cap2">PLAN</span>
    <div class="check"><span>Carry unallocated money forward<span class="d">Adds last month’s “Left” to next month’s income</span></span><button class="switch" role="switch" aria-checked="${S.settings.carryLeft}" aria-label="Carry unallocated money forward" data-act="toggleSetting" data-key="carryLeft"></button></div>
    <span class="cap2">ISA</span>
    <div class="check"><span>I’m under 65<span class="d">£12,000 Cash ISA limit from April 2027</span></span><button class="switch" role="switch" aria-checked="${S.settings.under65}" aria-label="Under 65" data-act="toggleSetting" data-key="under65"></button></div>
    <span class="cap2">APPEARANCE</span>
    <div class="seg" role="group" aria-label="Light or dark mode">${[['system', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<button type="button" data-act="setLook" data-key="appearance" data-v="${v}" aria-pressed="${S.settings.appearance === v}">${l}</button>`).join('')}</div>
    <span class="small muted">Automatic follows your iPhone’s Light/Dark setting.</span>
    <div class="field"><span>Layout colour</span><div class="swatches" role="group" aria-label="Layout colour">${Object.entries(THEMES).map(([k, t]) => `<button type="button" data-act="setLook" data-key="accent" data-v="${k}" aria-pressed="${S.settings.accent === k}" aria-label="${t.name}" title="${t.name}" style="background:${t.light[0]}"></button>`).join('')}</div>
      <span class="hint">${esc((THEMES[S.settings.accent] || THEMES.green).name)}. Used for totals, buttons and highlights.</span></div>
    <span class="cap2">NUMBERS</span>
    <div class="check"><span>Decimal places</span><div class="seg" role="group" aria-label="Decimal places">${[['0', '0'], ['2', '2']].map(([v, l]) => `<button type="button" data-act="setLook" data-key="decimals" data-v="${v}" aria-pressed="${String(S.settings.decimals) === v}">${l}</button>`).join('')}</div></div>
    <span class="cap2">BACKUP AND EXPORT</span>
    <button class="btn wide" data-act="exportJSON">Full backup (.json): formulas and all settings</button>
    <button class="btn wide" data-act="exportXLSX">Excel / Numbers (.xlsx) with live formulas</button>
    <button class="btn wide" data-act="exportCSV">CSV (values only)</button>
    <button class="btn wide" data-act="importJSON">Restore from backup (.json)</button>
    <p class="note">Last backup: ${esc(S.settings.lastBackup ? stamp(S.settings.lastBackup) : 'never')}.</p>
    <span class="cap2">WHERE YOUR DATA IS</span>
    <p class="note">Only on this device, in this app’s private browser storage. Nothing is sent anywhere: no account, no server, no tracking. If you delete the app from your Home Screen, its data is deleted too, so export a backup to Files or iCloud Drive regularly.</p>
    <span class="cap2">APP</span>
    <div class="check"><span>Version ${APP_VERSION}<span class="d">Updates load automatically when you open the app online.</span></span><button class="mini" data-act="checkUpdate">Check for updates</button></div>
    <button class="btn danger wide" data-act="eraseAll">Erase all data</button>`;
}
function renderSheet() {
  const host = $('#sheet');
  const sh = ui.sheet;
  if (!sh) { host.innerHTML = ''; document.body.style.overflow = ''; return; }
  const scrollTop = $('#sheet .panel') ? $('#sheet .panel').scrollTop : 0;
  const builders = { cell: sheetCell, total: sheetTotal, line: sheetLine, repay: sheetRepay, cat: sheetCat, liab: sheetLiab, months: sheetMonths, rate: sheetRate, allowance: sheetAllowance, isaMonth: sheetIsaMonth, inspect: sheetInspect, settings: sheetSettings, goal: sheetGoal, grow: sheetGoalRow, checkin: sheetCheckIn, cover: sheetCover, projcats: sheetProjCats };
  resetCalc();
  host.innerHTML = `<div class="shade" data-act="shade"><div class="panel" role="dialog" aria-modal="true" aria-labelledby="sheetTitle">${builders[sh.type](sh)}</div></div>`;
  document.body.style.overflow = 'hidden';
  const p = $('#sheet .panel');
  if (p && sh.keepScroll) p.scrollTop = scrollTop;
  sh.keepScroll = false;
}
function rerenderSheet() { collect(); ui.sheet.keepScroll = true; renderSheet(); }

/* ---------------- main render ---------------- */
function render(toTop) {
  applyTheme();
  resetCalc();
  if (!ui.m || !visibleMonths().includes(ui.m)) ui.m = curM();
  const y = window.scrollY;
  const act = document.activeElement;
  const focusKey = act && act.dataset && act.dataset.key ? act.dataset.key : null;
  const typedNow = focusKey ? act.value : null;
  const screens = { overview: screenOverview, savings: screenSavings, liab: screenLiab, plan: screenPlan, goals: screenGoals, isa: screenIsa };
  const tabs = [['overview', 'Overview'], ['savings', 'Savings'], ['liab', 'Liabilities'], ['plan', 'Plan'], ['goals', 'Goals'], ['isa', 'ISA']];
  $('#app').innerHTML = screens[ui.tab]() + `<nav class="tabbar" aria-label="Main"><div class="in">${tabs.map(([k, l]) =>
    `<button data-act="tab" data-tab="${k}" ${ui.tab === k ? 'aria-current="page"' : ''}>${svg(k)}<span>${l}</span></button>`).join('')}</div></nav>`;
  window.scrollTo(0, toTop ? 0 : y);
  if (focusKey && !toTop) {
    const el = $$('#app [data-key]').find((x) => x.dataset.key === focusKey);
    if (el) { if (typedNow !== el.dataset.orig) el.value = typedNow; el.focus({ preventScroll: true }); try { el.select(); } catch (_) {} }
  }
}

/* ---------------- actions ---------------- */
function readNum(field, { allowBlank = true, min = null } = {}) {
  const n = parseAmount(ui.sheet.f[field]);
  if (n == null) { if (allowBlank) return null; throw new FErr('Please enter an amount'); }
  if (isNaN(n)) throw new FErr(`“${ui.sheet.f[field]}” isn’t a number`);
  if (min != null && n < min) throw new FErr(`Must be ${min} or more`);
  return n;
}
function guard(fn) { return (...a) => { try { fn(...a); } catch (e) { if (e instanceof FErr) toast(e.message); else { console.error(e); toast('Something went wrong: ' + e.message); } } }; }
function uniqueName(arr, name, selfId) {
  let n = cleanName(name);
  if (!n) throw new FErr('Please enter a name');
  const taken = (x) => arr.some((o) => o.id !== selfId && o.name.toLowerCase() === x.toLowerCase());
  if (!taken(n)) return n;
  let i = 2;
  while (taken(`${n} ${i}`)) i++;
  return `${n} ${i}`;
}

const ACT = {
  tab: (d) => { ui.tab = d.tab; ui.sheet = null; renderSheet(); render(true); },
  pickMonth: (d) => { ui.m = d.m; ui.justAdded.clear(); render(); },
  planEmpty: (d) => { ui.planShowEmpty[d.sec] = !ui.planShowEmpty[d.sec]; render(); },
  ovMore: () => { ui.ovMore = !ui.ovMore; render(); },
  undo: () => {
    if (!undoStack.length) return;
    S = migrate(JSON.parse(undoStack.pop()));
    S.updatedAt = now(); save(); ui.sheet = null; renderSheet(); render(); toast('Undone');
  },
  openSettings: () => openSheet({ type: 'settings' }),
  closeSheet: () => closeSheet(),
  shade: (d, el, ev) => { if (ev.target === el) closeSheet(); },
  toggleEdit: (d) => { ui.edit[d.k] = !ui.edit[d.k]; render(); },
  toggleHidden: (d) => { ui.showHidden[d.k] = !ui.showHidden[d.k]; render(); },
  seg: (d) => { collect(); ui.sheet.f[d.fieldName] = d.v; rerenderSheet(); },
  segBool: (d) => { collect(); ui.sheet.f[d.fieldName] = !(fv(d.fieldName, $(`#sheet [data-field-name="${d.fieldName}"]`).getAttribute('aria-checked') === 'true')); rerenderSheet(); },
  inspect: (d) => openSheet({ type: 'inspect', k: d.k }),
  openMonths: () => openSheet({ type: 'months' }),
  openRate: () => { if (ui.sheet && ui.sheet.type !== 'settings') collect(); openSheet({ type: 'rate', back: ui.sheet && ui.sheet.type !== 'rate' ? ui.sheet : null }); },

  /* formula editor */
  fxKey: (d) => {
    const el = $('#fx'); if (!el) return;
    if (d.t === '⌫') {
      const s = ui.sheet.caret != null ? ui.sheet.caret : el.value.length;
      const e = ui.sheet.caretEnd != null ? ui.sheet.caretEnd : s;
      if (s !== e) { ui.sheet.caretEnd = e; insertAtCaret(''); return; }
      if (s === 0) return;
      // Delete a whole [reference] at once if the caret is right after one.
      let start = s - 1;
      if (el.value[s - 1] === ']') { const o = el.value.lastIndexOf('[', s - 1); if (o >= 0) start = o; }
      ui.sheet.caret = start; ui.sheet.caretEnd = s; insertAtCaret('');
      return;
    }
    insertAtCaret(['+', '−', '×', '÷'].includes(d.t) ? ` ${d.t} ` : d.t === ',' ? ', ' : d.t);
  },
  fxPicker: () => { collect(); ui.sheet.picker = !ui.sheet.picker; rerenderSheet(); },
  fxRef: (d) => {
    const scope = fv('scope', '');
    const at = scope === '' ? '' : scope === 'prev' ? ' @ previous month' : ' @ ' + mLabel(scope);
    const el = $('#fx');
    const pos = ui.sheet.caret != null ? ui.sheet.caret : (el ? el.value.length : 0);
    const before = el ? el.value.slice(0, pos).trimEnd() : '';
    // Picking a value right after another value adds them, so no need to type +.
    const joiner = /[\])0-9%]$/.test(before) ? (el.value.slice(0, pos).endsWith(' ') ? '+ ' : ' + ') : '';
    insertAtCaret(joiner + '[' + refName(d.k, d.id) + at + ']');
    toast(joiner ? 'Added with +' : 'Inserted');
  },

  /* savings and liabilities cells */
  editCell: (d) => openSheet({ type: 'cell', k: d.k, id: d.id, m: d.m, f: { fx: toDisplay(((d.k === 's' ? S.catCells : S.liabCells)[d.id] || {})[d.m] ? ((d.k === 's' ? S.catCells : S.liabCells)[d.id][d.m].f || '') : '') } }),
  saveCell: guard(() => {
    collect();
    const sh = ui.sheet;
    const store = sh.k === 's' ? S.catCells : S.liabCells;
    const cell = (store[sh.id] || {})[sh.m];
    const defMode = cell && cell.f ? 'formula' : cell && cell.v != null ? 'value' : sh.m > firstM() ? 'auto' : 'value';
    const mode = fv('mode', defMode);
    if (mode === 'auto') {
      mutate(() => { if (store[sh.id]) delete store[sh.id][sh.m]; }, 'Set to automatic');
    } else if (mode === 'value') {
      const n = readNum('val');
      mutate(() => {
        store[sh.id] = store[sh.id] || {};
        if (n == null) delete store[sh.id][sh.m]; else store[sh.id][sh.m] = { v: n, f: null, at: now() };
      }, n == null ? 'Cleared' : 'Saved');
    } else {
      const text = String(fv('fx', '')).trim();
      if (!text) throw new FErr('The formula is empty');
      const internal = validateFormula(sh, text);
      // Look the store up again: validation restores S from a snapshot, which replaces nested objects.
      mutate(() => { const st = sh.k === 's' ? S.catCells : S.liabCells; st[sh.id] = st[sh.id] || {}; st[sh.id][sh.m] = { v: null, f: internal, at: now() }; }, 'Formula saved');
    }
    closeSheet();
  }),
  editTotal: (d) => openSheet({ type: 'total', k: d.k, m: ui.m, f: { fx: toDisplay(d.k === 's' ? S.savTotal.f : S.liabTotal.f) } }),
  saveTotal: guard(() => {
    collect();
    const sh = ui.sheet;
    const text = String(fv('fx', '')).trim() || 'SUM()';
    const internal = validateFormula(sh, text);
    mutate(() => { const t = sh.k === 's' ? S.savTotal : S.liabTotal; t.f = internal; t.at = now(); }, 'Total formula saved');
    closeSheet();
  }),
  resetTotal: () => {
    const sh = ui.sheet;
    const f = sh.k === 's' ? 'SUM(' + S.cats.filter((c) => c.kind === 'held').map((c) => `{s:${c.id}}`).join(', ') + ')' : 'SUM(' + S.liabs.map((l) => `{l:${l.id}}`).join(', ') + ')';
    ui.sheet.f.fx = toDisplay(f); ui.sheet.keepScroll = true; renderSheet();
  },

  /* categories */
  newCat: () => openSheet({ type: 'cat', id: null }),
  editCat: (d) => openSheet({ type: 'cat', id: d.id }),
  saveCat: guard(() => {
    collect();
    const sh = ui.sheet;
    const c = catById(sh.id);
    const name = uniqueName(S.cats, fv('name', c ? c.name : ''), sh.id);
    const isa = fv('isa', c ? c.isa || '' : '') || null;
    const prior = isa ? readNum('prior', { min: 0 }) : null;
    const dpRaw = fv('dp', c && c.dp != null ? String(c.dp) : '');
    const kind = fv('kind', c ? c.kind : 'held');
    const inTotal = fv('inTotal', c ? usesRef(S.savTotal.f, 's', c.id) : kind === 'held');
    const growth = kind === 'held' ? readNum('growth') : null;
    if (growth != null && (growth < -50 || growth > 50)) throw new FErr('Growth should be between −50% and 50% a year');
    mutate(() => {
      const t = c || { id: uid(), isaPrior: {}, hidden: false };
      Object.assign(t, {
        name, kind, ccy: fv('ccy', c ? c.ccy : 'GBP'), color: fv('color', c ? c.color : COLORS[S.cats.length % COLORS.length]),
        isa, flexible: !!fv('flexible', c ? c.flexible : false), bold: !!fv('bold', c ? c.bold : false),
        hidden: !!fv('hidden', c ? c.hidden : false), dp: dpRaw === '' ? null : Number(dpRaw), growth: growth || null, note: cleanNote(fv('note', c ? c.note : '')), at: now()
      });
      if (isa) t.isaPrior[taxYear(curM())] = prior || 0;
      if (!c) S.cats.push(t);
      const has = usesRef(S.savTotal.f, 's', t.id);
      if (inTotal && !has) S.savTotal.f = addRefToSum(S.savTotal.f, `{s:${t.id}}`);
      if (!inTotal && has) S.savTotal.f = removeRefFromSum(S.savTotal.f, 's', t.id);
    }, c ? 'Saved' : 'Category added');
    closeSheet();
  }),
  deleteCat: guard(() => {
    const c = catById(ui.sheet.id);
    const used = usagesOf('s', c.id).filter((w) => !w.startsWith('Savings › ' + c.name) && w !== 'Total savings formula');
    const lines = S.lines.filter((l) => l.link === c.id).map((l) => l.name);
    const msg = `Delete “${c.name}” and its values in every month?` + (lines.length ? `\n\nPlan rows paying into it will be unlinked: ${lines.join(', ')}.` : '') + (used.length ? `\n\nThese formulas use it and will show an error until fixed:\n• ${used.join('\n• ')}` : '') + '\n\nYou can undo this.';
    if (!confirm(msg)) return;
    mutate(() => {
      S.cats = S.cats.filter((x) => x.id !== c.id);
      delete S.catCells[c.id]; delete S.isaOv[c.id];
      S.savTotal.f = removeRefFromSum(S.savTotal.f, 's', c.id);
      S.lines.forEach((l) => { if (l.link === c.id) l.link = null; });
    }, 'Category deleted');
    closeSheet();
  }),
  moveCat: (d) => mutateMove(S.cats, d.id, Number(d.dir)),
  moveLiab: (d) => mutateMove(S.liabs, d.id, Number(d.dir)),

  /* liabilities */
  newLiab: () => openSheet({ type: 'liab', id: null }),
  editLiab: (d) => openSheet({ type: 'liab', id: d.id }),
  saveLiab: guard(() => {
    collect();
    const sh = ui.sheet;
    const l = liabById(sh.id);
    const name = uniqueName(S.liabs, fv('name', l ? l.name : ''), sh.id);
    const rep = readNum('repay', { min: 0 });
    const bal = l ? null : readNum('bal', { min: 0 });
    const inTotal = fv('inTotal', l ? usesRef(S.liabTotal.f, 'l', l.id) : true);
    mutate(() => {
      const t = l || { id: uid(), hidden: false };
      Object.assign(t, { name, repay: rep || 0, autoPay: !!fv('autoPay', l ? l.autoPay : true), color: fv('color', l ? l.color : COLORS[(S.liabs.length + 4) % COLORS.length]), bold: !!fv('bold', l ? l.bold : false), hidden: !!fv('hidden', l ? l.hidden : false), note: cleanNote(fv('note', l ? l.note : '')), at: now() });
      if (!l) {
        S.liabs.push(t);
        if (bal != null) { S.liabCells[t.id] = { [curM()]: { v: bal, f: null, at: now() } }; }
      }
      const has = usesRef(S.liabTotal.f, 'l', t.id);
      if (inTotal && !has) S.liabTotal.f = addRefToSum(S.liabTotal.f, `{l:${t.id}}`);
      if (!inTotal && has) S.liabTotal.f = removeRefFromSum(S.liabTotal.f, 'l', t.id);
    }, l ? 'Saved' : 'Liability added. It now appears in Plan.');
    closeSheet();
  }),
  deleteLiab: guard(() => {
    const l = liabById(ui.sheet.id);
    const used = usagesOf('l', l.id).concat(usagesOf('r', l.id)).filter((w) => !w.startsWith('Liabilities › ' + l.name) && w !== 'Total liabilities formula');
    if (!confirm(`Delete “${l.name}”, its balances and its repayments in every month?` + (used.length ? `\n\nThese formulas use it and will show an error until fixed:\n• ${used.join('\n• ')}` : '') + '\n\nYou can undo this.')) return;
    mutate(() => {
      S.liabs = S.liabs.filter((x) => x.id !== l.id);
      delete S.liabCells[l.id]; delete S.repay[l.id]; delete S.borrow[l.id];
      S.liabTotal.f = removeRefFromSum(S.liabTotal.f, 'l', l.id);
    }, 'Liability deleted');
    closeSheet();
  }),

  /* plan rows */
  newLine: (d) => openSheet({ type: 'line', id: null, m: ui.m, draftLine: { id: uid(), sec: d.sec, name: '', link: null, behaviour: 'normal', opening: 0, bold: false, entries: {}, start: ui.m > firstM() ? ui.m : null, end: null, at: now() }, f: { once: 'false' } }),
  editLine: (d) => { const ln = lineById(d.id); const e = ln.entries[d.m] || {}; openSheet({ type: 'line', id: d.id, m: d.m, f: { fx: toDisplay(e.f || '') } }); },
  saveLine: guard(() => {
    collect();
    const sh = ui.sheet;
    const existing = lineById(sh.id);
    const ln = existing || sh.draftLine;
    const name = uniqueName(S.lines, fv('name', ln.name), ln.id);
    const e = ln.entries[sh.m] || {};
    const mode = fv('mode', e.f ? 'formula' : 'value');
    const once = fv('once', String(!!e.once)) === 'true';
    const actual = readNum('actual');
    const carry = !!fv('carry', ln.behaviour === 'carry');
    const opening = carry ? (readNum('opening') || 0) : (ln.opening || 0);
    let amt = null, f = null;
    if (mode === 'value') amt = readNum('amt');
    else {
      const text = String(fv('fx', '')).trim();
      if (text) {
        const tmp = Object.assign({}, sh);
        if (!existing) { tmp.draftLine = Object.assign(clone(ln), { name }); }
        f = validateFormula(tmp, text);
      }
    }
    mutate(() => {
      let t = lineById(ln.id);
      if (!t) { t = clone(ln); S.lines.push(t); }
      t.name = name; t.behaviour = carry ? 'carry' : 'normal'; t.opening = opening; t.bold = !!fv('bold', t.bold); t.note = cleanNote(fv('note', t.note)); t.at = now();
      if (t.sec === 'saving') t.link = fv('link', t.link || '') || null;
      if (amt == null && f == null && actual == null) delete t.entries[sh.m];
      else t.entries[sh.m] = { amt, f, once, actual, at: now() };
      if (!existing) ui.justAdded.add(t.id);
    }, existing ? 'Saved' : `Row added from ${mLabel(sh.m)} onwards`);
    closeSheet();
  }),
  clearLineMonth: () => {
    const sh = ui.sheet;
    mutate(() => { delete lineById(sh.id).entries[sh.m]; }, `${mShort(sh.m)} cleared`);
    closeSheet();
  },
  deleteLine: () => {
    const ln = lineById(ui.sheet.id);
    const m = ui.sheet.m;
    const startsAt = ln.start && ln.start > firstM() ? ln.start : firstM();
    if (m > startsAt) {
      // Earlier months keep the row; it stops from this month.
      if (!confirm(`Remove “${ln.name}” from ${mLabel(m)} onwards?\n\nEarlier months keep it. You can undo this.`)) return;
      mutate(() => { const t = lineById(ln.id); t.end = m; t.at = now(); }, `Removed from ${mLabel(m)} onwards`);
    } else {
      const used = usagesOf('p', ln.id);
      if (!confirm(`Remove “${ln.name}”? It starts in ${mLabel(startsAt)}, so it will be removed completely.` + (used.length ? `\n\nThese formulas use it and will show an error until fixed:\n• ${used.join('\n• ')}` : '') + '\n\nYou can undo this.')) return;
      mutate(() => { S.lines = S.lines.filter((x) => x.id !== ln.id); }, 'Row removed');
    }
    closeSheet();
  },

  /* goal spending plan */
  spendToggle: (d) => { ui.spendOpen[d.id] = !ui.spendOpen[d.id]; render(); },
  spendAdd: (d) => {
    let newId = null;
    mutate(() => { const g = goalById(d.id); const r = blankSpend(1)[0]; newId = r.id; g.spend.push(r); });
    ui.spendOpen[d.id] = true; render();
    const el = $$('#app [data-key]').find((x) => x.dataset.key === `spname|${newId}`);
    if (el) el.focus();
  },

  /* growth projection */
  projToggle: () => { ui.projOpen = !ui.projOpen; render(); },
  projLine: () => { mutate(() => { S.settings.proj.line = S.settings.proj.line === false; }); render(); },
  openProjCats: () => openSheet({ type: 'projcats' }),
  saveProjCats: () => {
    collect();
    const ids = S.cats.filter((c) => c.kind === 'held' && fv('pc_' + c.id, projCats().includes(c.id))).map((c) => c.id);
    mutate(() => { S.settings.proj.cats = ids; }, 'Saved');
    closeSheet();
  },

  /* overspend */
  openCover: (d) => openSheet({ type: 'cover', m: d.m }),
  saveCover: guard(() => {
    collect();
    const sh = ui.sheet;
    const m = sh.m;
    const amt = readNum('amt', { allowBlank: false, min: 0 });
    if (!(amt > 0)) throw new FErr('Enter an amount above £0');
    const def = (S.liabs.find((l) => /over/i.test(l.name)) || S.liabs[0] || { id: '__new' }).id;
    const target = fv('target', def);
    const name = target === '__new' ? uniqueName(S.liabs, fv('name', 'Overspend')) : null;
    const tl = liabById(target);
    const cell = tl ? (S.liabCells[tl.id] || {})[m] : null;
    const addBal = m === firstM() && cell && cell.v != null && !cell.f && !!fv('addBal', true);
    let label = '';
    mutate(() => {
      let id = target;
      if (target === '__new') {
        id = uid();
        S.liabs.push({ id, name, repay: 0, autoPay: true, color: '#8E3B2F', hidden: false, bold: false, at: now() });
        S.liabTotal.f = addRefToSum(S.liabTotal.f, `{l:${id}}`);
      }
      S.borrow[id] = S.borrow[id] || {};
      const e = Object.assign({ amt: 0, over: 0 }, S.borrow[id][m] || {});
      e.over = Math.round(((Number(e.over) || 0) + amt) * 100) / 100; e.at = now();
      S.borrow[id][m] = e;
      if (addBal) { const c = S.liabCells[id][m]; c.v = Math.round((c.v + amt) * 100) / 100; c.at = now(); }
      label = (liabById(id) || {}).name;
    });
    toast(`${fmt(amt)} added to ${label} as overspend`);
    closeSheet();
  }),

  /* month-start check-in */
  openCheckIn: () => openSheet({ type: 'checkin', m: curM() }),
  saveCheckIn: guard(() => {
    collect();
    const m = curM();
    const vals = [];
    for (const [kind, arr, store] of [['s', S.cats, 'catCells'], ['l', S.liabs, 'liabCells']]) {
      for (const it of arr) {
        const key = `ci_${kind}_${it.id}`;
        if (ui.sheet.f[key] === undefined) continue;
        const n = parseAmount(ui.sheet.f[key]);
        if (n == null) continue;
        if (isNaN(n)) throw new FErr(`${it.name}: “${ui.sheet.f[key]}” isn’t a number`);
        if (kind === 'l' && n < 0) throw new FErr(`${it.name}: use a positive amount`);
        vals.push([store, it.id, n]);
      }
    }
    mutate(() => {
      for (const [store, id, n] of vals) { S[store][id] = S[store][id] || {}; S[store][id][m] = { v: n, f: null, at: now() }; }
      S.settings.checkIn = m;
    }, `${mLong(m)} balances confirmed`);
    closeSheet();
  }),
  skipCheckIn: () => { mutate(() => { S.settings.checkIn = curM(); }, 'Skipped. You’ll be asked again next month.'); closeSheet(); },

  /* goals */
  newGoal: () => openSheet({ type: 'goal', id: null, m: curM(), draftGoal: { id: uid(), name: '', color: COLORS[S.goals.length % COLORS.length], target: null, date: null, rows: [{ id: uid(), label: 'Saved so far', v: null, f: null }], spend: blankSpend() } }),
  editGoal: (d) => { const g = goalById(d.id); openSheet({ type: 'goal', id: d.id, m: curM(), f: { fx: toDisplay(g.target && g.target.f ? g.target.f : '') } }); },
  saveGoal: guard(() => {
    collect();
    const sh = ui.sheet;
    const existing = goalById(sh.id);
    const g0 = existing || sh.draftGoal;
    const name = uniqueName(S.goals, fv('name', g0.name), g0.id);
    const tmode = fv('tmode', g0.target ? (g0.target.f ? 'formula' : 'value') : 'none');
    let target = null;
    if (tmode === 'value') { const n = readNum('tval'); target = n == null ? null : { v: n, f: null }; }
    if (tmode === 'formula') {
      const text = String(fv('fx', '')).trim();
      if (text) {
        const tmp = Object.assign({}, sh);
        if (!existing) tmp.draftGoal = Object.assign(clone(g0), { name });
        target = { v: null, f: validateFormula(tmp, text) };
      }
    }
    const date = String(fv('date', g0.date || '')).trim();
    if (date && !/^\d{4}-\d{2}$/.test(date)) throw new FErr('Choose a month for the target date');
    mutate(() => {
      let g = goalById(g0.id);
      if (!g) { g = clone(g0); S.goals.push(g); }
      Object.assign(g, { name, target, date: date || null, color: fv('color', g.color), note: cleanNote(fv('note', g.note)), at: now() });
    }, existing ? 'Saved' : 'Goal added');
    closeSheet();
  }),
  deleteGoal: () => {
    const g = goalById(ui.sheet.id);
    const used = usagesOf('g', g.id);
    if (!confirm(`Delete the goal “${g.name}” and its lines?` + (used.length ? `\n\nThese formulas use it and will show an error until fixed:\n• ${used.join('\n• ')}` : '') + '\n\nYou can undo this.')) return;
    mutate(() => { S.goals = S.goals.filter((x) => x.id !== g.id); }, 'Goal deleted');
    closeSheet();
  },
  moveGoal: (d) => {
    const id = ui.sheet.id;
    mutateMove(S.goals, id, Number(d.dir));
    collect(); ui.sheet.keepScroll = true; renderSheet();
  },
  newGoalRow: (d) => openSheet({ type: 'grow', gid: d.gid, rid: null, m: curM(), draftRow: { id: uid(), label: '', v: null, f: null } }),
  editGoalRow: (d) => { const r = goalById(d.gid).rows.find((x) => x.id === d.rid); openSheet({ type: 'grow', gid: d.gid, rid: d.rid, m: curM(), f: { fx: toDisplay(r.f || '') } }); },
  saveGoalRow: guard(() => {
    collect();
    const sh = ui.sheet;
    const g0 = goalById(sh.gid);
    const existing = g0.rows.find((x) => x.id === sh.rid);
    const r0 = existing || sh.draftRow;
    const label = cleanName(fv('label', r0.label));
    if (!label) throw new FErr('Please enter a label');
    const mode = fv('mode', r0.f ? 'formula' : 'value');
    let v = null, f = null;
    if (mode === 'value') v = readNum('val');
    else {
      const text = String(fv('fx', '')).trim();
      if (!text) throw new FErr('The formula is empty');
      const tmp = Object.assign({}, sh, { rid: r0.id });
      if (!existing) tmp.draftRow = Object.assign(clone(r0), { label });
      f = validateFormula(tmp, text);
    }
    mutate(() => {
      const g = goalById(sh.gid);
      let r = g.rows.find((x) => x.id === r0.id);
      if (!r) { r = clone(r0); g.rows.push(r); }
      Object.assign(r, { label, v, f, note: cleanNote(fv('note', r.note)), at: now() });
    }, existing ? 'Saved' : 'Line added');
    closeSheet();
  }),
  deleteGoalRow: () => {
    const sh = ui.sheet;
    const g = goalById(sh.gid);
    const r = g.rows.find((x) => x.id === sh.rid);
    if (!confirm(`Delete the line “${r.label}”? You can undo this.`)) return;
    mutate(() => { const gg = goalById(sh.gid); gg.rows = gg.rows.filter((x) => x.id !== sh.rid); }, 'Line deleted');
    closeSheet();
  },

  /* repayments */
  toggleRepay: (d) => {
    const on = repayOn(d.id, d.m);
    mutate(() => {
      S.repay[d.id] = S.repay[d.id] || {};
      const e = S.repay[d.id][d.m] = Object.assign({}, S.repay[d.id][d.m] || {});
      e.on = !on; e.at = now();
    });
    render();
  },
  editRepay: (d) => { const e = (S.repay[d.id] || {})[d.m] || {}; openSheet({ type: 'repay', id: d.id, m: d.m, f: { fx: toDisplay(e.f || '') } }); },
  saveRepay: guard(() => {
    collect();
    const sh = ui.sheet;
    const e0 = (S.repay[sh.id] || {})[sh.m] || {};
    const mode = fv('mode', e0.f ? 'formula' : 'value');
    const once = fv('once', String(!!e0.once)) === 'true';
    const actual = readNum('actual', { min: 0 });
    const on = !!fv('on', repayOn(sh.id, sh.m));
    const borrow = readNum('borrow', { min: 0 });
    const over = readNum('over', { min: 0 });
    let amt = null, f = null;
    if (mode === 'value') amt = readNum('amt', { min: 0 });
    else { const text = String(fv('fx', '')).trim(); if (text) f = validateFormula(sh, text); }
    mutate(() => {
      S.repay[sh.id] = S.repay[sh.id] || {};
      const l = liabById(sh.id);
      const e = { amt, f, once, actual, at: now() };
      if (on !== !!l.autoPay) e.on = on; else if (e0.on != null) e.on = on;
      S.repay[sh.id][sh.m] = e;
      S.borrow[sh.id] = S.borrow[sh.id] || {};
      if (borrow || over) S.borrow[sh.id][sh.m] = { amt: borrow || 0, over: over || 0, at: now() }; else delete S.borrow[sh.id][sh.m];
    }, 'Saved');
    closeSheet();
  }),
  clearRepayMonth: () => { const sh = ui.sheet; mutate(() => { if (S.repay[sh.id]) delete S.repay[sh.id][sh.m]; if (S.borrow[sh.id]) delete S.borrow[sh.id][sh.m]; }, 'Reset'); closeSheet(); },

  /* months */
  fcount: (d) => { mutate(() => { S.settings.forecastMonths = Math.min(36, Math.max(0, S.settings.forecastMonths + Number(d.d))); }); ui.sheet.keepScroll = true; renderSheet(); render(); },
  toggleMonth: (d) => {
    mutate(() => { const h = S.settings.hiddenMonths; const i = h.indexOf(d.m); if (i >= 0) h.splice(i, 1); else h.push(d.m); });
    ui.sheet.keepScroll = true; renderSheet(); render();
  },
  toggleSetting: (d) => { mutate(() => { S.settings[d.key] = !S.settings[d.key]; }); ui.sheet.keepScroll = true; renderSheet(); render(); },
  setLook: (d) => {
    mutate(() => { S.settings[d.key] = d.key === 'decimals' ? Number(d.v) : d.v; });
    applyTheme(); ui.sheet.keepScroll = true; renderSheet(); render();
  },

  /* rate */
  rateNudge: (d) => { collect(); const n = parseAmount(fv('rate', rate())); const v = Math.max(0.01, Math.round(((n > 0 ? n : rate()) + Number(d.d)) * 100) / 100); ui.sheet.f.rate = v.toFixed(2); rerenderSheet(); },
  saveRate: guard(() => {
    collect();
    const n = readNum('rate', { allowBlank: false });
    if (!(n > 0)) throw new FErr('The rate must be more than 0');
    mutate(() => { S.settings.rates.INR = { perGBP: n, at: now() }; }, 'Rate saved. £ figures updated.');
    const back = ui.sheet.back;
    if (back) { back.keepScroll = true; ui.sheet = back; renderSheet(); render(); } else closeSheet();
  }),

  /* ISA */
  editAllowance: (d) => openSheet({ type: 'allowance', ty: Number(d.ty) }),
  saveAllowance: guard(() => {
    collect();
    const ty = ui.sheet.ty;
    const overall = readNum('overall', { allowBlank: false, min: 0 });
    const cash = readNum('cash', { min: 0 });
    const lisa = readNum('lisa', { allowBlank: false, min: 0 });
    mutate(() => {
      if (ty >= 2027 && ui.sheet.f.under65 !== undefined) S.settings.under65 = !!ui.sheet.f.under65;
      S.settings.allowances[ty] = { overall, cash, lisa };
    }, 'Allowance saved');
    closeSheet();
  }),
  resetAllowance: () => { const ty = ui.sheet.ty; mutate(() => { delete S.settings.allowances[ty]; }, 'Defaults restored'); closeSheet(); },
  editIsaMonth: (d) => openSheet({ type: 'isaMonth', m: d.m }),
  saveIsaMonth: guard(() => {
    collect();
    const m = ui.sheet.m;
    const vals = isaCats().map((c) => ({ c, amt: readNum('ov_' + c.id, { min: 0 }), wd: readNum('wd_' + c.id, { min: 0 }) }));
    mutate(() => {
      for (const { c, amt, wd } of vals) {
        S.isaOv[c.id] = S.isaOv[c.id] || {};
        if (amt == null && !wd) delete S.isaOv[c.id][m];
        else S.isaOv[c.id][m] = { amt, wd: wd || 0, at: now() };
      }
    }, 'Saved');
    closeSheet();
  }),

  /* backup */
  exportJSON: guard(async () => {
    const blob = new Blob([JSON.stringify({ app: 'my-finances', exportedAt: new Date().toISOString(), data: S }, null, 2)], { type: 'application/json' });
    if (await deliver(blob, `my-finances-backup-${new Date().toISOString().slice(0, 10)}.json`)) {
      S.settings.lastBackup = now(); S.settings.changes = 0; save(); toast('Backup created'); if (ui.sheet) rerenderSheet(); render();
    }
  }),
  exportXLSX: guard(async () => {
    const blob = buildXLSX();
    if (await deliver(blob, `my-finances-${new Date().toISOString().slice(0, 10)}.xlsx`)) toast('Excel file created. Numbers opens it too.');
  }),
  exportCSV: guard(async () => {
    const blob = new Blob(['﻿' + buildCSV()], { type: 'text/csv' });
    if (await deliver(blob, `my-finances-${new Date().toISOString().slice(0, 10)}.csv`)) toast('CSV created');
  }),
  checkUpdate: async () => {
    // Clears only the app's offline file cache, never your data, then reloads the newest version.
    toast('Checking for updates…');
    try {
      const regs = navigator.serviceWorker ? await navigator.serviceWorker.getRegistrations() : [];
      await Promise.all(regs.map((r) => r.unregister()));
      const keys = window.caches ? await caches.keys() : [];
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (_) { /* reload anyway */ }
    location.reload();
  },
  importJSON: () => { const i = $('#importFile'); i.value = ''; i.click(); },
  eraseAll: () => {
    if (!confirm('Erase ALL data on this device? This cannot be undone after you close the app. Export a backup first if unsure.')) return;
    if (!confirm('Are you sure? Everything will be reset to empty.')) return;
    mutate(() => { S = blankState(); });
    S.updatedAt = now(); save(); closeSheet(); toast('All data erased. Undo is still available until you close the app.');
  }
};
function mutateMove(arr, id, dir) {
  const i = arr.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= arr.length) return;
  mutate(() => { const [x] = arr.splice(i, 1); arr.splice(j, 0, x); });
  render();
}

async function deliver(blob, filename) {
  try {
    const file = new File([blob], filename, { type: blob.type });
    const touch = navigator.maxTouchPoints > 0;
    if (touch && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: filename }); return true; }
      catch (e) { if (e && e.name === 'AbortError') return false; }
    }
  } catch (_) { /* fall back to a download */ }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  return true;
}

$('#importFile').addEventListener('change', async (ev) => {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const obj = JSON.parse(text);
    const data = obj && obj.data ? obj.data : obj;
    if (!data || data.v !== 1 || !Array.isArray(data.cats) || !data.settings) throw new Error('This file is not a My Finances backup.');
    const when = obj.exportedAt ? new Date(obj.exportedAt).toLocaleString('en-GB') : 'an unknown date';
    if (!confirm(`Replace everything in the app with the backup from ${when}? You can undo this until you close the app.`)) return;
    mutate(() => { S = migrate(data); });
    closeSheet();
    toast('Backup restored');
  } catch (e) {
    toast('Could not restore: ' + (e.message || 'unreadable file'));
  }
});

/* ---------------- XLSX (Excel / Numbers) export ---------------- */
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipStore(files) {
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true);
    lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true); ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
    ch.setUint16(30, 0, true); ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true);
    ch.setUint32(38, 0, true); ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((t, b) => t + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
const colName = (n) => { let s = ''; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };
const xmlEsc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const sheetRef = (name) => `'${name.replace(/'/g, "''")}'`;

function buildWorkbookModel() {
  resetCalc();
  const months = allMonths();
  const plainSheetName = (m) => `Plan ${mLabel(m)}`;
  const sheets = [];
  const addr = {}; // key -> 'Sheet'!$C$5
  const put = (sheet, r, c, cell) => { sheet.rows[r] = sheet.rows[r] || {}; sheet.rows[r][c] = cell; };

  const setS = { name: 'Settings', rows: {}, widths: [30, 20] };
  put(setS, 1, 1, { s: 'Rate ₹ per £1', b: true }); put(setS, 1, 2, { n: rate() });
  put(setS, 2, 1, { s: 'Rate last changed' }); put(setS, 2, 2, { s: S.settings.rates.INR.at ? stamp(S.settings.rates.INR.at) : 'default' });
  put(setS, 3, 1, { s: 'Exported' }); put(setS, 3, 2, { s: stamp(now()) });
  put(setS, 5, 1, { s: 'Blue cells in the app are formulas here too. Change a typed value and the rest recalculates.' });
  const RATE = `${sheetRef('Settings')}!$B$1`;

  const sav = { name: 'Savings', rows: {}, widths: [30, 10].concat(months.map(() => 14)) };
  const lia = { name: 'Liabilities', rows: {}, widths: [30, 10].concat(months.map(() => 14)) };
  const planSheets = months.map((m) => ({ name: plainSheetName(m), m, rows: {}, widths: [30, 22, 14, 14, 14] }));
  sheets.push(sav, lia, ...planSheets);

  // Lay out addresses first so formulas can point anywhere.
  [sav, lia].forEach((sh) => { put(sh, 1, 1, { s: sh.name === 'Savings' ? 'Category' : 'Liability', b: true }); put(sh, 1, 2, { s: 'Currency', b: true }); months.forEach((m, i) => put(sh, 1, 3 + i, { s: mLabel(m), b: true })); });
  let r = 2;
  const catRow = {}, catGbpRow = {};
  S.cats.forEach((c) => { catRow[c.id] = r++; });
  S.cats.filter((c) => c.ccy === 'INR').forEach((c) => { catGbpRow[c.id] = r++; });
  const savTotRow = r + 1;
  r = 2;
  const liabRow = {};
  S.liabs.forEach((l) => { liabRow[l.id] = r++; });
  const liaTotRow = r + 1;
  const lineRow = {}, repRow = {};
  planSheets.forEach((ps) => {
    put(ps, 1, 1, { s: 'Item', b: true }); put(ps, 1, 2, { s: 'Section', b: true }); put(ps, 1, 3, { s: 'Planned', b: true }); put(ps, 1, 4, { s: 'Actual', b: true }); put(ps, 1, 5, { s: 'Used', b: true });
  });
  let pr = 2;
  ['income', 'expense', 'saving'].forEach((sec) => S.lines.filter((l) => l.sec === sec).forEach((l) => { lineRow[l.id] = pr++; }));
  S.liabs.forEach((l) => { repRow[l.id] = pr++; });
  const brRow = {};
  S.liabs.forEach((l) => { brRow[l.id] = pr++; });
  const planTot = pr + 1;

  months.forEach((m, i) => {
    const col = colName(3 + i);
    S.cats.forEach((c) => { addr[`sN|${c.id}|${m}`] = `${sheetRef('Savings')}!$${col}$${catRow[c.id]}`; addr[`s|${c.id}|${m}`] = `${sheetRef('Savings')}!$${col}$${c.ccy === 'INR' ? catGbpRow[c.id] : catRow[c.id]}`; });
    addr[`T|_|${m}`] = `${sheetRef('Savings')}!$${col}$${savTotRow}`;
    S.liabs.forEach((l) => { addr[`l|${l.id}|${m}`] = `${sheetRef('Liabilities')}!$${col}$${liabRow[l.id]}`; });
    addr[`L|_|${m}`] = `${sheetRef('Liabilities')}!$${col}$${liaTotRow}`;
    const pn = sheetRef(plainSheetName(m));
    S.lines.forEach((l) => { addr[`p|${l.id}|${m}`] = `${pn}!$C$${lineRow[l.id]}`; addr[`pu|${l.id}|${m}`] = `${pn}!$E$${lineRow[l.id]}`; });
    S.liabs.forEach((l) => { addr[`ru|${l.id}|${m}`] = `${pn}!$E$${repRow[l.id]}`; addr[`bw|${l.id}|${m}`] = `${pn}!$E$${brRow[l.id]}`; });
  });

  // Translate an app formula into an Excel formula; returns null if something can't be expressed.
  const xl = (f, m) => {
    let ok = true;
    const out = String(f).replace(REF_RE, (_, k, id, at) => {
      let mm;
      try { mm = resolveAt(at, m); } catch (e) { ok = false; return '0'; }
      if (k === 'x') return RATE;
      const key = k === 'p' ? `pu|${id}|${mm}` : k === 'r' ? `ru|${id}|${mm}` : `${k}|${id}|${mm}`;
      if (addr[key]) return addr[key];
      // Outside the exported months: use the calculated number.
      const v = safe(() => getRef(k, id, mm));
      if (v instanceof FErr) { ok = false; return '0'; }
      return String(v);
    });
    return ok ? out.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)') : null;
  };
  const num = (fn) => { const v = safe(fn); return v instanceof FErr ? { s: '#ERROR ' + v.message } : { n: v }; };
  const cellFor = (valueFn, formula) => { const v = safe(valueFn); if (v instanceof FErr) return { s: '#ERROR ' + v.message }; return formula ? { n: v, f: formula } : { n: v }; };

  // Savings
  S.cats.forEach((c) => {
    const row = catRow[c.id];
    put(sav, row, 1, { s: c.name + (c.kind === 'expected' ? ' (expected)' : '') + (c.hidden ? ' (hidden)' : ''), b: c.bold });
    put(sav, row, 2, { s: c.ccy });
    months.forEach((m, i) => {
      const cell = (S.catCells[c.id] || {})[m];
      let f = null;
      if (cell && cell.f) { const x = xl(cell.f, m); f = x && (c.ccy === 'INR' ? `(${x})*${RATE}` : x); }
      else if (!(cell && cell.v != null) && m > firstM()) {
        const prev0 = addr[`sN|${c.id}|${addM(m, -1)}`];
        const prev = c.growth ? `${prev0}*(1+${monthlyRate(c.growth)})` : prev0;
        const links = S.lines.filter((l) => l.sec === 'saving' && l.link === c.id).map((l) => addr[`pu|${l.id}|${m}`]);
        const add = links.length ? '+' + (c.ccy === 'INR' ? `(${links.join('+')})*${RATE}` : links.join('+')) : '';
        f = prev + add;
      }
      const cl = cellFor(() => catNative(c.id, m), f);
      cl.cur = c.ccy; cl.b = c.bold;
      put(sav, row, 3 + i, cl);
    });
    if (c.ccy === 'INR') {
      put(sav, catGbpRow[c.id], 1, { s: c.name + ' in £' }); put(sav, catGbpRow[c.id], 2, { s: 'GBP' });
      months.forEach((m, i) => put(sav, catGbpRow[c.id], 3 + i, cellFor(() => catGBP(c.id, m), `${colName(3 + i)}${catRow[c.id]}/${RATE}`)));
    }
  });
  put(sav, savTotRow, 1, { s: 'Total savings (£)', b: true });
  months.forEach((m, i) => { const x = xl(S.savTotal.f || '0', m); const cl = cellFor(() => savTotal(m), x); cl.b = true; put(sav, savTotRow, 3 + i, cl); });

  // Liabilities
  S.liabs.forEach((l) => {
    const row = liabRow[l.id];
    put(lia, row, 1, { s: l.name + (l.hidden ? ' (hidden)' : ''), b: l.bold }); put(lia, row, 2, { s: 'GBP' });
    months.forEach((m, i) => {
      const cell = (S.liabCells[l.id] || {})[m];
      let f = null;
      if (cell && cell.f) f = xl(cell.f, m);
      else if (!(cell && cell.v != null) && m > firstM()) f = `MAX(0,${addr[`l|${l.id}|${addM(m, -1)}`]}+${addr[`bw|${l.id}|${m}`]}-${addr[`ru|${l.id}|${m}`]})`;
      const cl = cellFor(() => liabVal(l.id, m), f); cl.b = l.bold;
      put(lia, row, 3 + i, cl);
    });
  });
  put(lia, liaTotRow, 1, { s: 'Total liabilities (£)', b: true });
  months.forEach((m, i) => { const cl = cellFor(() => liabTotal(m), xl(S.liabTotal.f || '0', m)); cl.b = true; put(lia, liaTotRow, 3 + i, cl); });

  // Plan sheets
  const secName = { income: 'Income', expense: 'Expense', saving: 'Savings transfer' };
  planSheets.forEach((ps) => {
    const m = ps.m;
    S.lines.forEach((l) => {
      const row = lineRow[l.id];
      put(ps, row, 1, { s: l.name, b: l.bold });
      put(ps, row, 2, { s: secName[l.sec] + (l.sec === 'saving' && catById(l.link) ? ' → ' + catById(l.link).name : '') });
      const found = lineActive(l, m) ? findEntry(l.entries, m) : null;
      let f = null;
      if (found && found.e.f) f = xl(found.e.f, m);
      else if (found && found.from !== m && addr[`p|${l.id}|${found.from}`]) f = addr[`p|${l.id}|${found.from}`];
      put(ps, row, 3, cellFor(() => linePlanned(l, m), f));
      const e = lineActive(l, m) ? l.entries[m] : null;
      if (e && e.actual != null) put(ps, row, 4, { n: e.actual });
      put(ps, row, 5, cellFor(() => lineUsed(l, m), `IF(D${row}="",C${row},D${row})`));
    });
    S.liabs.forEach((l) => {
      const row = repRow[l.id];
      put(ps, row, 1, { s: 'Repayment: ' + l.name });
      put(ps, row, 2, { s: repayOn(l.id, m) ? 'Repayment (on)' : 'Repayment (off)' });
      put(ps, row, 3, num(() => repayPlanned(l.id, m)));
      const e = (S.repay[l.id] || {})[m];
      if (e && e.actual != null) put(ps, row, 4, { n: e.actual });
      put(ps, row, 5, cellFor(() => repayUsed(l.id, m), `IF(D${row}="",C${row},D${row})`));
      const br = brRow[l.id];
      put(ps, br, 1, { s: 'Borrowed: ' + l.name }); put(ps, br, 2, { s: overAmt(l.id, m) ? `New borrowing incl. ${fmt(overAmt(l.id, m))} OVERSPEND` : 'New borrowing (adds to liability)' });
      put(ps, br, 5, { n: borrowAmt(l.id, m) });
    });
    const sumOf = (rows) => (rows.length ? `SUM(${rows.map((x) => 'E' + x).join(',')})` : '0');
    const groups = [
      ['Income', S.lines.filter((l) => l.sec === 'income').map((l) => lineRow[l.id])],
      ['Expenses', S.lines.filter((l) => l.sec === 'expense').map((l) => lineRow[l.id])],
      ['Savings transfers', S.lines.filter((l) => l.sec === 'saving').map((l) => lineRow[l.id])],
      ['Repayments', S.liabs.map((l) => repRow[l.id])]
    ];
    const psum = safe(() => planSummary(m));
    const vals = psum instanceof FErr ? [0, 0, 0, 0] : [psum.income, psum.expense, psum.saving, psum.repay];
    groups.forEach(([label, rows], gi) => { put(ps, planTot + gi, 1, { s: label, b: true }); put(ps, planTot + gi, 5, { n: vals[gi], f: sumOf(rows), b: true }); });
    put(ps, planTot + 6, 1, { s: 'Borrowed', b: true });
    put(ps, planTot + 6, 5, { n: psum instanceof FErr ? 0 : psum.borrow, f: S.liabs.length ? `SUM(${S.liabs.map((l) => 'E' + brRow[l.id]).join(',')})` : '0', b: true });
    let leftF = `E${planTot}-E${planTot + 1}-E${planTot + 2}-E${planTot + 3}+E${planTot + 6}`;
    if (S.settings.carryLeft && m > firstM()) {
      put(ps, planTot + 4, 1, { s: 'Brought forward' });
      put(ps, planTot + 4, 5, { n: psum instanceof FErr ? 0 : psum.bf, f: `MAX(0,${sheetRef(plainSheetName(addM(m, -1)))}!$E$${planTot + 5})` });
      leftF += `+E${planTot + 4}`;
    }
    put(ps, planTot + 5, 1, { s: 'Left to allocate', b: true });
    put(ps, planTot + 5, 5, { n: psum instanceof FErr ? 0 : psum.left, f: leftF, b: true });
  });

  // ISA (values)
  const isa = { name: 'ISA', rows: {}, widths: [16, 16, 16, 16, 16, 40] };
  let ir = 1;
  const tys = Array.from(new Set(months.map(taxYear)));
  tys.forEach((ty) => {
    const y = safe(() => isaYear(ty));
    if (y instanceof FErr) return;
    put(isa, ir, 1, { s: `Tax year ${tyName(ty)}`, b: true }); put(isa, ir, 2, { s: 'Allowance' }); put(isa, ir, 3, { n: y.a.overall });
    if (y.a.cash != null) { put(isa, ir, 4, { s: 'Cash limit' }); put(isa, ir, 5, { n: y.a.cash }); }
    ir++;
    put(isa, ir, 1, { s: 'Month', b: true }); put(isa, ir, 2, { s: 'Paid in', b: true }); put(isa, ir, 3, { s: 'Used', b: true }); put(isa, ir, 4, { s: 'Left', b: true }); put(isa, ir, 5, { s: 'Cash used', b: true }); put(isa, ir, 6, { s: 'Detail', b: true });
    ir++;
    y.rows.forEach((row) => { put(isa, ir, 1, { s: mLabel(row.m) }); put(isa, ir, 2, { n: row.add }); put(isa, ir, 3, { n: row.used }); put(isa, ir, 4, { n: y.a.overall - row.used }); put(isa, ir, 5, { n: row.cash }); put(isa, ir, 6, { s: row.parts.join('; ') }); ir++; });
    ir++;
  });
  sheets.push(isa);
  const gs = { name: 'Goals', rows: {}, widths: [26, 30, 16, 50] };
  put(gs, 1, 1, { s: 'Goal', b: true }); put(gs, 1, 2, { s: 'Line', b: true }); put(gs, 1, 3, { s: 'Amount', b: true }); put(gs, 1, 4, { s: 'Formula in the app', b: true });
  let gr = 2;
  const cmx = curM();
  S.goals.forEach((g) => {
    const first = gr;
    g.rows.forEach((r) => {
      put(gs, gr, 1, { s: g.name }); put(gs, gr, 2, { s: r.label });
      put(gs, gr, 3, cellFor(() => goalRowVal(g, r, cmx), r.f ? xl(r.f, cmx) : null));
      if (r.f) put(gs, gr, 4, { s: '= ' + toDisplay(r.f) });
      gr++;
    });
    put(gs, gr, 1, { s: g.name, b: true }); put(gs, gr, 2, { s: 'Money for this goal', b: true });
    const tot = cellFor(() => goalAvail(g.id, cmx), gr > first ? `SUM(C${first}:C${gr - 1})` : '0'); tot.b = true; put(gs, gr, 3, tot);
    const totRow = gr; gr++;
    const spendItems = (g.spend || []).filter((r) => r.name || (typeof r.amt === 'number' && r.amt));
    if (spendItems.length) {
      put(gs, gr, 1, { s: g.name, b: true }); put(gs, gr, 2, { s: 'Spending plan', b: true }); gr++;
      const s0 = gr;
      spendItems.forEach((r) => { put(gs, gr, 1, { s: g.name }); put(gs, gr, 2, { s: r.name || '(no name)' }); put(gs, gr, 3, { n: typeof r.amt === 'number' ? r.amt : 0 }); gr++; });
      put(gs, gr, 1, { s: g.name }); put(gs, gr, 2, { s: 'Target (spending plan total)', b: true });
      put(gs, gr, 3, { n: spendSum(g), f: `SUM(C${s0}:C${gr - 1})`, b: true }); gr++;
      put(gs, gr, 1, { s: g.name }); put(gs, gr, 2, { s: 'Still needed' });
      put(gs, gr, 3, cellFor(() => spendSum(g) - goalAvail(g.id, cmx), `C${gr - 1}-C${totRow}`)); gr++;
    } else if (g.target) {
      put(gs, gr, 1, { s: g.name }); put(gs, gr, 2, { s: 'Target' });
      put(gs, gr, 3, cellFor(() => goalTarget(g, cmx), g.target.f ? xl(g.target.f, cmx) : null));
      if (g.target.f) put(gs, gr, 4, { s: '= ' + toDisplay(g.target.f) });
      gr++;
      put(gs, gr, 1, { s: g.name }); put(gs, gr, 2, { s: 'Still needed' });
      put(gs, gr, 3, cellFor(() => goalTarget(g, cmx) - goalAvail(g.id, cmx), `C${gr - 1}-C${totRow}`));
      gr++;
    }
    if (g.date) { put(gs, gr, 1, { s: g.name }); put(gs, gr, 2, { s: 'Target date' }); put(gs, gr, 4, { s: mLong(g.date) }); gr++; }
    gr++;
  });
  sheets.push(gs);
  if (projRate() != null && projCats().length) {
    const pjs = { name: 'Growth projection', rows: {}, widths: [16, 18, 18, 18] };
    put(pjs, 1, 1, { s: `At ${projRate()}% a year on ${projCats().map((id) => catById(id).name).join(', ')}`, b: true });
    put(pjs, 2, 1, { s: 'Month', b: true }); put(pjs, 2, 2, { s: 'Forecast', b: true }); put(pjs, 2, 3, { s: 'With growth', b: true }); put(pjs, 2, 4, { s: 'Growth', b: true });
    months.filter((m) => m > curM()).forEach((m, i) => {
      const a = safe(() => savTotal(m)), b = safe(() => projTotal(m));
      put(pjs, 3 + i, 1, { s: mLabel(m) });
      if (!(a instanceof FErr) && !(b instanceof FErr)) { put(pjs, 3 + i, 2, { n: a }); put(pjs, 3 + i, 3, { n: b }); put(pjs, 3 + i, 4, { n: b - a, f: `C${3 + i}-B${3 + i}` }); }
    });
    sheets.push(pjs);
  }
  sheets.unshift(setS);
  return sheets;
}
function buildXLSX() {
  const sheets = buildWorkbookModel();
  const sheetXml = (sh) => {
    const rowNums = Object.keys(sh.rows).map(Number).sort((a, b) => a - b);
    const cols = sh.widths ? `<cols>${sh.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
    const rows = rowNums.map((r) => {
      const cells = Object.keys(sh.rows[r]).map(Number).sort((a, b) => a - b).map((c) => {
        const cl = sh.rows[r][c];
        const ref = colName(c) + r;
        if (cl.s != null) return `<c r="${ref}" t="inlineStr"${cl.b ? ' s="2"' : ''}><is><t xml:space="preserve">${xmlEsc(cl.s)}</t></is></c>`;
        const style = cl.cur === 'INR' ? (cl.b ? 5 : 4) : (cl.b ? 3 : 1);
        const v = typeof cl.n === 'number' && isFinite(cl.n) ? cl.n : 0;
        return `<c r="${ref}" s="${style}">${cl.f ? `<f>${xmlEsc(cl.f)}</f>` : ''}<v>${v}</v></c>`;
      }).join('');
      return `<row r="${r}">${cells}</row>`;
    }).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane xSplit="1" ySplit="1" topLeftCell="B2" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${rows}</sheetData></worksheet>`;
  };
  const files = [
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xmlEsc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;£&quot;#,##0.00;[Red]\\-&quot;£&quot;#,##0.00"/><numFmt numFmtId="165" formatCode="&quot;₹&quot;#,##0.00"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` }
  ];
  sheets.forEach((s, i) => files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s) }));
  return zipStore(files);
}
function buildCSV() {
  resetCalc();
  const months = allMonths();
  const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const n = (fn) => { const v = safe(fn); return v instanceof FErr ? q('ERROR: ' + v.message) : String(Math.round(v * 100) / 100); };
  const lines = [];
  lines.push(['Section', 'Item', 'Currency'].concat(months.map(mLabel)).map(q).join(','));
  S.cats.forEach((c) => lines.push([q('Savings'), q(c.name), q(c.ccy)].concat(months.map((m) => n(() => catNative(c.id, m)))).join(',')));
  lines.push([q('Savings'), q('Total savings'), q('GBP')].concat(months.map((m) => n(() => savTotal(m)))).join(','));
  S.liabs.forEach((l) => lines.push([q('Liabilities'), q(l.name), q('GBP')].concat(months.map((m) => n(() => liabVal(l.id, m)))).join(',')));
  lines.push([q('Liabilities'), q('Total liabilities'), q('GBP')].concat(months.map((m) => n(() => liabTotal(m)))).join(','));
  S.lines.forEach((l) => lines.push([q('Plan: ' + l.sec), q(l.name), q('GBP')].concat(months.map((m) => n(() => lineUsed(l, m)))).join(',')));
  S.liabs.forEach((l) => lines.push([q('Plan: repayment'), q(l.name), q('GBP')].concat(months.map((m) => n(() => repayUsed(l.id, m)))).join(',')));
  S.liabs.forEach((l) => lines.push([q('Plan: borrowed'), q(l.name), q('GBP')].concat(months.map((m) => n(() => borrowAmt(l.id, m)))).join(',')));
  lines.push([q('Plan'), q('Left to allocate'), q('GBP')].concat(months.map((m) => n(() => planSummary(m).left))).join(','));
  lines.push('');
  lines.push(['Goal', 'Line', 'Amount now'].map(q).join(','));
  S.goals.forEach((g) => {
    g.rows.forEach((r) => lines.push([q(g.name), q(r.label), n(() => goalRowVal(g, r, curM()))].join(',')));
    lines.push([q(g.name), q('Money for this goal'), n(() => goalAvail(g.id, curM()))].join(','));
    (g.spend || []).filter((r) => r.name || (typeof r.amt === 'number' && r.amt)).forEach((r) => lines.push([q(g.name), q('Spend: ' + (r.name || '(no name)')), String(typeof r.amt === 'number' ? r.amt : 0)].join(',')));
    if (hasTarget(g)) lines.push([q(g.name), q('Target'), n(() => goalTarget(g, curM()))].join(','));
  });
  return lines.join('\r\n');
}

/* ---------------- events ---------------- */
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const fn = ACT[el.dataset.act];
  if (!fn) return;
  if (el.dataset.act !== 'shade') ev.stopPropagation();
  guard(fn)(el.dataset, el, ev);
});
document.addEventListener('input', (ev) => {
  const t = ev.target;
  if (!ui.sheet || !t.dataset || !t.dataset.field) return;
  ui.sheet.f[t.dataset.field] = t.type === 'checkbox' ? t.checked : t.value;
  if (t.id === 'fx') { ui.sheet.caret = t.selectionStart; ui.sheet.caretEnd = t.selectionEnd; $('#fxPreview').innerHTML = fxPreviewHTML(); }
  if (t.dataset.field === 'val' && $('#inrPrev')) $('#inrPrev').textContent = inrPreview(t.value);
  if (t.id === 'rateIn' && $('#ratePrev')) { const n = parseAmount(t.value); $('#ratePrev').textContent = n > 0 ? `£1 = ₹${n.toFixed(2)} · ₹1 = £${(1 / n).toFixed(5)}` : 'Enter a number above 0'; }
});
document.addEventListener('change', (ev) => {
  const t = ev.target;
  if (t.dataset && t.dataset.inl) { if (commitInline(t)) scheduleRender(); return; }
  if (!ui.sheet || !t.dataset || !t.dataset.field) return;
  if (t.tagName === 'SELECT') { collect(); rerenderSheet(); }
});
['keyup', 'click', 'select'].forEach((type) => document.addEventListener(type, (ev) => {
  if (ev.target && ev.target.id === 'fx' && ui.sheet) { ui.sheet.caret = ev.target.selectionStart; ui.sheet.caretEnd = ev.target.selectionEnd; }
}, true));
document.addEventListener('focusin', (ev) => {
  const t = ev.target;
  if (t.dataset && t.dataset.inl) setTimeout(() => { try { t.select(); } catch (_) {} }, 0);
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && ev.target.dataset && ev.target.dataset.inl) { ev.preventDefault(); const t = ev.target; if (commitInline(t)) scheduleRender(); t.blur(); return; }
  if (ev.key === 'Escape' && ev.target.dataset && ev.target.dataset.inl) { ev.target.value = ev.target.dataset.orig; ev.target.blur(); return; }
  if (ev.key === 'Escape' && ui.sheet) closeSheet();
  if (ev.key === 'Enter' && ui.sheet && ev.target.tagName === 'INPUT') {
    ev.preventDefault();
    const save = $('#sheet .btn.primary');
    if (save) save.click();
  }
});
// Keep "now" and the current month correct if the app stays open past midnight or month end.
let lastSeenMonth = null;
function tick() { const m = curM(); if (lastSeenMonth && m !== lastSeenMonth && !ui.sheet) { ui.m = m; render(); } lastSeenMonth = m; }
document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); if (!ui.sheet) render(); } });
setInterval(tick, 60000);

/* ---------------- start ---------------- */
load();
lastSeenMonth = curM();
render();
if (loadWarning) setTimeout(() => toast(loadWarning), 300);
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => reg.update()).catch(() => {});
  // When a new version takes over, reload once so it shows straight away (only when no editor is open).
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded || ui.sheet) return;
    reloaded = true;
    location.reload();
  });
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

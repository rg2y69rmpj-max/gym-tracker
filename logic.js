/* Pure data logic — no DOM. Usable in browser (window.GT) and Node (module.exports). */
(function (root) {
  const KEY = 'gymtracker.v1';
  const BODY_PARTS = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core'];
  const DEFAULT_EXERCISES = [
    ['Barbell bench press','chest'],['Incline dumbbell press','chest'],['Cable chest fly','chest'],['Weighted dips','chest'],
    ['Deadlift','back'],['Romanian deadlift','legs'],['Lat pulldown','back'],['Pull-up','back'],['Barbell row','back'],['Seated cable row','back'],['Face pull','shoulders'],
    ['Back squat','legs'],['Leg press','legs'],['Bulgarian split squat','legs'],['Leg curl','legs'],['Leg extension','legs'],['Standing calf raise','legs'],
    ['Overhead press','shoulders'],['Dumbbell lateral raise','shoulders'],['Rear delt fly','shoulders'],
    ['Dumbbell curl','arms'],['EZ-bar curl','arms'],['Hammer curl','arms'],['Cable triceps pushdown','arms'],['Skull crusher','arms'],['Overhead cable extension','arms'],
    ['Plank','core'],['Hanging knee raise','core']
  ].map(([name, bodyPart]) => ({ name, bodyPart }));

  const VERSION = 3;
  const DEFAULT_SETTINGS = { calTarget: 2300, proteinTarget: 190, carbTarget: 230, fatTarget: 70, fibreTarget: 30, waterTarget: 3,
    stepsMin: 8000, stepsMax: 10000, carbCycling: false, calWeightDay: 2420, calOtherDay: 2180,
    lossMin: 0.3, lossMax: 0.6, startWeight: null, heightCm: null, age: null, planFile: 'plan.json',
    sleepTarget: 7, lastCalChange: null, photoSnoozeUntil: null, deloadSnoozeUntil: null };
  const COLLS = ['customBodyParts', 'exercises', 'sets', 'treadmill', 'meals', 'weights', 'water', 'steps', 'sleep', 'waist', 'photos', 'deloads'];
  function emptyState() {
    return { version: VERSION, settings: { ...DEFAULT_SETTINGS },
      customBodyParts: [], exercises: DEFAULT_EXERCISES.map(e => ({ ...e })),
      sets: [], treadmill: [], meals: [], weights: [], water: [], steps: [], sleep: [], waist: [], photos: [], deloads: [] };
  }
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const pad = n => String(n).padStart(2, '0');
  function today(d = new Date()) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function nowTime(d = new Date()) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };

  function normalize(s) {
    const base = emptyState();
    if (!s || typeof s !== 'object') return base;
    const old = s.settings || {};
    const out = { ...base, ...s, settings: { ...base.settings, ...old } };
    for (const k of COLLS) if (!Array.isArray(out[k])) out[k] = base[k];
    // Migration v1 -> v2: replace untouched v1 default targets with the final defaults; add macro fields to meals.
    if (!s.version || s.version < 2) {
      if (old.calTarget === undefined || old.calTarget === 2350) out.settings.calTarget = DEFAULT_SETTINGS.calTarget;
      if (old.proteinTarget === undefined || old.proteinTarget === 180) out.settings.proteinTarget = DEFAULT_SETTINGS.proteinTarget;
    }
    out.meals = out.meals.map(m => ({ ...m, carbs: num(m.carbs), fat: num(m.fat), fibre: num(m.fibre) }));
    out.version = VERSION;
    return out;
  }
  function bodyParts(s) { return BODY_PARTS.concat(s.customBodyParts); }
  function addBodyPart(s, name) { name = String(name || '').trim().toLowerCase(); if (name && !bodyParts(s).includes(name)) s.customBodyParts.push(name); return name; }
  function ensureExercise(s, name, bodyPart) {
    name = String(name || '').trim(); if (!name) return null;
    let ex = s.exercises.find(e => e.name.toLowerCase() === name.toLowerCase());
    if (!ex) { ex = { name, bodyPart: bodyPart || 'custom' }; s.exercises.push(ex); }
    return ex;
  }

  const COLL = ['sets', 'treadmill', 'meals', 'weights', 'water', 'steps', 'sleep', 'waist', 'photos', 'deloads'];
  function add(s, coll, entry) {
    if (!COLL.includes(coll)) throw new Error('bad collection ' + coll);
    const e = { id: uid(), date: today(), ...entry };
    if (coll === 'sets') { const ex = ensureExercise(s, e.exercise, e.bodyPart); if (!ex) throw new Error('exercise required'); e.exercise = ex.name; e.bodyPart = e.bodyPart || ex.bodyPart; e.reps = num(e.reps); e.weight = num(e.weight); }
    if (coll === 'meals') { for (const k of ['calories', 'protein', 'carbs', 'fat', 'fibre']) e[k] = num(e[k]); e.time = e.time || nowTime(); }
    if (coll === 'weights') e.kg = num(e.kg);
    if (coll === 'water') { e.ml = num(e.ml); if (e.ml < 0) { // never let the day's total drop below 0
      const cur = s.water.filter(x => x.date === e.date).reduce((t, x) => t + num(x.ml), 0); e.ml = -Math.min(-e.ml, Math.max(0, cur)); if (!e.ml) return null; } }
    if (coll === 'steps') { e.steps = Math.round(num(e.steps)); s.steps = s.steps.filter(x => x.date !== e.date); } // one total per day
    if (coll === 'sleep') { e.hours = Math.round(Math.min(24, Math.max(0, num(e.hours))) * 4) / 4; s.sleep = s.sleep.filter(x => x.date !== e.date); } // last night, one per day
    if (coll === 'waist') { e.cm = Math.round(num(e.cm) * 10) / 10; if (!(e.cm > 0)) throw new Error('waist in cm required'); s.waist = s.waist.filter(x => x.date !== e.date); }
    if (coll === 'photos' || coll === 'deloads') { if (s[coll].some(x => x.date === e.date)) return s[coll].find(x => x.date === e.date); }
    if (coll === 'treadmill') for (const k of ['duration', 'distance', 'speed', 'incline', 'calories']) e[k] = e[k] === '' || e[k] == null ? null : num(e[k]);
    s[coll].push(e); return e;
  }
  function update(s, coll, id, patch) { const e = s[coll].find(x => x.id === id); if (!e) return null; Object.assign(e, patch); return e; }
  function remove(s, coll, id) { const n = s[coll].length; s[coll] = s[coll].filter(x => x.id !== id); return s[coll].length < n; }

  // Previous session: latest date before `date` with sets for this exercise
  function previousSession(s, exercise, date = today()) {
    const prior = s.sets.filter(x => x.exercise === exercise && x.date < date);
    if (!prior.length) return null;
    const d = prior.map(x => x.date).sort().pop();
    return { date: d, sets: prior.filter(x => x.date === d) };
  }
  function lastSet(s, exercise) { const l = s.sets.filter(x => x.exercise === exercise); return l[l.length - 1] || null; }
  const e1rm = (w, r) => r > 0 ? w * (1 + r / 30) : 0; // Epley

  function dayTotals(s, date) {
    const m = s.meals.filter(x => x.date === date);
    const sum = k => m.reduce((a, x) => a + num(x[k]), 0);
    const st = (s.steps || []).find(x => x.date === date);
    return { calories: sum('calories'), protein: sum('protein'), carbs: sum('carbs'), fat: sum('fat'), fibre: sum('fibre'), count: m.length,
      waterL: Math.max(0, Math.round((s.water || []).filter(x => x.date === date).reduce((a, x) => a + num(x.ml), 0))) / 1000, steps: st ? st.steps : 0,
      sleep: ((s.sleep || []).find(x => x.date === date) || {}).hours ?? null };
  }
  const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  // 'weights' if the plan has exercises that day, 'treadmill' if cardio, otherwise 'rest'
  function dayType(plan, date) {
    const p = plan && plan.days && plan.days[DOW[new Date(date + 'T00:00:00').getDay()]];
    if (!p) return 'rest'; if (p.exercises && p.exercises.length) return 'weights'; return p.cardio ? 'treadmill' : 'rest';
  }
  function calTargetFor(s, date, plan) {
    const st = s.settings; if (!st.carbCycling) return num(st.calTarget);
    return dayType(plan, date) === 'weights' ? num(st.calWeightDay) : num(st.calOtherDay);
  }
  function addDays(date, n) { const d = new Date(date + 'T00:00:00'); d.setDate(d.getDate() + n); return today(d); }
  function avg7At(s, date) { const from = addDays(date, -6); const w = s.weights.filter(x => x.date >= from && x.date <= date); return w.length ? w.reduce((a, x) => a + x.kg, 0) / w.length : null; }
  // Weekly rate = 7-day avg ending `date` minus 7-day avg ending 7 days earlier (kg/week, negative = loss)
  function weightTrend(s, date) {
    const st = s.settings, now = avg7At(s, date), prev = avg7At(s, addDays(date, -7));
    if (now == null || prev == null) return { avg: now, prevAvg: prev, rate: null, status: 'need-data' };
    const rate = now - prev, loss = -rate;
    const status = loss < st.lossMin ? 'too-slow' : loss > st.lossMax ? 'too-fast' : 'in-range';
    return { avg: now, prevAvg: prev, rate, status };
  }
  // per exercise: per date top set weight and best est 1RM
  function exerciseProgress(s, exercise) {
    const by = {};
    for (const x of s.sets.filter(x => x.exercise === exercise)) {
      const d = by[x.date] || (by[x.date] = { date: x.date, top: 0, best1rm: 0 });
      d.top = Math.max(d.top, x.weight); d.best1rm = Math.max(d.best1rm, e1rm(x.weight, x.reps));
    }
    return Object.values(by).sort((a, b) => a.date < b.date ? -1 : 1);
  }
  function weekStart(date) { const d = new Date(date + 'T00:00:00'); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return today(d); }
  function weeklyVolume(s) { // {week: {bodyPart: kg*reps}}
    const out = {};
    for (const x of s.sets) { const w = weekStart(x.date); out[w] = out[w] || {}; out[w][x.bodyPart] = (out[w][x.bodyPart] || 0) + x.weight * x.reps; }
    return out;
  }
  function treadmillTotals(s) {
    return s.treadmill.reduce((a, x) => ({ sessions: a.sessions + 1, minutes: a.minutes + num(x.duration), km: a.km + num(x.distance), calories: a.calories + num(x.calories) }), { sessions: 0, minutes: 0, km: 0, calories: 0 });
  }
  // Double progression flag: all sets of last session at/above top of rep range
  function readyToProgress(s, exercise, repTop) {
    const l = s.sets.filter(x => x.exercise === exercise); if (!l.length || !repTop) return false;
    const d = l[l.length - 1].date; const ss = l.filter(x => x.date === d);
    return ss.length > 0 && ss.every(x => x.reps >= repTop);
  }

  /* ---------- recomp checks (plan v2: calorie rules, deload flag, photo reminder) ---------- */
  const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);
  const CAL = { step: 150, floor: 2150, fastLoss: 0.7, flatKg: 0.2, waistCm: 0.5, liftPct: 1 };
  // Weekly change of the 7-day average for the weeks ending `date`, date-7, date-14 … (kg/week; negative = loss; null = not enough weigh-ins)
  function weeklyRates(s, date, n = 3) {
    const out = []; for (let k = 0; k < n; k++) { const a = avg7At(s, addDays(date, -7 * k)), b = avg7At(s, addDays(date, -7 * k - 7)); out.push(a == null || b == null ? null : a - b); }
    return out;
  }
  // Waist now vs 2–3 weeks earlier: {now, before, change, days} or null
  function waistChange(s, date) {
    const w = s.waist.filter(x => x.date <= date).sort((a, b) => a.date < b.date ? -1 : 1); if (w.length < 2) return null;
    const cur = w[w.length - 1]; if (daysBetween(cur.date, date) > 10) return null; // last measurement too old
    const base = w.filter(x => { const d = daysBetween(x.date, cur.date); return d >= 13 && d <= 24; }).pop();
    return base ? { now: cur.cm, before: base.cm, change: Math.round((cur.cm - base.cm) * 10) / 10, days: daysBetween(base.date, cur.date) } : null;
  }
  const MAIN_LIFT = /bench|squat|deadlift|row|overhead press|pull-?up|pulldown|incline dumbbell press|hip thrust|leg press/i;
  // Main lifts: best estimated 1RM in the last 2 weeks vs the 2 weeks before. rising / falling / flat / unknown
  function liftTrend(s, date) {
    const from1 = addDays(date, -13), from0 = addDays(date, -27), best = (ex, a, b) => Math.max(0, ...s.sets.filter(x => x.exercise === ex && x.date >= a && x.date <= b).map(x => e1rm(x.weight, x.reps)));
    let exs = [...new Set(s.sets.filter(x => x.date >= from0 && x.date <= date).map(x => x.exercise))];
    if (exs.some(e => MAIN_LIFT.test(e))) exs = exs.filter(e => MAIN_LIFT.test(e));
    const changes = exs.map(ex => ({ exercise: ex, before: best(ex, from0, addDays(from1, -1)), now: best(ex, from1, date) })).filter(c => c.before > 0 && c.now > 0)
      .map(c => ({ ...c, pct: (c.now - c.before) / c.before * 100 }));
    if (!changes.length) return { status: 'unknown', changes, median: null };
    const ps = changes.map(c => c.pct).sort((a, b) => a - b), median = ps.length % 2 ? ps[(ps.length - 1) / 2] : (ps[ps.length / 2 - 1] + ps[ps.length / 2]) / 2;
    return { status: median >= CAL.liftPct ? 'rising' : median <= -CAL.liftPct ? 'falling' : 'flat', changes, median };
  }
  const kg2 = v => (v > 0 ? '+' : '') + (Math.round(v * 100) / 100) + ' kg/week';
  // The plan's weekly calorie rules. Never suggests a cut unless weight AND waist are both flat for 2–3 weeks;
  // changes nothing while the waist is shrinking and lifts are rising (the recomp is working).
  function calorieCheck(s, date) {
    const st = s.settings, target = num(st.calTarget), ws = s.weights.filter(x => x.date <= date).map(x => x.date).sort();
    const res = (action, title, reasons, extra) => ({ action, kcal: action === 'add' ? CAL.step : action === 'cut' ? -CAL.step : 0, title, reasons, target, ...extra });
    if (!ws.length) return res('wait', 'Log your morning weight to start the weekly calorie check.', []);
    const day1 = ws[0], since = daysBetween(day1, date);
    if (since < 14) return res('wait', `Too early: weeks 1\u20132 are mostly water. First calorie check on ${addDays(day1, 14)}.`, []);
    if (st.lastCalChange && daysBetween(st.lastCalChange, date) < 7) return res('wait', `Calories changed on ${st.lastCalChange}. Next check from ${addDays(st.lastCalChange, 7)}.`, []);
    const [r0, r1, r2] = weeklyRates(s, date, 3), lifts = liftTrend(s, date), waist = waistChange(s, date);
    if (r0 == null || r1 == null) return res('wait', 'Need weigh-ins in each of the last 3 weeks to compare 7-day averages.', []);
    const reasons = [`Weight: ${kg2(r0)} this week, ${kg2(r1)} the week before.`,
      waist ? `Waist: ${waist.now} cm, ${waist.change > 0 ? '+' : ''}${waist.change} cm over ${Math.round(waist.days / 7)} weeks.` : 'Waist: not enough weekly measurements yet (needs one now and one 2\u20133 weeks ago).',
      lifts.status === 'unknown' ? 'Lifts: not enough sessions to compare yet.' : `Main lifts: ${lifts.status} (${lifts.median > 0 ? '+' : ''}${Math.round(lifts.median * 10) / 10}% est. 1RM vs the 2 weeks before).`];
    if (r0 < -CAL.fastLoss && r1 < -CAL.fastLoss) return res('add', `Add ${CAL.step} kcal: losing more than ${CAL.fastLoss} kg a week for 2 weeks.`, reasons);
    if (lifts.status === 'falling') return res('add', `Add ${CAL.step} kcal: main lifts have been falling for 2 weeks.`, reasons);
    const weightFlat = Math.abs(r0) <= CAL.flatKg && Math.abs(r1) <= CAL.flatKg, weeksFlat = weightFlat ? (r2 != null && Math.abs(r2) <= CAL.flatKg ? 3 : 2) : 0;
    const waistShrinking = waist && waist.change <= -CAL.waistCm, waistFlat = waist && Math.abs(waist.change) < CAL.waistCm;
    if (weightFlat && waistShrinking && lifts.status === 'rising') return res('hold', 'Don\u2019t change anything: the recomp is working (weight flat, waist shrinking, lifts going up).', reasons);
    if (weightFlat && waistFlat) {
      if (target - CAL.step < CAL.floor) return res('review', `Weight and waist flat for ${weeksFlat} weeks, but cutting ${CAL.step} kcal would take you below ${CAL.floor.toLocaleString('en')} kcal. Review the plan first.`, reasons);
      return res('cut', `Cut ${CAL.step} kcal (from carbs): weight and waist both flat for ${weeksFlat} weeks.`, reasons, { newTarget: target - CAL.step });
    }
    if (weightFlat && !waist) return res('hold', 'Weight is flat. Log your waist weekly: calories only come down if the waist is flat too.', reasons);
    if (weightFlat && waistShrinking) return res('hold', 'No change: the waist is shrinking, so fat is coming off even though the scale is flat.', reasons);
    if (weightFlat) return res('hold', 'No change this week. Keep logging weight, waist and lifts.', reasons);
    const loss = -r0; return res('hold', loss >= st.lossMin && loss <= st.lossMax ? `No change: losing ${Math.round(loss * 100) / 100} kg a week, inside the ${st.lossMin}\u2013${st.lossMax} target.` : 'No change this week.', reasons);
  }
  // Applies a suggested change to the calorie target (cuts come from carbs: 150 kcal = 37.5 g); carb-cycling day targets move by the same amount.
  function applyCalorieChange(s, kcal, date = today()) {
    const st = s.settings; st.calTarget = num(st.calTarget) + kcal; st.calWeightDay = num(st.calWeightDay) + kcal; st.calOtherDay = num(st.calOtherDay) + kcal;
    if (kcal < 0) st.carbTarget = Math.max(0, Math.round(num(st.carbTarget) + kcal / 4)); st.lastCalChange = date; return st;
  }
  // Deload flag: the same lift dropped 2 sessions running, or 8 weeks since the last deload (or since you started logging sets).
  function deloadCheck(s, date) {
    const last = s.deloads.filter(x => x.date <= date).map(x => x.date).sort().pop() || null;
    if (last && daysBetween(last, date) < 7) return { suggest: false, active: true, since: last, until: addDays(last, 6), reasons: [] };
    const after = last ? addDays(last, 7) : '0000-00-00', reasons = [];
    const exs = [...new Set(s.sets.map(x => x.exercise))];
    for (const ex of exs) {
      const by = {}; for (const x of s.sets) if (x.exercise === ex && x.date >= after && x.date <= date) by[x.date] = Math.max(by[x.date] || 0, e1rm(x.weight, x.reps));
      const ds = Object.keys(by).sort(); if (ds.length < 3 || daysBetween(ds[ds.length - 1], date) > 14) continue;
      const [a, b, c] = ds.slice(-3).map(d => by[d]);
      if (b < a && c < b) reasons.push(`${ex} dropped 2 sessions running (est. 1RM ${Math.round(a)} \u2192 ${Math.round(b)} \u2192 ${Math.round(c)} kg).`);
    }
    const firstSet = s.sets.map(x => x.date).filter(d => d <= date).sort()[0], from = last || firstSet;
    const weeks = from ? Math.floor(daysBetween(from, date) / 7) : 0;
    if (from && weeks >= 8) reasons.push(last ? `${weeks} weeks since your last deload.` : `${weeks} weeks of training logged without a deload.`);
    const snoozed = s.settings.deloadSnoozeUntil && date < s.settings.deloadSnoozeUntil;
    return { suggest: reasons.length > 0 && !snoozed, active: false, since: last, weeks, reasons };
  }
  // Progress photos every 4 weeks (front, side, back). Due if never taken (once something is logged) or 28+ days since the last.
  function photoReminder(s, date) {
    const last = s.photos.filter(x => x.date <= date).map(x => x.date).sort().pop() || null, days = last ? daysBetween(last, date) : null;
    const snoozed = s.settings.photoSnoozeUntil && date < s.settings.photoSnoozeUntil;
    const anything = COLL.some(c => c !== 'photos' && s[c].length);
    return { due: !snoozed && anything && (last ? days >= 28 : true), last, days, next: last ? addDays(last, 28) : date };
  }
  function load(storage) { try { return normalize(JSON.parse(storage.getItem(KEY))); } catch { return emptyState(); } }
  function save(storage, s) { storage.setItem(KEY, JSON.stringify(s)); }
  /* ---------- backup + restore ---------- */
  const BACKUP_APP = 'gym-tracker', BACKUP_VERSION = 1, BACKUP_META_KEY = 'gymtracker.backup.v1', BACKUP_REMIND_DAYS = 14, DAY = 864e5;
  // Everything the app stores lives in one object, so a backup is the whole of it.
  function buildBackup(s, now = Date.now()) {
    const at = new Date(now).toISOString();
    return { app: BACKUP_APP, kind: 'backup', version: BACKUP_VERSION, createdAt: at, exportedAt: at, data: JSON.parse(JSON.stringify(s)) };
  }
  function exportJSON(s, now) { return JSON.stringify(buildBackup(s, now), null, 2); }
  function backupFileName(d = new Date()) { return 'gym-tracker-backup-' + today(d) + '.json'; }
  function backupSummary(s) {
    const dates = COLL.flatMap(c => (s[c] || []).map(x => x && x.date)).filter(d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    const days = arr => new Set((arr || []).map(x => x.date)).size;
    return { sets: s.sets.length, workoutDays: days(s.sets), treadmill: s.treadmill.length, meals: s.meals.length, weights: s.weights.length,
      waterDays: days(s.water), stepDays: s.steps.length, sleepDays: s.sleep.length, waist: s.waist.length, photos: s.photos.length, deloads: s.deloads.length, exercises: s.exercises.length, customBodyParts: s.customBodyParts.length,
      entries: COLL.reduce((a, c) => a + s[c].length, 0), from: dates[0] || null, to: dates[dates.length - 1] || null };
  }
  // Checks a backup (or an older Export JSON file). Returns {createdAt, data (migrated), summary}; throws an Error with a plain reason.
  function parseBackup(text) {
    let o;
    try { o = JSON.parse(String(text || '').replace(/^\uFEFF/, '')); } catch (e) { throw new Error('This file isn\u2019t a valid backup (it isn\u2019t readable JSON). Pick a gym-tracker-backup-….json file.'); }
    if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('This file isn\u2019t a Gym Tracker backup.');
    if (o.app && o.app !== BACKUP_APP) throw new Error(o.app === 'stock-watchlist' ? 'This is a Stock Watchlist backup, not a Gym Tracker one.' : 'This backup is from another app (' + String(o.app).slice(0, 40) + ').');
    if (o.kind === 'backup' && o.version > BACKUP_VERSION) throw new Error('This backup was made by a newer version of Gym Tracker. Update the app (close and reopen it), then try again.');
    const d = o.data && typeof o.data === 'object' ? o.data : o;
    if (!d || typeof d !== 'object' || !Array.isArray(d.sets)) throw new Error('This file isn\u2019t a Gym Tracker backup (no workout data in it).');
    for (const k of COLLS) if (d[k] !== undefined && !Array.isArray(d[k])) throw new Error('This backup looks damaged (' + k + ' isn\u2019t a list), so nothing was restored.');
    if (d.settings !== undefined && (typeof d.settings !== 'object' || Array.isArray(d.settings))) throw new Error('This backup looks damaged (settings), so nothing was restored.');
    const clean = { ...d };
    for (const k of COLLS) if (Array.isArray(d[k])) clean[k] = d[k].filter(x => k === 'customBodyParts' ? typeof x === 'string' : x && typeof x === 'object' && !Array.isArray(x));
    const data = normalize(clean), at = Date.parse(o.createdAt || o.exportedAt);
    return { createdAt: isFinite(at) ? at : null, data, summary: backupSummary(data) };
  }
  function importJSON(text) { return parseBackup(text).data; }
  // Merge a restored backup into this device's data without removing or overwriting anything here:
  // entries only in the backup are added (matched by id); for one-per-day logs (steps, sleep, waist, photos, deloads) the phone's entry for a day wins;
  // exercises and custom body parts are added by name; settings stay as they are. Returns {state, added: {coll: n}, total}.
  const ONE_PER_DAY = ['steps', 'sleep', 'waist', 'photos', 'deloads'];
  function mergeBackup(cur, inc) {
    const out = normalize(JSON.parse(JSON.stringify(cur))), b = normalize(JSON.parse(JSON.stringify(inc))), added = {};
    for (const c of COLL) {
      const ids = new Set(out[c].map(x => x.id)), days = new Set(out[c].map(x => x.date)), sigs = new Set(out[c].map(x => JSON.stringify(x))); let n = 0;
      for (const e of b[c]) {
        if (!e || (e.id ? ids.has(e.id) : sigs.has(JSON.stringify(e)))) continue; // old files may have entries without ids
        if (ONE_PER_DAY.includes(c) && days.has(e.date)) continue;
        out[c].push(e); if (e.id) ids.add(e.id); days.add(e.date); n++;
      }
      added[c] = n;
    }
    const names = new Set(out.exercises.map(e => String(e.name).toLowerCase())); added.exercises = 0;
    for (const e of b.exercises) if (e && e.name && !names.has(String(e.name).toLowerCase())) { out.exercises.push(e); names.add(String(e.name).toLowerCase()); added.exercises++; }
    for (const bp of b.customBodyParts) if (!out.customBodyParts.includes(bp)) out.customBodyParts.push(bp);
    for (const c of ['sets', 'treadmill', 'meals', 'weights', 'water']) out[c].sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
    return { state: out, added, total: COLL.reduce((a, c) => a + added[c], 0) };
  }
  function loadBackupMeta(storage, now = Date.now()) {
    let m = {}; try { m = JSON.parse(storage.getItem(BACKUP_META_KEY)) || {}; } catch (e) { m = {}; }
    const n = v => typeof v === 'number' && isFinite(v);
    const out = { lastAt: n(m.lastAt) ? m.lastAt : null, firstSeenAt: n(m.firstSeenAt) ? m.firstSeenAt : now, snoozeUntil: n(m.snoozeUntil) ? m.snoozeUntil : 0 };
    if (!n(m.firstSeenAt)) storage.setItem(BACKUP_META_KEY, JSON.stringify(out)); // first use: the reminder counts from today
    return out;
  }
  function saveBackupMeta(storage, m) { storage.setItem(BACKUP_META_KEY, JSON.stringify(m)); }
  // Due 14 days after the last backup (or after first use if there's never been one), unless snoozed.
  function backupReminder(meta, now = Date.now(), days = BACKUP_REMIND_DAYS) {
    const since = meta.lastAt || meta.firstSeenAt || now, daysSince = Math.max(0, Math.floor((now - since) / DAY));
    return { due: daysSince >= days && now >= (meta.snoozeUntil || 0), daysSince, never: !meta.lastAt };
  }

  const api = { KEY, BODY_PARTS, emptyState, normalize, bodyParts, addBodyPart, ensureExercise, add, update, remove, previousSession, lastSet, e1rm,
    dayTotals, dayType, calTargetFor, weightTrend, avg7At, addDays, DEFAULT_SETTINGS, VERSION, exerciseProgress, weekStart, weeklyVolume, treadmillTotals, readyToProgress, load, save, exportJSON, importJSON, today, nowTime, daysBetween, CAL, weeklyRates, waistChange, liftTrend, calorieCheck, applyCalorieChange, deloadCheck, photoReminder,
    BACKUP_APP, BACKUP_VERSION, BACKUP_META_KEY, BACKUP_REMIND_DAYS, DAY, buildBackup, backupFileName, backupSummary, parseBackup, mergeBackup, loadBackupMeta, saveBackupMeta, backupReminder };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GT = api;
})(typeof window !== 'undefined' ? window : globalThis);

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

  const VERSION = 2;
  const DEFAULT_SETTINGS = { calTarget: 2300, proteinTarget: 190, carbTarget: 230, fatTarget: 70, fibreTarget: 30, waterTarget: 3,
    stepsMin: 8000, stepsMax: 10000, carbCycling: false, calWeightDay: 2420, calOtherDay: 2180,
    lossMin: 0.3, lossMax: 0.6, startWeight: null, heightCm: null, age: null, planFile: 'plan.json' };
  const COLLS = ['customBodyParts', 'exercises', 'sets', 'treadmill', 'meals', 'weights', 'water', 'steps'];
  function emptyState() {
    return { version: VERSION, settings: { ...DEFAULT_SETTINGS },
      customBodyParts: [], exercises: DEFAULT_EXERCISES.map(e => ({ ...e })),
      sets: [], treadmill: [], meals: [], weights: [], water: [], steps: [] };
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

  const COLL = ['sets', 'treadmill', 'meals', 'weights', 'water', 'steps'];
  function add(s, coll, entry) {
    if (!COLL.includes(coll)) throw new Error('bad collection ' + coll);
    const e = { id: uid(), date: today(), ...entry };
    if (coll === 'sets') { const ex = ensureExercise(s, e.exercise, e.bodyPart); if (!ex) throw new Error('exercise required'); e.exercise = ex.name; e.bodyPart = e.bodyPart || ex.bodyPart; e.reps = num(e.reps); e.weight = num(e.weight); }
    if (coll === 'meals') { for (const k of ['calories', 'protein', 'carbs', 'fat', 'fibre']) e[k] = num(e[k]); e.time = e.time || nowTime(); }
    if (coll === 'weights') e.kg = num(e.kg);
    if (coll === 'water') { e.ml = num(e.ml); if (e.ml < 0) { // never let the day's total drop below 0
      const cur = s.water.filter(x => x.date === e.date).reduce((t, x) => t + num(x.ml), 0); e.ml = -Math.min(-e.ml, Math.max(0, cur)); if (!e.ml) return null; } }
    if (coll === 'steps') { e.steps = Math.round(num(e.steps)); s.steps = s.steps.filter(x => x.date !== e.date); } // one total per day
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
      waterL: Math.max(0, Math.round((s.water || []).filter(x => x.date === date).reduce((a, x) => a + num(x.ml), 0))) / 1000, steps: st ? st.steps : 0 };
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
  function load(storage) { try { return normalize(JSON.parse(storage.getItem(KEY))); } catch { return emptyState(); } }
  function save(storage, s) { storage.setItem(KEY, JSON.stringify(s)); }
  function exportJSON(s) { return JSON.stringify({ app: 'gym-tracker', exportedAt: new Date().toISOString(), data: s }, null, 2); }
  function importJSON(text) { const o = JSON.parse(text); const d = o && o.data ? o.data : o; if (!d || !Array.isArray(d.sets)) throw new Error('Not a gym-tracker export'); return normalize(d); }

  const api = { KEY, BODY_PARTS, emptyState, normalize, bodyParts, addBodyPart, ensureExercise, add, update, remove, previousSession, lastSet, e1rm,
    dayTotals, dayType, calTargetFor, weightTrend, avg7At, addDays, DEFAULT_SETTINGS, VERSION, exerciseProgress, weekStart, weeklyVolume, treadmillTotals, readyToProgress, load, save, exportJSON, importJSON, today, nowTime };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GT = api;
})(typeof window !== 'undefined' ? window : globalThis);

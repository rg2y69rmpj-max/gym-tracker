// Run: node tests/logic.test.js
const assert = require('assert'); const GT = require('../logic.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const mem = () => { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => m[k] = v, removeItem: k => delete m[k] }; };

t('add/edit/delete sets + reusable exercise list', () => {
  const s = GT.emptyState(); const n0 = s.exercises.length;
  const a = GT.add(s, 'sets', { date: '2026-10-01', exercise: 'Barbell bench press', bodyPart: 'chest', weight: '80', reps: '8' });
  assert.strictEqual(a.weight, 80); assert.strictEqual(s.exercises.length, n0);
  GT.add(s, 'sets', { date: '2026-10-01', exercise: 'Cable Crossover', bodyPart: 'chest', weight: 20, reps: 12 });
  assert.strictEqual(s.exercises.length, n0 + 1);
  GT.add(s, 'sets', { date: '2026-10-01', exercise: 'cable crossover', weight: 20, reps: 12 }); // case-insensitive reuse
  assert.strictEqual(s.exercises.length, n0 + 1); assert.strictEqual(s.sets[2].exercise, 'Cable Crossover');
  GT.update(s, 'sets', a.id, { weight: 82.5 }); assert.strictEqual(s.sets[0].weight, 82.5);
  assert.ok(GT.remove(s, 'sets', a.id)); assert.strictEqual(s.sets.length, 2); assert.ok(!GT.remove(s, 'sets', 'nope'));
  assert.throws(() => GT.add(s, 'sets', { exercise: '' }));
});
t('custom body part', () => { const s = GT.emptyState(); GT.addBodyPart(s, ' Forearms '); GT.addBodyPart(s, 'forearms'); GT.addBodyPart(s, 'chest');
  assert.deepStrictEqual(s.customBodyParts, ['forearms']); assert.ok(GT.bodyParts(s).includes('forearms')); });
t('previous session + last set', () => {
  const s = GT.emptyState();
  GT.add(s, 'sets', { date: '2026-09-28', exercise: 'Back squat', weight: 100, reps: 8 });
  GT.add(s, 'sets', { date: '2026-10-02', exercise: 'Back squat', weight: 105, reps: 6 });
  GT.add(s, 'sets', { date: '2026-10-02', exercise: 'Back squat', weight: 105, reps: 5 });
  GT.add(s, 'sets', { date: '2026-10-07', exercise: 'Back squat', weight: 107.5, reps: 6 });
  const p = GT.previousSession(s, 'Back squat', '2026-10-07'); assert.strictEqual(p.date, '2026-10-02'); assert.strictEqual(p.sets.length, 2);
  assert.strictEqual(GT.previousSession(s, 'Back squat', '2026-09-28'), null);
  assert.strictEqual(GT.lastSet(s, 'Back squat').weight, 107.5);
  const pr = GT.exerciseProgress(s, 'Back squat'); assert.strictEqual(pr.length, 3); assert.strictEqual(pr[1].top, 105);
  assert.ok(Math.abs(pr[1].best1rm - 105 * (1 + 6 / 30)) < 1e-9);
});
t('meal daily totals', () => {
  const s = GT.emptyState();
  GT.add(s, 'meals', { date: '2026-10-07', name: 'Eggs', calories: '450', protein: '40', time: '07:30' });
  const m = GT.add(s, 'meals', { date: '2026-10-07', name: 'Chicken rice', calories: 650, protein: 50 });
  GT.add(s, 'meals', { date: '2026-10-06', name: 'Other day', calories: 999, protein: 99 });
  const t0 = GT.dayTotals(s, '2026-10-07'); assert.strictEqual(t0.calories, 1100); assert.strictEqual(t0.protein, 90); assert.strictEqual(t0.count, 2);
  assert.strictEqual(t0.carbs, 0); assert.strictEqual(t0.fat, 0); assert.strictEqual(t0.fibre, 0); // optional macros default to 0
  GT.update(s, 'meals', m.id, { calories: 700 }); assert.strictEqual(GT.dayTotals(s, '2026-10-07').calories, 1150);
  GT.remove(s, 'meals', m.id); const t1 = GT.dayTotals(s, '2026-10-07'); assert.deepStrictEqual([t1.calories, t1.protein, t1.count], [450, 40, 1]);
  assert.match(m.time, /^\d\d:\d\d$/);
});
t('weekly volume by body part (Mon-start weeks)', () => {
  const s = GT.emptyState(); assert.strictEqual(GT.weekStart('2026-10-07'), '2026-10-05'); assert.strictEqual(GT.weekStart('2026-10-11'), '2026-10-05');
  GT.add(s, 'sets', { date: '2026-10-05', exercise: 'Barbell bench press', weight: 80, reps: 8 });
  GT.add(s, 'sets', { date: '2026-10-09', exercise: 'Barbell bench press', weight: 80, reps: 8 });
  GT.add(s, 'sets', { date: '2026-10-09', exercise: 'Back squat', weight: 100, reps: 5 });
  assert.deepStrictEqual(GT.weeklyVolume(s), { '2026-10-05': { chest: 1280, legs: 500 } });
});
t('treadmill totals with optional calories', () => {
  const s = GT.emptyState();
  GT.add(s, 'treadmill', { duration: 40, distance: 4.2, speed: 6.3, incline: 8, calories: '' });
  GT.add(s, 'treadmill', { duration: '25', distance: '3', speed: 7.2, incline: 1, calories: 250 });
  assert.strictEqual(s.treadmill[0].calories, null);
  const T = GT.treadmillTotals(s); assert.strictEqual(T.sessions, 2); assert.strictEqual(T.minutes, 65); assert.ok(Math.abs(T.km - 7.2) < 1e-9); assert.strictEqual(T.calories, 250);
});
t('body weight + progression flag', () => {
  const s = GT.emptyState(); const w = GT.add(s, 'weights', { kg: '85.4' }); assert.strictEqual(w.kg, 85.4);
  GT.add(s, 'sets', { date: '2026-10-01', exercise: 'Overhead press', weight: 50, reps: 8 });
  GT.add(s, 'sets', { date: '2026-10-01', exercise: 'Overhead press', weight: 50, reps: 7 });
  assert.ok(!GT.readyToProgress(s, 'Overhead press', 8)); GT.update(s, 'sets', s.sets[1].id, { reps: 8 }); assert.ok(GT.readyToProgress(s, 'Overhead press', 8));
});
t('persist, export/import, normalize bad data', () => {
  const st = mem(); const s = GT.emptyState(); s.settings.calTarget = 2400; GT.add(s, 'weights', { kg: 84 }); GT.save(st, s);
  const l = GT.load(st); assert.strictEqual(l.settings.calTarget, 2400); assert.strictEqual(l.weights.length, 1);
  const back = GT.importJSON(GT.exportJSON(l)); assert.deepStrictEqual(back, l);
  assert.throws(() => GT.importJSON('{"foo":1}')); assert.throws(() => GT.importJSON('not json'));
  st.setItem(GT.KEY, '{broken'); assert.deepStrictEqual(GT.load(st).sets, []);
  assert.strictEqual(GT.normalize({ sets: 'x' }).sets.length, 0);
});
t('plan files parse and are labelled', () => {
  const ex = require('../plan.json'), real = require('../plan.recomp.json');
  assert.strictEqual(ex.example, true); assert.match(ex.name, /EXAMPLE/); assert.strictEqual(real.example, false);
  for (const p of [ex, real]) for (const d of ['mon','tue','wed','thu','fri','sat','sun']) { assert.ok(p.days[d].title, d); (p.days[d].exercises || []).forEach(e => assert.ok(e.name && e.sets && e.reps && e.bodyPart)); }
});
t('final default targets', () => { const st = GT.emptyState().settings;
  assert.deepStrictEqual([st.calTarget, st.proteinTarget, st.carbTarget, st.fatTarget, st.fibreTarget, st.waterTarget, st.stepsMin, st.stepsMax], [2300, 190, 230, 70, 30, 3, 8000, 10000]);
  assert.strictEqual(st.carbCycling, false); assert.deepStrictEqual([st.calWeightDay, st.calOtherDay, st.lossMin, st.lossMax, st.startWeight], [2420, 2180, 0.3, 0.6, null]); });
t('macros, water, steps totals', () => { const s = GT.emptyState(); const d = '2026-10-07';
  GT.add(s, 'meals', { date: d, name: 'A', calories: 500, protein: 40, carbs: '60', fat: 15, fibre: 8 });
  GT.add(s, 'meals', { date: d, name: 'B', calories: 300, protein: 30, carbs: 20, fat: '', fibre: undefined });
  GT.add(s, 'water', { date: d, ml: 500 }); GT.add(s, 'water', { date: d, ml: 250 }); GT.add(s, 'water', { date: d, ml: 1250 }); GT.add(s, 'water', { date: d, ml: -250 });
  GT.add(s, 'steps', { date: d, steps: 6000 }); GT.add(s, 'steps', { date: d, steps: '9123' }); GT.add(s, 'steps', { date: '2026-10-06', steps: 4000 });
  const t = GT.dayTotals(s, d); assert.deepStrictEqual([t.carbs, t.fat, t.fibre, t.waterL, t.steps], [80, 15, 8, 1.75, 9123]);
  assert.strictEqual(s.steps.length, 2, 'steps upsert one per day'); });
t('carb cycling uses plan day type', () => { const s = GT.emptyState(); const plan = require('../plan.recomp.json');
  // 2026-10-05 Mon chest, 06 Tue zone2, 11 Sun rest
  assert.strictEqual(GT.dayType(plan, '2026-10-05'), 'weights'); assert.strictEqual(GT.dayType(plan, '2026-10-06'), 'treadmill'); assert.strictEqual(GT.dayType(plan, '2026-10-11'), 'rest');
  assert.strictEqual(GT.calTargetFor(s, '2026-10-05', plan), 2300); // off by default
  s.settings.carbCycling = true;
  assert.strictEqual(GT.calTargetFor(s, '2026-10-05', plan), 2420); assert.strictEqual(GT.calTargetFor(s, '2026-10-06', plan), 2180); assert.strictEqual(GT.calTargetFor(s, '2026-10-11', plan), 2180);
  assert.strictEqual(GT.calTargetFor(s, '2026-10-05', null), 2180, 'no plan -> rest'); });
t('weekly weight rate on 7-day average', () => { const s = GT.emptyState();
  assert.strictEqual(GT.weightTrend(s, '2026-10-14').status, 'need-data');
  for (let i = 0; i < 14; i++) GT.add(s, 'weights', { date: GT.addDays('2026-10-01', i), kg: 93 - i * 0.4 / 7 }); // 0.4 kg/wk
  let tr = GT.weightTrend(s, '2026-10-14'); assert.ok(Math.abs(tr.rate + 0.4) < 1e-9, tr.rate); assert.strictEqual(tr.status, 'in-range');
  s.weights.forEach((w, i) => w.kg = 93 - i * 0.1 / 7); assert.strictEqual(GT.weightTrend(s, '2026-10-14').status, 'too-slow');
  s.weights.forEach((w, i) => w.kg = 93 - i * 1 / 7); assert.strictEqual(GT.weightTrend(s, '2026-10-14').status, 'too-fast');
  s.weights.forEach((w, i) => w.kg = 93 + i * 0.2 / 7); tr = GT.weightTrend(s, '2026-10-14'); assert.ok(tr.rate > 0); assert.strictEqual(tr.status, 'too-slow'); });
t('migration v1 -> v2', () => { const st = mem();
  const v1 = { version: 1, settings: { calTarget: 2350, proteinTarget: 180, planFile: 'plan.recomp.json' }, customBodyParts: ['forearms'], exercises: [{ name: 'X', bodyPart: 'arms' }],
    sets: [{ id: 'a', date: '2026-10-01', exercise: 'X', bodyPart: 'arms', weight: 10, reps: 10 }], treadmill: [], meals: [{ id: 'm', date: '2026-10-01', name: 'Eggs', calories: 400, protein: 30, time: '08:00' }], weights: [{ id: 'w', date: '2026-10-01', kg: 93 }] };
  st.setItem(GT.KEY, JSON.stringify(v1)); const s = GT.load(st);
  assert.strictEqual(s.version, 2); assert.strictEqual(s.settings.calTarget, 2300); assert.strictEqual(s.settings.proteinTarget, 190); assert.strictEqual(s.settings.fibreTarget, 30);
  assert.strictEqual(s.settings.planFile, 'plan.recomp.json'); assert.deepStrictEqual(s.water, []); assert.deepStrictEqual(s.steps, []);
  assert.deepStrictEqual([s.meals[0].carbs, s.meals[0].fat, s.meals[0].fibre], [0, 0, 0]); assert.strictEqual(s.sets.length, 1); assert.deepStrictEqual(s.customBodyParts, ['forearms']);
  const custom = GT.normalize({ ...v1, settings: { calTarget: 2500, proteinTarget: 200 } }); assert.deepStrictEqual([custom.settings.calTarget, custom.settings.proteinTarget], [2500, 200], 'user-edited targets kept');
  const imp = GT.importJSON(JSON.stringify({ app: 'gym-tracker', data: v1 })); assert.strictEqual(imp.version, 2); });
t('water total never below 0', () => { const s = GT.emptyState(), d = '2026-10-07';
  assert.strictEqual(GT.add(s, 'water', { date: d, ml: -250 }), null); assert.strictEqual(GT.dayTotals(s, d).waterL, 0);
  GT.add(s, 'water', { date: d, ml: 100 }); const e = GT.add(s, 'water', { date: d, ml: -250 }); assert.strictEqual(e.ml, -100); assert.strictEqual(GT.dayTotals(s, d).waterL, 0);
  GT.add(s, 'water', { date: d, ml: 500 }); GT.add(s, 'water', { date: d, ml: -250 }); assert.strictEqual(GT.dayTotals(s, d).waterL, 0.25);
  s.water.push({ id: 'bad', date: d, ml: -9999 }); assert.strictEqual(GT.dayTotals(s, d).waterL, 0, 'legacy negative data clamped'); });
console.log(`\n${n} tests passed`);

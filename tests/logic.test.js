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
  for (let i = 0; i < 14; i++) GT.add(s, 'weights', { date: GT.addDays('2026-10-01', i), kg: 80 - i * 0.4 / 7 }); // 0.4 kg/wk
  let tr = GT.weightTrend(s, '2026-10-14'); assert.ok(Math.abs(tr.rate + 0.4) < 1e-9, tr.rate); assert.strictEqual(tr.status, 'in-range');
  s.weights.forEach((w, i) => w.kg = 80 - i * 0.1 / 7); assert.strictEqual(GT.weightTrend(s, '2026-10-14').status, 'too-slow');
  s.weights.forEach((w, i) => w.kg = 80 - i * 1 / 7); assert.strictEqual(GT.weightTrend(s, '2026-10-14').status, 'too-fast');
  s.weights.forEach((w, i) => w.kg = 80 + i * 0.2 / 7); tr = GT.weightTrend(s, '2026-10-14'); assert.ok(tr.rate > 0); assert.strictEqual(tr.status, 'too-slow'); });
t('migration v1 -> v2', () => { const st = mem();
  const v1 = { version: 1, settings: { calTarget: 2350, proteinTarget: 180, planFile: 'plan.recomp.json' }, customBodyParts: ['forearms'], exercises: [{ name: 'X', bodyPart: 'arms' }],
    sets: [{ id: 'a', date: '2026-10-01', exercise: 'X', bodyPart: 'arms', weight: 10, reps: 10 }], treadmill: [], meals: [{ id: 'm', date: '2026-10-01', name: 'Eggs', calories: 400, protein: 30, time: '08:00' }], weights: [{ id: 'w', date: '2026-10-01', kg: 80 }] };
  st.setItem(GT.KEY, JSON.stringify(v1)); const s = GT.load(st);
  assert.strictEqual(s.version, GT.VERSION); assert.strictEqual(s.settings.calTarget, 2300); assert.strictEqual(s.settings.proteinTarget, 190); assert.strictEqual(s.settings.fibreTarget, 30);
  assert.strictEqual(s.settings.planFile, 'plan.recomp.json'); assert.deepStrictEqual(s.water, []); assert.deepStrictEqual(s.steps, []);
  assert.deepStrictEqual([s.meals[0].carbs, s.meals[0].fat, s.meals[0].fibre], [0, 0, 0]); assert.strictEqual(s.sets.length, 1); assert.deepStrictEqual(s.customBodyParts, ['forearms']);
  const custom = GT.normalize({ ...v1, settings: { calTarget: 2500, proteinTarget: 200 } }); assert.deepStrictEqual([custom.settings.calTarget, custom.settings.proteinTarget], [2500, 200], 'user-edited targets kept');
  const imp = GT.importJSON(JSON.stringify({ app: 'gym-tracker', data: v1 })); assert.strictEqual(imp.version, GT.VERSION); assert.deepStrictEqual([imp.sleep, imp.waist, imp.photos, imp.deloads], [[], [], [], []]); });
t('water total never below 0', () => { const s = GT.emptyState(), d = '2026-10-07';
  assert.strictEqual(GT.add(s, 'water', { date: d, ml: -250 }), null); assert.strictEqual(GT.dayTotals(s, d).waterL, 0);
  GT.add(s, 'water', { date: d, ml: 100 }); const e = GT.add(s, 'water', { date: d, ml: -250 }); assert.strictEqual(e.ml, -100); assert.strictEqual(GT.dayTotals(s, d).waterL, 0);
  GT.add(s, 'water', { date: d, ml: 500 }); GT.add(s, 'water', { date: d, ml: -250 }); assert.strictEqual(GT.dayTotals(s, d).waterL, 0.25);
  s.water.push({ id: 'bad', date: d, ml: -9999 }); assert.strictEqual(GT.dayTotals(s, d).waterL, 0, 'legacy negative data clamped'); });
t('backup: whole state in one file, round-trips, older Export JSON files still restore', () => {
  const s = GT.emptyState(); GT.addBodyPart(s, 'forearms'); s.settings.calTarget = 2100; s.settings.planFile = 'plan.recomp.json';
  GT.add(s, 'sets', { date: '2026-10-01', exercise: 'Deadlift', weight: 140, reps: 5 }); GT.add(s, 'sets', { date: '2026-10-03', exercise: 'Wrist curl', bodyPart: 'forearms', weight: 20, reps: 15 });
  GT.add(s, 'treadmill', { date: '2026-10-02', duration: 30, speed: 6 }); GT.add(s, 'meals', { date: '2026-10-02', name: 'Eggs', calories: 400, protein: 30 });
  GT.add(s, 'weights', { date: '2026-10-02', kg: 90.4 }); GT.add(s, 'water', { date: '2026-10-02', ml: 500 }); GT.add(s, 'steps', { date: '2026-10-02', steps: 9000 });
  const b = GT.buildBackup(s, Date.UTC(2026, 9, 8));
  assert.strictEqual(b.app, 'gym-tracker'); assert.strictEqual(b.kind, 'backup'); assert.strictEqual(b.version, 1); assert.strictEqual(b.createdAt, '2026-10-08T00:00:00.000Z');
  b.data.sets[0].weight = 1; assert.strictEqual(s.sets[0].weight, 140, 'backup is a copy');
  const p = GT.parseBackup(GT.exportJSON(s, Date.UTC(2026, 9, 8)));
  assert.deepStrictEqual(p.data, GT.normalize(JSON.parse(JSON.stringify(s))), 'everything comes back'); assert.strictEqual(p.createdAt, Date.UTC(2026, 9, 8));
  assert.strictEqual(p.data.settings.calTarget, 2100); assert.deepStrictEqual(p.data.customBodyParts, ['forearms']); assert.ok(p.data.exercises.some(e => e.name === 'Wrist curl'));
  assert.deepStrictEqual([p.summary.sets, p.summary.workoutDays, p.summary.treadmill, p.summary.meals, p.summary.weights, p.summary.waterDays, p.summary.stepDays, p.summary.entries], [2, 2, 1, 1, 1, 1, 1, 7]);
  assert.deepStrictEqual([p.summary.from, p.summary.to], ['2026-10-01', '2026-10-03']);
  const old = GT.parseBackup(JSON.stringify({ app: 'gym-tracker', exportedAt: '2026-09-01T00:00:00.000Z', data: { version: 1, sets: [], meals: [], weights: [] } }));
  assert.strictEqual(old.data.version, GT.VERSION); assert.deepStrictEqual(old.data.water, []); assert.strictEqual(old.createdAt, Date.parse('2026-09-01T00:00:00.000Z'));
  assert.strictEqual(GT.parseBackup(JSON.stringify(s)).data.sets.length, 2, 'raw state (no wrapper) accepted');
  assert.strictEqual(GT.importJSON(GT.exportJSON(s)).sets.length, 2);
  assert.ok(/^gym-tracker-backup-\d{4}-\d{2}-\d{2}\.json$/.test(GT.backupFileName()));
});
t('restore refuses bad files with a plain reason, and drops junk entries', () => {
  const bad = (txt, re) => assert.throws(() => GT.parseBackup(txt), e => re.test(e.message), String(txt).slice(0, 40));
  bad('not json', /valid backup/); bad('', /valid backup/); bad('[1,2]', /isn.t a Gym Tracker backup/); bad('{"hello":1}', /no workout data/);
  bad(JSON.stringify({ app: 'stock-watchlist', kind: 'backup', version: 1, data: { watchlists: {} } }), /Stock Watchlist backup/);
  bad(JSON.stringify({ app: 'gym-tracker', kind: 'backup', version: 99, data: { sets: [] } }), /newer version/);
  bad(JSON.stringify({ app: 'gym-tracker', data: { sets: [], meals: 'x' } }), /damaged \(meals/);
  bad(JSON.stringify({ app: 'gym-tracker', data: { sets: [], settings: [] } }), /damaged \(settings/);
  const p = GT.parseBackup('\uFEFF' + JSON.stringify({ app: 'gym-tracker', data: { sets: [null, 5, { id: 'a', date: '2026-10-01', exercise: 'X', weight: 1, reps: 1 }], customBodyParts: ['ok', 3] } }));
  assert.strictEqual(p.data.sets.length, 1); assert.deepStrictEqual(p.data.customBodyParts, ['ok']);
});
t('backup reminder: due 14 days after the last backup (or first use), snooze works', () => {
  const st = mem(), D = GT.DAY, t0 = Date.UTC(2026, 9, 1);
  const m = GT.loadBackupMeta(st, t0); assert.strictEqual(m.firstSeenAt, t0); assert.strictEqual(GT.loadBackupMeta(st, t0 + 5 * D).firstSeenAt, t0, 'first use is remembered');
  assert.deepStrictEqual(GT.backupReminder(m, t0 + 13 * D), { due: false, daysSince: 13, never: true });
  assert.deepStrictEqual(GT.backupReminder(m, t0 + 14 * D), { due: true, daysSince: 14, never: true });
  m.lastAt = t0 + 14 * D; GT.saveBackupMeta(st, m); const m2 = GT.loadBackupMeta(st);
  assert.strictEqual(GT.backupReminder(m2, t0 + 27 * D).due, false); assert.strictEqual(GT.backupReminder(m2, t0 + 28 * D).due, true); assert.strictEqual(GT.backupReminder(m2, t0 + 28 * D).never, false);
  m2.snoozeUntil = t0 + 31 * D; assert.strictEqual(GT.backupReminder(m2, t0 + 30 * D).due, false); assert.strictEqual(GT.backupReminder(m2, t0 + 31 * D).due, true);
  st.setItem(GT.BACKUP_META_KEY, '{oops'); assert.strictEqual(GT.loadBackupMeta(st, t0).lastAt, null, 'damaged meta starts fresh');
});
t('service worker: cache bumped, installs bypass the HTTP cache, app checks for updates', () => {
  const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  assert.ok(/const CACHE = 'gymtracker-v5'/.test(sw)); assert.ok(/new Request\(a, \{ cache: 'reload' \}\)/.test(sw), 'addAll uses cache: reload');
  assert.ok(/updateViaCache: 'none'/.test(app) && /controllerchange/.test(app) && /visibilitychange[\s\S]{0,120}reg\.update\(\)/.test(app), 'registration: updateViaCache none, reload on controllerchange, update on visibility');
  const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const id of ['backupBtn', 'restoreBtn', 'restoreFile', 'backupLast', 'backupNudge']) assert.ok(idx.includes(`id="${id}"`), id);
});

// ---------- plan v2 additions ----------
const D0 = '2026-08-03'; // a Monday
const day = n => GT.addDays(D0, n);
// weights: one per day following kgAt(dayIndex)
const seedWeights = (s, days, kgAt) => { for (let i = 0; i < days; i++) GT.add(s, 'weights', { date: day(i), kg: Math.round(kgAt(i) * 100) / 100 }); };
const seedLifts = (s, days, kgAt) => { for (let i = 0; i < days; i += 3.5) { const d = Math.floor(i); GT.add(s, 'sets', { date: day(d), exercise: 'Barbell bench press', weight: kgAt(d), reps: 6 }); GT.add(s, 'sets', { date: day(d + 1), exercise: 'Back squat', weight: kgAt(d) + 20, reps: 6 }); } };
t('sleep hours (daily) and waist (weekly) are logged, one per day, and show in day totals', () => {
  const s = GT.emptyState();
  GT.add(s, 'sleep', { date: '2026-10-07', hours: '6.6' }); GT.add(s, 'sleep', { date: '2026-10-07', hours: 7.5 }); GT.add(s, 'sleep', { date: '2026-10-08', hours: 30 });
  assert.strictEqual(s.sleep.length, 2); assert.strictEqual(GT.dayTotals(s, '2026-10-07').sleep, 7.5); assert.strictEqual(GT.dayTotals(s, '2026-10-08').sleep, 24, 'clamped'); assert.strictEqual(GT.dayTotals(s, '2026-10-09').sleep, null);
  GT.add(s, 'waist', { date: '2026-10-05', cm: '98.44' }); GT.add(s, 'waist', { date: '2026-10-05', cm: 98.2 });
  assert.deepStrictEqual(s.waist.map(w => w.cm), [98.2]); assert.throws(() => GT.add(s, 'waist', { date: '2026-10-06', cm: '' }));
  assert.strictEqual(s.settings.sleepTarget, 7);
});
t('calorie check: too early in weeks 1-2, then needs 3 weeks of weigh-ins', () => {
  const s = GT.emptyState(); assert.strictEqual(GT.calorieCheck(s, day(0)).action, 'wait');
  seedWeights(s, 10, () => 80); const c = GT.calorieCheck(s, day(9)); assert.strictEqual(c.action, 'wait'); assert.ok(/weeks 1.2 are mostly water/.test(c.title) && c.title.includes(day(14)));
});
t('calorie check: weight AND waist flat for 2-3 weeks -> cut 150 kcal (from carbs), never below 2150', () => {
  const s = GT.emptyState(); seedWeights(s, 42, i => i < 14 ? 80 - i * 0.05 : 79.3 + (i % 2) * 0.1);
  for (const [d, cm] of [[7, 99.5], [14, 99], [21, 98.9], [28, 99], [34, 98.9], [41, 99]]) GT.add(s, 'waist', { date: day(d), cm });
  seedLifts(s, 42, () => 80);
  const c = GT.calorieCheck(s, day(34)); assert.strictEqual(c.action, 'cut', c.title); assert.strictEqual(c.kcal, -150); assert.strictEqual(c.newTarget, 2150); assert.ok(/weight and waist both flat for [23] weeks/.test(c.title), c.title);
  GT.applyCalorieChange(s, c.kcal, day(34)); assert.deepStrictEqual([s.settings.calTarget, s.settings.carbTarget, s.settings.calWeightDay, s.settings.calOtherDay, s.settings.lastCalChange], [2150, 193, 2270, 2030, day(34)]);
  assert.strictEqual(GT.calorieCheck(s, day(36)).action, 'wait', 'one change a week');
  const r = GT.calorieCheck(s, day(41)); assert.strictEqual(r.action, 'review', 'cutting again would go below 2150: ' + r.title);
});
t('calorie check: weight flat, waist shrinking, lifts rising -> change nothing', () => {
  const s = GT.emptyState(); seedWeights(s, 35, () => 79.5);
  for (const [d, cm] of [[7, 100], [14, 99.4], [21, 98.8], [28, 98.3], [34, 97.9]]) GT.add(s, 'waist', { date: day(d), cm });
  seedLifts(s, 35, d => 70 + Math.floor(d / 7) * 2.5);
  const c = GT.calorieCheck(s, day(34)); assert.strictEqual(c.action, 'hold', c.title); assert.strictEqual(c.kcal, 0); assert.ok(/recomp is working/.test(c.title), c.title);
  assert.strictEqual(GT.liftTrend(s, day(34)).status, 'rising'); assert.ok(GT.waistChange(s, day(34)).change <= -0.5);
  // waist shrinking but lifts flat: still no cut
  const s2 = GT.emptyState(); seedWeights(s2, 35, () => 79.5); for (const [d, cm] of [[14, 99.4], [21, 98.8], [34, 97.9]]) GT.add(s2, 'waist', { date: day(d), cm }); seedLifts(s2, 35, () => 80);
  const c2 = GT.calorieCheck(s2, day(34)); assert.strictEqual(c2.action, 'hold'); assert.ok(/waist is shrinking/.test(c2.title), c2.title);
  // weight flat but no waist data: never cut
  const s3 = GT.emptyState(); seedWeights(s3, 35, () => 79.5); seedLifts(s3, 35, () => 80);
  const c3 = GT.calorieCheck(s3, day(34)); assert.strictEqual(c3.action, 'hold'); assert.ok(/Log your waist/.test(c3.title), c3.title);
});
t('calorie check: fast loss for 2 weeks or falling lifts -> add 150 kcal; normal loss -> no change', () => {
  const s = GT.emptyState(); seedWeights(s, 35, i => 95 - i * 0.12); seedLifts(s, 35, () => 80);
  const c = GT.calorieCheck(s, day(34)); assert.strictEqual(c.action, 'add', c.title); assert.strictEqual(c.kcal, 150); assert.ok(/more than 0.7 kg a week/.test(c.title));
  const s2 = GT.emptyState(); seedWeights(s2, 35, () => 79.5); seedLifts(s2, 35, d => 90 - Math.floor(d / 7) * 2.5); for (const [d, cm] of [[14, 99], [34, 99]]) GT.add(s2, 'waist', { date: day(d), cm });
  const c2 = GT.calorieCheck(s2, day(34)); assert.strictEqual(c2.action, 'add', c2.title); assert.ok(/lifts have been falling/.test(c2.title));
  const s3 = GT.emptyState(); seedWeights(s3, 35, i => 95 - i * 0.065); seedLifts(s3, 35, () => 80);
  const c3 = GT.calorieCheck(s3, day(34)); assert.strictEqual(c3.action, 'hold'); assert.ok(/inside the 0.3.0.6 target/.test(c3.title), c3.title);
});
t('deload flag: same lift drops 2 sessions running, or 8 weeks since the last deload', () => {
  const s = GT.emptyState();
  [[0, 100], [3, 100], [7, 97.5], [10, 95]].forEach(([d, w]) => GT.add(s, 'sets', { date: day(d), exercise: 'Back squat', weight: w, reps: 5 }));
  let r = GT.deloadCheck(s, day(11)); assert.ok(r.suggest && /Back squat dropped 2 sessions running/.test(r.reasons[0]), JSON.stringify(r));
  GT.add(s, 'deloads', { date: day(11) }); r = GT.deloadCheck(s, day(13)); assert.ok(r.active && !r.suggest && r.until === day(17));
  r = GT.deloadCheck(s, day(19)); assert.ok(!r.suggest, 'drops before the deload no longer count');
  const s2 = GT.emptyState(); for (let d = 0; d <= 56; d += 7) GT.add(s2, 'sets', { date: day(d), exercise: 'Deadlift', weight: 100 + d / 7 * 5, reps: 5 });
  assert.ok(!GT.deloadCheck(s2, day(55)).suggest); r = GT.deloadCheck(s2, day(56)); assert.ok(r.suggest && /8 weeks of training logged without a deload/.test(r.reasons[0]), JSON.stringify(r));
  GT.add(s2, 'deloads', { date: day(0) }); assert.ok(/8 weeks since your last deload/.test(GT.deloadCheck(s2, day(56)).reasons[0]));
  s2.settings.deloadSnoozeUntil = day(60); assert.ok(!GT.deloadCheck(s2, day(57)).suggest, 'snoozed');
});
t('progress photos: due at the start, then every 4 weeks; snooze works', () => {
  const s = GT.emptyState(); assert.ok(!GT.photoReminder(s, day(0)).due, 'nothing logged yet');
  GT.add(s, 'weights', { date: day(0), kg: 80 }); assert.ok(GT.photoReminder(s, day(0)).due, 'baseline photos');
  GT.add(s, 'photos', { date: day(0) }); GT.add(s, 'photos', { date: day(0) }); assert.strictEqual(s.photos.length, 1);
  assert.ok(!GT.photoReminder(s, day(27)).due); const r = GT.photoReminder(s, day(28)); assert.ok(r.due && r.days === 28 && r.next === day(28));
  s.settings.photoSnoozeUntil = day(30); assert.ok(!GT.photoReminder(s, day(29)).due); assert.ok(GT.photoReminder(s, day(30)).due);
});
t('backup includes the new sleep, waist, photo and deload logs', () => {
  const s = GT.emptyState(); GT.add(s, 'sleep', { date: day(0), hours: 7 }); GT.add(s, 'waist', { date: day(0), cm: 99 }); GT.add(s, 'photos', { date: day(0) }); GT.add(s, 'deloads', { date: day(0) });
  const p = GT.parseBackup(GT.exportJSON(s)); assert.deepStrictEqual([p.summary.sleepDays, p.summary.waist, p.summary.photos, p.summary.deloads], [1, 1, 1, 1]);
  assert.strictEqual(p.data.waist[0].cm, 99);
});
t('restore merge: keeps everything on this phone, adds what is only in the backup, phone wins per day, settings kept', () => {
  const phone = GT.emptyState(), other = GT.emptyState();
  const shared = GT.add(phone, 'sets', { date: '2026-10-01', exercise: 'Barbell bench press', weight: 60, reps: 8 });
  other.sets.push({ ...shared }); // same entry in both (same id): not duplicated
  GT.add(other, 'sets', { date: '2026-09-28', exercise: 'Cable Crossover', bodyPart: 'chest', weight: 20, reps: 12 }); // new exercise too
  GT.add(phone, 'meals', { date: '2026-10-01', name: 'A', calories: 500, protein: 40 }); GT.add(other, 'meals', { date: '2026-09-30', name: 'B', calories: 600, protein: 50 });
  GT.add(phone, 'sleep', { date: '2026-10-01', hours: 7 }); GT.add(other, 'sleep', { date: '2026-10-01', hours: 5 }); GT.add(other, 'sleep', { date: '2026-09-30', hours: 8 });
  GT.add(phone, 'steps', { date: '2026-10-01', steps: 9000 }); GT.add(other, 'steps', { date: '2026-10-01', steps: 100 });
  GT.add(other, 'waist', { date: '2026-09-24', cm: 100 }); GT.add(other, 'water', { date: '2026-09-30', ml: 500 });
  other.customBodyParts.push('forearms'); phone.settings.calTarget = 2150; other.settings.calTarget = 2600;
  const before = JSON.stringify(phone);
  const m = GT.mergeBackup(phone, GT.parseBackup(GT.exportJSON(other)).data), r = m.state;
  assert.strictEqual(JSON.stringify(phone), before, 'input state not mutated');
  assert.strictEqual(r.sets.length, 2); assert.strictEqual(r.meals.length, 2); assert.strictEqual(r.waist.length, 1); assert.strictEqual(r.water.length, 1);
  assert.deepStrictEqual(r.sleep.map(x => [x.date, x.hours]).sort(), [['2026-09-30', 8], ['2026-10-01', 7]], 'phone wins for the same night');
  assert.strictEqual(r.steps.find(x => x.date === '2026-10-01').steps, 9000);
  assert.ok(r.exercises.some(e => e.name === 'Cable Crossover') && r.customBodyParts.includes('forearms'));
  assert.strictEqual(r.settings.calTarget, 2150, 'settings kept');
  assert.deepStrictEqual([m.added.sets, m.added.meals, m.added.sleep, m.added.steps, m.added.exercises], [1, 1, 1, 0, 1]);
  assert.strictEqual(GT.mergeBackup(r, GT.parseBackup(GT.exportJSON(other)).data).total, 0, 'merging the same file twice adds nothing');
  // old Export JSON entries without ids are de-duplicated by content
  const legacy = { sets: [{ date: '2026-09-01', exercise: 'Plank', weight: 0, reps: 60 }] };
  const once = GT.mergeBackup(GT.emptyState(), GT.parseBackup(JSON.stringify(legacy)).data).state;
  assert.strictEqual(GT.mergeBackup(once, GT.parseBackup(JSON.stringify(legacy)).data).state.sets.length, 1);
});
console.log(`\n${n} tests passed`);

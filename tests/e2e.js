// Headless check. Needs: npm i puppeteer-core (outside this folder), Chrome at /usr/bin/google-chrome, and python3 -m http.server 8765 running in the app dir.
const puppeteer = require('puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); const errs = [];
  const ok = (c, m) => { if (!c) errs.push('FAIL ' + m); else console.log('ok -', m); };
  const SHOTS = process.env.SHOTS_DIR || '/tmp', BASE = process.env.BASE_URL || 'http://localhost:8765/';
  const tap = sel => p.$eval(sel, e => { e.scrollIntoView({ block: 'center' }); e.click(); }); // the sticky header can cover a button that's only half in view

  p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => m.type() === 'error' && errs.push('console: ' + m.text()));
  p.on('requestfailed', r => errs.push('reqfail: ' + r.url())); p.on('dialog', d => d.accept(d.type() === 'prompt' ? 'DELETE' : undefined));
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  // Share-sheet stand-in: records the File handed to navigator.share. localStorage 'test.share' = ok | abort | none (none = no Web Share, like desktop Chrome).
  await p.evaluateOnNewDocument(() => {
    window.__shared = []; window.__downloads = [];
    const mode = () => localStorage.getItem('test.share') || 'none';
    Object.defineProperty(navigator, 'canShare', { configurable: true, get: () => (mode() === 'none' ? undefined : d => !!(d && d.files && d.files.length && d.files[0] instanceof File)) });
    Object.defineProperty(navigator, 'share', { configurable: true, get: () => (mode() === 'none' ? undefined : async d => {
      if (mode() === 'abort') throw new DOMException('Share canceled', 'AbortError');
      const f = d.files[0]; window.__shared.push({ name: f.name, type: f.type, text: await f.text() });
    }) });
    const blobs = {}, mk = URL.createObjectURL.bind(URL); URL.createObjectURL = b => { const u = mk(b); blobs[u] = b; return u; };
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { if (this.download && blobs[this.href]) { const a = this; window.__downloads.push(blobs[a.href].text().then(t => ({ name: a.download, text: t }))); return; } return click.call(this); };
  });
  for (const u of ['manifest.webmanifest','sw.js','plan.json','plan.recomp.json','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon-180.png']) { const r = await p.goto(BASE + u); if (r.status() !== 200) errs.push(u + ' ' + r.status()); }
  // Seed legacy v1 data, then check it loads and migrates
  await p.goto(BASE, { waitUntil: 'networkidle0' });
  await p.evaluate(() => localStorage.setItem('gymtracker.v1', JSON.stringify({ version: 1, settings: { calTarget: 2350, proteinTarget: 180, planFile: 'plan.json' }, customBodyParts: [], exercises: [], sets: [], treadmill: [], meals: [{ id: 'old', date: '2000-01-01', name: 'Old meal', calories: 100, protein: 10, time: '08:00' }], weights: [] })));
  await p.reload({ waitUntil: 'networkidle0' });
  ok((await p.$eval('#todaySummary', e => e.textContent)).includes('/ 2300'), 'v1 data migrates to 2300 kcal target');
  await p.evaluate(() => localStorage.removeItem('gymtracker.v1')); await p.reload({ waitUntil: 'networkidle0' });
  await p.waitForFunction(() => document.querySelector('#planBox').textContent.includes('EXAMPLE'));
  ok(true, 'plan loaded (EXAMPLE label shown)');
  // Workout
  await p.click('[data-v=workout]'); await p.type('#wEx', 'Barbell bench press'); await p.type('#wKg', '80'); await p.type('#wReps', '8'); await p.click('#addSet');
  await p.click('#repeatSet'); await p.click('#repeatSet');
  ok(await p.$$eval('#setList .item', x => x.length) === 3, '1 set + 2 repeats = 3 sets');
  // Edit a set
  await p.click('#setList [data-edit]'); await p.$eval('#wKg', e => e.value = ''); await p.type('#wKg', '82.5'); await p.click('#addSet');
  ok((await p.$eval('#setList', e => e.textContent)).includes('82.5 kg × 8'), 'edit set');
  await p.click('#setList [data-del]'); ok(await p.$$eval('#setList .item', x => x.length) === 2, 'delete set');
  // previous session display: switch to next day
  await p.$eval('#date', e => { const d = new Date(e.value + 'T00:00:00'); d.setDate(d.getDate() + 1); e.value = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); e.dispatchEvent(new Event('change')); });
  await p.$eval('#wEx', e => { e.value = 'Barbell bench press'; e.dispatchEvent(new Event('input')); });
  ok((await p.$eval('#prevBox', e => e.textContent)).includes('80×8'), 'previous session shown next day');
  await p.$eval('#date', e => { const d = new Date(e.value + 'T00:00:00'); d.setDate(d.getDate() - 1); e.value = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); e.dispatchEvent(new Event('change')); });
  // Meals
  await p.click('[data-v=meals]');
  for (const [n, c, pr] of [['Eggs', 450, 40], ['Chicken rice', 650, 50]]) { await p.type('#mForm [name=name]', n); await p.type('#mForm [name=calories]', String(c)); await p.type('#mForm [name=protein]', String(pr)); await p.click('#mForm button.primary'); }
  let tot = await p.$eval('#mealTotals', e => e.textContent); ok(tot.includes('1100 / 2300') && tot.includes('90 / 190') && tot.includes('Carbs: 0 / 230'), 'meal totals 1100/2300 kcal, 90/190 g, carbs default 0: ' + tot.replace(/\s+/g, ' '));
  await p.type('#mForm [name=name]', 'Oats'); await p.type('#mForm [name=calories]', '300'); await p.type('#mForm [name=protein]', '10'); await p.type('#mForm [name=carbs]', '50'); await p.type('#mForm [name=fat]', '6'); await p.type('#mForm [name=fibre]', '8'); await p.click('#mForm button.primary');
  tot = await p.$eval('#mealTotals', e => e.textContent); ok(tot.includes('Carbs: 50 / 230') && tot.includes('Fat: 6 / 70') && tot.includes('Fibre: 8 / ≥30'), 'macros totals');
  await p.evaluate(() => [...document.querySelectorAll('#mList .item')].find(i => i.textContent.includes('Oats')).querySelector('[data-del]').click());
  await p.click('#mList [data-edit]'); await p.$eval('#mForm [name=calories]', e => e.value = ''); await p.type('#mForm [name=calories]', '500'); await p.click('#mForm button.primary');
  tot = await p.$eval('#mealTotals', e => e.textContent); ok(tot.includes('1150'), 'meal edit updates totals');
  // Water + steps on Today
  await p.click('[data-v=today]'); await p.click('[data-water="500"]'); await p.click('[data-water="250"]'); await p.type('#stepsForm [name=steps]', '8500'); await p.click('#stepsForm button');
  let sum = await p.$eval('#todaySummary', e => e.textContent); ok(sum.includes('Water: 0.8 / ≥3') && sum.includes('Steps: 8500 / 8000–10000') && sum.includes('in range'), 'water + steps vs target');
  for (let i = 0; i < 5; i++) await p.click('[data-water="-250"]');
  ok((await p.$eval('#todaySummary', e => e.textContent)).includes('Water: 0 / ≥3'), 'water never below 0 after extra -250 taps');
  await p.click('[data-water="500"]'); await p.click('[data-water="250"]');
  ok(sum.includes('Fibre:') && sum.includes('Carbs:') && sum.includes('Fat:'), 'all targets on Today');
  // Treadmill
  await p.click('[data-v=cardio]'); await p.type('#tForm [name=duration]', '40'); await p.type('#tForm [name=speed]', '6'); await p.type('#tForm [name=incline]', '8'); 
  ok(await p.$eval('#tForm [name=distance]', e => e.value) === '4', 'distance auto-calc'); await p.click('#tForm button.primary');
  ok(await p.$$eval('#tList .item', x => x.length) === 1, 'treadmill added');
  // Weight
  await p.click('[data-v=weight]'); ok(await p.$eval('#bwForm [name=kg]', e => e.placeholder) === 'kg', 'weight placeholder'); await p.type('#bwForm [name=kg]', '85.2'); await p.click('#bwForm button.primary');
  ok((await p.$eval('#bwList', e => e.textContent)).includes('85.2'), 'weight logged');
  // Settings targets
  await p.click('[data-v=settings]'); await p.$eval('#sForm [name=calTarget]', e => e.value = '2000'); await p.click('#sForm button.primary');
  await p.click('[data-v=today]'); ok((await p.$eval('#todaySummary', e => e.textContent)).includes('/ 2000'), 'target change reflected');
  await p.click('[data-v=settings]'); await p.$eval('#sForm [name=carbCycling]', c => c.click()); await p.click('#sForm button.primary'); await p.click('[data-v=today]');
  const cyc = await p.$eval('#todaySummary', e => e.textContent); ok(/\/ (2420|2180) kcal/.test(cyc), 'carb cycling target applied: ' + cyc.match(/\/ \d+ kcal\s*\w+ day/)?.[0]);
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('gymtracker.v1')).settings.carbCycling === true), 'carb cycling saved');
  // Trend: inject 14 days of weights at -0.4 kg/wk and check
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('gymtracker.v1')); const d0 = new Date(); for (let i = 13; i >= 0; i--) { const d = new Date(d0); d.setDate(d.getDate() - i);
    const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); s.weights.push({ id: 'x' + i, date: ds, kg: 80 - (13 - i) * 0.4 / 7 }); }
    s.weights = s.weights.filter(w => w.id.startsWith('x')); localStorage.setItem('gymtracker.v1', JSON.stringify(s)); });
  await p.reload({ waitUntil: 'networkidle0' }); await p.waitForFunction(() => document.querySelector('#trendBox').textContent.includes('kg/week'));
  const trend = await p.$eval('#trendBox', e => e.textContent); ok(trend.includes('-0.4 kg/week') && trend.includes('in range'), 'weekly rate shown + in range: ' + trend.replace(/\s+/g, ' ').slice(0, 80));
  // switch plan
  await p.click('[data-v=settings]'); await p.select('#sForm [name=planFile]', 'plan.recomp.json'); await p.click('#sForm button.primary');
  await p.click('[data-v=today]'); await p.waitForFunction(() => !document.querySelector('#planBox').textContent.includes('EXAMPLE'));
  ok(true, 'recomp plan loads: ' + (await p.$eval('#planBox b', e => e.textContent)));
  await p.click('[data-v=progress]'); await new Promise(r => setTimeout(r, 300)); await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: SHOTS + '/gt-progress.png', fullPage: true });
  await p.click('[data-v=today]'); await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: SHOTS + '/gt-today.png' });
  const data = await p.evaluate(() => JSON.parse(localStorage.getItem('gymtracker.v1')));
  ok(data.sets.length === 2 && data.meals.length === 2 && data.water.reduce((a, w) => a + w.ml, 0) === 750 && data.steps.length === 1, 'localStorage persisted');
  // reload persists
  await p.reload({ waitUntil: 'networkidle0' }); ok(await p.evaluate(() => JSON.parse(localStorage.getItem('gymtracker.v1')).meals.length) === 2, 'persists after reload');
  ok(await p.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())), 'service worker registered');
  // ---------- backup + restore ----------
  const fs = require('fs'), os = require('os'), path = require('path'), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-bk-'));
  ok(await p.$eval('#backupNudge', e => e.hidden), 'no backup reminder in the first 14 days');
  await p.evaluate(() => localStorage.setItem('gymtracker.backup.v1', JSON.stringify({ lastAt: null, firstSeenAt: Date.now() - 15 * 864e5, snoozeUntil: 0 })));
  await p.reload({ waitUntil: 'networkidle0' });
  ok(!(await p.$eval('#backupNudge', e => e.hidden)) && (await p.$eval('#backupNudge', e => e.textContent)).includes('No backup yet'), 'gentle reminder on Today after 14 days without a backup');
  await tap('#nudgeLater'); ok(await p.$eval('#backupNudge', e => e.hidden), 'Later hides the reminder (snoozed)');
  await p.evaluate(() => { const m = JSON.parse(localStorage.getItem('gymtracker.backup.v1')); m.snoozeUntil = 0; localStorage.setItem('gymtracker.backup.v1', JSON.stringify(m)); localStorage.setItem('test.share', 'ok'); });
  await p.reload({ waitUntil: 'networkidle0' });
  await tap('#nudgeBackup'); await p.waitForFunction(() => window.__shared.length === 1);
  const sh = (await p.evaluate(() => window.__shared))[0], bk = JSON.parse(sh.text);
  ok(/^gym-tracker-backup-\d{4}-\d{2}-\d{2}\.json$/.test(sh.name) && sh.type === 'application/json', 'Back up now hands a JSON File to the iPhone share sheet: ' + sh.name);
  ok(bk.app === 'gym-tracker' && bk.kind === 'backup' && bk.data.sets.length === 2 && bk.data.meals.length === 2 && bk.data.treadmill.length === 1 && bk.data.steps.length === 1 && bk.data.weights.length === 14 && bk.data.settings.calTarget === 2000 && bk.data.settings.planFile === 'plan.recomp.json',
    'backup holds everything (sets, meals, treadmill, weights, steps, settings)');
  ok(await p.$eval('#backupNudge', e => e.hidden), 'reminder goes away after a backup');
  await p.click('[data-v=settings]');
  ok(/Last backup: .*\(today\)/.test(await p.$eval('#backupLast', e => e.textContent)), 'More shows the last backup date: ' + await p.$eval('#backupLast', e => e.textContent));
  await p.evaluate(() => localStorage.setItem('test.share', 'abort')); await tap('#backupBtn');
  await p.waitForFunction(() => /cancelled/.test(document.querySelector('#backupMsg').textContent)); ok(true, 'closing the share sheet: "Backup cancelled"');
  await p.evaluate(() => localStorage.setItem('test.share', 'none')); await tap('#backupBtn');
  await p.waitForFunction(() => window.__downloads.length === 1);
  const dl = await p.evaluate(() => window.__downloads[0]); ok(dl.name === sh.name && JSON.parse(dl.text).data.sets.length === 2, 'no Web Share: falls back to a file download');
  const good = path.join(tmp, sh.name), wrong = path.join(tmp, 'stock-watchlist-backup-2026-10-08.json'), junk = path.join(tmp, 'notes.json');
  fs.writeFileSync(good, sh.text); fs.writeFileSync(wrong, JSON.stringify({ app: 'stock-watchlist', kind: 'backup', version: 1, data: { watchlists: {} } })); fs.writeFileSync(junk, 'hello');
  await (await p.$('#restoreFile')).uploadFile(wrong); await p.waitForFunction(() => /Stock Watchlist/.test(document.querySelector('#backupMsg').textContent));
  await (await p.$('#restoreFile')).uploadFile(junk); await p.waitForFunction(() => /valid backup/.test(document.querySelector('#backupMsg').textContent));
  ok(await p.$eval('#restorePreview', e => e.hidden), 'restore refuses a Stock Watchlist file and a non-JSON file, with the reason');
  // lose some data, then restore it
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('gymtracker.v1')); s.meals = []; s.sets = s.sets.slice(0, 1); localStorage.setItem('gymtracker.v1', JSON.stringify(s)); });
  await p.reload({ waitUntil: 'networkidle0' }); await p.click('[data-v=settings]');
  await (await p.$('#restoreFile')).uploadFile(good); await p.waitForSelector('#restorePreview:not([hidden])');
  const prev = await p.$$eval('#restoreTable tr', t => t.map(r => [...r.children].map(c => c.textContent))), pr = n => prev.find(r => r[0] === n) || [];
  ok(pr('Meals')[1] === '0' && pr('Meals')[2] === '2' && pr('Workout sets')[1].startsWith('1 ') && pr('Workout sets')[2].startsWith('2 '), 'restore preview shows what will be replaced (now vs backup): ' + JSON.stringify(prev.slice(1, 4)));
  await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: SHOTS + '/gt-restore-preview.png', fullPage: true });
  await tap('#restoreCancel'); ok(await p.$eval('#restorePreview', e => e.hidden) && (await p.$eval('#backupMsg', e => e.textContent)).includes('Nothing changed') && await p.evaluate(() => JSON.parse(localStorage.getItem('gymtracker.v1')).meals.length) === 0, 'Cancel leaves everything as it was');
  await (await p.$('#restoreFile')).uploadFile(good); await p.waitForSelector('#restorePreview:not([hidden])'); await tap('#restoreGo');
  const rs = await p.evaluate(() => JSON.parse(localStorage.getItem('gymtracker.v1')));
  ok(rs.meals.length === 2 && rs.sets.length === 2 && (await p.$eval('#backupMsg', e => e.textContent)).startsWith('Restored'), 'confirmed restore brings the data back');
  await p.click('[data-v=meals]'); ok(await p.$$eval('#mList .item', x => x.length) === 2, 'restored meals show without a reload');
  await p.reload({ waitUntil: 'networkidle0' }); ok(await p.evaluate(() => JSON.parse(localStorage.getItem('gymtracker.v1')).meals.length) === 2, 'restore persists after reload');
  // Merge: add a meal that's only on the phone and drop one from the backup's set list, then merge: phone entry kept, missing backup entries added, settings kept
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('gymtracker.v1')); s.meals.push({ id: 'phoneonly', date: s.meals[0].date, name: 'Phone-only meal', calories: 100, protein: 10, carbs: 0, fat: 0, fibre: 0, time: '12:00' }); s.sets = s.sets.slice(0, 1); s.settings.calTarget = 2222; localStorage.setItem('gymtracker.v1', JSON.stringify(s)); });
  await p.reload({ waitUntil: 'networkidle0' }); await p.click('[data-v=settings]');
  await (await p.$('#restoreFile')).uploadFile(good); await p.waitForSelector('#restorePreview:not([hidden])'); await tap('#restoreMerge');
  const mg = await p.evaluate(() => JSON.parse(localStorage.getItem('gymtracker.v1')));
  ok(mg.meals.length === 3 && mg.meals.some(m => m.id === 'phoneonly') && mg.sets.length === 2 && mg.settings.calTarget === 2222 && (await p.$eval('#backupMsg', e => e.textContent)).startsWith('Merged'), 'Merge keeps phone-only entries and settings, adds what is only in the backup');
  await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: SHOTS + '/gt-today-after-restore.png' });
  fs.rmSync(tmp, { recursive: true, force: true });
  // ---------- plan v2: sleep, waist, weekly calorie check, deload flag, progress photos ----------
  await p.click('[data-v=today]');
  await p.type('#sleepForm [name=hours]', '6.5'); await tap('#sleepForm button');
  ok((await p.$eval('#todaySummary', e => e.textContent)).includes('Sleep: 6.5 / ≥7 h'), 'sleep hours logged on Today, shown against the 7 h goal');
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('gymtracker.v1')).sleep.length === 1), 'sleep saved (one entry per night)');
  ok(!!(await p.$('#photoFlag')), 'progress photo reminder shows (no photos yet)');
  await tap('#photoDone'); ok(!(await p.$('#photoFlag')) && await p.evaluate(() => JSON.parse(localStorage.getItem('gymtracker.v1')).photos.length === 1), 'Done hides it for 4 weeks');
  await p.click('[data-v=weight]'); await p.type('#waistForm [name=cm]', '98.6'); await tap('#waistForm button.primary');
  ok((await p.$eval('#waistList', e => e.textContent)).includes('98.6 cm'), 'waist logged on the Weight tab');
  // Scenario A: 5 weeks, weight flat, waist shrinking, lifts rising -> no change
  const seed = (waist, liftStep, squatDrop) => p.evaluate((waist, liftStep, squatDrop) => {
    const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
    const s = JSON.parse(localStorage.getItem('gymtracker.v1')); s.weights = []; s.waist = []; s.sets = []; s.deloads = []; s.settings.lastCalChange = null; s.settings.carbCycling = false; s.settings.calTarget = 2300; s.settings.carbTarget = 230;
    for (let i = 34; i >= 0; i--) s.weights.push({ id: 'w' + i, date: ago(i), kg: 79.5 + (i % 2) * 0.1 });
    waist.forEach(([n, cm], k) => s.waist.push({ id: 'c' + k, date: ago(n), cm }));
    for (let i = 34; i >= 0; i -= 4) { const wk = Math.floor((34 - i) / 7); s.sets.push({ id: 'b' + i, date: ago(i), exercise: 'Barbell bench press', bodyPart: 'chest', weight: 70 + wk * liftStep, reps: 6 }); }
    if (squatDrop) [[9, 100], [6, 97.5], [2, 95]].forEach(([n, w]) => s.sets.push({ id: 'q' + n, date: ago(n), exercise: 'Back squat', bodyPart: 'legs', weight: w, reps: 5 }));
    localStorage.setItem('gymtracker.v1', JSON.stringify(s));
  }, waist, liftStep, squatDrop);
  await seed([[34, 100], [27, 99.4], [20, 98.9], [14, 98.5], [7, 98.1], [0, 97.6]], 2.5, false);
  await p.reload({ waitUntil: 'networkidle0' });
  let cal = await p.$eval('#calBox', e => e.textContent);
  ok(/Don.t change anything: the recomp is working/.test(cal) && !(await p.$('#calBox [data-cal]')), 'weight flat + waist shrinking + lifts rising: "Don\u2019t change anything", no cut offered');
  // Scenario B: weight and waist both flat -> suggest -150 kcal, Apply changes the target once
  await seed([[34, 99], [27, 99.1], [20, 99], [14, 98.9], [7, 99], [0, 99]], 0, false);
  await p.reload({ waitUntil: 'networkidle0' });
  cal = await p.$eval('#calBox', e => e.textContent);
  ok(/Cut 150 kcal \(from carbs\): weight and waist both flat for [23] weeks/.test(cal) && (await p.$eval('#calBox [data-cal]', e => e.textContent)).includes('2,300 → 2,150'), 'weight AND waist flat: suggests cutting 150 kcal: ' + cal.slice(0, 120));
  await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: SHOTS + '/gt-today-calorie-check.png', fullPage: true });
  await tap('#calBox [data-cal]');
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('gymtracker.v1')).settings);
  ok(st.calTarget === 2150 && st.carbTarget === 193 && (await p.$eval('#calBox', e => e.textContent)).includes('Next check from'), 'Apply: target 2150 kcal (carbs −37.5 g), next check in a week');
  // Deload flag: squat dropped 2 sessions running
  await seed([[14, 99], [0, 99]], 2.5, true);
  await p.reload({ waitUntil: 'networkidle0' });
  ok(!!(await p.$('#deloadFlag')) && (await p.$eval('#deloadFlag', e => e.textContent)).includes('Back squat dropped 2 sessions running'), 'deload flag: same lift dropped 2 sessions running');
  await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: SHOTS + '/gt-today-flags.png', fullPage: true });
  await tap('#deloadStart'); ok(!(await p.$('#deloadFlag')) && !!(await p.$('#deloadActive')), 'Start deload week: flag replaced by the deload-week note');
  await p.click('[data-v=workout]'); ok(!(await p.$eval('#deloadNote', e => e.hidden)), 'Lift tab shows the deload week (same weights, about half the sets)');
  await p.click('[data-v=progress]'); await new Promise(r => setTimeout(r, 300));
  ok((await p.$eval('#waistNote', e => e.textContent)).includes('Latest 99 cm') && (await p.$eval('#sleepNote', e => e.textContent)).includes('6.5 h average'), 'Progress: waist and sleep charts');
  await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: SHOTS + '/gt-progress.png', fullPage: true });
  await p.click('[data-v=settings]'); ok(await p.$eval('#sForm [name=sleepTarget]', e => e.value) === '7', 'sleep goal in settings (7 h)');
  await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: SHOTS + '/gt-more-backup.png', fullPage: true });
  await p.click('[data-v=today]');
  // delete all
  await p.click('[data-v=settings]'); await p.click('#wipeBtn'); ok(await p.evaluate(() => localStorage.getItem('gymtracker.v1')) === null || await p.evaluate(() => JSON.parse(localStorage.getItem('gymtracker.v1')).sets.length === 0), 'delete all');
  // offline
  await p.setOfflineMode(true); await p.reload({ waitUntil: 'domcontentloaded' }); ok(await p.$eval('#title', e => e.textContent) === 'Today', 'loads offline from SW cache');
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'No JS errors'); await b.close(); process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

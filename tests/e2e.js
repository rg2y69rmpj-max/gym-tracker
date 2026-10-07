// Headless check. Needs: npm i puppeteer-core (outside this folder), Chrome at /usr/bin/google-chrome, and python3 -m http.server 8765 running in the app dir.
const puppeteer = require('puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); const errs = [];
  const ok = (c, m) => { if (!c) errs.push('FAIL ' + m); else console.log('ok -', m); };

  p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => m.type() === 'error' && errs.push('console: ' + m.text()));
  p.on('requestfailed', r => errs.push('reqfail: ' + r.url())); p.on('dialog', d => d.accept(d.type() === 'prompt' ? 'DELETE' : undefined));
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  for (const u of ['manifest.webmanifest','sw.js','plan.json','plan.recomp.json','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon-180.png']) { const r = await p.goto('http://localhost:8765/' + u); if (r.status() !== 200) errs.push(u + ' ' + r.status()); }
  // Seed legacy v1 data, then check it loads and migrates
  await p.goto('http://localhost:8765/', { waitUntil: 'networkidle0' });
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
    const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); s.weights.push({ id: 'x' + i, date: ds, kg: 93 - (13 - i) * 0.4 / 7 }); }
    s.weights = s.weights.filter(w => w.id.startsWith('x')); localStorage.setItem('gymtracker.v1', JSON.stringify(s)); });
  await p.reload({ waitUntil: 'networkidle0' }); await p.waitForFunction(() => document.querySelector('#trendBox').textContent.includes('kg/week'));
  const trend = await p.$eval('#trendBox', e => e.textContent); ok(trend.includes('-0.4 kg/week') && trend.includes('in range'), 'weekly rate shown + in range: ' + trend.replace(/\s+/g, ' ').slice(0, 80));
  // switch plan
  await p.click('[data-v=settings]'); await p.select('#sForm [name=planFile]', 'plan.recomp.json'); await p.click('#sForm button.primary');
  await p.click('[data-v=today]'); await p.waitForFunction(() => !document.querySelector('#planBox').textContent.includes('EXAMPLE'));
  ok(true, 'recomp plan loads: ' + (await p.$eval('#planBox b', e => e.textContent)));
  await p.click('[data-v=progress]'); await new Promise(r => setTimeout(r, 300)); await p.screenshot({ path: '/tmp/gt-progress.png', fullPage: true });
  await p.click('[data-v=today]'); await p.screenshot({ path: '/tmp/gt-today.png' });
  const data = await p.evaluate(() => JSON.parse(localStorage.getItem('gymtracker.v1')));
  ok(data.sets.length === 2 && data.meals.length === 2 && data.water.reduce((a, w) => a + w.ml, 0) === 750 && data.steps.length === 1, 'localStorage persisted');
  // reload persists
  await p.reload({ waitUntil: 'networkidle0' }); ok(await p.evaluate(() => JSON.parse(localStorage.getItem('gymtracker.v1')).meals.length) === 2, 'persists after reload');
  ok(await p.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())), 'service worker registered');
  // delete all
  await p.click('[data-v=settings]'); await p.click('#wipeBtn'); ok(await p.evaluate(() => localStorage.getItem('gymtracker.v1')) === null || await p.evaluate(() => JSON.parse(localStorage.getItem('gymtracker.v1')).sets.length === 0), 'delete all');
  // offline
  await p.setOfflineMode(true); await p.reload({ waitUntil: 'domcontentloaded' }); ok(await p.$eval('#title', e => e.textContent) === 'Today', 'loads offline from SW cache');
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'No JS errors'); await b.close(); process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

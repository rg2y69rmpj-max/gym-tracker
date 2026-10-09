/* UI layer. Depends on GT (logic.js) and Charts (charts.js). */
(function () {
  'use strict';
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let S = GT.load(localStorage), view = 'today', plan = null, editing = null; // editing: {coll,id}
  const save = () => GT.save(localStorage, S);
  const day = () => $('#date').value || GT.today();
  const toast = m => { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, 1800); };
  const r1 = n => Math.round(n * 10) / 10;
  const TITLES = { today: 'Today', workout: 'Workout', cardio: 'Treadmill', meals: 'Meals', weight: 'Body weight', progress: 'Progress', settings: 'Settings' };
  const COLORS = { chest: '#ff6b6b', back: '#5aa9ff', shoulders: '#ffb347', arms: '#c38bff', legs: '#3ddc97', core: '#f7e463' };
  const colorFor = (p, i) => COLORS[p] || ['#ff8fab', '#7ee8fa', '#b8f2a6', '#f9c74f'][i % 4];

  $('#date').value = GT.today();
  $('#date').addEventListener('change', () => { editing = null; render(); });
  $$('#tabs button').forEach(b => b.addEventListener('click', () => show(b.dataset.v)));
  function show(v) { view = v; $$('.view').forEach(s => s.hidden = s.id !== 'v-' + v); $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === v)); $('#title').textContent = TITLES[v]; editing = null; render(); scrollTo(0, 0); }

  function itemRow(main, coll, id) { return `<div class="item"><div class="main">${main}</div><button data-edit="${coll}:${id}">Edit</button><button data-del="${coll}:${id}">✕</button></div>`; }
  document.addEventListener('click', e => {
    const d = e.target.closest('[data-del]'), ed = e.target.closest('[data-edit]');
    if (d) { const [c, id] = d.dataset.del.split(':'); if (confirm('Delete this entry?')) { GT.remove(S, c, id); save(); render(); toast('Deleted'); } }
    if (ed) { const [c, id] = ed.dataset.edit.split(':'); startEdit(c, id); }
  });

  function startEdit(coll, id) {
    const e = S[coll].find(x => x.id === id); if (!e) return; editing = { coll, id };
    if (coll === 'sets') { $('#wPart').value = e.bodyPart; $('#wEx').value = e.exercise; $('#wKg').value = e.weight; $('#wReps').value = e.reps; $('#addSet').textContent = 'Save set'; scrollTo(0, 0); onEx(); return; }
    const f = { treadmill: '#tForm', meals: '#mForm', weights: '#bwForm', waist: '#waistForm' }[coll];
    for (const el of $(f).elements) if (el.name && el.name in e) el.value = e[el.name] ?? '';
    $(f).querySelector('button.primary').textContent = 'Save changes'; $(f).scrollIntoView({ behavior: 'smooth' });
  }
  function resetForm(f, label) { $(f).reset(); $(f).querySelector('button.primary').textContent = label; }
  function formData(f) { const o = {}; for (const el of $(f).elements) if (el.name) o[el.name] = el.value; return o; }
  function submitColl(f, coll, label, fix) {
    $(f).addEventListener('submit', ev => { ev.preventDefault(); const o = fix ? fix(formData(f)) : formData(f);
      if (editing && editing.coll === coll) { const tmp = GT.add(GT.emptyState(), coll, o); delete tmp.id; delete tmp.date; GT.update(S, coll, editing.id, tmp); editing = null; toast('Saved'); }
      else { GT.add(S, coll, { ...o, date: day() }); toast('Added'); }
      save(); resetForm(f, label); render(); });
  }
  submitColl('#tForm', 'treadmill', 'Add treadmill session');
  submitColl('#mForm', 'meals', 'Add meal');
  submitColl('#bwForm', 'weights', 'Log');
  submitColl('#waistForm', 'waist', 'Log waist');

  /* ---------- workout ---------- */
  function fillParts() { $('#wPart').innerHTML = GT.bodyParts(S).map(p => `<option>${esc(p)}</option>`).join(''); }
  function fillExList() { const p = $('#wPart').value; const ex = S.exercises.filter(e => e.bodyPart === p).concat(S.exercises.filter(e => e.bodyPart !== p));
    $('#exList').innerHTML = ex.map(e => `<option value="${esc(e.name)}">${esc(e.bodyPart)}</option>`).join(''); }
  $('#wPart').addEventListener('change', fillExList);
  $('#addPart').addEventListener('click', () => { const n = prompt('New body part name'); const p = GT.addBodyPart(S, n); if (p) { save(); fillParts(); $('#wPart').value = p; fillExList(); } });
  function onEx() {
    const name = $('#wEx').value.trim(); const ex = S.exercises.find(e => e.name.toLowerCase() === name.toLowerCase());
    if (ex && !editing) $('#wPart').value = ex.bodyPart;
    const prev = ex && GT.previousSession(S, ex.name, day());
    $('#prevBox').innerHTML = prev ? `Last time (${prev.date}): ${prev.sets.map(s => `<b>${s.weight}×${s.reps}</b>`).join(', ')}` : (ex ? 'No previous session for this exercise.' : '');
    const last = ex && GT.lastSet(S, ex.name);
    if (last && !editing && !$('#wKg').value && !$('#wReps').value) { $('#wKg').placeholder = last.weight; $('#wReps').placeholder = last.reps; }
  }
  $('#wEx').addEventListener('input', onEx); $('#wEx').addEventListener('change', onEx);
  $('#addSet').addEventListener('click', () => {
    const exercise = $('#wEx').value.trim(); if (!exercise) return toast('Pick an exercise');
    const weight = $('#wKg').value || $('#wKg').placeholder, reps = $('#wReps').value || $('#wReps').placeholder;
    if (reps === '' || reps == null) return toast('Enter reps');
    if (editing && editing.coll === 'sets') { GT.ensureExercise(S, exercise, $('#wPart').value); GT.update(S, 'sets', editing.id, { exercise, bodyPart: $('#wPart').value, weight: +weight || 0, reps: +reps || 0 }); editing = null; $('#addSet').textContent = 'Add set'; toast('Saved'); }
    else { GT.add(S, 'sets', { date: day(), exercise, bodyPart: $('#wPart').value, weight, reps }); toast(`Set: ${+weight || 0} kg × ${reps}`); }
    save(); $('#wKg').placeholder = +weight || 0; $('#wReps').placeholder = reps; $('#wKg').value = $('#wReps').value = ''; render();
  });
  $('#repeatSet').addEventListener('click', () => {
    const name = $('#wEx').value.trim(); const l = name ? GT.lastSet(S, S.exercises.find(e => e.name.toLowerCase() === name.toLowerCase())?.name) : S.sets[S.sets.length - 1];
    if (!l) return toast('No previous set');
    GT.add(S, 'sets', { date: day(), exercise: l.exercise, bodyPart: l.bodyPart, weight: l.weight, reps: l.reps }); save();
    $('#wEx').value = l.exercise; toast(`Repeated ${l.weight} kg × ${l.reps}`); render();
  });
  function renderWorkout() {
    const dl = GT.deloadCheck(S, day()); $('#deloadNote').hidden = !dl.active; if (dl.active) $('#deloadNote').innerHTML = `<span class="pill ex">Deload week</span> until ${esc(dl.until)}: same weights, about half the sets.`;
    const cur = $('#wPart').value; fillParts(); if (cur) $('#wPart').value = cur; fillExList(); onEx();
    const sets = S.sets.filter(s => s.date === day()); const groups = {};
    sets.forEach(s => (groups[s.exercise] = groups[s.exercise] || []).push(s));
    $('#setList').innerHTML = Object.entries(groups).map(([ex, ss]) => `<div class="muted small" style="margin-top:8px"><b>${esc(ex)}</b> · ${esc(ss[0].bodyPart)}</div>` +
      ss.map((s, i) => itemRow(`Set ${i + 1}: <b>${s.weight} kg × ${s.reps}</b>`, 'sets', s.id)).join('')).join('') || '<p class="muted">No sets yet.</p>';
  }

  /* ---------- meals / cardio / weight ---------- */
  function bar(label, v, t, unit) { const pct = t ? Math.min(100, v / t * 100) : 0;
    return `<div class="small">${label}: <b>${Math.round(v)}</b> / ${t} ${unit} <span class="muted">(${t - v >= 0 ? Math.round(t - v) + ' left' : Math.round(v - t) + ' over'})</span></div><div class="bar ${v > t ? 'over' : ''}"><i style="width:${pct}%"></i></div>`; }
  function minBar(label, v, t, unit) { const pct = t ? Math.min(100, v / t * 100) : 0; const ok = v >= t;
    return `<div class="small">${label}: <b>${r1(v)}</b> / ≥${t} ${unit} ${ok ? '<span class="pill ok">✓</span>' : `<span class="muted">(${r1(t - v)} to go)</span>`}</div><div class="bar"><i style="width:${pct}%"></i></div>`; }
  function stepsBar(v) { const { stepsMin: lo, stepsMax: hi } = S.settings; const pct = Math.min(100, v / hi * 100);
    const tag = v >= lo && v <= hi ? '<span class="pill ok">in range</span>' : v > hi ? '<span class="pill ok">above range</span>' : `<span class="muted">(${lo - v} to ${lo})</span>`;
    return `<div class="small">Steps: <b>${v}</b> / ${lo}–${hi} ${tag}</div><div class="bar"><i style="width:${pct}%"></i></div>`; }
  function sleepBar(h) { const t = +S.settings.sleepTarget || 7;
    if (h == null) return `<div class="small">Sleep: <span class="muted">not logged (goal ≥${t} h)</span></div><div class="bar"><i style="width:0%"></i></div>`;
    return minBar('Sleep', h, t, 'h'); }
  /* ---------- weekly calorie check, deload flag, photo reminder (plan v2) ---------- */
  const kcal = n => Math.round(n).toLocaleString('en');
  function calHTML() {
    const c = GT.calorieCheck(S, day());
    const pill = { add: '<span class="pill ex">+150 kcal</span>', cut: '<span class="pill ex">−150 kcal</span>', hold: '<span class="pill ok">no change</span>', review: '<span class="pill bad">review plan</span>', wait: '<span class="pill">waiting for data</span>' }[c.action];
    let h = `<h2>Weekly calorie check</h2><div class="small" data-cal-action="${c.action}">${pill} <b>${esc(c.title)}</b></div>`;
    if (c.reasons.length) h += '<ul class="small muted reasons">' + c.reasons.map(r => `<li>${esc(r)}</li>`).join('') + '</ul>';
    if (c.action === 'add' || c.action === 'cut') h += `<button type="button" class="sm" data-cal="${c.kcal}">Apply: ${kcal(c.target)} → ${kcal(c.target + c.kcal)} kcal${c.kcal < 0 ? ' (from carbs)' : ''}</button>`;
    return h + `<p class="muted small">Checked weekly from your 7-day average weight, weekly waist and main lifts. Only suggests a cut when weight and waist are both flat for 2–3 weeks.</p>`;
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-cal]'); if (!b) return; const k = +b.dataset.cal;
    GT.applyCalorieChange(S, k, day()); save(); render(); toast(`Calorie target ${k > 0 ? '+' : ''}${k}: now ${kcal(S.settings.calTarget)} kcal`); });
  function flagsHTML() {
    let h = ''; const d = GT.deloadCheck(S, day()), ph = GT.photoReminder(S, day());
    if (d.suggest) h += `<div class="card flag" id="deloadFlag"><h2>Deload suggested</h2><ul class="small reasons">${d.reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` +
      '<p class="small muted">For one week: same weights, about half the sets.</p><div class="row"><button type="button" class="primary grow" id="deloadStart">Start deload week</button><button type="button" class="ghost sm" id="deloadLater">Not now</button></div></div>';
    if (d.active) h += `<div class="card flag small" id="deloadActive"><span class="pill ex">Deload week</span> until ${esc(d.until)}: same weights, about half the sets.</div>`;
    if (ph.due) h += `<div class="card flag" id="photoFlag"><h2>Progress photos</h2><p class="small">${ph.last ? `It's been ${ph.days} days since your last photos.` : 'Take your starting photos.'} Front, side and back, same light and time of day. Use the Camera app; the photos stay in your Photos library (this app doesn't store them).</p>` +
      '<div class="row"><button type="button" class="primary grow" id="photoDone">Done, taken today</button><button type="button" class="ghost sm" id="photoLater">In 2 days</button></div></div>';
    return h;
  }
  document.addEventListener('click', e => {
    const id = e.target.closest('button') && e.target.closest('button').id; if (!id) return;
    if (id === 'deloadStart') { GT.add(S, 'deloads', { date: day() }); save(); render(); toast('Deload week started'); }
    else if (id === 'deloadLater') { S.settings.deloadSnoozeUntil = GT.addDays(day(), 7); save(); render(); }
    else if (id === 'photoDone') { GT.add(S, 'photos', { date: day() }); save(); render(); toast('Photos logged. Next reminder in 4 weeks'); }
    else if (id === 'photoLater') { S.settings.photoSnoozeUntil = GT.addDays(day(), 2); save(); render(); }
  });
  function calTarget() { return GT.calTargetFor(S, day(), plan && !plan.error ? plan : null); }
  function totalsHTML(full) { const t = GT.dayTotals(S, day()), st = S.settings;
    const cyc = st.carbCycling ? ` <span class="pill">${GT.dayType(plan, day())} day</span>` : '';
    let h = bar('Calories', t.calories, calTarget(), 'kcal' + cyc) + bar('Protein', t.protein, st.proteinTarget, 'g');
    if (full) h += bar('Carbs', t.carbs, st.carbTarget, 'g') + bar('Fat', t.fat, st.fatTarget, 'g') + minBar('Fibre', t.fibre, st.fibreTarget, 'g') + minBar('Water', t.waterL, st.waterTarget, 'L') + stepsBar(t.steps) + sleepBar(t.sleep);
    return h; }
  function trendHTML() { const tr = GT.weightTrend(S, day()), st = S.settings;
    if (tr.status === 'need-data') return `<h2>Weight trend</h2><p class="muted small">Need weigh-ins in this week and the week before to work out a weekly rate. Goal: lose ${st.lossMin}–${st.lossMax} kg/week (7-day average). Start: ${st.startWeight} kg.</p>`;
    const pill = { 'in-range': '<span class="pill ok">in range</span>', 'too-slow': '<span class="pill ex">slower than goal</span>', 'too-fast': '<span class="pill bad">faster than goal</span>' }[tr.status];
    return `<h2>Weight trend</h2><div>7-day avg <b>${r1(tr.avg)} kg</b> · <b>${tr.rate > 0 ? '+' : ''}${(Math.round(tr.rate * 100) / 100)} kg/week</b> ${pill}</div><p class="muted small">Goal: lose ${st.lossMin}–${st.lossMax} kg/week. Prev week avg ${r1(tr.prevAvg)} kg.</p>`; }
  function renderMeals() {
    $('#mealTotals').innerHTML = totalsHTML(true).split('<div class="small">Water')[0];
    if (!editing) $('#mForm').time.value = GT.nowTime();
    $('#mealNames').innerHTML = [...new Set(S.meals.map(m => m.name))].map(n => `<option value="${esc(n)}">`).join('');
    const ms = S.meals.filter(m => m.date === day()).sort((a, b) => a.time < b.time ? -1 : 1);
    $('#mList').innerHTML = ms.map(m => itemRow(`<b>${esc(m.name)}</b> <span class="muted small">${esc(m.time)}</span><br><span class="small">${m.calories} kcal · ${m.protein} g P · ${m.carbs || 0} C · ${m.fat || 0} F · ${m.fibre || 0} fibre</span>`, 'meals', m.id)).join('') || '<p class="muted">No meals logged.</p>';
  }
  // Re-use a previous meal's numbers when picking its name
  $('#mForm').name.addEventListener('change', e => { const m = [...S.meals].reverse().find(x => x.name === e.target.value); if (m && !$('#mForm').calories.value) { $('#mForm').calories.value = m.calories; $('#mForm').protein.value = m.protein; for (const k of ['carbs', 'fat', 'fibre']) $('#mForm')[k].value = m[k] || ''; } });
  // Auto-fill distance from speed×duration
  $('#tForm').addEventListener('input', e => { const f = $('#tForm'); if ((e.target.name === 'speed' || e.target.name === 'duration') && f.speed.value && f.duration.value && !f.distance.dataset.manual) f.distance.value = Math.round(f.speed.value * f.duration.value / 60 * 100) / 100; if (e.target.name === 'distance') f.distance.dataset.manual = 1; });
  function tmLine(t) { return [t.duration != null && `${t.duration} min`, t.distance != null && `${t.distance} km`, t.speed != null && `${t.speed} km/h`, t.incline != null && `${t.incline}%`, t.calories != null && `${t.calories} kcal`].filter(Boolean).join(' · '); }
  function renderCardio() {
    const ts = [...S.treadmill].sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 30);
    $('#tList').innerHTML = ts.map(t => itemRow(`<b>${t.date}</b><br><span class="small">${tmLine(t)}</span>`, 'treadmill', t.id)).join('') || '<p class="muted">No sessions yet.</p>';
  }
  function bwSeries() { return [...S.weights].sort((a, b) => a.date < b.date ? -1 : 1).map(w => ({ x: w.date, y: w.kg })); }
  function avg7(pts) { return pts.map((p, i) => { const from = new Date(p.x + 'T00:00:00'); from.setDate(from.getDate() - 6); const f = GT.today(from); const w = pts.filter(q => q.x >= f && q.x <= p.x); return { x: p.x, y: r1(w.reduce((a, q) => a + q.y, 0) / w.length) }; }); }
  function renderWeight() {
    const ws = [...S.weights].sort((a, b) => a.date < b.date ? 1 : -1);
    $('#bwList').innerHTML = ws.map(w => itemRow(`<b>${w.kg} kg</b> <span class="muted small">${w.date}</span>`, 'weights', w.id)).join('') || '<p class="muted">No entries.</p>';
    $('#trendBox2').innerHTML = trendHTML(); $('#calBox2').innerHTML = calHTML();
    const wa = [...S.waist].sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 8);
    $('#waistList').innerHTML = wa.map(w => itemRow(`<b>${w.cm} cm</b> <span class="muted small">${w.date}</span>`, 'waist', w.id)).join('') || '<p class="muted small">No waist measurements yet.</p>';
    const pts = bwSeries(); Charts.line($('#cBwSmall'), [{ label: 'kg', color: '#5aa9ff', points: pts }, { label: '7-day avg', color: '#3ddc97', points: avg7(pts), dashed: true }], { height: 160 });
  }

  /* ---------- progress ---------- */
  function lastNDays(n) { const out = [], d = new Date(day() + 'T00:00:00'); for (let i = n - 1; i >= 0; i--) { const x = new Date(d); x.setDate(d.getDate() - i); out.push(GT.today(x)); } return out; }
  function renderProgress() {
    const used = [...new Set(S.sets.map(s => s.exercise))].sort(); const sel = $('#pEx'); const cur = sel.value;
    sel.innerHTML = used.map(e => `<option>${esc(e)}</option>`).join('') || '<option value="">No exercises logged</option>'; if (used.includes(cur)) sel.value = cur;
    const pr = sel.value ? GT.exerciseProgress(S, sel.value) : [];
    Charts.line($('#cEx'), [{ label: 'Top set kg', color: '#3ddc97', points: pr.map(p => ({ x: p.date, y: p.top })) }, { label: 'Best est. 1RM', color: '#ffb347', points: pr.map(p => ({ x: p.date, y: r1(p.best1rm) })) }]);
    $('#pExNote').textContent = pr.length ? `All-time top set: ${Math.max(...pr.map(p => p.top))} kg · est. 1RM (Epley): ${r1(Math.max(...pr.map(p => p.best1rm)))} kg` : '';
    const vol = GT.weeklyVolume(S), weeks = Object.keys(vol).sort().slice(-10), parts = [...new Set(weeks.flatMap(w => Object.keys(vol[w])))];
    Charts.bars($('#cVol'), weeks, parts.map((p, i) => ({ label: p, color: colorFor(p, i), values: weeks.map(w => vol[w][p] || 0) })));
    const days = lastNDays(14).filter((d, i, a) => S.meals.some(m => m.date === d) || i === a.length - 1);
    const tot = days.map(d => ({ d, t: GT.dayTotals(S, d) }));
    Charts.line($('#cCal'), [{ label: 'kcal', color: '#ff6b6b', points: tot.map(o => ({ x: o.d, y: o.t.calories })) }, { label: 'target', color: '#8b93a3', dashed: true, points: tot.map(o => ({ x: o.d, y: GT.calTargetFor(S, o.d, plan && !plan.error ? plan : null) })) }], { zero: true });
    Charts.line($('#cPro'), [{ label: 'protein g', color: '#c38bff', points: tot.map(o => ({ x: o.d, y: o.t.protein })) }, { label: 'target', color: '#8b93a3', dashed: true, points: tot.map(o => ({ x: o.d, y: +S.settings.proteinTarget })) }], { zero: true });
    const pts = bwSeries(); Charts.line($('#cBw'), [{ label: 'kg', color: '#5aa9ff', points: pts }, { label: '7-day avg', color: '#3ddc97', points: avg7(pts), dashed: true }]);
    const T = GT.treadmillTotals(S);
    $('#tTotals').innerHTML = `<span class="pill">${T.sessions} sessions</span><span class="pill">${r1(T.minutes)} min</span><span class="pill">${r1(T.km)} km</span><span class="pill">${Math.round(T.calories)} kcal</span>`;
    const tw = {}; S.treadmill.forEach(t => { const w = GT.weekStart(t.date); tw[w] = (tw[w] || 0) + (+t.duration || 0); }); const wk = Object.keys(tw).sort().slice(-10);
    Charts.bars($('#cTm'), wk, [{ label: 'minutes / week', color: '#5aa9ff', values: wk.map(w => tw[w]) }], { height: 160 });
    const wp = [...S.waist].sort((a, b) => a.date < b.date ? -1 : 1).map(w => ({ x: w.date, y: w.cm }));
    Charts.line($('#cWaist'), [{ label: 'waist cm', color: '#ffb347', points: wp }], { height: 160 });
    const wc = GT.waistChange(S, day()); $('#waistNote').textContent = wp.length ? `Latest ${wp[wp.length - 1].y} cm` + (wc ? ` · ${wc.change > 0 ? '+' : ''}${wc.change} cm over ${Math.round(wc.days / 7)} weeks` : '') : 'Log your waist weekly on the Weight tab.';
    const sd = lastNDays(14), sl = sd.map(d => ({ d, h: GT.dayTotals(S, d).sleep })).filter(o => o.h != null), stg = +S.settings.sleepTarget || 7;
    Charts.line($('#cSleep'), [{ label: 'hours', color: '#7ee8fa', points: sl.map(o => ({ x: o.d, y: o.h })) }, { label: 'goal', color: '#8b93a3', dashed: true, points: sl.map(o => ({ x: o.d, y: stg })) }], { height: 160, zero: true });
    const l7 = sl.filter(o => o.d >= GT.addDays(day(), -6)); $('#sleepNote').textContent = l7.length ? `Last 7 days: ${r1(l7.reduce((a, o) => a + o.h, 0) / l7.length)} h average (${l7.filter(o => o.h >= stg).length}/${l7.length} nights at ≥${stg} h)` : 'Log sleep on the Today tab.';
  }

  /* ---------- today + plan ---------- */
  const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  async function loadPlan() {
    try { const r = await fetch(S.settings.planFile || 'plan.json', { cache: 'no-cache' }); plan = await r.json(); } catch (e) { plan = { error: String(e) }; }
    if (view === 'today') renderToday();
  }
  function renderToday() {
    const sets = S.sets.filter(s => s.date === day()), tm = S.treadmill.filter(t => t.date === day()), w = S.weights.find(x => x.date === day());
    $('#todaySummary').innerHTML = totalsHTML(true) + `<div class="small"><span class="pill">${sets.length} sets</span><span class="pill">${tm.reduce((a, t) => a + (+t.duration || 0), 0)} treadmill min</span><span class="pill">${w ? w.kg + ' kg' : 'no weigh-in'}</span></div>`;
    const t = GT.dayTotals(S, day()); $('#stepsForm').steps.value = t.steps || ''; $('#sleepForm').hours.value = t.sleep ?? ''; $('#trendBox').innerHTML = trendHTML();
    $('#calBox').innerHTML = calHTML(); $('#flagsBox').innerHTML = flagsHTML();
    if (!plan) return; if (plan.error) { $('#planBox').innerHTML = `<p class="muted">Couldn't load plan: ${esc(plan.error)}</p>`; return; }
    const key = DOW[new Date(day() + 'T00:00:00').getDay()], p = plan.days && plan.days[key];
    let h = `<div class="small" style="margin-bottom:6px">${plan.example ? '<span class="pill ex">EXAMPLE plan</span>' : '<span class="pill ok">Plan</span>'} ${esc(plan.name || '')}</div>`;
    if (!p) h += '<p class="muted">Nothing scheduled.</p>';
    else {
      h += `<div><b>${esc(p.title)}</b></div>` + (p.notes ? `<p class="muted small">${esc(p.notes)}</p>` : '');
      (p.exercises || []).forEach((e, i) => { const prev = GT.previousSession(S, e.name, day()); const done = sets.filter(s => s.exercise === e.name).length;
        const top = parseInt(String(e.reps).split(/[–-]/).pop()); const up = GT.readyToProgress(S, e.name, top);
        h += `<div class="plan-ex"><button data-plan="${i}">Log</button><b>${esc(e.name)}</b><br><span class="small">${e.sets} × ${esc(e.reps)}${e.note ? ' · ' + esc(e.note) : ''}</span><br><span class="muted small">${done}/${e.sets} done${prev ? ` · last ${prev.sets.map(s => s.weight + '×' + s.reps).join(', ')}` : ''}</span>${up ? ' <span class="pill ok">↑ add weight</span>' : ''}</div>`; });
      if (p.cardio) h += `<div class="plan-ex"><b>🏃 ${esc(p.cardio)}</b></div>`;
    }
    $('#planBox').innerHTML = h;
    $$('[data-plan]').forEach(b => b.addEventListener('click', () => { const e = p.exercises[+b.dataset.plan]; GT.ensureExercise(S, e.name, e.bodyPart); save(); show('workout'); $('#wEx').value = e.name; if (e.bodyPart) $('#wPart').value = e.bodyPart; onEx(); $('#wKg').focus(); }));
  }

  document.addEventListener('click', e => { const b = e.target.closest('[data-water]'); if (!b) return; const e2 = GT.add(S, 'water', { date: day(), ml: +b.dataset.water }); if (!e2) return toast('Water is already 0'); save(); render(); toast(`Water ${e2.ml > 0 ? '+' : ''}${e2.ml} ml`); });
  $('#sleepForm').addEventListener('submit', e => { e.preventDefault(); const v = $('#sleepForm').hours.value; if (v === '') return toast('Enter hours slept'); GT.add(S, 'sleep', { date: day(), hours: v }); save(); render(); toast('Sleep saved'); });
  $('#stepsForm').addEventListener('submit', e => { e.preventDefault(); GT.add(S, 'steps', { date: day(), steps: $('#stepsForm').steps.value }); save(); render(); toast('Steps saved'); });
  /* ---------- settings ---------- */
  $('#sForm').addEventListener('submit', ev => { ev.preventDefault(); const o = formData('#sForm');
    for (const k of ['calTarget', 'proteinTarget', 'carbTarget', 'fatTarget', 'fibreTarget', 'waterTarget', 'stepsMin', 'stepsMax', 'calWeightDay', 'calOtherDay', 'lossMin', 'lossMax', 'sleepTarget']) S.settings[k] = +o[k] || 0;
    S.settings.carbCycling = $('#sForm').carbCycling.checked;
    const pf = o.planFile !== S.settings.planFile; S.settings.planFile = o.planFile; save(); toast('Settings saved'); if (pf) loadPlan(); });
  function renderSettings() {
    const f = $('#sForm'); for (const k of ['calTarget', 'proteinTarget', 'carbTarget', 'fatTarget', 'fibreTarget', 'waterTarget', 'stepsMin', 'stepsMax', 'calWeightDay', 'calOtherDay', 'lossMin', 'lossMax', 'sleepTarget']) f[k].value = S.settings[k];
    f.carbCycling.checked = !!S.settings.carbCycling; f.planFile.value = S.settings.planFile;
    $('#exManage').innerHTML = S.exercises.map((e, i) => `<div class="item"><div class="main">${esc(e.name)} <span class="muted small">${esc(e.bodyPart)}</span></div><button data-exdel="${i}">✕</button></div>`).join('');
    $$('[data-exdel]').forEach(b => b.addEventListener('click', () => { const e = S.exercises[+b.dataset.exdel]; if (confirm(`Remove "${e.name}" from the list? Logged sets are kept.`)) { S.exercises.splice(+b.dataset.exdel, 1); save(); renderSettings(); } }));
    renderBackup();
  }
  /* ---------- backup + restore ---------- */
  let pendingRestore = null;
  const fmtWhen = t => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const dayWord = n => (n === 0 ? 'today' : n === 1 ? 'yesterday' : n + ' days ago');
  const backupSay = (t, err) => { const el = $('#backupMsg'); el.className = 'small ' + (err ? 'err-t' : 'muted'); el.textContent = t; if (t && view !== 'settings') toast(t); };
  function renderBackup() {
    const m = GT.loadBackupMeta(localStorage), r = GT.backupReminder(m);
    $('#backupLast').innerHTML = m.lastAt ? `Last backup: <b>${esc(fmtWhen(m.lastAt))}</b> (${dayWord(r.daysSince)})${r.due ? ' · <span class="pill ex">time for a new one</span>' : ''}` : 'No backup made on this device yet.';
  }
  function renderNudge() {
    const el = $('#backupNudge'), r = GT.backupReminder(GT.loadBackupMeta(localStorage));
    el.hidden = !(r.due && GT.backupSummary(S).entries > 0);
    if (el.hidden) return;
    el.innerHTML = `<p>${r.never ? 'No backup yet' : 'Last backup ' + r.daysSince + ' days ago'}. A quick backup keeps your logs safe if iOS clears the app\u2019s data.</p>` +
      '<div class="row"><button type="button" class="primary grow" id="nudgeBackup">Back up now</button><button type="button" class="ghost sm" id="nudgeLater">Later</button></div>';
  }
  $('#backupNudge').addEventListener('click', e => {
    if (e.target.closest('#nudgeBackup')) backupNow().then(renderNudge);
    if (e.target.closest('#nudgeLater')) { const m = GT.loadBackupMeta(localStorage); m.snoozeUntil = Date.now() + 3 * GT.DAY; GT.saveBackupMeta(localStorage, m); renderNudge(); }
  });
  async function backupNow() {
    const txt = GT.exportJSON(S), name = GT.backupFileName(), file = new File([txt], name, { type: 'application/json' });
    let how = 'download';
    if (navigator.share && navigator.canShare) {
      let can = false; try { can = navigator.canShare({ files: [file] }); } catch (e) { can = false; }
      if (can) {
        try { await navigator.share({ files: [file], title: name }); how = 'share'; }
        catch (e) { if (e && e.name === 'AbortError') { backupSay('Backup cancelled, nothing was saved.'); return false; } how = 'download'; }
      }
    }
    if (how === 'download') {
      const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    }
    const m = GT.loadBackupMeta(localStorage); m.lastAt = Date.now(); m.snoozeUntil = 0; GT.saveBackupMeta(localStorage, m);
    backupSay(how === 'share' ? `Backed up: ${name}.` : `Backup downloaded: ${name}.`);
    if (view === 'settings') renderBackup();
    return true;
  }
  $('#backupBtn').addEventListener('click', () => backupNow());
  $('#restoreBtn').addEventListener('click', () => $('#restoreFile').click());
  $('#restoreFile').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    $('#restorePreview').hidden = true; pendingRestore = null;
    let parsed;
    try { parsed = GT.parseBackup(await f.text()); } catch (err) { backupSay('Can\u2019t restore: ' + err.message, true); return; }
    pendingRestore = parsed; renderRestorePreview(parsed, f.name); backupSay('');
  });
  const dd = n => n + (n === 1 ? ' day' : ' days');
  function renderRestorePreview(p, fname) {
    const now = GT.backupSummary(S), b = p.summary;
    const row = (label, cur, next) => `<tr><td>${label}</td><td>${cur}</td><td>${next}</td></tr>`;
    const span = x => (x.from ? (x.from === x.to ? x.from : `${x.from} to ${x.to}`) : 'nothing logged');
    $('#restorePreview').innerHTML = `<h3>Restore \u201c${esc(fname)}\u201d?</h3><p>Backup made ${p.createdAt ? esc(fmtWhen(p.createdAt)) : '(date unknown)'}. What\u2019s on this phone and in the file:</p>` +
      '<table id="restoreTable"><tr><th></th><th>Now</th><th>From backup</th></tr>' +
      row('Workout sets', `${now.sets} (${dd(now.workoutDays)})`, `${b.sets} (${dd(b.workoutDays)})`) + row('Treadmill sessions', now.treadmill, b.treadmill) +
      row('Meals', now.meals, b.meals) + row('Weigh-ins', now.weights, b.weights) + row('Water (days)', now.waterDays, b.waterDays) + row('Steps (days)', now.stepDays, b.stepDays) + row('Sleep (nights)', now.sleepDays, b.sleepDays) + row('Waist entries', now.waist, b.waist) +
      row('Exercises in list', now.exercises, b.exercises) + row('Dates', span(now), span(b)) + row('Settings', 'current', 'from backup') + '</table>' +
      '<p class="muted"><b>Merge</b> keeps everything on this phone and adds the entries that are only in the backup (for sleep, steps and waist, the phone\u2019s entry for a day wins); your settings stay. <b>Replace</b> makes this phone match the backup, settings included. Neither can be undone: back up first if unsure.</p>' +
      '<div class="row"><button type="button" class="primary grow" id="restoreMerge">Merge</button><button type="button" class="danger grow" id="restoreGo">Replace</button><button type="button" class="ghost sm" id="restoreCancel">Cancel</button></div>';
    $('#restorePreview').hidden = false; $('#restorePreview').scrollIntoView({ block: 'center' });
  }
  $('#restorePreview').addEventListener('click', e => {
    if (e.target.closest('#restoreCancel')) { pendingRestore = null; $('#restorePreview').hidden = true; backupSay('Restore cancelled. Nothing changed.'); return; }
    if (e.target.closest('#restoreMerge') && pendingRestore) {
      const m = GT.mergeBackup(S, pendingRestore.data), a = m.added; pendingRestore = null; S = m.state; save(); editing = null;
      $('#restorePreview').hidden = true; render(); renderBackup();
      backupSay(m.total ? `Merged: added ${a.sets} sets, ${a.meals} meals, ${a.weights} weigh-ins, ${a.treadmill} treadmill sessions, ${a.sleep} sleep, ${a.waist} waist entries${a.exercises ? ', ' + a.exercises + ' exercises' : ''}. Nothing on this phone was changed.` : 'Merged: everything in the backup is already on this phone.');
      toast('Merged backup'); return;
    }
    if (!e.target.closest('#restoreGo') || !pendingRestore) return;
    const planChanged = pendingRestore.data.settings.planFile !== S.settings.planFile, n = pendingRestore.summary;
    S = pendingRestore.data; pendingRestore = null; save(); editing = null;
    $('#restorePreview').hidden = true; render(); renderBackup();
    backupSay(`Restored: ${n.sets} sets, ${n.meals} meals, ${n.weights} weigh-ins, ${n.treadmill} treadmill sessions.`); toast('Restored from backup');
    if (planChanged) loadPlan();
  });
  $('#wipeBtn').addEventListener('click', () => { if (confirm('Delete ALL gym tracker data on this device? This cannot be undone.') && prompt('Type DELETE to confirm') === 'DELETE') { localStorage.removeItem(GT.KEY); S = GT.emptyState(); render(); toast('All data deleted'); } });

  function render() { renderNudge(); ({ today: renderToday, workout: renderWorkout, cardio: renderCardio, meals: renderMeals, weight: renderWeight, progress: renderProgress, settings: renderSettings })[view](); }
  addEventListener('resize', () => { if (view === 'progress' || view === 'weight') render(); });
  GT.loadBackupMeta(localStorage); // first use: the backup reminder counts from today
  render(); loadPlan();
  // Updates: check for a new sw.js on every launch and whenever the app comes back to the foreground (iOS keeps Home Screen apps alive),
  // never from the HTTP cache; when the new version takes over, reload once so the new files are used.
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    const hadCtrl = !!navigator.serviceWorker.controller; let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadCtrl && !reloaded) { reloaded = true; location.reload(); } });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
      reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
    }).catch(() => {});
  }
})();

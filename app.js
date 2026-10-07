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
    const f = { treadmill: '#tForm', meals: '#mForm', weights: '#bwForm' }[coll];
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
  function calTarget() { return GT.calTargetFor(S, day(), plan && !plan.error ? plan : null); }
  function totalsHTML(full) { const t = GT.dayTotals(S, day()), st = S.settings;
    const cyc = st.carbCycling ? ` <span class="pill">${GT.dayType(plan, day())} day</span>` : '';
    let h = bar('Calories', t.calories, calTarget(), 'kcal' + cyc) + bar('Protein', t.protein, st.proteinTarget, 'g');
    if (full) h += bar('Carbs', t.carbs, st.carbTarget, 'g') + bar('Fat', t.fat, st.fatTarget, 'g') + minBar('Fibre', t.fibre, st.fibreTarget, 'g') + minBar('Water', t.waterL, st.waterTarget, 'L') + stepsBar(t.steps);
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
    $('#trendBox2').innerHTML = trendHTML();
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
    const t = GT.dayTotals(S, day()); $('#stepsForm').steps.value = t.steps || ''; $('#trendBox').innerHTML = trendHTML();
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
  $('#stepsForm').addEventListener('submit', e => { e.preventDefault(); GT.add(S, 'steps', { date: day(), steps: $('#stepsForm').steps.value }); save(); render(); toast('Steps saved'); });
  /* ---------- settings ---------- */
  $('#sForm').addEventListener('submit', ev => { ev.preventDefault(); const o = formData('#sForm');
    for (const k of ['calTarget', 'proteinTarget', 'carbTarget', 'fatTarget', 'fibreTarget', 'waterTarget', 'stepsMin', 'stepsMax', 'calWeightDay', 'calOtherDay', 'lossMin', 'lossMax']) S.settings[k] = +o[k] || 0;
    S.settings.carbCycling = $('#sForm').carbCycling.checked;
    const pf = o.planFile !== S.settings.planFile; S.settings.planFile = o.planFile; save(); toast('Settings saved'); if (pf) loadPlan(); });
  function renderSettings() {
    const f = $('#sForm'); for (const k of ['calTarget', 'proteinTarget', 'carbTarget', 'fatTarget', 'fibreTarget', 'waterTarget', 'stepsMin', 'stepsMax', 'calWeightDay', 'calOtherDay', 'lossMin', 'lossMax']) f[k].value = S.settings[k];
    f.carbCycling.checked = !!S.settings.carbCycling; f.planFile.value = S.settings.planFile;
    $('#exManage').innerHTML = S.exercises.map((e, i) => `<div class="item"><div class="main">${esc(e.name)} <span class="muted small">${esc(e.bodyPart)}</span></div><button data-exdel="${i}">✕</button></div>`).join('');
    $$('[data-exdel]').forEach(b => b.addEventListener('click', () => { const e = S.exercises[+b.dataset.exdel]; if (confirm(`Remove "${e.name}" from the list? Logged sets are kept.`)) { S.exercises.splice(+b.dataset.exdel, 1); save(); renderSettings(); } }));
  }
  $('#exportBtn').addEventListener('click', async () => {
    const txt = GT.exportJSON(S), name = `gym-tracker-${GT.today()}.json`, file = new File([txt], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $('#importFile').addEventListener('change', async e => { const f = e.target.files[0]; if (!f) return;
    try { const d = GT.importJSON(await f.text()); if (confirm(`Replace current data with import (${d.sets.length} sets, ${d.meals.length} meals)?`)) { S = d; save(); render(); toast('Imported'); } } catch (err) { alert('Import failed: ' + err.message); }
    e.target.value = ''; });
  $('#wipeBtn').addEventListener('click', () => { if (confirm('Delete ALL gym tracker data on this device? This cannot be undone.') && prompt('Type DELETE to confirm') === 'DELETE') { localStorage.removeItem(GT.KEY); S = GT.emptyState(); render(); toast('All data deleted'); } });

  function render() { ({ today: renderToday, workout: renderWorkout, cardio: renderCardio, meals: renderMeals, weight: renderWeight, progress: renderProgress, settings: renderSettings })[view](); }
  addEventListener('resize', () => { if (view === 'progress' || view === 'weight') render(); });
  render(); loadPlan();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();

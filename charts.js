/* Tiny canvas charts (no deps). series: [{label,color,points:[{x:'YYYY-MM-DD',y}] , dashed}] */
(function (root) {
  function setup(canvas, h = 200) {
    const dpr = root.devicePixelRatio || 1, w = canvas.clientWidth || 320;
    canvas.width = w * dpr; canvas.height = h * dpr; canvas.style.height = h + 'px';
    const c = canvas.getContext('2d'); c.scale(dpr, dpr); c.clearRect(0, 0, w, h);
    c.font = '11px -apple-system, system-ui, sans-serif'; return { c, w, h };
  }
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#888';
  function empty(c, w, h, msg) { c.fillStyle = css('--muted'); c.textAlign = 'center'; c.fillText(msg || 'No data yet', w / 2, h / 2); }
  function frame(c, w, h, min, max, labels) {
    const L = 40, R = 8, T = 20, B = 22; c.strokeStyle = css('--line'); c.fillStyle = css('--muted'); c.lineWidth = 1; c.textAlign = 'right';
    for (let i = 0; i <= 4; i++) { const v = min + (max - min) * i / 4, y = T + (h - T - B) * (1 - i / 4); c.beginPath(); c.moveTo(L, y); c.lineTo(w - R, y); c.stroke(); c.fillText(Math.round(v * 10) / 10, L - 4, y + 3); }
    c.textAlign = 'center'; if (labels.length) { const idx = [0, Math.floor((labels.length - 1) / 2), labels.length - 1]; [...new Set(idx)].forEach(i => c.fillText(labels[i].slice(5), L + (w - L - R) * (labels.length === 1 ? 0.5 : i / (labels.length - 1)), h - 6)); }
    return { L, R, T, B };
  }
  function line(canvas, series, opts = {}) {
    const { c, w, h } = setup(canvas, opts.height);
    const xs = [...new Set(series.flatMap(s => s.points.map(p => p.x)))].sort();
    const ys = series.flatMap(s => s.points.map(p => p.y));
    if (!xs.length) return empty(c, w, h);
    let min = Math.min(...ys), max = Math.max(...ys); if (opts.zero) min = Math.min(0, min); if (min === max) { min -= 1; max += 1; } const pad = (max - min) * 0.08; min = opts.zero ? min : min - pad; max += pad;
    const f = frame(c, w, h, min, max, xs);
    const X = x => f.L + (w - f.L - f.R) * (xs.length === 1 ? 0.5 : xs.indexOf(x) / (xs.length - 1));
    const Y = y => f.T + (h - f.T - f.B) * (1 - (y - min) / (max - min));
    series.forEach(s => { c.strokeStyle = c.fillStyle = s.color; c.lineWidth = 2; c.setLineDash(s.dashed ? [5, 4] : []); c.beginPath();
      s.points.forEach((p, i) => i ? c.lineTo(X(p.x), Y(p.y)) : c.moveTo(X(p.x), Y(p.y))); c.stroke(); c.setLineDash([]);
      if (!s.dashed) s.points.forEach(p => { c.beginPath(); c.arc(X(p.x), Y(p.y), 2.5, 0, 7); c.fill(); }); });
    legend(c, series, w);
  }
  // stacked bars: labels[], stacks: [{label,color,values[]}]
  function bars(canvas, labels, stacks, opts = {}) {
    const { c, w, h } = setup(canvas, opts.height);
    if (!labels.length) return empty(c, w, h);
    const totals = labels.map((_, i) => stacks.reduce((a, s) => a + (s.values[i] || 0), 0));
    const max = Math.max(...totals, 1) * 1.08, f = frame(c, w, h, 0, max, labels);
    const bw = (w - f.L - f.R) / labels.length;
    labels.forEach((_, i) => { let acc = 0; stacks.forEach(s => { const v = s.values[i] || 0; if (!v) return; const y0 = f.T + (h - f.T - f.B) * (1 - acc / max), y1 = f.T + (h - f.T - f.B) * (1 - (acc + v) / max);
      c.fillStyle = s.color; c.fillRect(f.L + i * bw + bw * 0.15, y1, bw * 0.7, y0 - y1); acc += v; }); });
    legend(c, stacks, w);
  }
  function legend(c, items, w) { let x = 44; c.textAlign = 'left'; items.forEach(s => { c.fillStyle = s.color; c.fillRect(x, 2, 8, 8); c.fillStyle = css('--muted'); c.fillText(s.label, x + 11, 10); x += c.measureText(s.label).width + 22; }); }
  root.Charts = { line, bars };
})(window);

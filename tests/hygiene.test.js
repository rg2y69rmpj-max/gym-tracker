// Repo hygiene: no personal details, no local paths, no API keys or secrets, no CDNs. Run: node tests/hygiene.test.js
const fs = require('fs'), path = require('path'), assert = require('assert');
const ROOT = path.join(__dirname, '..');
const files = []; (function walk(d) { for (const f of fs.readdirSync(d)) { if (f === '.git' || f === 'node_modules') continue; const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(js|json|html|css|md|webmanifest|txt)$/.test(f)) files.push(p); } })(ROOT);
let n = 0, bad = 0; const t = (name, fn) => { try { fn(); n++; console.log('ok -', name); } catch (e) { bad++; console.log('FAIL -', name, '\n  ', e.message); } };
const text = files.map(f => ({ f: path.relative(ROOT, f), s: fs.readFileSync(f, 'utf8') }));
const scan = (re, what, skip = () => false) => { for (const { f, s } of text) if (!skip(f)) { const m = s.match(re); assert.ok(!m, `${f}: ${what}: "${m && m[0]}"`); } };
const SELF = f => f === 'tests/hygiene.test.js';
t('no local or workspace paths', () => scan(new RegExp(['/work' + 'space/', '/ho' + 'me/[a-z]', '/Us' + 'ers/[A-Za-z]', '[A-Z]:\\\\Us' + 'ers'].join('|')), 'local path')); // built from parts so this file passes its own check
t('no email addresses or phone numbers', () => scan(/[\w.+-]+@[\w-]+\.[\w.]+|\b0[45]\d{2}[ -]?\d{3}[ -]?\d{3}\b|\+61\s?\d/, 'contact detail', SELF));
// Names and other private words are passed in at run time (HYGIENE_TERMS="word1,word2"), so they're never written into the repo themselves.
const TERMS = (process.env.HYGIENE_TERMS || '').split(',').map(x => x.trim()).filter(Boolean);
const esc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
t('no personal details (body stats, age, health notes' + (TERMS.length ? ', plus ' + TERMS.length + ' private terms' : '; set HYGIENE_TERMS to also check names') + ')', () => {
  scan(/\b\d{2,3}(\.\d)? ?kg\b[^\n]{0,40}\b1[4-9]\d ?cm\b|\b(age|aged)\s*:?\s*[1-9]\d\b|\bI'?m \d{2}\b|creatinine|blood test/i, 'personal detail', SELF);
  if (TERMS.length) scan(new RegExp('\\b(' + TERMS.map(esc).join('|') + ')\\b', 'i'), 'private term');
});
t('settings ship with no body stats filled in', () => { const L = require(path.join(ROOT, 'logic.js')); const d = L.DEFAULT_SETTINGS; assert.ok(d.startWeight === null && d.heightCm === null && d.age === null); });
t('no API keys, tokens or secrets', () => scan(/(api[_-]?key|apikey|secret|token|password)\s*[:=]\s*['"][^'"]{8,}|\bsk-[A-Za-z0-9]{16,}|\bAKIA[0-9A-Z]{16}\b|\bgh[pousr]_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}/i, 'secret', SELF));
t('no CDNs or third-party scripts', () => scan(/<script[^>]+src=["']https?:|<link[^>]+href=["']https?:\/\/(?!fonts\.)/i, 'external asset'));
t('service worker caches every app-shell file that exists, versioned cache, fresh install', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const assets = JSON.parse(sw.match(/const ASSETS = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"'));
  for (const a of assets) if (a !== './') assert.ok(fs.existsSync(path.join(ROOT, a)), a);
  for (const f of ['index.html', 'app.js', 'logic.js', 'charts.js', 'styles.css', 'manifest.webmanifest', 'plan.json', 'plan.recomp.json']) assert.ok(assets.includes(f), f);
  assert.ok(/const CACHE = 'gymtracker-v5';/.test(sw), 'cache version bumped to gymtracker-v5');
  assert.ok(/new Request\(a, \{ cache: 'reload' \}\)/.test(sw), 'install fetches the shell fresh (cache: reload)');
  assert.ok(/skipWaiting\(\)/.test(sw) && /clients\.claim\(\)/.test(sw) && /k !== CACHE/.test(sw), 'skipWaiting, clients.claim, old caches deleted');
});
t('app picks up a new service worker: updateViaCache none, update on load and visibility, one reload on controllerchange', () => {
  const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  assert.ok(/register\('sw\.js', \{ updateViaCache: 'none' \}\)/.test(app)); assert.ok(/\.then\(reg => \{\s*reg\.update\(\)/.test(app), 'update on load');
  assert.ok(/visibilitychange[\s\S]{0,120}reg\.update\(\)/.test(app)); assert.ok(/controllerchange[\s\S]{0,80}hadCtrl && !reloaded/.test(app));
});
console.log(`\nhygiene (${files.length} files): ${n} passed, ${bad} failed`); process.exit(bad ? 1 : 0);

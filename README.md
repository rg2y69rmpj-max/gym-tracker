# Gym & Meal Tracker (PWA)

A mobile-first, offline-capable tracker for lifting, treadmill, meals, and body weight, built for an iPhone and a recomp goal (muscle gain plus fat loss). It's static files only: no build step, no backend, no CDNs.

## Run locally
```bash
cd /workspace/apps/gym-tracker
python3 -m http.server 8000
# open http://localhost:8000
```
The service worker needs `http://localhost` or HTTPS. It won't run from `file://`.

## Features
- **Today:** progress against every target (calories, protein, carbs, fat, fibre ≥30 g, water ≥3 L, steps 8000–10000), +250/+500/−250 ml water buttons, a steps box, the weekly weight rate, the day's summary, and **Today's plan** (loaded from `plan.json`). Each plan exercise has a "Log" button and shows your last numbers. An "↑ add weight" flag appears once every set in your last session hit the top of the rep range (double progression).
- **Lift:** body part (6 defaults plus custom), a reusable exercise list (pick from it, or type a new name to add it), weight in kg and reps. The last session's numbers are shown. Weight and reps are pre-filled from your last set (tap Add set with the fields empty to reuse them), and there's a **↻ Repeat last set** button. Sets can be edited and deleted.
- **Cardio:** treadmill duration, distance (worked out from speed × time unless you type it), speed, incline, and optional calories.
- **Meals:** name (earlier names autocomplete and refill their numbers), calories, protein, time, and optional carbs, fat and fibre (blank counts as 0), with daily totals against targets.
- **Weight:** body weight log with a 7-day average trend. The weekly rate is the 7-day average ending today minus the 7-day average ending 7 days earlier, checked against the goal of losing 0.3–0.6 kg a week (in range, slower than goal, or faster than goal). It needs weigh-ins in both weeks.
- **Progress:** top-set weight and best estimated 1RM per exercise, weekly volume by body part, daily calories and protein against target (last 14 days), body weight trend, and treadmill totals with minutes per week.
- **More (settings):** all targets (defaults: 2300 kcal, 190 g protein, 230 g carbs, 70 g fat, ≥30 g fibre, 3 L water, 8000–10000 steps), **carb cycling** (off by default; when on, 2420 kcal on weights days and 2180 on treadmill and rest days, using the day type from the active plan: a day with exercises is a weights day, a cardio-only day is a treadmill day, anything else is rest), the weight-loss goal range, plan file choice, managing the exercise list, JSON export (the iOS share sheet lets you save it to Files), import, and **Delete all data** (needs a confirm plus typing DELETE).

Data is stored in `localStorage` under the key `gymtracker.v1` (schema version 2), on this device only. Saved data from older versions is migrated on load: missing settings, water and steps are added, meals get carbs, fat and fibre set to 0, and the old default targets (2350 kcal / 180 g) become 2300 / 190 unless you'd changed them. Imports are migrated the same way.

## Plan files and swapping in the real plan
- `plan.json` is a clearly labelled **EXAMPLE** push/pull/legs template (`"example": true`, so the app shows an "EXAMPLE plan" badge).
- `plan.recomp.json` is the Recomp Program v1. You can pick it in **More → Plan file**.

To use the real plan as the default:
1. Convert the program markdown to the format below, or edit `plan.recomp.json` if the markdown has changed.
2. Either overwrite `plan.json` with it (and set `"example": false`), or leave `plan.json` alone and choose `plan.recomp.json` in settings.
3. If you rename or add a plan file, add it to `ASSETS` in `sw.js` and to the `<select name="planFile">` in `index.html`. Bump `CACHE` in `sw.js` (for example `gymtracker-v2`) whenever you change app files so phones pick up the update. Plan files are fetched network-first, so plan edits show up on the next open while online.

Format:
```json
{ "name": "…", "example": false,
  "days": { "mon": { "title": "Chest", "notes": "optional",
                     "exercises": [ { "name": "Barbell bench press", "bodyPart": "chest", "sets": 4, "reps": "6-8", "note": "RIR 2" } ],
                     "cardio": "optional text" },
            "tue": { … }, "…": {}, "sun": { "title": "Rest" } } }
```
Keys are `mon` to `sun`. `reps` is a string, and the number after the dash is used for the progression flag. Exercise names that match your logged names link up with your history.

## Install on iPhone
Open the hosted URL in **Safari**, tap Share, then **Add to Home Screen**. It runs full-screen and works offline after the first load. Data is tied to the origin (the URL), so if you change hosts, export first and import afterwards. iOS can clear storage for sites you haven't opened in a long time, so export now and then.

## Hosting options (none of these have been done; they're for you to choose)
1. **GitHub Pages or Netlify (static, public HTTPS URL).** Pages: push this folder to a repo, then Settings → Pages → deploy from branch. Netlify: drag and drop the folder at app.netlify.com/drop, or run `netlify deploy --dir .`. Your data stays on the phone, but the app's code and the plan files would be publicly readable.
2. **Tailscale (private).** Install Tailscale on the host machine and the iPhone, sign in to the same tailnet, then serve the app over HTTPS inside the tailnet only: `python3 -m http.server 8000` and `tailscale serve --bg 8000`. Open `https://<machine>.<tailnet>.ts.net` on the phone. Don't use `tailscale funnel`, which makes it public.
3. **Temporary tunnel preview.** `python3 -m http.server 8000` then `cloudflared tunnel --url http://localhost:8000` (or `ngrok http 8000`) gives a temporary HTTPS URL. Anyone with the link can open it while the tunnel is running, and the URL changes each time, which resets the origin (and the localStorage data that goes with it). Only use it for previews.

## Tests
```bash
node tests/logic.test.js          # unit tests for add/edit/delete, totals, volume, progression, import/export, plan files
# headless E2E (needs puppeteer-core installed somewhere on NODE_PATH and Chrome):
python3 -m http.server 8765 &  NODE_PATH=/path/to/node_modules node tests/e2e.js
```

## Files
`index.html`, `styles.css`, `logic.js` (pure data logic, also loads in Node), `charts.js` (tiny canvas charts), `app.js` (UI), `sw.js`, `manifest.webmanifest`, `plan.json`, `plan.recomp.json`, `icons/`, `tests/`.

## Limitations
- No sync between devices. Data lives in this browser's localStorage only.
- Estimated 1RM uses the Epley formula. Volume counts only kg × reps, so bodyweight exercises count as 0 unless you log added weight.
- The plan isn't parsed from markdown automatically; `plan.recomp.json` is a manual conversion.
- RIR, heart rate, and run type (listed in gym-plan.md's "Data for the tracker app") aren't tracked yet.

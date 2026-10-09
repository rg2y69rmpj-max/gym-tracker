# Gym & Meal Tracker (PWA)

A mobile-first, offline-capable tracker for lifting, treadmill, meals, and body weight, built for an iPhone and a recomp goal (muscle gain plus fat loss). It's static files only: no build step, no backend, no CDNs.

## Run locally
```bash
cd gym-tracker
python3 -m http.server 8000
# open http://localhost:8000
```
The service worker needs `http://localhost` or HTTPS. It won't run from `file://`.

## Features
- **Today:** progress against every target (calories, protein, carbs, fat, fibre ≥30 g, water ≥3 L, steps 8000–10000), +250/+500/−250 ml water buttons, a steps box, the weekly weight rate, the day's summary, and **Today's plan** (loaded from `plan.json`). Each plan exercise has a "Log" button and shows your last numbers. An "↑ add weight" flag appears once every set in your last session hit the top of the rep range (double progression).
- **Lift:** body part (6 defaults plus custom), a reusable exercise list (pick from it, or type a new name to add it), weight in kg and reps. The last session's numbers are shown. Weight and reps are pre-filled from your last set (tap Add set with the fields empty to reuse them), and there's a **↻ Repeat last set** button. Sets can be edited and deleted.
- **Cardio:** treadmill duration, distance (worked out from speed × time unless you type it), speed, incline, and optional calories.
- **Meals:** name (earlier names autocomplete and refill their numbers), calories, protein, time, and optional carbs, fat and fibre (blank counts as 0), with daily totals against targets.
- **Today** also has **sleep** (hours slept last night, one entry per day, against a ≥7 h goal you can change in More), and cards for the **weekly calorie check**, the **deload flag** and the **progress photo reminder** (below).
- **Weight:** body weight log with a 7-day average trend, plus a weekly **waist** log (cm, measured at the navel first thing in the morning) with edit and delete. The weekly rate is the 7-day average ending today minus the 7-day average ending 7 days earlier, checked against the goal of losing 0.3–0.6 kg a week (in range, slower than goal, or faster than goal). It needs weigh-ins in both weeks.
- **Progress:** top-set weight and best estimated 1RM per exercise, weekly volume by body part, daily calories and protein against target (last 14 days), body weight trend, waist (with the change over the last 2–3 weeks), sleep for the last 14 days (7-day average and nights at goal), and treadmill totals with minutes per week.
- **More (settings):** all targets (defaults: 2300 kcal, 190 g protein, 230 g carbs, 70 g fat, ≥30 g fibre, 3 L water, 8000–10000 steps, ≥7 h sleep), **carb cycling** (off by default; when on, 2420 kcal on weights days and 2180 on treadmill and rest days, using the day type from the active plan: a day with exercises is a weights day, a cardio-only day is a treadmill day, anything else is rest), the weight-loss goal range, plan file choice, managing the exercise list, **Backup** (see below), and **Delete all data** (needs a confirm plus typing DELETE).

Data is stored in `localStorage` under the key `gymtracker.v1` (schema version 3: adds sleep, waist, photo and deload logs), on this device only. Saved data from older versions is migrated on load: missing settings, water and steps are added, meals get carbs, fat and fibre set to 0, and the old default targets (2350 kcal / 180 g) become 2300 / 190 unless you'd changed them. Restored backups (and older Export JSON files) are migrated the same way.

## Recomp checks (from the program's v2 tracking notes)
- **Weekly calorie check** (Today and Weight). Uses the 7-day average weight (week-on-week), the weekly waist (now vs 2–3 weeks ago) and the main lifts (best estimated 1RM in the last 2 weeks vs the 2 before). In order:
  1. Weeks 1–2 after your first weigh-in are ignored (mostly water). It also waits a week after any change.
  2. Losing more than 0.7 kg a week for 2 weeks, or main lifts falling for 2 weeks: **add 150 kcal**.
  3. Weight flat, waist shrinking and lifts going up: **don't change anything** (the recomp is working).
  4. Weight **and** waist both flat (within 0.2 kg/week and 0.5 cm) for 2–3 weeks: **cut 150 kcal, from carbs**. This is the only time it suggests a cut. If that would go below 2,150 kcal it says to review the plan instead.
  5. Anything else (including a flat scale with no waist data, or a shrinking waist): no change.
  Nothing changes on its own: an **Apply** button updates the calorie target (and the carb-cycling day targets by the same amount; a cut also takes 37.5 g off the carb target).
- **Deload flag** (Today): suggested when the same lift's best estimated 1RM drops 2 sessions running, or 8 weeks have passed since the last deload (or since your first logged set). **Start deload week** logs it and shows "same weights, about half the sets" on Today and Lift for 7 days; **Not now** hides it for a week.
- **Progress photos** (Today): a reminder to take front, side and back photos every 4 weeks (and once at the start, after you've logged anything). **Done, taken today** logs the date; **In 2 days** snoozes it. The photos themselves stay in your Photos library; the app never stores them.

## Backup and restore
iOS can clear a web app's storage if you don't open it for a while, so back up now and then. **More → Backup:**
- **Back up now** makes one JSON file (`gym-tracker-backup-YYYY-MM-DD.json`) with everything the app stores: sets, treadmill sessions, meals, weigh-ins, waist, sleep, water, steps, photo and deload dates, custom body parts, the exercise list and all settings. On iPhone the share sheet opens: tap **Save to Files**, then pick **iCloud Drive** (or anywhere). Where sharing files isn't supported, the file downloads instead.
- **Restore from backup** opens the file picker. The app checks the file (right app, readable, not damaged, not from a newer version), then shows a table of what's on the phone now next to what's in the file (sets and workout days, treadmill sessions, meals, weigh-ins, water and step days, exercises, date range). Nothing changes until you pick one:
  - **Merge** keeps everything on the phone and adds the entries that are only in the backup (sets, meals, treadmill sessions, weigh-ins, water, sleep, waist, photo and deload dates, exercises). For one-per-day logs (steps, sleep, waist) the phone's entry for that day wins. Settings stay as they are. Handy if you logged on two devices, or restored an old file after starting fresh.
  - **Replace** makes the phone match the backup exactly, settings included.
  - **Cancel** leaves everything as it was. Files from the old **Export JSON** button restore too.
- The card shows the date of your last backup. After **14 days** without one (counted from first use if you've never backed up), a small reminder appears at the top of **Today** with **Back up now** and **Later** (snoozes 3 days). It only shows once you've logged something.
- **Updates:** the app checks for a new version every time it opens or comes back to the foreground, and reloads once when the new version takes over, so the Home Screen app picks up changes without reinstalling.

## Plan files and swapping in the real plan
- `plan.json` is a clearly labelled **EXAMPLE** push/pull/legs template (`"example": true`, so the app shows an "EXAMPLE plan" badge).
- `plan.recomp.json` is the Recomp Program v1. You can pick it in **More → Plan file**.

To use the real plan as the default:
1. Convert the program markdown to the format below, or edit `plan.recomp.json` if the markdown has changed.
2. Either overwrite `plan.json` with it (and set `"example": false`), or leave `plan.json` alone and choose `plan.recomp.json` in settings.
3. If you rename or add a plan file, add it to `ASSETS` in `sw.js` and to the `<select name="planFile">` in `index.html`. Bump `CACHE` in `sw.js` (it's `gymtracker-v5` now) whenever you change app files so phones pick up the update. Plan files are fetched network-first, so plan edits show up on the next open while online.

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
Open the hosted URL in **Safari**, tap Share, then **Add to Home Screen**. It runs full-screen and works offline after the first load. Data is tied to the origin (the URL), so if you change hosts, tap **Back up now** first and **Restore from backup** on the new URL. iOS can clear storage for sites you haven't opened in a long time, so back up now and then (the app reminds you after 14 days).

## Hosting options (none of these have been done; they're for you to choose)
1. **GitHub Pages or Netlify (static, public HTTPS URL).** Pages: push this folder to a repo, then Settings → Pages → deploy from branch. Netlify: drag and drop the folder at app.netlify.com/drop, or run `netlify deploy --dir .`. Your data stays on the phone, but the app's code and the plan files would be publicly readable.
2. **Tailscale (private).** Install Tailscale on the host machine and the iPhone, sign in to the same tailnet, then serve the app over HTTPS inside the tailnet only: `python3 -m http.server 8000` and `tailscale serve --bg 8000`. Open `https://<machine>.<tailnet>.ts.net` on the phone. Don't use `tailscale funnel`, which makes it public.
3. **Temporary tunnel preview.** `python3 -m http.server 8000` then `cloudflared tunnel --url http://localhost:8000` (or `ngrok http 8000`) gives a temporary HTTPS URL. Anyone with the link can open it while the tunnel is running, and the URL changes each time, which resets the origin (and the localStorage data that goes with it). Only use it for previews.

## Tests
```bash
node tests/logic.test.js          # unit tests for add/edit/delete, totals, volume, progression, migration, backup build/restore checks, sleep/waist logging,
                                  # calorie rules (cut only if weight AND waist flat, hold when recomp is working), deload flag, photo reminder,
                                  # 14-day reminder, SW cache version + update fix
# headless E2E (needs puppeteer-core installed somewhere on NODE_PATH and Chrome):
python3 -m http.server 8765 &  NODE_PATH=/path/to/node_modules SHOTS_DIR=/tmp node tests/e2e.js
node tests/hygiene.test.js       # no local paths, emails/phone numbers, body stats, API keys or CDNs; HYGIENE_TERMS="name,other" also checks private words
```
The E2E run also checks sleep and waist logging, the calorie check (a "no change" recomp scenario and a "cut 150" scenario with Apply), the deload flag, the photo reminder, the backup reminder, Back up now (with a stand-in for the iPhone share sheet, and the download fallback), and restore: wrong files refused, the preview, Cancel, and Replace.

## Files
`index.html`, `styles.css`, `logic.js` (pure data logic, also loads in Node), `charts.js` (tiny canvas charts), `app.js` (UI), `sw.js`, `manifest.webmanifest`, `plan.json`, `plan.recomp.json`, `icons/`, `tests/`.

## Limitations
- No sync between devices. Data lives in this browser's localStorage only.
- Estimated 1RM uses the Epley formula. Volume counts only kg × reps, so bodyweight exercises count as 0 unless you log added weight.
- The plan isn't parsed from markdown automatically; `plan.recomp.json` is a manual conversion.
- RIR, heart rate, and run type (listed in gym-plan.md's "Data for the tracker app") aren't tracked yet.

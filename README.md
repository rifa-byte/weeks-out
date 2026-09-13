# Weeks Out

A lifting log first: sets, reps, RPE, estimated 1RM, PRs. Programs you can follow, build, customise and share with a code. A Programs tab where you make a program (AI questionnaire), find one other lifters and coaches have shared, or find a coach. And, for those who compete, a Meet tab with attempts, plates, scores and a meet-day timeline. Everything you log lives on the phone: no account, no server — yet.

Roadmap in one line: **now** logging + programs + sharing by code + a curated Find / Coaches list; **after the first meet (Nov 2026)** accounts, published listings, coach applications, and paid programs via in-app purchase.

Built with Expo (React Native + TypeScript) and SQLite. Defaults to kilograms and IPF rules; a lb toggle is in the Meet tab.

## Run it on your iPhone (free, no Apple account needed)

1. Install **Expo Go** from the App Store on your iPhone.
2. On your computer, install Node.js 20 or newer (nodejs.org) and clone this repo:
   ```bash
   git clone <your-repo-url> weeks-out
   cd weeks-out
   npm install
   npx expo start
   ```
3. Scan the QR code in the terminal with the iPhone camera. It opens in Expo Go.
   If your phone and computer are on different networks, run `npx expo start --tunnel` instead.

Edits to the code reload on the phone within a second or two.

## Checks

```bash
npm test          # unit tests for the lifting math (RPE chart, e1RM, DOTS, IPF GL, Wilks, attempts, plates)
npm run typecheck # TypeScript
```

## Project layout

```
app/
  _layout.tsx         root: opens the SQLite database, loads settings, sets theme
  (tabs)/index.tsx    Log — weeks-out header, best e1RMs, sessions list
  (tabs)/meet.tsx     Meet — profile, attempt planner + warm-ups, bodyweight log, scoring, plate loader
  meet/day.tsx        Meet-day mode: timeline + platform attempts
  (tabs)/rank.tsx     Rank — Where you stand (OpenPowerlifting) / Where you fail (Fail Map)
  (tabs)/programs.tsx Programs — pick a template, build your own, use a shared code, track the active program, share it
  program/new.tsx     build-your-own: name, weeks, days
  program/import.tsx  paste a share code
  program/make.tsx    the questionnaire and the result screen
  mode.tsx            meet mode / general mode
  api/generate+api.ts server route: questionnaire → Claude → validated program
  program/start.tsx   enter your bests and start a template
  program/day/[id].tsx a program day: planned sets, Customise (swap/add/remove), one tap to log it
  exercise/pick.tsx   movement picker: search, lift, weak-point / rehab / muscle filters, custom names
  welcome.tsx         four-step tour on first launch
  help.tsx            “How this works”, one topic per screen
  session/[id].tsx    a single session: add sets (tap one to edit), see e1RM and PRs, notes
lib/
  math.ts             every formula, pure functions on kg (unit-tested)
  programs.ts         program templates and the resolver that turns them into kg (unit-tested)
  meetprep.ts         meet-prep generator: phases by weeks out, 2–6 day splits (unit-tested)
  generator.ts        questionnaire → program (local, deterministic; the AI fallback) (unit-tested)
  ai-schema.ts        what the AI is asked for, and how its answer is validated and expanded (unit-tested)
  ai.ts               client call with timeout and fallback
  exercises.ts        the movement library: ids, categories, parent lift, strength factor, tags (unit-tested)
  picker.ts           callback bridge for the picker route
  share.ts            share codes: WO1. + base64url(compact JSON) (unit-tested)
  explore.ts          the curated Find / Coaches list — add programs and coaches here
  opl.ts              OpenPowerlifting client: name search, ladders, percentile / rank / placing maths
  failmap.ts          the Fail Map: positions, aggregation, fixes (cues, variations, accessories)
  meetday.ts          meet-day timeline and attempt rules (unit-tested)
  prep.ts             pre-session stretches, band work and holds per lift (unit-tested)
  db.ts               SQLite schema + queries
  settings.tsx        units / sex / bodyweight / meet date, persisted
  format.ts           dates and number parsing
components/ui.tsx     shared building blocks (Screen, Card, Field, Segmented, …)
constants/theme.ts    palette (light + dark), plate colours, spacing
```

## Roadmap to 7 Nov 2026

- Sprint 1 (done): log + e1RM + PRs
- Sprint 2 (done, v0): attempt planner, warm-ups, IPF GL / DOTS / Wilks, plate loader, weight class
- Sprint 3 (done, v0): three program templates that load from your e1RMs, a week-by-week tracker, and one tap to log a day into the session log
- Sprint 4 (done, v0): exercise library (competition lifts, variations with strength factors, secondary, accessories; weak-point and rehab tags), program customisation (swap / add / remove / ± sets & reps), Log tab follows the active program, last-time history and best per movement, rest timer, plate strip while logging, gym plate sets (kg / lb / IPF) and bar weight, bodyweight log with class-limit distance
- Sprint 5 (done, v0): meet-day mode (weigh-in / flight inputs → day-before and meet-day timeline that follows the clock; attempt cards with good / miss, next-attempt suggestions, plates and warm-ups, running total with IPF GL and DOTS), pre-session prep block (stretches, band work, static holds chosen from the day's lifts)
- Sprint 6 (done): first-launch tour, “How this works” on every screen, numbered steps and hints wherever there is something to tap, short warm-up list by default with “More drills” and “Add your own”, one accessory per program day
- Sprint 7 (done): repositioned as a logging + programs + community app. Share codes (export a program, paste to import), Build your own program (blank weeks, apply a day to every week), Explore tab with curated programs and coaches
- Sprint 8 (done): meet prep is generated for any length (1–24 weeks) and 2–6 days a week with block periodization scaled to the time available (build → strength → peak → taper, deload in long builds), day splits modelled on elite programs
- Sprint 9 (done): meet mode / general mode chosen on first launch and switchable; Programs = “Make me a program” (8-question questionnaire → AI-written program, validated, with built-in fallback) or “Find a program” (Explore with goal / level / days filters, coach programs link to coaching); share codes carry tags
- Sprint 10 (done): first launch = “meet or not?” then straight into the questionnaire, nothing else (skippable; keyed on `setupDone`); Explore folded into Programs as Mine / Make / Find / Coaches; tabs are now Log + Programs (+ Meet in meet mode); tour moved to Help
- Sprint 11 (done): the Rank tab — “Where you stand” (search any lifter on OpenPowerlifting, compare lift by lift, see where your total lands in your class worldwide or per country, recent meets and where you’d have placed) and “Where you fail” (the Fail Map: tap where a rep stuck when logging → sticking point per lift, why, cues, variations, accessories, and a nudge to a coach)
- Next: app icon; store screenshots; turn the AI on (see below); friends' feedback via Issues (see CONTRIBUTING.md)
- December: accounts (Supabase), publish programs to Find from the app, coach profiles + applications, paid programs (in-app purchase)
- Then: Google Play closed test (12 testers, 14 days), TestFlight, launch on meet day

## The AI program writer

"Make me a program" asks eight questions and, when the server is configured, sends them to Claude (Haiku 4.5 by default) which returns a compact program structure. The app expands it week by week, checks every movement against the library and every percentage, set and rep against safe limits, and only then shows it. Without the server, or offline, the same questions drive the built-in generator (`lib/generator.ts`), so the feature always works.

**Turn the AI on (one-time, ~10 minutes)**

1. Create an Anthropic Console account at console.anthropic.com, add a little credit (US$5 covers a few hundred programs on Haiku), and create an API key.
2. Install and log in to EAS: `npm install -g eas-cli && eas login`, then in the project `eas init`.
3. Store the key on the server side only: `eas env:create --scope project --name ANTHROPIC_API_KEY --visibility secret --value sk-ant-...` (choose the environments it asks for; production is enough).
4. Deploy the API: `npx expo export --platform web && eas deploy`. It prints a URL like `https://weeks-out--abc123.expo.app`.
5. Tell the app where the server is: put `EXPO_PUBLIC_GENERATOR_URL=https://…expo.app` in a `.env` file (see `.env.example`) and restart `npx expo start`. For store builds, add the same variable with `eas env:create --scope project --name EXPO_PUBLIC_GENERATOR_URL --visibility plain --value https://…`.

Cost per program is roughly US$0.01–0.04 on Haiku. Set a monthly spend limit in the Anthropic Console so a bug can never surprise you. The route is `app/api/generate+api.ts`; the prompt and validation live in `lib/ai-schema.ts`.

## Store builds (later)

Builds and store submission run through Expo's free EAS tier — no Mac needed:

```bash
npm install -g eas-cli
eas login            # free Expo account
eas init             # links this project to your Expo account (one time)
eas build -p android --profile preview   # installable APK for testers
eas build -p ios --profile production    # needs the Apple Developer Program
eas submit -p ios                        # to TestFlight / App Store
```

`eas.json` already has the profiles.

## Formulas

- **e1RM**: RTS-style RPE chart (reps 1–10, RPE 6–10); Epley when no RPE is given.
- **IPF GL** (2020), **DOTS** (2019), **Wilks** (original) — coefficients as published; tests check against published worked examples and OpenPowerlifting listings.
- **Attempts**: opener ≈ 91 % of best rounded down to 2.5 kg, second ≈ 96 %, third ≈ 101 %, always ascending.
- **Warm-ups**: bar ×10, then 40/55/70/80/90 % of the opener.
- **Plates**: IPF calibrated set (25/20/15/10/5/2.5/1.25/0.5/0.25), 20 kg bar, 2.5 kg collars each side.

## OpenPowerlifting inside the app

OpenPowerlifting releases every result to the public domain and asks people to use the bulk download rather than scrape the site. `scripts/opl-build.mjs` does that: it downloads the bulk CSV once, streams it, and writes small static JSON files to `public/opl/` (name-search shards, and per-class “ladders” with a histogram of totals, the top 20, and recent meets per country). The app fetches those files straight from GitHub (`EXPO_PUBLIC_OPL_URL` overrides the base URL), so there is no server and nothing to pay for.

To publish or refresh the index (a few minutes; needs Node 18+):

```
npm run opl:build            # IPF affiliates, lifters active since 2016 (default)
npm run opl:build -- --source all      # every federation (bigger)
git add public/opl; git commit -m "Refresh OpenPowerlifting index"; git push
```

Until `public/opl/meta.json` exists on `main`, the Rank tab shows a “not switched on yet” card. The attribution line in the app is required-by-courtesy: *Data from the OpenPowerlifting project, openpowerlifting.org.*

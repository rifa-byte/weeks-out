# Weeks Out

A powerlifting app for everyone who has a date on the calendar. Training log with RPE-based e1RM, meet-day tools (attempt planner, warm-ups, IPF GL / DOTS / Wilks, plate loader), and programs. Everything lives on the phone: no account, no server.

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
  (tabs)/meet.tsx     Meet — profile, attempt planner + warm-ups, scoring, plate loader
  (tabs)/programs.tsx Programs — templates (sprint 3)
  session/[id].tsx    a single session: add sets, see e1RM and PRs, notes
lib/
  math.ts             every formula, pure functions on kg (unit-tested)
  db.ts               SQLite schema + queries
  settings.tsx        units / sex / bodyweight / meet date, persisted
  format.ts           dates and number parsing
components/ui.tsx     shared building blocks (Screen, Card, Field, Segmented, …)
constants/theme.ts    palette (light + dark), plate colours, spacing
```

## Roadmap to 7 Nov 2026

- Sprint 1 (done): log + e1RM + PRs
- Sprint 2 (done, v0): attempt planner, warm-ups, IPF GL / DOTS / Wilks, plate loader, weight class
- Sprint 3: programs that load from your e1RMs and push sessions into the log; app icon; store screenshots
- Then: Google Play closed test (12 testers, 14 days), TestFlight, launch on meet day

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

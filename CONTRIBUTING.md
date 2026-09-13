# Contributing to Weeks Out

Thanks for helping. Two ways in:

## Suggest a feature or report a bug

Open a GitHub Issue on this repo. Say what you were trying to do in the gym, what the app did, and what you wished it did. Screenshots help. Rif triages issues and they get built in order of how many lifters they help.

## Get listed under Programs → Find / Coaches

Open an Issue titled "Add me to Explore" (the app's Submit buttons pre-fill it). For a program, include the share code from Programs → Mine → Share this program, a name, and one line about who it's for. For coaching, your name, Instagram, location, what you offer and a price. Rif adds it to `lib/explore.ts`.

## Work on the code

1. Ask Rif to add you as a collaborator (or fork the repo).
2. Install Node.js 20+ and Expo Go on your phone.
3. `git clone`, `npm install`, `npx expo start`, scan the QR code.
4. Make a branch: `git checkout -b my-feature`.
5. Run the checks before you push: `npm test` and `npm run typecheck`.
6. Push and open a Pull Request. Describe what changed and why; a screen recording from your phone is worth a lot.

### Where things live

- `lib/` — the logic, all pure TypeScript and unit-tested. Add formulas, templates, exercises and prep items here. `lib/exercises.ts` and `lib/prep.ts` are data files: adding a movement or a warm-up drill is one line.
- `app/` — the screens (Expo Router: file path = route).
- `components/` — shared UI pieces.

### House rules

- Everything is stored in kilograms; convert at the edges with `useSettings().fmt / toKg`.
- Weights that go on a bar land on 2.5 kg steps.
- Keep the first screen useful with zero data — new users start empty.
- No accounts, no server, no analytics. The app works offline, and that's a feature.

/**
 * Weeks Out — Find / Coaches (the old Explore tab, now inside Programs).
 *
 * Until the real marketplace exists (accounts, listings, payments), this file IS the
 * marketplace: a curated list shipped with the app. Adding a program or a coach is a
 * pull request or an Issue on GitHub — see CONTRIBUTING.md.
 *
 * Programs point at a built-in template id (`template`) or carry a share code (`code`).
 * Coaches link out; the app never handles money for them.
 */

export interface ExploreProgram {
  id: string;
  name: string;
  author: string;
  blurb: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  goal: 'strength' | 'meet-prep' | 'hypertrophy' | 'rehab';
  weeks: number;
  daysPerWeek: number;
  price: 'free';                 // paid listings come with the marketplace
  template?: string;             // built-in template id
  code?: string;                 // share code, WO1.…
  focus?: 'balanced' | 'squat' | 'bench' | 'deadlift';
  coach?: string;                // Instagram handle of the coach who shared it — shows "message for coaching"
}

export interface ExploreCoach {
  id: string;
  name: string;
  handle: string;                // Instagram handle without @
  location: string;
  about: string;
  offers: string[];              // e.g. "Online 1:1", "Meet-day handling", "Form checks"
  price: string;                 // free text, e.g. "from $60/month"
  federations?: string[];
  spots?: 'open' | 'waitlist' | 'full';
}

export const EXPLORE_PROGRAMS: ExploreProgram[] = [
  {
    id: 'p-full-body', name: '3-day full body', author: 'Weeks Out', level: 'beginner', goal: 'strength',
    blurb: 'Squat, bench and deadlift every week at rising intensity, then a deload. The sensible first program.',
    weeks: 4, daysPerWeek: 3, price: 'free', template: 'full-body-3',
  },
  {
    id: 'p-sbd-split', name: '4-day SBD split', author: 'Weeks Out', level: 'intermediate', goal: 'strength',
    blurb: 'One heavy top set per lift with back-offs, plus volume days. For building between meets.',
    weeks: 4, daysPerWeek: 4, price: 'free', template: 'sbd-split-4',
  },
  {
    id: 'p-meet-prep', name: 'Meet prep (any length, 2–6 days)', author: 'Weeks Out', level: 'intermediate', goal: 'meet-prep',
    blurb: 'Build → strength → peak → taper, scaled to your weeks out and the days you can train. This one is the 8-week, 3-day version; set your own in Programs.',
    weeks: 8, daysPerWeek: 3, price: 'free', template: 'meet-prep-8',
  },
];

export const EXPLORE_COACHES: ExploreCoach[] = [
  // Example entry — replace with real coaches via PR / Issue.
  {
    id: 'c-example', name: 'Your name here', handle: 'weeksout', location: 'Singapore',
    about: 'Competing lifter who programs for others. Not a certified coach — a lifter who has done the prep and will do yours with you.',
    offers: ['Online 1:1', 'Meet-day handling', 'Form checks'], price: 'founding rate', federations: ['IPF'], spots: 'open',
  },
];

export const LEVEL_LABEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' } as const;
export const GOAL_LABEL = { strength: 'Strength', 'meet-prep': 'Meet prep', hypertrophy: 'Size', rehab: 'Rehab' } as const;

/** Where people go to add themselves. */
export const SUBMIT_URL = 'https://github.com/rifa-byte/weeks-out/issues/new?title=Add%20me%20to%20Explore&body=Program%20or%20coach%3F%0AName%3A%0AInstagram%3A%0AWhat%20you%20offer%3A%0AShare%20code%20(for%20programs)%3A';

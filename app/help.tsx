import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Body, Button, Card, Eyebrow, H2, Screen, Title } from '@/components/ui';
import { useTheme } from '@/constants/theme';

type Topic = 'log' | 'session' | 'programs' | 'rank' | 'meet' | 'meetday';

const HELP: Record<Topic, { title: string; sections: { h: string; p: string }[] }> = {
  log: {
    title: 'Log',
    sections: [
      { h: 'Start a session', p: 'Tap the big red button. If you have a program running, the button already says which session is next — tap it and the sets are filled in for you.' },
      { h: 'Open an old session', p: 'Tap any row in the list. Hold your finger on a row to delete it.' },
      { h: 'Meet mode or not', p: 'The small link under the title switches between meet mode (weeks-out countdown, Meet tab) and general mode. Nothing you logged changes.' },
      { h: 'Load the bar', p: 'The button at the top right. Type a weight, pick the plates your gym has, and it shows what goes on each side. Inside a session the plates appear under the weight box by themselves.' },
      { h: 'The three numbers at the top', p: 'Your best estimated 1RM for each lift, worked out from every set you have logged. Log one set of each lift and they appear.' },
    ],
  },
  session: {
    title: 'Logging a set',
    sections: [
      { h: '1. Pick the movement', p: 'Tap Squat, Bench or Deadlift. For anything else tap “All movements” and search — pause squat, RDL, face pulls, whatever you did.' },
      { h: '2. Weight and reps', p: 'Type the weight on the bar and how many reps. A picture of the plates appears so you can load the bar without maths.' },
      { h: '3. RPE — how hard was it?', p: '10 = you could not have done one more rep. 9 = one rep left. 8 = two left. 7 = three left. Tap “none” if you don’t use RPE.' },
      { h: '4. Tap Add set', p: 'The set appears in the list below with its estimated 1RM. A “PR” tag means it is your best ever for that movement.' },
      { h: 'Made a mistake?', p: 'Tap the set — it jumps back into the form so you can fix it and add it again. Tap ✕ to delete it.' },
      { h: 'Rest timer', p: 'Starts by itself when you add a set and buzzes when time is up. Tap a time (1:30 … 5:00) to change how long you rest.' },
      { h: 'Prep', p: 'A short list of warm-up drills for the lifts you are doing today. Tick them off, tap “More” for extra drills, or skip.' },
    ],
  },
  programs: {
    title: 'Programs',
    sections: [
      { h: 'While a program is running', p: 'This tab is your program: each week a card, each day a row, the highlighted row is next. Tap a day to see the sets, “Log this day” to put them in your log. End program (bottom) brings back Make and Find; your log stays.' },
      { h: 'Make → Make me a program', p: 'Eight questions — level, days, block type (if you’re not prepping for a meet), fatigue, focus, sore joints, gym, session length. The app writes a program; every number is checked. In meet mode it is scaled to your meet date.' },
      { h: 'Make → Import a spreadsheet', p: 'Got a program from a coach in Google Sheets or Excel? Paste the link (shared as “Anyone with the link”), pick the file, or copy-paste the cells. The app reads weeks, days, sets, reps, weights, % and RPE and lays it out the app’s way. Check week 1, tap Start. Weights in lb are converted.' },
      { h: 'Make → Quick start', p: 'No questions: pick 2–6 days a week and start a sensible 6-week strength block.' },
      { h: 'Make → Build your own / shared code', p: 'Build your own: name it, pick weeks and days, fill each day. Shared code: paste a code a friend or coach sent.' },
      { h: 'Find', p: 'Well-known programs (Texas Method, Madcow 5×5, 5/3/1 Boring But Big, GZCLP) and programs from coaches on Weeks Out. Tap Filter for goal, level and days. Start → enter your bests → done.' },
      { h: 'Coaches', p: 'Lifters who take clients. Tap the Instagram button to message them. Coach yourself? Tap Get listed.' },
      { h: 'Change a day', p: 'Open the day and tap “Change this day”. Swap a movement for a variation, add an accessory, remove one, or change sets and reps. Weights re-calculate.' },
      { h: 'Share it', p: 'Tap “Share this program” at the bottom of your program. It makes a code you can send anywhere; the receiver pastes it under Make → Use a shared code and the weights come from their bests (a coach’s fixed weights travel as written).' },
    ],
  },
  rank: {
    title: 'Rank',
    sections: [
      { h: 'Two halves', p: '“Where you stand” compares you with every lifter on OpenPowerlifting. “Where you fail” is your Fail Map — where your reps die and what fixes it. Tap the switch at the top.' },
      { h: 'Your numbers', p: 'Squat, bench and deadlift are your best estimated 1RMs from the log; the total is the three added up. DOTS and IPF GL use your bodyweight and sex — tap the line at the top right of the card to set them. Type a different total to test a goal.' },
      { h: 'Search any lifter', p: 'Type a name (surname alone works). Tap a result and you get their best meet next to your numbers, lift by lift, with the gap. Green = you are ahead.' },
      { h: 'Where your total lands', p: 'Pick World or a country and your weight class. It shows the top-percent your total is in, your rank among everyone who competed in that class in the last two years, the top 10, and — for a country — recent meets and where you would have placed.' },
      { h: 'Logging a sticking point', p: 'In a session, after you tap the RPE, tap where the bar slowed or stopped (out of the hole, halfway, lockout) and “Missed a rep” if you missed. Takes one tap. Clean sets need nothing.' },
      { h: 'Reading the Fail Map', p: 'Each lift gets a bar per position. The longest bar is your sticking point; under it: what it usually means, three cues for the next set, variations that attack it (with their rough % of your main lift), and muscles to build. If it keeps happening, the app suggests a coach.' },
      { h: 'Where the data comes from', p: 'OpenPowerlifting’s public-domain results, rebuilt into a small index every so often. It is not live: a meet from last weekend may take a while to appear.' },
    ],
  },
  meet: {
    title: 'Meet',
    sections: [
      { h: 'You and your meet', p: 'Type your meet name, pick the date from the calendar, set bodyweight, sex and units. Fields save when you tap away.' },
      { h: 'Attempts', p: 'Openers, seconds and thirds for each lift, from your best e1RM in the log. Type a different best in the box on the right to plan from that instead.' },
      { h: 'Bodyweight', p: 'Type today’s weight and tap Save. Shows your class, how far you are from the limit, and the 7-day change.' },
      { h: 'Score a total', p: 'Type any total to see IPF GL, DOTS and Wilks at your bodyweight.' },
      { h: 'Load the bar', p: 'Tell the app which plates your gym has, type a weight, and it shows what to put on each side.' },
      { h: 'Meet-day mode', p: 'The button at the top. Enter your weigh-in and flight times and it writes your day.' },
    ],
  },
  meetday: {
    title: 'Meet day',
    sections: [
      { h: 'Set it up', p: 'Choose 2-hour or 24-hour weigh-in, type the weigh-in time and when your squat flight starts. Bench and deadlift times are optional — the app estimates them.' },
      { h: 'Timeline', p: 'What to do and when, from the night before to your last deadlift. Tap any line to read the detail. On meet day the next thing is highlighted and done things are crossed out.' },
      { h: 'Platform', p: 'Three attempts per lift. After each lift tap Good or Miss. The next attempt fills itself in; type over it if you and your handler decide differently. The current attempt shows the plates and your warm-ups.' },
      { h: 'Total', p: 'Adds up your best good attempt for each lift, with IPF GL and DOTS.' },
    ],
  },
};

export default function HelpScreen() {
  const { topic } = useLocalSearchParams<{ topic: string }>();
  const router = useRouter();
  const t = useTheme();
  const h = HELP[(topic as Topic) in HELP ? (topic as Topic) : 'log'];
  return (
    <>
      <Stack.Screen options={{ title: 'How this works' }} />
      <Screen>
        <View>
          <Eyebrow>How this works</Eyebrow>
          <Title>{h.title}</Title>
        </View>
        {h.sections.map(s => (
          <Card key={s.h} style={{ gap: 4 }}>
            <H2 style={{ fontSize: 16 }}>{s.h}</H2>
            <Body muted>{s.p}</Body>
          </Card>
        ))}
        <Button title="Show the welcome tour" kind="ghost" onPress={() => router.push({ pathname: '/welcome', params: { tour: '1' } })} />
        <Text style={{ color: t.ink3, fontSize: 12, textAlign: 'center' }}>Something unclear? Tell Rif — it gets fixed.</Text>
      </Screen>
    </>
  );
}

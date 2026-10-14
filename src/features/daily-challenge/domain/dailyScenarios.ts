import type { StreakData } from './dailyAttempt';

export interface DailyScenario {
  id: string;
  scenario: string;
  choices: { label: string; correct: boolean; explanation: string }[];
  lawCitation: string;
}

// Pool of daily scenarios — one is selected per day based on date hash
export const DAILY_SCENARIOS: DailyScenario[] = [
  {
    id: 'coding-wednesday',
    scenario: "You're on EDSA. Your plate ends in 7.\nToday is Wednesday. It's 8:15 AM.\nCan you drive?",
    choices: [
      { label: 'Yes, Wednesday coding is for plates ending in 5 and 6', correct: true, explanation: 'Correct! Wednesday coding is for plates ending in 5 and 6. Plates ending in 7 and 8 are coded on Thursdays.' },
      { label: 'No, I should have left before 7 AM', correct: false, explanation: 'Wrong. Your plate ending in 7 is coded on Thursday, not Wednesday. You can drive today.' },
      { label: 'Yes, coding only applies after 10 AM', correct: false, explanation: 'Wrong reasoning. Coding windows are 7-10 AM and 5-8 PM, but your plate isn\'t coded on Wednesday anyway.' },
    ],
    lawCitation: 'MMDA Number Coding: Mon 1-2, Tue 3-4, Wed 5-6, Thu 7-8, Fri 9-0',
  },
  {
    id: 'jeepney-stop',
    scenario: "A jeepney suddenly stops to pick up passengers in the middle of the road, blocking your lane.\nWhat should you do?",
    choices: [
      { label: 'Honk aggressively and swerve around', correct: false, explanation: 'Dangerous. Swerving without checking blind spots could cause a collision.' },
      { label: 'Slow down, check mirrors, and carefully pass when safe', correct: true, explanation: 'Correct! Always slow down, check your mirrors, and pass safely with adequate clearance.' },
      { label: 'Stop and wait indefinitely', correct: false, explanation: 'While safer than swerving blindly, you should carefully pass when the lane is clear.' },
    ],
    lawCitation: 'RA 4136, Section 41 — Exercise caution when passing stopped vehicles.',
  },
  {
    id: 'drunk-driving',
    scenario: "You're at a friend's birthday. You had 3 bottles of beer.\nYour house is just 2 km away.\nShould you drive home?",
    choices: [
      { label: 'Yes, it\'s just a short drive', correct: false, explanation: 'Distance doesn\'t matter. Drunk driving is illegal regardless of distance.' },
      { label: 'No, take a taxi or have a sober friend drive', correct: true, explanation: 'Correct! Never drive under the influence. The BAC limit is 0.05%, and 3 beers likely exceeds that.' },
      { label: 'Yes, if I drink coffee first', correct: false, explanation: 'Coffee doesn\'t lower BAC. Only time reduces blood alcohol concentration.' },
    ],
    lawCitation: 'RA 10586 (Anti-Drunk Driving Act) — BAC limit: 0.05% non-pro, 0.00% professional.',
  },
  {
    id: 'child-seat',
    scenario: "Your 8-year-old niece (4'8\") is riding with you.\nThe backseat has no child seat.\nWhat should you do?",
    choices: [
      { label: 'Let her sit in front with a regular seatbelt', correct: false, explanation: 'Children under 12 must sit in the back with proper child restraint.' },
      { label: 'She needs a proper child restraint system in the backseat', correct: true, explanation: 'Correct! Under RA 11229, children under 12 or below 4\'11" must use child restraint systems.' },
      { label: 'It\'s fine, she\'s old enough for a regular seatbelt', correct: false, explanation: 'At 8 years old and 4\'8", she still requires a child restraint system.' },
    ],
    lawCitation: 'RA 11229 — Child restraint systems required for children under 12 or below 4\'11".',
  },
  {
    id: 'tricycle-blind-spot',
    scenario: "You're turning right on a narrow Manila street.\nA tricycle is in your right blind spot.\nWhat do you do?",
    choices: [
      { label: 'Turn quickly before the tricycle moves', correct: false, explanation: 'Turning without clearing your blind spot is extremely dangerous.' },
      { label: 'Check your right mirror and blind spot, then turn slowly', correct: true, explanation: 'Correct! Always check mirrors and blind spots before turning, especially on narrow streets.' },
      { label: 'Honk twice and turn', correct: false, explanation: 'Honking doesn\'t make it safe. You must visually confirm the path is clear.' },
    ],
    lawCitation: 'RA 4136, Section 43 — Drivers must signal and check before turning.',
  },
  {
    id: 'flooded-road',
    scenario: "It's been raining heavily in Manila.\nThe underpass ahead has knee-deep flood water.\nDo you cross?",
    choices: [
      { label: 'Yes, drive through slowly', correct: false, explanation: 'Knee-deep water can stall your engine and flood the exhaust. Very risky.' },
      { label: 'No, find an alternate route', correct: true, explanation: 'Correct! Never drive through flood water you can\'t gauge the depth of. Find a safer route.' },
      { label: 'Yes, if I speed through quickly', correct: false, explanation: 'Speeding through floodwater causes hydroplaning and can damage your vehicle severely.' },
    ],
    lawCitation: 'LTO Advisory — Avoid flooded roads. Water above tire level can stall engines and cause accidents.',
  },
  {
    id: 'distracted-driving',
    scenario: "While driving on C5, your phone rings.\nIt's an important work call.\nWhat should you do?",
    choices: [
      { label: 'Answer using the phone on speaker on the dashboard mount', correct: false, explanation: 'Even hands-free devices mounted on the dashboard are restricted under RA 10913.' },
      { label: 'Pull over safely first, then answer', correct: true, explanation: 'Correct! The safest action is to find a safe place to stop before using your phone.' },
      { label: 'Quickly text "call you back"', correct: false, explanation: 'Texting while driving is one of the most dangerous forms of distracted driving.' },
    ],
    lawCitation: 'RA 10913 (Anti-Distracted Driving Act) — Mobile devices while driving are prohibited.',
  },
  {
    id: 'edsa-bus-lane',
    scenario: "You're driving a private car on EDSA.\nThe EDSA Busway lane is clear and your lane is stuck in traffic.\nDo you use the bus lane?",
    choices: [
      { label: 'Yes, it\'s empty so it\'s fine', correct: false, explanation: 'The EDSA Busway is exclusively for buses. Private vehicles face fines and apprehension.' },
      { label: 'No, it\'s exclusively for buses', correct: true, explanation: 'Correct! The EDSA Busway is reserved for public buses only, regardless of traffic conditions.' },
      { label: 'Yes, if I merge back before the next stop', correct: false, explanation: 'Using the bus lane at any point is a violation, even briefly.' },
    ],
    lawCitation: 'DOTr/MMDA EDSA Busway Rules — Private vehicles are prohibited in the busway.',
  },
  {
    id: 'motorcycle-lane',
    scenario: "You see a motorcycle weaving between lanes on Commonwealth Ave.\nYou're about to change lanes.\nWhat should you check?",
    choices: [
      { label: 'Just the rearview mirror', correct: false, explanation: 'Motorcycles can be in blind spots not visible in the rearview mirror.' },
      { label: 'All mirrors and do a shoulder check', correct: true, explanation: 'Correct! Motorcycles are small and fast — always check all mirrors and blind spots.' },
      { label: 'Nothing, motorcycles should watch for cars', correct: false, explanation: 'Regardless of others\' behavior, you\'re responsible for safe lane changes.' },
    ],
    lawCitation: 'RA 4136, Section 41 — Drivers must check before changing lanes.',
  },
  {
    id: 'loading-zone',
    scenario: "You need to drop off a package quickly.\nThe only spot is a No Loading/Unloading zone.\nIt will take just 30 seconds.",
    choices: [
      { label: 'It\'s fine for 30 seconds', correct: false, explanation: 'No Loading zones are enforced regardless of duration. You can be apprehended immediately.' },
      { label: 'Find a proper loading zone even if farther', correct: true, explanation: 'Correct! Always use designated loading/unloading zones. Brief stops in no-loading zones are still violations.' },
      { label: 'Turn on hazard lights and do it quickly', correct: false, explanation: 'Hazard lights don\'t override traffic rules. No loading means no loading.' },
    ],
    lawCitation: 'RA 4136, Section 46 — Loading/unloading only in designated zones.',
  },
  {
    id: 'foggy-mountain',
    scenario: "You're driving through Baguio at dawn.\nFog reduces visibility to about 20 meters.\nWhat should you do?",
    choices: [
      { label: 'Turn on high beams to see better', correct: false, explanation: 'High beams reflect off fog and reduce visibility even more.' },
      { label: 'Use low beams/fog lights and reduce speed', correct: true, explanation: 'Correct! Low beams and fog lights cut through fog better than high beams.' },
      { label: 'Follow the car ahead closely to use their lights', correct: false, explanation: 'Following closely in low visibility is extremely dangerous — you won\'t have time to brake.' },
    ],
    lawCitation: 'RA 4136, Section 34(d) — Use appropriate lights in conditions of reduced visibility.',
  },
  {
    id: 'provincial-bus',
    scenario: "A provincial bus on a national highway is going 90 km/h.\nThe speed limit is 80 km/h.\nYou're behind it. What do you do?",
    choices: [
      { label: 'Match the bus speed to stay with traffic flow', correct: false, explanation: 'Following a speeding vehicle doesn\'t exempt you from speed limits.' },
      { label: 'Maintain 80 km/h and keep safe following distance', correct: true, explanation: 'Correct! Follow the posted speed limit regardless of other vehicles\' speed.' },
      { label: 'Overtake the bus since it\'s speeding', correct: false, explanation: 'Overtaking would require exceeding the speed limit yourself.' },
    ],
    lawCitation: 'RA 4136, Section 35 — Maximum 80 km/h on national highways.',
  },
];

export const getDailyScenario = (date: Date = new Date()): DailyScenario => {
  const dayHash = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  const index = dayHash % DAILY_SCENARIOS.length;
  return DAILY_SCENARIOS[index];
};

/** Reconstructs which scenario was shown on a given YYYY-MM-DD key - the hash is deterministic per date. */
export const getDailyScenarioForDateKey = (dateKey: string): DailyScenario => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return getDailyScenario(new Date(year, month - 1, day));
};

/** YYYY-MM-DD in the viewer's own timezone - the key both storage paths use. */
export const toDateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const getDailyKey = (): string => toDateKey(new Date());

/**
 * The streak after today's challenge is answered. Idempotent: answering a day
 * that is already recorded leaves the streak untouched.
 */
export const updateStreak = (streak: StreakData, todayKey: string): StreakData => {
  if (streak.completedDates.includes(todayKey)) return streak;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toDateKey(yesterday);

  const isConsecutive = streak.lastCompletedDate === yesterdayKey;
  const newStreak = isConsecutive ? streak.currentStreak + 1 : 1;

  return {
    currentStreak: newStreak,
    longestStreak: Math.max(streak.longestStreak, newStreak),
    lastCompletedDate: todayKey,
    completedDates: [...streak.completedDates, todayKey],
  };
};

/** Streak milestones a player has earned. */
export const streakBadges = (longestStreak: number): { icon: string; label: string }[] =>
  [
    { threshold: 7, icon: '🔥', label: '7-Day Streak' },
    { threshold: 14, icon: '⚡', label: '14-Day Streak' },
    { threshold: 30, icon: '👑', label: 'Pro Driver (30 Days)' },
  ]
    .filter(badge => longestStreak >= badge.threshold)
    .map(({ icon, label }) => ({ icon, label }));

/**
 * The local exam bank: 40 LTO-style items with their law citations.
 *
 * This is also the fallback when the `exam_questions` Firestore collection is
 * empty or unreadable. Its ability estimate is Rasch (`@/domain/assessment/rasch`).
 */
export interface ExamQuestion {
  id: number;
  question: string;
  choices: string[];
  correctIndex: number;
  lawCitation: string;
  category: ExamCategory;
}

export type ExamCategory =
  | 'right_of_way'
  | 'traffic_signals'
  | 'road_signs'
  | 'speed_limits'
  | 'overtaking'
  | 'parking'
  | 'pedestrians'
  | 'emergency'
  | 'number_coding'
  | 'general_rules';

export const CATEGORY_LABELS: Record<ExamCategory, string> = {
  right_of_way: 'Right of Way',
  traffic_signals: 'Traffic Signals',
  road_signs: 'Road Signs',
  speed_limits: 'Speed Limits',
  overtaking: 'Overtaking & Lane Discipline',
  parking: 'Parking Rules',
  pedestrians: 'Pedestrian Safety',
  emergency: 'Emergency Situations',
  number_coding: 'Number Coding Scheme',
  general_rules: 'General Traffic Rules',
};

export const EXAM_QUESTIONS: ExamQuestion[] = [
  // Right of Way (5 questions)
  {
    id: 1,
    question: 'At an uncontrolled intersection, who has the right of way?',
    choices: ['The vehicle on the left', 'The vehicle on the right', 'The faster vehicle', 'The larger vehicle'],
    correctIndex: 1,
    lawCitation: 'RA 4136, Section 42(a) — The driver on the right has the right of way at intersections without traffic signs or signals.',
    category: 'right_of_way',
  },
  {
    id: 2,
    question: 'When approaching a rotunda (roundabout), who has the right of way?',
    choices: ['Vehicles entering the rotunda', 'Vehicles already inside the rotunda', 'The larger vehicle', 'Whoever honks first'],
    correctIndex: 1,
    lawCitation: 'RA 4136, Section 42 — Vehicles already in the rotunda have the right of way over entering vehicles.',
    category: 'right_of_way',
  },
  {
    id: 3,
    question: 'An emergency vehicle with sirens is approaching from behind. What should you do?',
    choices: ['Speed up to stay ahead', 'Pull over to the right and stop', 'Honk back to acknowledge', 'Continue at the same speed'],
    correctIndex: 1,
    lawCitation: 'RA 4136, Section 49 — All vehicles must yield and pull to the right upon hearing an emergency siren.',
    category: 'right_of_way',
  },
  {
    id: 4,
    question: 'At a T-intersection without signs, who has the right of way?',
    choices: ['The vehicle on the through road', 'The vehicle turning', 'The vehicle arriving first', 'The vehicle on the left'],
    correctIndex: 0,
    lawCitation: 'RA 4136, Section 42 — Vehicles on the through road have priority at T-intersections.',
    category: 'right_of_way',
  },
  {
    id: 5,
    question: 'A pedestrian is crossing at a marked crosswalk. Who has the right of way?',
    choices: ['The driver', 'The pedestrian', 'Whoever got there first', 'It depends on the speed'],
    correctIndex: 1,
    lawCitation: 'RA 4136, Section 42(d) — Pedestrians on marked crosswalks have the right of way.',
    category: 'right_of_way',
  },

  // Traffic Signals (5 questions)
  {
    id: 6,
    question: 'What does a flashing yellow traffic light mean?',
    choices: ['Stop completely', 'Proceed with caution', 'Speed up before it turns red', 'Yield to pedestrians only'],
    correctIndex: 1,
    lawCitation: 'RA 4136, Section 34 — A flashing yellow light means proceed with caution.',
    category: 'traffic_signals',
  },
  {
    id: 7,
    question: 'When the traffic light turns yellow, what is the correct action?',
    choices: ['Speed up to beat the red', 'Slow down and prepare to stop', 'Stop immediately even if in the intersection', 'Honk and proceed'],
    correctIndex: 1,
    lawCitation: 'RA 4136, Section 34 — Yellow light warns that the signal is about to change to red.',
    category: 'traffic_signals',
  },
  {
    id: 8,
    question: 'A traffic enforcer is directing traffic against the traffic light. Which should you follow?',
    choices: ['The traffic light', 'The traffic enforcer', 'Whichever lets you go faster', 'Wait until both agree'],
    correctIndex: 1,
    lawCitation: 'RA 4136, Section 34 — Traffic enforcers override traffic lights.',
    category: 'traffic_signals',
  },
  {
    id: 9,
    question: 'What does a flashing red traffic light mean?',
    choices: ['Proceed with caution', 'Stop, then proceed when safe', 'The light is broken, ignore it', 'Speed up'],
    correctIndex: 1,
    lawCitation: 'RA 4136, Section 34 — A flashing red light is treated as a stop sign.',
    category: 'traffic_signals',
  },
  {
    id: 10,
    question: 'Can you make a right turn on a red light in the Philippines?',
    choices: ['Yes, always', 'No, never', 'Only if there is a sign allowing it', 'Only if no one is looking'],
    correctIndex: 2,
    lawCitation: 'RA 4136 — Right turn on red is only allowed when a sign specifically permits it.',
    category: 'traffic_signals',
  },

  // Road Signs (4 questions)
  {
    id: 11,
    question: 'A triangular sign with a red border is what type of sign?',
    choices: ['Regulatory', 'Warning', 'Informational', 'Guide'],
    correctIndex: 1,
    lawCitation: 'DPWH Road Sign Manual — Triangular signs with red borders are warning signs.',
    category: 'road_signs',
  },
  {
    id: 12,
    question: 'A circular sign with a red border means what?',
    choices: ['Warning ahead', 'Mandatory/prohibitory instruction', 'Information about the road', 'Speed recommendation'],
    correctIndex: 1,
    lawCitation: 'DPWH Road Sign Manual — Circular signs with red borders are regulatory (prohibitory/mandatory).',
    category: 'road_signs',
  },
  {
    id: 13,
    question: 'What does a "No U-Turn" sign look like?',
    choices: ['Blue circle with U-turn arrow', 'Red circle with U-turn arrow crossed out', 'Yellow triangle with U-turn arrow', 'White rectangle with text'],
    correctIndex: 1,
    lawCitation: 'DPWH Road Sign Manual — No U-Turn is a circular prohibitory sign with a red border.',
    category: 'road_signs',
  },
  {
    id: 14,
    question: 'A diamond-shaped orange sign at a construction zone means:',
    choices: ['Tourist attraction ahead', 'Temporary warning — road work ahead', 'Speed up zone', 'Parking allowed'],
    correctIndex: 1,
    lawCitation: 'DPWH Road Sign Manual — Orange/diamond signs indicate temporary construction zone warnings.',
    category: 'road_signs',
  },

  // Speed Limits (4 questions)
  {
    id: 15,
    question: 'What is the maximum speed limit on a national highway outside city/town limits?',
    choices: ['40 km/h', '60 km/h', '80 km/h', '100 km/h'],
    correctIndex: 2,
    lawCitation: 'RA 4136, Section 35 — Maximum speed on open national highways is 80 km/h for passenger cars.',
    category: 'speed_limits',
  },
  {
    id: 16,
    question: 'What is the speed limit in a school zone?',
    choices: ['20 km/h', '30 km/h', '40 km/h', '60 km/h'],
    correctIndex: 0,
    lawCitation: 'RA 4136, Section 35 — Speed limit in school zones is 20 km/h.',
    category: 'speed_limits',
  },
  {
    id: 17,
    question: 'On a crowded city street, the maximum speed limit is:',
    choices: ['20 km/h', '30 km/h', '40 km/h', '60 km/h'],
    correctIndex: 1,
    lawCitation: 'RA 4136, Section 35 — Maximum speed on crowded streets is 30 km/h.',
    category: 'speed_limits',
  },
  {
    id: 18,
    question: 'When passing a hospital or church, what speed should you maintain?',
    choices: ['Normal speed', 'Not more than 20 km/h', 'Not more than 30 km/h', 'Not more than 40 km/h'],
    correctIndex: 1,
    lawCitation: 'RA 4136, Section 35 — Speed limit near hospitals and churches is 20 km/h.',
    category: 'speed_limits',
  },

  // Overtaking (4 questions)
  {
    id: 19,
    question: 'When is overtaking on the right allowed?',
    choices: ['Never', 'When the vehicle ahead is turning left', 'Whenever there is space', 'On all multi-lane roads'],
    correctIndex: 1,
    lawCitation: 'RA 4136, Section 41(c) — Overtaking on the right is allowed only when the vehicle ahead is making a left turn.',
    category: 'overtaking',
  },
  {
    id: 20,
    question: 'You should NOT overtake when:',
    choices: ['On a straight road with clear visibility', 'Approaching a curve or hill crest', 'On a wide two-lane road', 'The vehicle ahead is slow'],
    correctIndex: 1,
    lawCitation: 'RA 4136, Section 41 — No overtaking on curves, hill crests, intersections, or when vision is obstructed.',
    category: 'overtaking',
  },
  {
    id: 21,
    question: 'What does a solid yellow center line mean?',
    choices: ['You may overtake', 'No overtaking allowed', 'Road is one-way', 'Parking zone'],
    correctIndex: 1,
    lawCitation: 'DPWH Road Markings — A solid yellow center line means no passing/overtaking.',
    category: 'overtaking',
  },
  {
    id: 22,
    question: 'When being overtaken, what should you do?',
    choices: ['Speed up to prevent it', 'Move to the right and slow down slightly', 'Move to the left', 'Honk repeatedly'],
    correctIndex: 1,
    lawCitation: 'RA 4136, Section 41(b) — The driver being overtaken shall give way to the right.',
    category: 'overtaking',
  },

  // Parking (4 questions)
  {
    id: 23,
    question: 'It is illegal to park within how many meters of a fire hydrant?',
    choices: ['3 meters', '4 meters', '5 meters', '6 meters'],
    correctIndex: 2,
    lawCitation: 'RA 4136, Section 46 — Parking within 5 meters of a fire hydrant is prohibited.',
    category: 'parking',
  },
  {
    id: 24,
    question: 'You must NOT park:',
    choices: ['On a wide shoulder', 'Within 6 meters of an intersection', 'In a private parking lot', 'On a one-way street'],
    correctIndex: 1,
    lawCitation: 'RA 4136, Section 46 — Parking within 6 meters of an intersection is prohibited.',
    category: 'parking',
  },
  {
    id: 25,
    question: 'When parking uphill without a curb, your front wheels should:',
    choices: ['Point straight', 'Turn to the right (toward shoulder)', 'Turn to the left', 'It does not matter'],
    correctIndex: 1,
    lawCitation: 'RA 4136 — When parking uphill without a curb, turn wheels toward the shoulder so the car rolls off the road if brakes fail.',
    category: 'parking',
  },
  {
    id: 26,
    question: 'Double parking means:',
    choices: ['Parking in two spots', 'Parking beside an already parked vehicle', 'Parking twice in the same spot', 'Backing into a parking spot'],
    correctIndex: 1,
    lawCitation: 'RA 4136, Section 46 — Double parking (parking alongside a parked vehicle) is illegal.',
    category: 'parking',
  },

  // Pedestrians (3 questions)
  {
    id: 27,
    question: 'When must a driver yield to a pedestrian?',
    choices: ['Only at traffic lights', 'At any marked crosswalk', 'Only when a traffic enforcer says so', 'Never — pedestrians must yield to cars'],
    correctIndex: 1,
    lawCitation: 'RA 4136, Section 42(d) — Drivers must yield to pedestrians at marked crosswalks.',
    category: 'pedestrians',
  },
  {
    id: 28,
    question: 'In a school zone, what extra precaution should you take?',
    choices: ['Honk to warn children', 'Slow to 20 km/h and watch for children', 'Flash your headlights', 'Drive normally if no children are visible'],
    correctIndex: 1,
    lawCitation: 'RA 4136, Section 35 — Reduce speed to 20 km/h in school zones.',
    category: 'pedestrians',
  },
  {
    id: 29,
    question: 'A blind pedestrian with a white cane is at a crosswalk. What should you do?',
    choices: ['Honk to alert them', 'Stop completely and let them cross', 'Flash lights to signal', 'Drive slowly around them'],
    correctIndex: 1,
    lawCitation: 'RA 4136 — Drivers must give full right of way to blind pedestrians with white canes.',
    category: 'pedestrians',
  },

  // Emergency (3 questions)
  {
    id: 30,
    question: 'What should you do if your brakes fail while driving?',
    choices: ['Turn off the engine immediately', 'Pump the brake pedal rapidly and downshift', 'Jump out of the car', 'Honk continuously'],
    correctIndex: 1,
    lawCitation: 'LTO Driver Education — Pump brakes rapidly and downshift to use engine braking.',
    category: 'emergency',
  },
  {
    id: 31,
    question: 'If your tire blows out at high speed, you should:',
    choices: ['Brake hard immediately', 'Grip the steering wheel firmly and slow down gradually', 'Swerve to the shoulder immediately', 'Accelerate to maintain control'],
    correctIndex: 1,
    lawCitation: 'LTO Driver Education — Grip wheel firmly, ease off gas, and slow down gradually. Do not brake hard.',
    category: 'emergency',
  },
  {
    id: 32,
    question: 'Early warning devices (EWD) must be placed how far from a stalled vehicle on a highway?',
    choices: ['2 meters', '4 meters', 'At least 4 meters in front and behind', 'Only behind the vehicle'],
    correctIndex: 2,
    lawCitation: 'RA 4136 — EWDs must be placed at least 4 meters in front and behind a stalled vehicle.',
    category: 'emergency',
  },

  // Number Coding (3 questions)
  {
    id: 33,
    question: 'Under the MMDA Number Coding Scheme, vehicles with plates ending in 1 and 2 are banned on:',
    choices: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    correctIndex: 0,
    lawCitation: 'MMDA Resolution — Plates ending in 1 and 2 are coded on Mondays.',
    category: 'number_coding',
  },
  {
    id: 34,
    question: 'What hours does the MMDA number coding window cover?',
    choices: ['6 AM to 9 AM only', '7 AM to 8 PM (with midday window)', '7 AM to 10 AM and 5 PM to 8 PM', '24 hours'],
    correctIndex: 2,
    lawCitation: 'MMDA Number Coding — Window hours: 7:00-10:00 AM and 5:00-8:00 PM on weekdays.',
    category: 'number_coding',
  },
  {
    id: 35,
    question: 'Plates ending in 5 and 6 are banned on which day?',
    choices: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    correctIndex: 2,
    lawCitation: 'MMDA Resolution — 5 and 6: Wednesday. (1-2: Mon, 3-4: Tue, 5-6: Wed, 7-8: Thu, 9-0: Fri)',
    category: 'number_coding',
  },

  // General Rules (5 questions)
  {
    id: 36,
    question: 'What is the legal blood alcohol concentration (BAC) limit for driving in the Philippines?',
    choices: ['0.01%', '0.05%', '0.08%', 'Zero tolerance'],
    correctIndex: 1,
    lawCitation: 'RA 10586 (Anti-Drunk Driving Act) — BAC limit is 0.05% for non-professional and 0.00% for professional drivers.',
    category: 'general_rules',
  },
  {
    id: 37,
    question: 'The Anti-Distracted Driving Act prohibits:',
    choices: ['Talking to passengers', 'Using mobile phones while driving', 'Listening to the radio', 'Eating while parked'],
    correctIndex: 1,
    lawCitation: 'RA 10913 (Anti-Distracted Driving Act) — Use of mobile devices while driving is prohibited.',
    category: 'general_rules',
  },
  {
    id: 38,
    question: 'Child safety seats are mandatory for children aged:',
    choices: ['Below 6 years old', 'Below 10 years old', 'Below 12 years old who are below 4\'11"', 'All children under 18'],
    correctIndex: 2,
    lawCitation: 'RA 11229 (Child Safety in Motor Vehicles Act) — Children under 12 years old or below 4\'11" must use child restraint systems.',
    category: 'general_rules',
  },
  {
    id: 39,
    question: 'Seatbelts are required for:',
    choices: ['Only the driver', 'Driver and front passenger', 'All occupants of the vehicle', 'Only on highways'],
    correctIndex: 2,
    lawCitation: 'RA 8750 (Seat Belt Use Act) — All vehicle occupants must wear seat belts.',
    category: 'general_rules',
  },
  {
    id: 40,
    question: 'What document must you always carry while driving?',
    choices: ['Birth certificate', 'Valid driver\'s license and vehicle registration', 'Passport', 'Barangay clearance'],
    correctIndex: 1,
    lawCitation: 'RA 4136, Section 15 — Drivers must carry a valid license and official receipt of vehicle registration.',
    category: 'general_rules',
  },
];

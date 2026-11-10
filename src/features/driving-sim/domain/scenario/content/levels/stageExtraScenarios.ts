import type { SlotVariant } from '@/features/driving-sim/domain/scenario/pooling';

// DRAFT CONTENT (2026-10-28) for the group's review and the LTO's validation.
// Every scenario cites the module text it tests (by level and section); the
// FDM page is still to be verified for each, like the rest of the catalogue.
//
// Each is portable - a checkpoint question, or a decision graded from speed,
// lane and stopping - so the composer can append it to its stage's road, and
// borrow it into a later stage the competency is spread to.

const L3_IMG = 'arangkada_extracted_images/level3/';
const L7_IMG = 'arangkada_extracted_images/level7/';

// --- Level 7: Speed, Following, Overtaking, Expressways -----------------------

const level7: SlotVariant[] = [
  // hazard_awareness: the stage had one hazard scenario of its own.
  {
    id: 'level7.extra.crosswind-on-the-bridge',
    label: 'Crosswind on the bridge',
    type: 'obstacle_ahead',
    description:
      'The expressway climbs onto a long open bridge. The flags on the lamp posts stand straight out sideways, and the car ahead of you twitches as a gust catches it.',
    recommendedMove: 'Ease off before the bridge and hold the wheel firmly.',
    correctAction: 'brake',
    points: 25,
    warningDistance: 700,
    penaltyMessage:
      'You took the open bridge at full speed in a crosswind. A gust moves a fast car further across its lane than a slow one, and there is nowhere to go on a bridge.',
    rewardMessage: 'Correct. You came off the speed before the gusts reached you.',
    duration: 200,
    lawCitation:
      'Level 7 module, Expressway Driving Tips: "Be aware of crosswinds, especially on bridges and open stretches." Level 7 module, Speed Limits Under RA 4136: drive at a careful and prudent speed, no greater than is reasonable for the conditions.',
    competency: 'hazard_awareness',
    severity: 'major',
  },
  {
    id: 'level7.extra.hazards-on-ahead',
    label: 'Hazard lights ahead',
    type: 'obstacle_ahead',
    description:
      'A car ahead in your lane switches on its hazard lights and begins slowing sharply toward the shoulder. Something is wrong with it.',
    recommendedMove: 'Ease off now and keep a full two-second gap.',
    correctAction: 'brake',
    points: 25,
    warningDistance: 900,
    penaltyMessage:
      'Hazard lights on an expressway mean a vehicle is stopping for an emergency. You held your speed and closed on it.',
    rewardMessage: 'Correct. You read the hazard lights as a stop coming and opened the gap early.',
    duration: 200,
    lawCitation:
      'Level 7 module, Merging And Toll Exit Procedure: "On an expressway, switch on the hazard warning lights only when stopping for an emergency." Expressway Driving Tips: "Maintain a safe following distance at all times."',
    competency: 'hazard_awareness',
    severity: 'critical',
    npc: {
      path: 'travelling_ahead',
      vehicleKind: 'car',
      label: 'the car with its hazards on',
      hazards: true,
      approachSpan: 1000,
      entryHeadway: 3.5,
      speed: { cruise: 0.62, slowsTo: 0.35, slowsFrom: 420 },
    },
    following: {
      seconds: 2,
      tooCloseMessage:
        'You were inside two seconds of a car that was already slowing for an emergency. Hazard lights are the earliest warning you will get.',
    },
  },
  // parking: spread to Level 7 (2026-10-28).
  {
    id: 'level7.extra.photo-stop',
    type: 'scenario_trigger',
    scene: 'open_road',
    description:
      'Your passenger asks you to pull over on the expressway shoulder for a photo of the view. A NO STOPPING ANYTIME sign stands at the shoulder ahead.',
    correctAction: 'accelerate',
    avoid: ['stop'],
    recommendedMove: 'Keep going. Stop only in a designated place.',
    points: 20,
    warningDistance: 340,
    penaltyMessage:
      'You stopped on the expressway for a photo. Standing, stopping or parking is not allowed on an expressway except in designated places.',
    rewardMessage: 'Correct. You kept going: an expressway shoulder is not a place to stop for a view.',
    duration: 200,
    lawCitation:
      'Level 7 module, Expressway Rules: "Standing, stopping, loading, unloading, or parking is not allowed except in designated places." Level 6 module, Before You Choose The Space: do not stop where official signs prohibit it.',
    competency: 'parking',
    severity: 'major',
    sign: {
      image: L3_IMG + 'no-stopping-anytime.png',
      name: 'No Stopping Anytime',
      category: 'A. Regulatory Sign — Parking And Stopping',
      meaning: 'The vehicle may not stop in the marked area at any time.',
      art: 'rect_instruction',
      glyph: 'NO STOPPING',
    },
  },
  {
    id: 'level7.extra.drop-off-on-the-ramp',
    type: 'scenario_trigger',
    scene: 'open_road',
    description:
      'A friend riding with you asks to be let out here, at the side of the expressway near the exit, so they can walk the rest of the way.',
    correctAction: 'accelerate',
    avoid: ['stop'],
    recommendedMove: 'Do not unload on the expressway. Drop them off after the exit.',
    points: 20,
    warningDistance: 340,
    penaltyMessage:
      'You stopped to let a passenger out on the expressway. Unloading is not allowed there except in designated places, and no person may cross or leave the expressway except at designated points.',
    rewardMessage: 'Correct. You kept going and will let them out after the exit.',
    duration: 200,
    lawCitation:
      'Level 7 module, Expressway Rules: "No person or vehicle may enter, exit, or cross the expressway except at designated entry, exit, or interchange points." "Standing, stopping, loading, unloading, or parking is not allowed except in designated places."',
    competency: 'parking',
    severity: 'major',
  },
  // road_signs: spread to Level 7 (2026-10-28).
  {
    id: 'level7.extra.check-brakes-sign',
    type: 'obstacle_ahead',
    scene: 'open_road',
    description:
      'A CHECK BRAKES, REDUCE SPEED NOW sign stands at the start of a long descent ahead.',
    correctAction: 'brake',
    points: 20,
    duration: 200,
    penaltyMessage: 'The sign asks for the speed to come off now, before the descent demands it. You held your speed past it.',
    rewardMessage: 'Correct. You tested your brakes and slowed at the sign.',
    lawCitation:
      'Level 7 module, Merge-Lane Warning Signage: "Check Brakes, Reduce Speed Now — posted in conjunction with a merge or descent on the expressway; test your brakes and slow down before the situation demands it."',
    competency: 'road_signs',
    severity: 'major',
    sign: {
      image: L7_IMG + 'check-brakes-reduce-speed.png',
      name: 'Check Brakes, Reduce Speed Now',
      category: 'Expressway Signage',
      meaning: 'Test your brakes and slow down before the descent or merge ahead.',
      art: 'rect_instruction',
      glyph: 'CHECK BRAKES',
    },
  },
];

// --- Level 8: Defensive Driving Mindset ----------------------------------------

const level8: SlotVariant[] = [
  // general_rules: the stage had one general-rules scenario of its own.
  {
    id: 'level8.extra.difficult-enforcer',
    label: 'At the checkpoint',
    type: 'stop_sign',
    description:
      'An enforcer at a checkpoint stops you and, in your view, is rude and wrong about what you did.',
    correctAction: 'stop',
    points: 25,
    warningDistance: 560,
    question: 'How do you handle it?',
    choices: [
      { label: 'Stay polite, comply now, and take any complaint to the proper office later', action: 'stop' },
      { label: 'Argue it out at the roadside until the enforcer backs down', action: 'accelerate' },
      { label: 'Drive off: an enforcer who is wrong has no authority over you', action: 'brake' },
    ],
    penaltyMessage:
      'Arguing at the roadside, or leaving, turns a disagreement into a confrontation. Comply politely and save the complaint for the proper venue.',
    rewardMessage: 'Correct. Polite now, and the complaint goes where it can be heard.',
    duration: 220,
    lawCitation:
      'Level 8 module, Managing Stress While Driving, unlawful or difficult traffic enforcers: "Be polite. Comply rather than argue at the roadside. Save formal complaints for the proper venue and time, not the driver\'s seat. Use a dashcam or phone to document an incident if needed." Courtesy And Road Discipline: be courteous to traffic enforcers.',
    competency: 'general_rules',
    severity: 'major',
    inspection: {
      officerLine: 'Pakitabi po muna. Bakit po kayo lumusot doon?',
      documentType: 'Traffic Stop',
      holder: 'You',
      fields: [
        { label: 'Officer', value: 'Raising their voice' },
        { label: 'As far as you know', value: 'No rule broken' },
      ],
      vehicle: 'Private passenger car',
      tripPurpose: 'Private trip',
    },
  },
  {
    id: 'level8.extra.not-fit-to-drive',
    label: 'Before the drive home',
    type: 'stop_sign',
    description:
      'You have pulled into a gas station after a long party. You slept three hours, and the cold medicine you took says it may cause drowsiness.',
    correctAction: 'stop',
    points: 25,
    warningDistance: 560,
    question: 'Should you drive the rest of the way home now?',
    choices: [
      { label: 'No — rest first, or let a fit driver take over', action: 'stop' },
      { label: 'Yes — open the windows and turn the music up to stay awake', action: 'accelerate' },
      { label: 'Yes — it is only twenty minutes, so the medicine will not matter', action: 'brake' },
    ],
    penaltyMessage:
      'Fatigue, a late party and drowsy medicine each reduce your capacity to react. Pushing through them is how these crashes start.',
    rewardMessage: 'Correct. A driver who is not fit does not take the wheel.',
    duration: 220,
    lawCitation:
      'Level 8 module, Driver Wellness And Human Factors In Crashes: fatigue — "Observe reasonable driving hours and plan rest stops beforehand"; partying — "Limit the time spent before a drive"; illness — "Avoid driving if not physically fit." Hazards Around You: "If you are taking medicine that can affect your driving, do not drive, or consult a doctor first."',
    competency: 'general_rules',
    severity: 'major',
    inspection: {
      officerLine: 'Before you start the engine again, check yourself.',
      documentType: 'Driver Fitness Check',
      holder: 'You',
      fields: [
        { label: 'Sleep', value: '3 hours' },
        { label: 'Medicine', value: 'Cold tablet — may cause drowsiness' },
        { label: 'Distance home', value: '20 minutes' },
      ],
      vehicle: 'Private passenger car',
      tripPurpose: 'Drive home',
    },
  },
  // traffic_signals: spread to Level 8 (2026-10-28).
  {
    id: 'level8.extra.malfunctioning-signal',
    type: 'yellow_light',
    scene: 'signal',
    description:
      'The signal at the junction ahead is stuck flashing yellow, and drivers on the cross street are edging out without waiting.',
    correctAction: 'brake',
    points: 25,
    duration: 220,
    penaltyMessage:
      'A malfunctioning signal hands every driver the judgment, and some of them will get it wrong. Slow and read the junction before you cross it.',
    rewardMessage: 'Correct. You slowed and read the junction before crossing it.',
    lawCitation:
      'Level 3 module: a flashing yellow signal means slow down and proceed with caution. Level 8 module, Managing Stress: malfunctioning traffic lights are a common cause of stress; stay calm and drive defensively.',
    competency: 'traffic_signals',
    severity: 'critical',
    sign: {
      name: 'Flashing Yellow',
      category: 'Traffic Lights And Signals',
      meaning: 'Slow down and proceed with caution.',
      art: 'signal_head',
      aspect: 'flashing_yellow',
    },
  },
];

// --- Level 9: Emergencies And Road Crashes ------------------------------------

const level9: SlotVariant[] = [
  // parking: spread to Level 9 (2026-10-28).
  {
    id: 'level9.extra.no-stopping-at-the-bridge',
    type: 'scenario_trigger',
    scene: 'open_road',
    description:
      'Your engine has started to knock and you want to stop and look. A NO STOPPING ANYTIME sign stands at the narrow bridge just ahead; there is a wide shoulder past it.',
    correctAction: 'accelerate',
    avoid: ['stop'],
    recommendedMove: 'Do not stop at the sign. Ease on to the safe shoulder past the bridge.',
    points: 20,
    warningDistance: 340,
    penaltyMessage:
      'You stopped where a sign prohibits stopping, on the approach to a narrow bridge. A breakdown stop goes to the safest available position, off the travel lane.',
    rewardMessage: 'Correct. You kept going to a place where a stop is both allowed and safe.',
    duration: 200,
    lawCitation:
      'Level 9 module, Breakdown Procedure: "Move the vehicle to the safest available position, off the main travel lane if possible." Level 6 module, Before You Choose The Space: do not stop where official signs prohibit it.',
    competency: 'parking',
    severity: 'major',
    sign: {
      image: L3_IMG + 'no-stopping-anytime.png',
      name: 'No Stopping Anytime',
      category: 'A. Regulatory Sign — Parking And Stopping',
      meaning: 'The vehicle may not stop in the marked area at any time.',
      art: 'rect_instruction',
      glyph: 'NO STOPPING',
    },
  },
];

// --- Level 10: Safety Laws In Daily Driving ------------------------------------

const level10: SlotVariant[] = [
  // driver_legality: spread to Level 10 (2026-10-28).
  {
    id: 'level10.extra.dui-license-consequence',
    label: 'LTO checkpoint',
    type: 'stop_sign',
    description: 'An enforcer at a checkpoint explains what a drunk-driving conviction would mean for your license.',
    correctAction: 'stop',
    points: 25,
    warningDistance: 560,
    question: 'You hold a non-professional license. What does a first conviction under RA 10586 do to it?',
    choices: [
      { label: 'Confiscated and suspended for 12 months', action: 'stop' },
      { label: 'Perpetually revoked', action: 'brake' },
      { label: 'Nothing: only the fine applies on a first conviction', action: 'accelerate' },
    ],
    penaltyMessage:
      'A first conviction confiscates a non-professional license and suspends it for 12 months; a second revokes it. Perpetual revocation on the first conviction is the rule for a professional license.',
    rewardMessage: 'Correct. Twelve months suspended on the first conviction, revoked on the second.',
    duration: 220,
    lawCitation:
      "Level 10 module, Anti-Drunk And Drugged Driving Act (RA 10586): \"A professional driver's license is confiscated and perpetually revoked on the first conviction. A non-professional driver's license is confiscated and suspended for 12 months on the first conviction, and revoked on the second.\"",
    competency: 'driver_legality',
    severity: 'major',
    inspection: {
      officerLine: 'Paalala lang po tungkol sa lisensya ninyo.',
      documentType: "Non-Professional Driver's License",
      holder: 'SANTOS, ANA P.',
      fields: [
        { label: 'License', value: 'Non-Professional' },
        { label: 'Status', value: 'Active' },
      ],
      vehicle: 'Private passenger car',
      tripPurpose: 'Private trip',
    },
  },
  // document_awareness: spread to Level 10 (2026-10-28).
  {
    id: 'level10.extra.emission-test-date',
    label: 'Registration check',
    type: 'stop_sign',
    description: 'You stop to check your papers before going to the LTO to renew the registration.',
    correctAction: 'stop',
    points: 25,
    warningDistance: 560,
    question: 'Your emission test was done 75 days ago. Can it be used for this renewal?',
    choices: [
      { label: 'No — test results must be presented within 60 days of testing', action: 'stop' },
      { label: 'Yes — an emission test is valid for the whole registration year', action: 'accelerate' },
      { label: 'Yes — the emission test is not needed for renewal', action: 'brake' },
    ],
    penaltyMessage:
      'Emission test results must be presented to the LTO within 60 days of testing, as a prerequisite for registration or renewal. A 75-day-old test has to be redone.',
    rewardMessage: 'Correct. Past 60 days, the test has to be done again before renewal.',
    duration: 220,
    lawCitation:
      'Level 10 module, Clean Air Act (RA 8749): "Test results must be presented to the LTO within 60 days of testing, as a prerequisite for registration or renewal."',
    competency: 'document_awareness',
    severity: 'major',
    inspection: {
      officerLine: 'Check the emission certificate before the renewal.',
      documentType: 'Emission Test Result',
      holder: 'NCP 3719',
      fields: [
        { label: 'Tested', value: '75 days ago' },
        { label: 'Result', value: 'Passed' },
        { label: 'Renewal', value: 'Due this week' },
      ],
      vehicle: 'Private passenger car',
      tripPurpose: 'Registration renewal',
    },
  },
];

// --- Level 11: Motorcycles, Tricycles, PUVs ------------------------------------

const level11: SlotVariant[] = [
  // driver_legality: spread to Level 11 (2026-10-28).
  {
    id: 'level11.extra.tricycle-for-hire-license',
    label: 'Tricycle at a checkpoint',
    type: 'stop_sign',
    description: 'You are driving your uncle\'s tricycle for hire today, and an enforcer at a checkpoint asks for your license.',
    correctAction: 'stop',
    points: 25,
    warningDistance: 560,
    question: 'Your license is a non-professional one. May you drive the tricycle for hire?',
    choices: [
      { label: 'No-Go — a for-hire tricycle needs a professional license', action: 'stop' },
      { label: 'Go — any valid license covers a tricycle', action: 'accelerate' },
      { label: 'Go — a tricycle needs no license inside the barangay', action: 'brake' },
    ],
    penaltyMessage:
      'A tricycle driven for hire calls for a professional driver\'s license. Driving one with an invalid license, or with none, is a common tricycle violation.',
    rewardMessage: 'Correct. For hire means a professional license.',
    duration: 220,
    lawCitation:
      "Level 11 module, Proper Tricycle Operation: \"Use a professional driver's license for a for-hire tricycle.\" Common Tricycle Violations: \"Driving with expired registration, or with an invalid license or no license.\"",
    competency: 'driver_legality',
    severity: 'major',
    inspection: {
      officerLine: 'Lisensya po, at papeles ng tricycle.',
      documentType: "Non-Professional Driver's License",
      holder: 'REYES, MARCO D.',
      fields: [
        { label: 'License', value: 'Non-Professional — valid' },
        { label: 'Vehicle', value: 'Tricycle, for hire' },
      ],
      vehicle: 'Motorized tricycle — for hire',
      tripPurpose: 'Carrying fare-paying passengers',
    },
  },
  // document_awareness: spread to Level 11 (2026-10-28).
  {
    id: 'level11.extra.tricycle-mtop',
    label: 'Tricycle papers',
    type: 'stop_sign',
    description: 'An enforcer at a checkpoint looks over a tricycle for hire. Its registration is current, but there is no MTOP, ID or fare matrix on display.',
    correctAction: 'stop',
    points: 25,
    warningDistance: 560,
    question: 'Is this tricycle ready to carry passengers for hire?',
    choices: [
      { label: 'Go — current LTO registration is all a tricycle needs', action: 'accelerate' },
      { label: 'No-Go — the MTOP with its receipt, the ID and the fare matrix must all be visible', action: 'stop' },
      { label: 'Go — a tricycle needs an LTFRB franchise, not an MTOP', action: 'brake' },
    ],
    penaltyMessage:
      'A for-hire tricycle runs on the LGU\'s Motorized Tricycle Operator\'s Permit, and the MTOP with its official receipt, an ID and the fare matrix must all be visible. Registration alone does not make it a lawful for-hire vehicle.',
    rewardMessage: 'Correct. Without the MTOP, ID and fare matrix on display, it does not carry passengers.',
    duration: 220,
    lawCitation:
      "Level 11 module, Tricycle Registration, Franchise: \"A tricycle does not need a Certificate of Public Convenience (CPC) from the LTFRB; the concerned Local Government Unit regulates tricycle operation and grants franchises within its own territory.\" \"A Motorized Tricycle Operator's Permit (MTOP) with official receipt, an identification card, and the fare matrix must all be visible.\"",
    competency: 'document_awareness',
    severity: 'major',
    inspection: {
      officerLine: 'Nasaan po ang MTOP at fare matrix?',
      documentType: 'Tricycle — For Hire',
      holder: 'TODA unit 114',
      fields: [
        { label: 'LTO registration', value: 'Current' },
        { label: 'MTOP and receipt', value: 'Not displayed' },
        { label: 'ID and fare matrix', value: 'Not displayed' },
      ],
      vehicle: 'Motorized tricycle — for hire',
      tripPurpose: 'Carrying fare-paying passengers',
    },
  },
  // parking: spread to Level 11 (2026-10-28).
  {
    id: 'level11.extra.waiting-at-the-corner',
    type: 'scenario_trigger',
    scene: 'side_road',
    description:
      'You are picking up a friend who said to meet at the corner. The corner ahead is where a side street meets your road.',
    correctAction: 'accelerate',
    avoid: ['stop'],
    noStandingWithin: 6,
    recommendedMove: 'Do not wait within six meters of the corner.',
    points: 20,
    warningDistance: 340,
    penaltyMessage:
      'You stopped to wait within six meters of an intersection. Parking or waiting there blocks the view and the turn of everyone using the junction.',
    rewardMessage: 'Correct. You did not wait at the corner itself.',
    duration: 200,
    lawCitation:
      'Level 11 module, Common Tricycle Violations: "Parking or waiting within six meters of an intersection." Level 6 module, Before You Choose The Space: "Not within 6 meters of the intersection of curb lines."',
    competency: 'parking',
    severity: 'major',
  },
];

/** The extra scenarios, by stage. Level 2's general-rules additions are garage points (`level2.ts`). */
export const STAGE_EXTRA_SCENARIOS: Record<number, SlotVariant[]> = {
  7: level7,
  8: level8,
  9: level9,
  10: level10,
  11: level11,
};

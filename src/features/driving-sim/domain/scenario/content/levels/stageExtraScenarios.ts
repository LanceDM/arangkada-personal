import type { SlotVariant } from '@/features/driving-sim/domain/scenario/pooling';

// DRAFT CONTENT (2026-10-28) for the group's review and an official validation.
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
      'Level 7 module, Expressway Driving Tips: "Be aware of crosswinds, especially on bridges and open stretches." Level 7 module, Speed Limits Under Republic Act No. 4136: drive at a careful and prudent speed, no greater than is reasonable for the conditions.',
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
  // speed_control (2026-11-16, future work): written from the speed-limits
  // pack, F6 and S1 only.
  {
    id: 'level7.extra.minimum-sixty',
    type: 'speed_limit',
    scene: 'open_road',
    speedRule: 'minimum',
    postedSpeed: 60,
    description: 'A MINIMUM SPEED RESTRICTION sign reading 60 stands beside the expressway ahead.',
    correctAction: 'accelerate',
    points: 20,
    penaltyMessage: 'You were below the posted minimum. On the expressway the minimum speed is 60 km/h.',
    rewardMessage: 'Correct. You kept up to the 60 km/h minimum.',
    duration: 200,
    lawCitation:
      'Level 7 module: "Except where a specific speed limit is posted, the expressway minimum speed is 60 km/h and the maximum is 100 km/h." FDM Vol. 1, Expressway Rules and Regulations: "8. Speed limits (except in areas where specific speed limits are posted) a. Minimum: 60 kph b. Maximum: 100 kph". Speed Signs: "Minimum speed restrictions".',
    competency: 'speed_control',
    severity: 'major',
    sign: {
      name: 'Minimum Speed Restriction',
      category: 'A. Regulatory Sign — Speed',
      meaning: 'Vehicles must not travel slower than the posted speed.',
      art: 'circle_limit',
      glyph: '60',
    },
  },
  // 2026-11-17: written from the expressway source material and the
  // speed-limits pack only. Each stands on the expressway itself:
  // a course drive places Level 7's extras on road inserted after the Lane 1
  // yield slot (`MAINLINE_STRETCH_AT`), never past the toll plaza.
  //
  // road_signs: speed-limits pack S3, graded at the pack's labelled
  // expressway "slow down", 60% of the 100 that applies there (§3).
  {
    id: 'level7.extra.driver-must-slow-down',
    label: 'Driver must slow down',
    type: 'speed_limit',
    scene: 'open_road',
    speedRule: 'maximum',
    // The sign names no number (labelled, speed-limits pack §3).
    postedSpeed: 60,
    description: 'A DRIVER MUST SLOW DOWN sign stands beside the expressway ahead.',
    recommendedMove: 'Slow down at the sign.',
    correctAction: 'brake',
    points: 20,
    penaltyMessage: 'The sign says the driver must slow down. You passed it without slowing.',
    rewardMessage: 'Correct. You slowed down at the sign.',
    duration: 200,
    lawCitation: 'FDM Vol. 1, Traffic Instruction Signs: "Driver must slow down".',
    competency: 'road_signs',
    severity: 'major',
    sign: {
      image: L3_IMG + 'driver-must-slow-down.png',
      name: 'Driver Must Slow Down',
      category: 'E. Traffic Instruction Sign',
      meaning: 'The driver must slow down.',
      art: 'rect_instruction',
      glyph: 'SLOW DOWN',
    },
  },
  // road_signs: speed-limits pack S2. No source sets its figure: 80 is
  // labelled, as Level 3's 30 is, between the expressway's 60 and 100 (F6).
  {
    id: 'level7.extra.preferred-max-80',
    label: 'Preferred maximum speed',
    type: 'speed_limit',
    scene: 'open_road',
    speedRule: 'maximum',
    postedSpeed: 80,
    description: 'A PREFERRED MAXIMUM SPEED sign for normal weather and traffic conditions shows 80 beside the expressway ahead.',
    recommendedMove: 'Bring your speed down to 80 by the sign.',
    correctAction: 'brake',
    points: 20,
    penaltyMessage: 'The sign gives the preferred maximum speed during normal weather traffic conditions. You passed it above that speed.',
    rewardMessage: 'Correct. You were at or under the preferred maximum speed at the sign.',
    duration: 200,
    lawCitation: 'FDM Vol. 1, warning signs: "Preferred maximum speed during normal weather traffic conditions". The figure on this plate is the game\'s own: no source sets one.',
    competency: 'road_signs',
    severity: 'major',
    sign: {
      // No image: the plate is drawn from the glyph, the figure posted here.
      name: 'Preferred Maximum Speed (Normal Weather)',
      category: 'B. Warning Sign — Supplementary',
      meaning: 'Preferred maximum speed during normal weather traffic conditions.',
      art: 'diamond',
      glyph: '80',
    },
  },
  // parking: expressway pack T7, G2 and X3. Graded only on not stopping on
  // the expressway: whether a lay-by stop is allowed is where review items 46
  // and 50 disagree (K1), so nothing here turns on it.
  {
    id: 'level7.extra.tired-rest-area',
    label: 'Tired, rest area ahead',
    type: 'scenario_trigger',
    scene: 'open_road',
    description:
      'You are getting sleepy. A REST AREA sign beside the expressway gives the distance and direction to the rest area ahead.',
    correctAction: 'accelerate',
    avoid: ['stop'],
    recommendedMove: 'Keep going to the rest area. Do not stop on the expressway.',
    points: 20,
    warningDistance: 340,
    penaltyMessage:
      'You stopped on the expressway. No one may stand, stop, load, unload or park a vehicle there except in designated places.',
    rewardMessage: 'Correct. You kept going to take your break at the rest area.',
    duration: 200,
    lawCitation:
      'FDM Vol. 1, Expressway Driving Tips: "7. Rest in a safe place when tired or sleepy. Don\'t take chances -- do take a break." FDM Vol. 1, Expressway Rules and Regulations: "3. A person or group of persons is not allowed or permitted to stand, stop, load, unload, or park a vehicle in the Limited Access Facilities except in designated places." Expressway Service Signs: "Distance and direction to rest areas".',
    competency: 'parking',
    severity: 'major',
    sign: {
      // The face is an image in FDM Vol. 1 (expressway pack, needs visual
      // check); the plate is drawn from its glyph.
      name: 'Rest Area',
      category: 'Expressway Service Sign',
      meaning: 'Distance and direction to rest areas.',
      art: 'rect_instruction',
      glyph: 'REST AREA',
    },
  },
  // right_of_way: expressway pack E1, E2. Graded on the lane only: E1 also
  // says to stop, which the expressway's rule 3 forbids (K2), so neither a
  // stop nor keeping speed decides it.
  {
    id: 'level7.extra.ambulance-behind',
    label: 'Ambulance behind you',
    type: 'emergency_vehicle',
    description: 'An ambulance is coming up behind you on the expressway with its siren on.',
    recommendedMove: 'Move over to the right-hand lane and let it through.',
    correctAction: 'accelerate',
    points: 25,
    warningDistance: 700,
    penaltyMessage:
      'An ambulance giving an audible signal was behind you. Every other driver has to move as near as possible to the right-hand edge of the road.',
    rewardMessage: 'Correct. You moved to the right-hand lane and gave the ambulance the road.',
    duration: 200,
    lawCitation:
      'FDM Vol. 1, Emergency Vehicles: "Upon the approach of any police or fire department vehicle, or of an ambulance giving audible signal, the driver of every other vehicle shall immediately drive the same to a position as near as possible and parallel to the right-hand edge or curb of the highway…" "Give the priority right-of-way to emergency vehicles".',
    competency: 'right_of_way',
    severity: 'critical',
    requiredLane: {
      lane: 'curb',
      hint: 'Move over to the right-hand lane',
      wrongLaneMessage: 'You stayed out of the right-hand lane with an ambulance behind you. Move as near as possible to the right-hand edge.',
    },
    npc: {
      path: 'closing_from_behind',
      vehicleKind: 'ambulance',
      label: 'an ambulance with its siren on',
    },
  },
  // right_of_way: expressway pack X6, a second form of the Lane 1 yield slot.
  {
    id: 'level7.extra.faster-car-lane1',
    label: 'Faster car in Lane 1',
    type: 'scenario_trigger',
    description: 'A car is coming up fast behind you in Lane 1, the overtaking lane.',
    recommendedMove: 'Keep out of Lane 1 and let it pass.',
    correctAction: 'accelerate',
    points: 20,
    warningDistance: 700,
    penaltyMessage: 'You were in Lane 1 as a faster car came up behind you. Lane 1 is for overtaking, and an overtaking vehicle does not have right-of-way.',
    rewardMessage: 'Correct. You kept out of Lane 1 and let the faster car through.',
    duration: 200,
    lawCitation:
      'FDM Vol. 1, Expressway Rules and Regulations: "6. Lane No. 1 (innermost lane) or the lane nearest the Median Barrier or Median shall be used only for overtaking another vehicle but within the allowed speed. Overtaking vehicles, however, do not have right-of-way."',
    competency: 'right_of_way',
    severity: 'major',
    npc: {
      path: 'closing_from_behind',
      closing: { approach: 1.15, pass: 1.25, holdSeconds: 1.8 },
      vehicleKind: 'car',
      label: 'the car coming up Lane 1',
      lane: 'inner',
      color: '#7c2d12',
      approachSpan: 620,
    },
    requiredLane: {
      lane: 'middle',
      hint: 'Keep out of Lane 1',
      strict: true,
      wrongLaneMessage: 'You were in Lane 1 with a faster car behind you. Lane 1 is for overtaking only.',
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
    description: "At a road-safety checkpoint, the officer asks you about a drive home after a long party, three hours' sleep and a cold tablet that may cause drowsiness.",
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
  // general_rules (2026-11-16, future work): written from the Level 12 pack's
  // Row B (driver responsibilities, mapped to Levels 1, 8 and 12): R1, R2, R7, R8.
  {
    id: 'level8.extra.secure-before-leaving',
    label: 'Leaving the car',
    type: 'stop_sign',
    description: "At a road-safety checkpoint, the officer asks what you do before leaving your car for a few minutes at a shop.",
    correctAction: 'stop',
    points: 25,
    warningDistance: 560,
    question: 'What does a responsible driver do before leaving the vehicle?',
    choices: [
      { label: 'Take appropriate measures to secure and safeguard the vehicle first', action: 'stop' },
      { label: 'Leave it as it is: it is only for a few minutes', action: 'accelerate' },
      { label: 'Leave the engine running so the car is ready to go', action: 'brake' },
    ],
    penaltyMessage: 'A driver must take appropriate measures to secure and safeguard the vehicle before leaving it, however short the stop.',
    rewardMessage: 'Correct. The vehicle is secured and safeguarded before you leave it.',
    duration: 220,
    lawCitation:
      'Level 12 module, driver duties: "Take appropriate measures to secure and safeguard the vehicle before leaving it." RO101, Driver\'s Duties and Rights: "5. He must take appropriate measures to secure and safeguard the vehicle before leaving it." FDM Vol. 1, Chapter V: "5. Secure and safeguard the vehicle until it is returned to the designated location."',
    competency: 'general_rules',
    severity: 'major',
    inspection: {
      officerLine: 'Before you step out, think about the car.',
      documentType: 'Driver Duty Check',
      holder: 'You',
      fields: [
        { label: 'Stop', value: 'A few minutes, at a shop' },
        { label: 'Car', value: 'About to be left' },
      ],
      vehicle: 'Private passenger car',
      tripPurpose: 'Errand',
    },
  },
  {
    id: 'level8.extra.license-a-privilege',
    label: 'What the license is',
    type: 'stop_sign',
    description: "At a road-safety checkpoint, the officer asks what a driver's license is.",
    correctAction: 'stop',
    points: 25,
    warningDistance: 560,
    question: 'What is a driver\'s license?',
    choices: [
      { label: 'A right that cannot be taken away once granted', action: 'accelerate' },
      { label: 'A privilege, not a right', action: 'stop' },
      { label: 'A right for as long as the fees are paid', action: 'brake' },
    ],
    penaltyMessage: 'Having a driver\'s license is only a privilege and not a right.',
    rewardMessage: 'Correct. A driver\'s license is a privilege, not a right.',
    duration: 220,
    lawCitation:
      'Level 1 module: "The LTO describes a driver\'s license as a privilege, not a right." FDM Vol. 1, Driver\'s License: "DRIVER\'S LICENSE IS A PRIVILEGE, NOT A RIGHT". RO101, Driver\'s Duties and Rights: "7. He must know his rights and privileges. Having a driver\'s license is only a privilege and not a right."',
    competency: 'general_rules',
    severity: 'major',
    inspection: {
      officerLine: 'Your friend asks you a question.',
      documentType: 'Driver Duty Check',
      holder: 'You',
      fields: [{ label: 'Claim', value: 'Driving is my right' }],
      vehicle: 'Private passenger car',
      tripPurpose: 'Private trip',
    },
  },
  {
    id: 'level8.extra.officer-name-and-agency',
    label: 'Stopped by an officer',
    type: 'stop_sign',
    description: 'A traffic officer stops you and starts writing, without saying who they are or what the violation is.',
    correctAction: 'stop',
    points: 25,
    warningDistance: 560,
    question: 'What are you entitled to know during the apprehension?',
    choices: [
      { label: 'Nothing until you have paid the fine', action: 'brake' },
      { label: 'Only the amount of the fine', action: 'accelerate' },
      { label: 'The officer\'s complete name and agency, and the exact alleged violation', action: 'stop' },
    ],
    penaltyMessage: 'During an apprehension, every driver is entitled to know the complete name and agency of the apprehending officer and the exact alleged violation.',
    rewardMessage: 'Correct. You may ask the officer\'s name and agency, and the exact violation.',
    duration: 220,
    lawCitation:
      'Level 12 module, rights when apprehended: "To be informed of the full name and agency of the apprehending officer." FDM Vol. 1, Chapter V: "During an apprehension, all drivers are entitled to their right to: 1. Know the complete name and agency of the Apprehending Traffic Officer. 2. Know the exact alleged traffic violation." RO101, Rights of a Driver when Apprehended: "Right to be informed of the full name and agency of the apprehending officer."',
    competency: 'general_rules',
    severity: 'major',
    inspection: {
      officerLine: 'Please wait while I write this up.',
      documentType: 'Traffic Stop',
      holder: 'You',
      fields: [
        { label: 'Officer', value: 'Name and agency not given' },
        { label: 'Violation', value: 'Not stated' },
      ],
      vehicle: 'Private passenger car',
      tripPurpose: 'Private trip',
    },
  },
  // hazard_awareness (2026-11-16, future work): written from the Level 11
  // pack's Row 2 (active transport, RO105, mapped to Levels 8 and 11), A2, with
  // N3 (FDM Vol. 1, Road Sharing).
  {
    id: 'level8.extra.open-the-door-with-care',
    label: 'Getting out at the curb',
    type: 'stop_sign',
    description: "At a road-safety checkpoint, the officer asks about getting out of a car parked at the curb, where cyclists and motorcycles pass close.",
    correctAction: 'stop',
    points: 25,
    warningDistance: 560,
    question: 'What do you do before opening the door?',
    choices: [
      { label: 'Check for cyclists and motorcyclists first, then open the door with care', action: 'stop' },
      { label: 'Open it quickly: anyone passing will see the door and go around', action: 'accelerate' },
      { label: 'Open it slightly and wait for the riders to stop for you', action: 'brake' },
    ],
    penaltyMessage: 'Check if there are cyclists or motorcyclists before opening your car, to avoid property damage or personal injuries.',
    rewardMessage: 'Correct. You checked for riders, then opened the door with care.',
    duration: 220,
    lawCitation:
      'Level 8 module, section 8: "Open vehicle doors with care, checking for approaching cyclists first." FDM Vol. 1, Road Sharing: "Check if there are cyclists/motorcyclists before opening your car to avoid property damage or personal injuries." RO105, Active Transport, Guidelines for Drivers: "4. Open doors with care."',
    competency: 'hazard_awareness',
    severity: 'major',
    inspection: {
      officerLine: 'Before you open the door, look.',
      documentType: 'Road Sharing Check',
      holder: 'You',
      fields: [
        { label: 'Parked', value: 'At the curb' },
        { label: 'Passing', value: 'Cyclists and motorcycles' },
      ],
      vehicle: 'Private passenger car',
      tripPurpose: 'Private trip',
    },
  },
  {
    id: 'level8.extra.cyclist-clearance',
    label: 'Passing a cyclist',
    type: 'stop_sign',
    description: "At a road-safety checkpoint, the officer asks how you pass a cyclist on a narrow street.",
    correctAction: 'stop',
    points: 25,
    warningDistance: 560,
    question: 'How do you pass the cyclist?',
    choices: [
      { label: 'Close beside them, quickly, to spend less time next to them', action: 'accelerate' },
      { label: 'With sufficient clearance, watching your speed', action: 'stop' },
      { label: 'Sound the horn so they move onto the sidewalk', action: 'brake' },
    ],
    penaltyMessage: 'Give a cyclist sufficient clearance and watch your speed when passing, and always leave enough space when overtaking.',
    rewardMessage: 'Correct. Sufficient clearance, and a careful speed.',
    duration: 220,
    lawCitation:
      'Level 8 module, section 8: "Give cyclists sufficient clearance and watch your speed when passing." RO105, Active Transport, Guidelines for Drivers: "2. Give cyclist sufficient clearance and watch your speed when passing." FDM Vol. 1, Road Sharing: "Always leave enough space when overtaking a motorcyclist."',
    competency: 'hazard_awareness',
    severity: 'major',
    inspection: {
      officerLine: 'Plan the pass before you make it.',
      documentType: 'Road Sharing Check',
      holder: 'You',
      fields: [
        { label: 'Ahead', value: 'A cyclist' },
        { label: 'Street', value: 'Narrow' },
      ],
      vehicle: 'Private passenger car',
      tripPurpose: 'Private trip',
    },
  },
  {
    id: 'level8.extra.check-blind-spots',
    label: 'Pulling out',
    type: 'stop_sign',
    description: "At a road-safety checkpoint, the officer asks what you check before pulling out from the curb when your mirrors look clear.",
    correctAction: 'stop',
    points: 25,
    warningDistance: 560,
    question: 'What do you do before you move off?',
    choices: [
      { label: 'Go: the mirrors are clear', action: 'accelerate' },
      { label: 'Sound the horn and go', action: 'brake' },
      { label: 'Check your blind spots as well as the mirrors', action: 'stop' },
    ],
    penaltyMessage: 'Mirrors leave blind spots. Check them, and be alert to riders to each side of the car.',
    rewardMessage: 'Correct. Mirrors and blind spots, then move.',
    duration: 220,
    lawCitation:
      'Level 8 module, section 8: "Check your blind spots before any movement that could affect a cyclist or active-transport user." RO105, Active Transport, Guidelines for Drivers: "5. Check blind spots." FDM Vol. 1, Road Sharing: "Be alert in passing motorcyclists/cyclists by always checking the obstructions in front of their vehicle, behind it and to each side."',
    competency: 'hazard_awareness',
    severity: 'major',
    inspection: {
      officerLine: 'Before you pull out, check all around.',
      documentType: 'Road Sharing Check',
      holder: 'You',
      fields: [
        { label: 'Mirrors', value: 'Clear' },
        { label: 'Beside the car', value: 'Not visible in the mirrors' },
      ],
      vehicle: 'Private passenger car',
      tripPurpose: 'Private trip',
    },
  },
];

// --- Level 9: Emergencies And Road Crashes ------------------------------------

const level9: SlotVariant[] = [
  // parking: spread to Level 9 (2026-10-28).
  {
    id: 'level9.extra.no-stopping-at-the-bridge',
    type: 'scenario_trigger',
    // The bridge the text names is drawn (2026-11-16): it was open road.
    scene: 'bridge',
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
  // parking (2026-11-16, future work): written from the Level 6 parking pack,
  // P1 and P2 only. Asked as questions: the pack grades no distance but the
  // hydrant's (2a).
  {
    id: 'level9.extra.not-on-the-crosswalk',
    label: 'Where to stand',
    type: 'stop_sign',
    description: "At a road-safety checkpoint, the officer asks about stopping to check a soft tire when the only open curb is a marked crosswalk.",
    correctAction: 'stop',
    points: 25,
    warningDistance: 560,
    question: 'May you leave the car standing on the crosswalk while you check?',
    choices: [
      { label: 'Yes, if you stay with the car', action: 'accelerate' },
      { label: 'No. No driver may park or let the car stand on a crosswalk, attended or not', action: 'stop' },
      { label: 'Yes, if the hazard lights are on', action: 'brake' },
    ],
    penaltyMessage: 'No driver shall park a vehicle, or permit it to stand, whether attended or unattended, on a crosswalk.',
    rewardMessage: 'Correct. Not on a crosswalk, attended or not.',
    duration: 220,
    lawCitation:
      'Level 4 module, parking prohibitions: "On a crosswalk." FDM Vol. 1, Parking Prohibitions in Specified Places: "No driver shall park a vehicle, or permit it to stand, whether attended or unattended, upon a highway in any of the following places: … b. On a crosswalk". RO102, Parking: "Parking IS PROHIBITIED … b. On a crosswalk".',
    competency: 'parking',
    severity: 'major',
    inspection: {
      officerLine: 'Choose where to stop.',
      documentType: 'Stopping Place Check',
      holder: 'You',
      fields: [
        { label: 'Reason', value: 'Checking a soft tire' },
        { label: 'Space', value: 'A marked crosswalk' },
      ],
      vehicle: 'Private passenger car',
      tripPurpose: 'Private trip',
    },
  },
  {
    id: 'level9.extra.no-double-parking',
    label: 'Beside a parked car',
    type: 'stop_sign',
    description: "At a road-safety checkpoint, the officer asks about stopping in the road beside a car parked at the curb when every space is taken.",
    correctAction: 'stop',
    points: 25,
    warningDistance: 560,
    question: 'May you stop on the roadway side of the parked car?',
    choices: [
      { label: 'No. Parking or standing on the roadway side of a car parked at the curb is prohibited', action: 'stop' },
      { label: 'Yes, for a moment, with someone in the driver\'s seat', action: 'accelerate' },
      { label: 'Yes, if the parked car is yours', action: 'brake' },
    ],
    penaltyMessage: 'No driver shall park a vehicle, or permit it to stand, on the roadway side of any vehicle stopped or parked at the curb or edge of the highway.',
    rewardMessage: 'Correct. Not beside a car parked at the curb.',
    duration: 220,
    lawCitation:
      'Level 4 module, parking prohibitions: "On the roadway side of any vehicle already stopped or parked at the curb or edge of the highway." FDM Vol. 1, Parking Prohibitions in Specified Places: "No driver shall park a vehicle, or permit it to stand, whether attended or unattended, upon a highway in any of the following places: … g. On the roadway side of any vehicle stopped or parked at the curb or edge of the highway". RO102, Parking: "g. On the roadway side of any unmoving or parked MV at the curb or edge of the highway".',
    competency: 'parking',
    severity: 'major',
    inspection: {
      officerLine: 'Choose where to stop.',
      documentType: 'Stopping Place Check',
      holder: 'You',
      fields: [
        { label: 'Curb', value: 'Every space taken' },
        { label: 'Space', value: 'Beside a parked car' },
      ],
      vehicle: 'Private passenger car',
      tripPurpose: 'Private trip',
    },
  },
  {
    id: 'level9.extra.private-driveway',
    label: 'In front of a gate',
    type: 'stop_sign',
    description: "At a road-safety checkpoint, the officer asks about parking in front of a house's private driveway to make a call.",
    correctAction: 'stop',
    points: 25,
    warningDistance: 560,
    question: 'May you park there?',
    choices: [
      { label: 'Yes, if the gate is closed', action: 'accelerate' },
      { label: 'Yes, if you stay in the car', action: 'brake' },
      { label: 'No. Parking in front of a private driveway is prohibited', action: 'stop' },
    ],
    penaltyMessage: 'No driver shall park a vehicle, or permit it to stand, whether attended or unattended, in front of a private driveway.',
    rewardMessage: 'Correct. Not in front of a private driveway.',
    duration: 220,
    lawCitation:
      'Level 4 module, parking prohibitions: "In front of a private driveway." FDM Vol. 1, Parking Prohibitions in Specified Places: "No driver shall park a vehicle, or permit it to stand, whether attended or unattended, upon a highway in any of the following places: … f. In front of a private driveway". RO102, Parking: "f. In front of a private driveway".',
    competency: 'parking',
    severity: 'major',
    inspection: {
      officerLine: 'Choose where to stop.',
      documentType: 'Stopping Place Check',
      holder: 'You',
      fields: [
        { label: 'Reason', value: 'A phone call' },
        { label: 'Space', value: 'In front of a private driveway' },
      ],
      vehicle: 'Private passenger car',
      tripPurpose: 'Private trip',
    },
  },
];

// --- Level 10: Safety Laws In Daily Driving ------------------------------------

const level10: SlotVariant[] = [
  // driver_legality: spread to Level 10 (2026-10-28).
  {
    id: 'level10.extra.dui-license-consequence',
    label: 'Roadside checkpoint',
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
    description: 'You stop to check your papers before going to renew the registration.',
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
      'Emission test results must be presented within 60 days of testing, as a prerequisite for registration or renewal. A 75-day-old test has to be redone.',
    rewardMessage: 'Correct. Past 60 days, the test has to be done again before renewal.',
    duration: 220,
    lawCitation:
      'Level 10 module, Clean Air Act (RA 8749): "Test results must be presented within 60 days of testing, as a prerequisite for registration or renewal."',
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
      { label: 'Go — current registration is all a tricycle needs', action: 'accelerate' },
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
        { label: 'Registration', value: 'Current' },
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

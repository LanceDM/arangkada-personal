import type { LevelModule } from '@/features/driving-sim/domain/scenario/lessonModule';

const IMG = 'arangkada_extracted_images/level5/';

export const level5Module = {
  id: 'lto_level_5',
  title: 'Intersections And Right-Of-Way',
  sourceLevel: 5,
  desc: 'Learn to judge who goes first at an intersection: yielding correctly to pedestrians, other vehicles, emergency vehicles, and roundabout traffic under RA 4136.',
  lessons: [
    {
      id: 'level-5-mission-briefing',
      title: 'Mission Briefing: Intersections And Right-Of-Way',
      text: 'Every intersection asks the same question: who goes first? Right-of-way is not something you take. It is something the law assigns, and something you sometimes must give up even when it is legally yours.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Every intersection asks the same question: who goes first? Right-of-way is not something you take. It is something the law assigns, and something you sometimes must give up even when it is legally yours.',
        },
        {
          type: 'paragraph',
          text: 'On this mission, the route runs through several intersections: one with no traffic control at all, one with a pedestrian crossing, one where an emergency vehicle approaches with sirens on, and one roundabout. Judging who goes first, correctly and without hesitation, is the whole competency this level tests.',
        },
        {
          type: 'heading',
          text: 'Learning Goals',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Apply the RA 4136 right-of-way rules for uncontrolled intersections, left-turning vehicles, and vehicles entering from a private road.',
            'Decide who goes first at an intersection with no sign, a give-way sign, a stop sign, or a traffic signal.',
            'Yield correctly to pedestrians at crosswalks and know when a pedestrian must yield instead.',
            'Yield to police, fire, and ambulance vehicles operating on official business with audible signals.',
            'Apply roundabout rules: yield to circulating traffic, signal before exiting.',
            'Respect the yellow box and other intersection-discipline prohibitions.',
          ],
        },
      ],
    },
    {
      id: 'level-5-right-of-way-rules',
      title: '1. The Right-Of-Way Rules Under RA 4136',
      text: 'Republic Act No. 4136, the Land Transportation and Traffic Code, defines right-of-way with specific rules for specific situations. None of them reward speed or aggression.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Republic Act No. 4136, the Land Transportation and Traffic Code, defines right-of-way with specific rules for specific situations. None of them reward speed or aggression.',
        },
        {
          type: 'paragraph',
          text: 'The vehicle on the left shall yield to the vehicle on the right, except as otherwise provided by other right-of-way rules.',
        },
        {
          type: 'table',
          headers: ['Scenario', 'Situation', 'Rule'],
          rows: [
            [`[large]![Vehicle turning left yielding to a vehicle already in the intersection](${IMG}left-turn-yield-at-intersection.png)`, 'Vehicle B is approaching but has not yet entered an intersection', 'Vehicle B shall yield to a vehicle already within the intersection, or one turning left across its path, provided that turning vehicle gave a plainly visible signal of intention to turn.'],
            [`[rowspan:2][large]![Driver yielding to a pedestrian inside a marked crosswalk](${IMG}yield-to-pedestrian-at-crosswalk.png)`, 'A pedestrian is crossing within a crosswalk in a business or residential district', 'The driver shall yield to the pedestrian, except at intersections where traffic is regulated by a peace officer or a traffic signal.'],
            [``, 'A pedestrian crosses at a point other than a crosswalk', 'The pedestrian shall yield the right-of-way to vehicles on the highway.'],
            [`[rowspan:2][large]![Vehicle coming to a full stop before a through highway or railroad crossing](${IMG}stop-before-through-highway-or-railroad.jpg)`, 'A vehicle is about to traverse a "through highway" or railroad crossing', 'The driver shall bring the vehicle to a full stop, unless no hazard is apparent, in which case it may be slowed instead to about 8 kph.'],
            [``, 'A vehicle enters a highway from a private road or driveway', 'It shall yield the right-of-way to all vehicles already approaching on that highway.'],
          ],
        },
        {
          type: 'heading',
          text: 'Forfeiture Of Right-Of-Way',
        },
        {
          type: 'paragraph',
          text: 'A driver traveling at an unlawful speed forfeits any right-of-way they would otherwise have had. Right-of-way is a conditional privilege, not an absolute claim; a driver who is speeding, unsignaled, or otherwise unlawful cannot rely on it.',
        },
      ],
    },
    {
      id: 'level-5-who-goes-first',
      title: '2. Who Goes First: A Method For Every Intersection Type',
      text: 'Most intersection collisions happen because a driver misjudges who has the right-of-way. Use the type of intersection control to decide, every time, the same way.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Most intersection collisions happen because a driver misjudges who has the right-of-way. Use the type of intersection control to decide, every time, the same way.',
        },
        {
          type: 'table',
          headers: ['Visual', 'Intersection Type', 'Who Goes First'],
          rows: [
            [`[xlarge]![Intersection with no traffic sign, left vehicle yielding to right vehicle](${IMG}uncontrolled-intersection-yield-to-right.png)`, 'No Traffic Sign Or Signal', 'The vehicle on the left yields to the vehicle on the right.'],
            [`[xlarge]![Vehicle stopping at a give-way sign to yield to intersection traffic](${IMG}give-way-at-intersection.png)`, 'Give-Way Sign', 'You must give the right-of-way to any other vehicle in or closely approaching the intersection.'],
            [`[xlarge]![Vehicle coming to a full stop at a stop sign before yielding](${IMG}stop-sign-right-of-way.png)`, 'Stop Sign', 'Come to a full stop and yield to any vehicle in or approaching the intersection. If two vehicles stop at the same time, the vehicle on the left yields to the vehicle on the right. Never do a rolling stop.'],
            [`[rowspan:2][xlarge]![Vehicle proceeding on a green light after yielding to pedestrians and lawful traffic](${IMG}green-light-yield-before-proceeding.png)`, 'Traffic Signal, Green Light', 'You may proceed, but only after yielding to other vehicles and pedestrians already lawfully within the intersection.'],
            [``, 'Traffic Signal, Right Turn On Red Allowed', 'Proceed only after stopping and yielding to pedestrians and to cross-traffic vehicles. Never do a rolling stop.'],
          ],
        },
        {
          type: 'heading',
          text: 'Hazard Awareness',
        },
        {
          type: 'paragraph',
          text: 'Signages, pedestrians, and idle or approaching vehicles can all obstruct your view or your judgment at an intersection. Slow down early enough that a wrong guess about right-of-way does not become a collision.',
        },
      ],
    },
    {
      id: 'level-5-pedestrians',
      title: '3. Yielding To Pedestrians, Children, And PWDs',
      text: 'A crosswalk shifts the right-of-way to the pedestrian, but the duty to look out for vulnerable road users does not stop at the painted lines.',
      blocks: [
        {
          type: 'paragraph',
          text: 'A crosswalk shifts the right-of-way to the pedestrian, but the duty to look out for vulnerable road users does not stop at the painted lines. Level 3 already covers the pedestrian, children, and PWD warning signs, and Level 4 already covers the crosswalk marking itself; this lesson is about the yielding decision at the moment a person is actually there.',
        },
        {
          type: 'table',
          headers: ['Situation', 'Correct Driver Action'],
          rows: [
            ['Pedestrian crossing within a marked crosswalk', 'Yield the right-of-way, except where a peace officer or traffic signal is actively regulating the crossing.'],
            ['Pedestrian crossing outside a crosswalk', 'The pedestrian must yield to vehicles, but a prudent driver still slows and watches, since pedestrians do not always follow this rule.'],
            ['A child is near or approaching the road', 'Slow down in advance and be ready to stop; children are unpredictable and may enter the road suddenly.'],
            ['A person with a disability is crossing slowly', 'Allow extra time. Do not creep forward or rev the engine to hurry a person with a disability across.'],
          ],
        },
        {
          type: 'heading',
          text: 'Driver Habit',
        },
        {
          type: 'paragraph',
          text: 'When approaching a crosswalk or pedestrian lane, slow down and be ready to stop before you can confirm the crossing is clear, not after.',
        },
      ],
    },
    {
      id: 'level-5-emergency-vehicles',
      title: '4. Yielding To Emergency Vehicles',
      text: 'Police, fire, and ambulance vehicles operating on official business with an audible signal always outrank ordinary right-of-way rules.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Police, fire, and ambulance vehicles operating on official business with an audible signal always outrank ordinary right-of-way rules.',
        },
        {
          type: 'paragraph',
          text: 'The driver of a vehicle upon a highway shall yield the right-of-way to police or fire department vehicles and ambulances when such vehicles are operated on official business and the drivers sound an audible signal of their approach.',
        },
        {
          type: 'image',
          alt: 'Driver yielding safely to an approaching emergency vehicle with an audible siren.',
          src: IMG + 'yield-to-emergency-vehicle.png',
          size: 'large',
        },
        {
          type: 'table',
          headers: ['Step', 'Action'],
          rows: [
            ['1. Notice', 'Check mirrors and surroundings before reacting; do not brake hard without warning the traffic behind you.'],
            ['2. Move Over', 'Signal your intention, then move toward the nearest safe edge of the road and slow down or stop.'],
            ['3. Hold Position', 'Never stop inside an intersection or on top of a pedestrian crossing while yielding.'],
            ['4. Do Not Follow', 'Do not follow closely behind an emergency vehicle to take advantage of the cleared path.'],
          ],
        },
        {
          type: 'heading',
          text: 'Why It Matters',
        },
        {
          type: 'paragraph',
          text: 'Emergency vehicles carry priority right-of-way because seconds can determine whether a patient, a fire, or a crime scene is reached in time. Blocking or delaying one is both unsafe and unlawful. Resume normal driving only once the emergency vehicle has fully passed and it is safe to re-enter traffic.',
        },
      ],
    },
    {
      id: 'level-5-roundabouts',
      title: '5. Roundabout Rules',
      text: 'A roundabout replaces stop-and-go turns with continuous circulation. The rule is simple: whoever is already inside keeps moving; whoever is entering waits.',
      blocks: [
        {
          type: 'paragraph',
          text: 'A roundabout replaces stop-and-go turns with continuous circulation. The rule is simple: whoever is already inside keeps moving; whoever is entering waits.',
        },
        {
          type: 'image',
          alt: 'Roundabout Holding Line: vehicles within the rotunda have the right-of-way over vehicles which are just about to enter',
          src: IMG + 'roundabout-holding-line.png',
          size: 'large',
        },
        {
          type: 'table',
          headers: ['Situation', 'Rule'],
          rows: [
            ['Entering a roundabout or rotunda', 'Yield the right-of-way to vehicles already inside the roundabout.'],
            ['Exiting a roundabout or rotunda', 'Signal your intention and check your side mirror before you exit.'],
          ],
        },
        {
          type: 'heading',
          text: 'Common Mistakes',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Entering because a vehicle inside the roundabout is going slowly, instead of actually yielding to it.',
            'Forgetting to signal or check the mirror before exiting, which confuses vehicles about to enter.',
          ],
        },
      ],
    },
    {
      id: 'level-5-yellow-box-intersection-discipline',
      title: '6. Intersection Discipline: The Yellow Box Prohibitions',
      text: 'Right-of-way judgment is only half the picture. Even a driver with the right-of-way must not turn the intersection itself into an obstruction.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Right-of-way judgment is only half the picture. Even a driver with the right-of-way must not turn the intersection itself into an obstruction. These rules build on the yellow box marking you already learned to recognize in the markings lesson.',
        },
        {
          type: 'table',
          headers: ['Yellow Box Prohibition', 'Reason'],
          rows: [
            ['Do not block the intersection, even when making a turn.', 'A stalled vehicle inside the box stops cross-traffic in every direction.'],
            ['Do not make a U-turn inside the yellow box.', 'The maneuver takes too long and obstructs multiple directions of traffic at once.'],
            ['Yield the right-of-way to vehicles already inside the yellow box.', 'They are committed to clearing the intersection and have priority over vehicles about to enter.'],
            ['Do not communicate or exchange pleasantries with other motorists or road users while at the intersection.', 'Distraction inside an intersection increases the risk of blocking it or missing a hazard.'],
            ['Do not park within six meters of an intersection.', 'Parking that close blocks visibility and turning movements for other drivers.'],
            ['Do not load or unload passengers or goods at the intersection.', 'This creates an unpredictable obstruction exactly where traffic needs to flow freely.'],
          ],
        },
      ],
    },
    {
      id: 'level-5-method-and-recap',
      title: '7. Right-Of-Way Method And Mission Recap',
      text: 'Use one repeatable method at every intersection: identify the control type, identify who else is present, apply the matching right-of-way rule, then move only when it is confirmed safe.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Use one repeatable method at every intersection: identify the control type, identify who else is present, apply the matching right-of-way rule, then move only when it is confirmed safe.',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Identify the intersection control: none, give-way, stop, signal, or roundabout.',
            'Identify who else is present: pedestrians, vehicles on the right or left, an emergency vehicle, or circulating roundabout traffic.',
            'Apply the matching right-of-way rule, remembering that unlawful speed forfeits right-of-way.',
            'Confirm the intersection or yellow box is actually clear before committing to cross it.',
            'Proceed smoothly, without blocking the space you are about to enter.',
          ],
        },
        {
          type: 'heading',
          text: 'Scenario',
        },
        {
          type: 'paragraph',
          text: 'The mission route passes an uncontrolled junction where a vehicle approaches from the right, a marked crosswalk where a parent and child are waiting to cross, a stretch where an ambulance approaches from behind with its siren on, and a roundabout with steady circulating traffic. At the uncontrolled junction, the vehicle on the right goes first. At the crosswalk, the driver stops well behind the line and waits for the pedestrians to finish crossing. When the ambulance approaches, the driver signals, eases toward the road edge, and holds until it has fully passed. At the roundabout, the driver waits at the holding line for a safe gap, enters, signals, and exits.',
        },
        {
          type: 'heading',
          text: 'Level Recap',
        },
        {
          type: 'paragraph',
          text: 'Right-of-way is assigned by rule, not claimed by whoever moves first. At an uncontrolled intersection, left yields to right. At a give-way or stop sign, the driver yields to traffic already in or approaching the intersection. Pedestrians in a crosswalk have the right-of-way; children and PWDs need extra time and patience. Emergency vehicles with audible signals outrank ordinary right-of-way rules. Inside a roundabout, circulating traffic always has priority over vehicles entering. An intersection, including its yellow box, must be kept clear at all times, even by a driver who technically has the right to go.',
        },
      ],
    },
  ],
  // Seven items, one per mission beat, in the order the drive meets them.
  // Every question is a situation with a decision in it rather than a
  // definition to recall: the mission that follows is graded on what the
  // vehicle does, so the quiz that clears the player for it should be too.
  passingScore: 5,
  quiz: [
    {
      question:
        'You reach a crossroads with no signal, no stop sign and no give-way line. Another car arrives at the same moment on your right. Who goes first?',
      options: [
        'Whoever is already moving faster',
        'The car on your right — you are the vehicle on the left, so you yield',
        'You do, because you are on the wider road',
        'Whoever sounds their horn first',
      ],
      correct: 1,
      explanation:
        'Under RA 4136 the vehicle on the left yields to the vehicle on the right at an uncontrolled intersection. Speed, road width and the horn have nothing to do with it.',
    },
    {
      question:
        'A pedestrian is crossing inside a marked crosswalk in a business district, and no officer or signal is controlling the crossing. What must you do?',
      options: [
        'Yield the right-of-way and let them finish crossing',
        'Ease past behind them without stopping',
        'Proceed, since vehicles always outrank pedestrians',
        'Sound the horn so they hurry across',
      ],
      correct: 0,
      explanation:
        'A pedestrian crossing within a crosswalk holds the right-of-way, except where a peace officer or traffic signal is regulating the crossing. Hurrying a pedestrian along is never the correct action.',
    },
    {
      question:
        'A pedestrian steps into the road well away from any crosswalk. What is the legal position, and what should you actually do?',
      options: [
        'They have the right-of-way, so you must stop',
        'They must yield to you, so you may hold your speed',
        'They must yield to you, but you should still slow and be ready to stop',
        'It depends entirely on whether the road is in a business district',
      ],
      correct: 2,
      explanation:
        'A pedestrian crossing outside a crosswalk must yield to vehicles. Knowing the rule is not the same as relying on it: a prudent driver still slows and watches, because pedestrians do not always follow it.',
    },
    {
      question:
        'You are stopped at a Stop sign. Cross traffic has cleared and the junction is empty. What was required of you before moving off?',
      options: [
        'Slowing to about 8 kph was enough, since the way was clear',
        'A complete stop, then yielding to any vehicle in or approaching the junction',
        'Nothing, because arriving first gives you the right-of-way',
        'A complete stop only if another vehicle was actually visible',
      ],
      correct: 1,
      explanation:
        'A Stop sign requires a full stop every time, followed by yielding to any vehicle in or approaching the intersection. A rolling stop is a violation in itself, whether or not anything was coming.',
    },
    {
      question:
        'An ambulance on official business is closing behind you with its siren sounding. What is the correct response?',
      options: [
        'Brake hard immediately so it can pass',
        'Signal, move to the nearest safe edge of the road, and slow or stop until it passes',
        'Hold your lane and speed so your movements stay predictable',
        'Move over, then follow closely behind it through the cleared traffic',
      ],
      correct: 1,
      explanation:
        'Yield by signaling and moving to the nearest safe edge, then slowing or stopping. Braking hard without warning endangers the traffic behind you, never stop inside an intersection or crossing to do it, and never tailgate the emergency vehicle through the gap it has made.',
    },
    {
      question:
        'You arrive at a roundabout entry. A vehicle is already circulating and is moving slowly. May you enter ahead of it?',
      options: [
        'Yes — it is slow enough that entering will not obstruct it',
        'Yes, provided you signal before entering',
        'No — traffic already inside the roundabout has the right-of-way',
        'Only if you intend to take the first exit',
      ],
      correct: 2,
      explanation:
        'Vehicles already inside a roundabout have priority over vehicles entering it. Entering because the circulating vehicle looked slow is one of the two most common roundabout mistakes; the other is forgetting to signal and check the mirror before exiting.',
    },
    {
      question:
        'Traffic ahead is backed up and a yellow box junction is painted across the road. You have a green light. What may you not do?',
      options: [
        'Enter the box when your exit beyond it is already clear',
        'Enter and come to rest inside the box to wait for traffic ahead to move',
        'Wait behind the box until your exit clears',
        'Give way to a vehicle already inside the box',
      ],
      correct: 1,
      explanation:
        'The yellow box must be kept clear even by a driver who has the right-of-way. Do not enter unless your exit is clear, never stop or make a U-turn inside it, and yield to vehicles already within it.',
    },
  ],
} satisfies LevelModule;

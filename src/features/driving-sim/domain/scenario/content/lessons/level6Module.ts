import type { LevelModule } from '@/features/driving-sim/domain/scenario/lessonModule';

const IMG = 'arangkada_extracted_images/level6/';

export const level6Module = {
  id: 'lto_level_6',
  title: 'Turning, Lane Changes, Parking',
  sourceLevel: 6,
  desc: 'Learn to signal and execute turns correctly, change lanes safely, respect overtaking restrictions, and park legally using the correct technique for the situation.',
  lessons: [
    {
      id: 'level-6-mission-briefing',
      title: 'Mission Briefing: Turning, Lane Changes, Parking',
      text: "Every maneuver on this mission is voluntary. Nobody forces you to turn, change lanes, overtake, or park exactly where and when you do, which means every mistake here is a judgment mistake, not bad luck.",
      blocks: [
        {
          type: 'paragraph',
          text: "Every maneuver on this mission is voluntary. Nobody forces you to turn, change lanes, overtake, or park exactly where and when you do, which means every mistake here is a judgment mistake, not bad luck.",
        },
        {
          type: 'paragraph',
          text: 'On this mission, the route includes a left turn and a right turn in city traffic, a lane change that requires finding a safe gap, a no-parking zone, a fire hydrant, a posted tow-away zone, and a legal parking bay. Executing each maneuver with the correct signal, position, and timing is the whole competency this level tests.',
        },
        {
          type: 'heading',
          text: 'Learning Goals',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Position and execute right turns, left turns, and U-turns correctly.',
            'Give the correct hand or signal-light indication before starting, stopping, or turning.',
            'Change lanes only when it is safe, using the full mirror-signal-blind spot routine.',
            'Overtake only where it is legal and visibly safe, and know the restricted zones.',
            'Park using the correct technique for angle, parallel, perpendicular, uphill, and downhill parking.',
          ],
        },
      ],
    },
    {
      id: 'level-6-turning',
      title: '1. Turning At Intersections',
      text: 'A turn is not just a change in direction, it is a position you must be in before the intersection, not during it.',
      blocks: [
        {
          type: 'paragraph',
          text: 'A turn is not just a change in direction, it is a position you must be in before the intersection, not during it. RA 4136 requires that when turning left from one highway to another, the vehicle be conducted to the right of the center of the intersection.',
        },
        {
          type: 'table',
          headers: ['Visual', 'Turn', 'Procedure'],
          rows: [
            [`[medium]![Vehicle positioned in the rightmost lane before making a right turn](${IMG}right-turn-road-position.png)`, 'Right Turn', 'Proceed to the right lane well in advance. Reduce to a safe speed and signal your intention to turn. Check traffic approaching from the left and any pedestrians or obstructions. At the turn position, keep your rear right wheel nearest to the curb or edge of the highway.'],
            [`[medium]![Vehicle positioned near the center line before making a left turn at an intersection](${IMG}left-turn-road-position.png)`, 'Left Turn', 'Advance to the intersection in the correct lane and reduce to a safe speed while signaling. If stopped, keep your wheels pointed straight ahead until it is time to cross. Turn into the lane nearest the center line, watching for long vehicles and oncoming right-turning traffic that should pass on your right.'],
          ],
        },
        {
          type: 'heading',
          text: 'Turning From A One-Way Street',
        },
        {
          type: 'table',
          headers: ['Situation', 'Procedure'],
          rows: [
            [`[medium]![Left turn, one-way street to two-way street](${IMG}left-turn-one-way-to-two-way.png)`, 'Signal your intention, look ahead left and right, move toward the leftmost lane, watch for motorcycles, bicycles, pedestrians, and obstructions, and keep to the leftmost lane while turning.'],
            [`[medium]![Left turn, one-way street to one-way street](${IMG}left-turn-one-way-to-one-way.png)`, 'Signal your intention, look ahead to check the way is clear, position your vehicle nearest the curb upon reaching the intersection, and watch for motorcycles, bicycles, pedestrians, and obstructions.'],
            ['Turning from one-way to one-way on a red signal', 'Check whether a turn on red is allowed at this intersection. If yes, proceed only when safe. If no, stop and wait for green. When allowed, position nearest the curb and signal your intention before turning.'],
          ],
        },
        {
          type: 'heading',
          text: 'Making A U-Turn',
        },
        {
          type: 'paragraph',
          // FDM Vol. 1 p. 164: no U-turn on a double solid yellow line or where a No U-Turn sign is posted.
          text: 'U-turns are risky and prohibited in some areas: never on a double solid yellow line or where a No U-Turn sign is posted. Start turning from the right side of the innermost lane, check for traffic in both directions and signal, and when the way is clear, turn the wheel sharply to the left while moving forward. Do not change lanes again until you have reached the correct traffic speed. A U-turn is never allowed on a double solid yellow line or where a No U-Turn sign is posted, and it is never allowed inside a yellow box.',
        },
      ],
    },
    {
      id: 'level-6-hand-signals',
      title: '2. The Duty To Signal',
      text: 'Before starting, stopping, or turning from a direct line, the driver must first make sure the movement can be done safely, and must communicate it to anyone it could affect.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Before starting, stopping, or turning from a direct line, the driver must first make sure the movement can be done safely, and must communicate it to anyone it could affect. If a pedestrian may be affected, sound the horn. If another vehicle approaching or following may be affected, give a signal plainly visible to that driver of the intention to make the movement.',
        },
        {
          type: 'table',
          headers: ['Visual', 'Signal', 'Meaning'],
          rows: [
            [`[medium]![Left arm extended straight out to indicate a left turn](${IMG}hand-signal-left-turn.png)`, 'Left Arm Extended Straight Out', 'Indicates a left turn.'],
            [`[medium]![Left arm bent at the elbow with hand pointing up to indicate a right turn](${IMG}hand-signal-right-turn.png)`, 'Left Arm Bent At Elbow, Hand Pointing Up', 'Indicates a right turn.'],
            [`[medium]![Left arm bent at the elbow with hand pointing down to indicate stopping or slowing down](${IMG}hand-signal-stop-or-slow-down.png)`, 'Left Arm Bent At Elbow, Hand Pointing Down', 'Indicates stopping or slowing down.'],
          ],
        },
        {
          type: 'paragraph',
          text: 'The required signal is given by extending the hand and arm beyond the left side of the vehicle, or by an approved mechanical or electrical signal device such as a turn-signal light.',
        },
        {
          type: 'heading',
          text: 'Think, Look, Signal, Look Again',
        },
        {
          type: 'paragraph',
          text: "Before any turn or lane movement, run through TLSL: think about what you intend to do, look for traffic and hazards, signal your intention, then look again to confirm it is still safe before committing.",
        },
        {
          type: 'heading',
          text: 'For Motorcycle Riders',
        },
        {
          type: 'paragraph',
          text: 'Hand, head, or foot signals not covered by the standard set are not recognized as lawful and can confuse other motorists. Using something improvised, such as raising a foot to indicate a left turn, is neither lawful nor safe.',
        },
      ],
    },
    {
      id: 'level-6-lane-changes',
      title: '3. Changing Lanes Safely',
      text: 'A lane change is legal only if it is safe. Legality and safety are two separate checks, and both must pass before you move.',
      blocks: [
        {
          type: 'paragraph',
          text: 'A lane change is legal only if it is safe. Legality and safety are two separate checks, and both must pass before you move.',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Check traffic ahead, behind, and on the sides.',
            'Check the rearview mirror and side mirrors for approaching vehicles.',
            'Take a quick glance at the blind spots.',
            'Switch on the signal light.',
            'Steer into the new lane while looking forward.',
            'Switch off the signal.',
          ],
        },
        {
          type: 'table',
          headers: ['Situation', 'Rule'],
          rows: [
            ['Changing lanes when it is not safe to do so', 'Not allowed, regardless of the lane marking.'],
            // RA 4136 Sec. 41, FDM Vol. 1 p. 121
            ['Overtaking on the right, on a road in a business or residential district with two or more lanes going the same direction', 'Allowed if it is safe. Outside those districts, overtake on the left.'],
            ['Overtaking or changing lanes on the right when the vehicle in front is visibly turning left', 'Allowed, since the vehicle ahead has committed to leaving your lane.'],
          ],
        },
        {
          type: 'heading',
          text: 'In Heavy Traffic',
        },
        {
          type: 'paragraph',
          text: 'When changing lanes in heavy traffic, watch specifically for cyclists and motorcyclists filtering between vehicles; they are easy to miss in a mirror check alone.',
        },
      ],
    },
    {
      id: 'level-6-overtaking',
      title: '4. Overtaking Rules And Restrictions',
      text: 'Overtaking is one of the highest-risk maneuvers a driver performs, because it briefly puts you in the path of oncoming traffic or forces another driver to react to you.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Overtaking is one of the highest-risk maneuvers a driver performs, because it briefly puts you in the path of oncoming traffic or forces another driver to react to you.',
        },
        {
          type: 'heading',
          text: 'How To Overtake',
        },
        {
          type: 'table',
          headers: ['Rule', 'Requirement'],
          rows: [
            ['Overtaking a vehicle', 'Pass at a safe distance to the left of the vehicle being overtaken.'],
            ['Cutting an overtaken vehicle', 'Prohibited: do not move back to the right side of the highway until your vehicle is safely clear of the vehicle you passed.'],
            ['Driver to give way to an overtaking vehicle (lane straddling)', 'A driver about to be overtaken must give way to the overtaking vehicle once a suitable, audible signal has been given.'],
            ['Driver to give way to an overtaking vehicle (speed)', 'The driver being overtaken shall not increase speed until the overtaking vehicle has completely passed.'],
            ['Restrictions on overtaking and passing', 'Do not drive to the left of the center line to overtake unless that side is clearly visible and free of oncoming traffic for a sufficient distance to pass safely.'],
          ],
        },
        {
          type: 'heading',
          text: 'Where Overtaking Is Not Allowed',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'At intersections, and when approaching a bridge, curve, or the crest of a grade.',
            'On or across a solid yellow or solid white line.',
            'On the shoulder of the road.',
            'At a railroad crossing.',
            'Near a hospital or school zone, or on busy streets.',
            'Between temporary "men working" or caution signs marking road work.',
            'In any posted no-overtaking zone.',
          ],
        },
        {
          type: 'heading',
          text: 'For Motorcycle Riders',
        },
        {
          type: 'paragraph',
          text: "Never overtake a turning vehicle, especially in its blind spots. Large vehicles such as buses and trucks have larger blind spots than cars and jeepneys, and unnecessary lane changing to overtake is a common cause of motorcycle crashes.",
        },
      ],
    },
    {
      id: 'level-6-parking-technique',
      title: '5. Parking Technique',
      text: 'Where parking is prohibited was already covered in the markings level. This lesson is about executing a legal parking maneuver correctly once you have found a legitimate space.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Where parking is prohibited was already covered in the markings level. This lesson is about executing a legal parking maneuver correctly once you have found a legitimate space.',
        },
        {
          type: 'table',
          headers: ['Visual', 'Parking Type', 'Technique'],
          rows: [
            [`![Vehicle performing angle parking at roughly 45 degrees to the curb](${IMG}angle-parking.png)`, 'Angle Parking', 'Park at an angle of about 45 degrees to the curb, with one front wheel touching or within one foot of the curb.'],
            [`![Vehicle performing parallel parking by driving past the space then reversing into it](${IMG}parallel-parking.png)`, 'Parallel Parking', 'Drive slightly past the space, parallel to the vehicle in front of it, keeping a safe distance, then reverse into the space.'],
            [`![Vehicle performing perpendicular parking beside another vehicle in a mall or garage](${IMG}perpendicular-parking.png)`, 'Perpendicular Parking', 'Park beside another vehicle, perpendicular to a wall or curb; common in malls or garages with limited space.'],
          ],
        },
        {
          type: 'heading',
          text: 'Uphill And Downhill Parking',
        },
        {
          type: 'table',
          headers: ['Visual', 'Situation', 'Wheel Position'],
          rows: [
            // TODO(LTO review): FDM Vol. 1 p. 123 says wheels into the curb uphill and downhill, but the
            // FDM reviewer (pp. 168, 182) says away from the curb uphill. Kept as-is until the LTO reviewers decide.
            [`[large]![Vehicle parked on a slope with wheels turned into the curb](${IMG}slope-parking-with-curb.png)`, 'Parking Uphill Or Downhill, With A Curb', 'Turn the front wheels into the curb or toward the sidewalk. Always engage the parking brake, and leave the vehicle in gear if possible.'],
            [`[large]![Vehicle parked on a slope without a curb, wheels turned toward the edge of the road](${IMG}slope-parking-without-curb.png)`, 'Parking Uphill Or Downhill, Without A Curb', 'Turn the wheels so that if the parking brake is inadvertently released, the vehicle rolls off the road rather than into it.'],
          ],
        },
        {
          type: 'heading',
          text: 'For Motorcycle Riders',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Never park downhill.',
            'Use the center stand when parking for longer periods.',
            'Always lock the handlebar before leaving the motorcycle.',
            'If parking in a mall or bay, leave enough maneuvering space for others and for yourself.',
          ],
        },
        {
          type: 'heading',
          text: 'Before You Choose The Space',
        },
        // FDM Vol. 1 pp. 64, 96, 124 (RA 4136 Sec. 46), 172, 180
        {
          type: 'paragraph',
          text: 'Level 4 covered where parking is prohibited. Check these before you start the maneuver:',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Not within 4 meters of a fire hydrant.',
            'Not within 6 meters of the intersection of curb lines.',
            'Never double park: parking on the roadway side of a vehicle already parked at the curb is prohibited.',
            'Never on a pedestrian lane.',
            'In a No Loading/Unloading zone, do not stop even briefly; find a proper loading zone, even if it is farther.',
            'A PWD parking space is only for a PWD or someone driving with one.',
          ],
        },
      ],
    },
    {
      id: 'level-6-method-and-recap',
      title: '6. Maneuvering Method And Mission Recap',
      text: 'Use one repeatable method for every turn, lane change, overtake, or parking maneuver: think, position, signal, check again, then execute.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Use one repeatable method for every turn, lane change, overtake, or parking maneuver: think, position, signal, check again, then execute.',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Think about the maneuver you intend to make well before you reach it.',
            'Get into the correct lane or position early, not at the last second.',
            'Signal your intention clearly, by hand or signal light.',
            'Check mirrors and blind spots again immediately before moving.',
            'Execute smoothly, and switch off the signal once complete.',
          ],
        },
        {
          type: 'heading',
          text: 'Scenario',
        },
        {
          type: 'paragraph',
          text: 'The mission route requires a right turn from the correct lane, a left turn that positions the vehicle nearest the center line, a lane change into a gap that opens up ahead of a slower vehicle, three places the driver must recognize and pass without stopping (a no-parking zone, a fire hydrant, and a posted tow-away zone), and a marked parking bay where the driver must choose and execute the correct parking technique for the space available.',
        },
        {
          type: 'heading',
          text: 'Level Recap',
        },
        {
          type: 'paragraph',
          text: 'Turning correctly means being in the right lane and position before the intersection, not during it, and giving a clear, timely signal. Lane changes are legal only when they are also safe, using a full mirror-and-blind-spot check every time. Overtaking is restricted at intersections, curves, crests, railroad crossings, and anywhere visibility or a solid line forbids it, and the overtaken driver has duties too: no cutting in, and no speeding up while being passed. Parking technique depends on the space and the slope: angle, parallel, perpendicular, uphill, or downhill each has its own correct wheel and vehicle position.',
        },
      ],
    },
  ],
  // Five of the seven cover ground the drive itself cannot: a hand signal, a
  // U-turn restriction, and the three parking positions that a top-down
  // scrolling corridor has no way to show — an angle, a slope, and a steered
  // front wheel. The mission tests the manoeuvres you can perform; this tests
  // the ones you can only know.
  passingScore: 5,
  quiz: [
    {
      question:
        'You are turning left from one highway into another. Where must the vehicle be conducted, and which lane do you turn into?',
      options: [
        'To the right of the center of the intersection, turning into the lane nearest the center line',
        'To the left of the center of the intersection, turning into the rightmost lane',
        'Straight through the middle of the intersection, into whichever lane is clear',
        'Along the curb line, turning into the lane nearest the curb',
      ],
      correct: 0,
      explanation:
        'RA 4136 requires the vehicle to be conducted to the right of the center of the intersection on a left turn, and to turn into the lane nearest the center line. Cutting to the left of center puts you into the path of traffic turning the other way.',
    },
    {
      question:
        'Your signal lights have failed and you need to indicate a right turn by hand. What is the correct signal?',
      options: [
        'Left arm bent at the elbow, hand pointing up',
        'Left arm extended straight out',
        'Left arm bent at the elbow, hand pointing down',
        'Right arm extended straight out of the passenger window',
      ],
      correct: 0,
      explanation:
        'The three lawful hand signals are all given with the left arm, beyond the left side of the vehicle: straight out for a left turn, bent up for a right turn, and bent down for stopping or slowing. Anything improvised is not recognized and only confuses other motorists.',
    },
    {
      question:
        'You are in the lane beside the center line, behind a slow jeepney, with a second lane running your way to your right and it is clear. Is changing lanes to the right allowed?',
      options: [
        'Yes, if this is a business or residential district and the change is safe, since there are two or more lanes going your way',
        'No — overtaking on the right is never allowed under any circumstances',
        'Only if you sound the horn first',
        'Only if the jeepney is signaling to turn left',
      ],
      correct: 0,
      explanation:
        'RA 4136 allows overtaking on the right on a road in a business or residential district with two or more lanes going the same direction, and when the vehicle ahead is visibly turning left. Outside those districts, overtake on the left. Legality is only half of it though: the change must also be safe, which means mirrors, blind spot, signal, then steer.',
    },
    {
      question: 'Where is overtaking prohibited, regardless of how clear the road looks to you?',
      options: [
        'At intersections, on bridges, curves and crests, at railroad crossings, and on any solid yellow or white line',
        'Only where a No Overtaking sign is posted',
        'Only on expressways and national highways',
        'Only at night or in poor weather',
      ],
      correct: 0,
      explanation:
        'The restricted places are fixed regardless of visibility: intersections, approaches to bridges, curves and crests of grades, railroad crossings, hospital and school zones, road works, the shoulder, and anywhere marked with a solid line. A posted sign is one of the restrictions, not the whole list.',
    },
    {
      question: 'Where is a U-turn never allowed?',
      options: [
        'On a double solid yellow line, inside a yellow box, or where a No U-Turn sign is posted',
        'Anywhere on a two-way road',
        'Only on expressways',
        'Only between 6am and 6pm',
      ],
      correct: 0,
      explanation:
        'A U-turn is prohibited across a double solid yellow line, inside a yellow box junction, and wherever a No U-Turn sign is posted. Where it is allowed, start from the right side of the innermost lane, signal, check both directions, and do not change lanes again until you have reached traffic speed.',
    },
    {
      question:
        'You are parking in a marked bay at about 45 degrees to the curb. Where should the front wheel finish?',
      options: [
        'Touching the curb, or within about a foot of it',
        'At least three feet clear of the curb',
        'Turned hard away from the curb',
        'Anywhere, as long as the vehicle is inside the painted lines',
      ],
      correct: 0,
      explanation:
        'Angle parking sits at roughly 45 degrees to the curb with one front wheel touching it or within about a foot of it. Parallel parking is entered in reverse after drawing level with the vehicle in front; perpendicular parking sits square to a wall or curb, as in a mall or garage.',
    },
    {
      question:
        'You are parking on a slope with a curb. Which way do you turn the front wheels, and what else must you do?',
      options: [
        'Turn the front wheels into the curb, engage the parking brake, and leave the vehicle in gear if you can',
        'Leave the wheels straight ahead and rely on the parking brake alone',
        'Turn the front wheels away from the curb, toward the middle of the road',
        'Turn the wheels into the curb but leave the parking brake off so the tires take the load',
      ],
      correct: 0,
      explanation:
        'With a curb, the front wheels are turned into it so the tire catches if the brake ever releases. Without a curb, turn them so the vehicle would roll off the road rather than into it. Either way the parking brake goes on, and the vehicle is left in gear where possible. Motorcycles should never be parked downhill at all.',
    },
  ],
} satisfies LevelModule;

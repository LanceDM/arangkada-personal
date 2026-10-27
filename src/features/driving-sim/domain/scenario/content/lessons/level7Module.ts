import type { LevelModule } from '@/features/driving-sim/domain/scenario/lessonModule';

const IMG = 'arangkada_extracted_images/level7/';

export const level7Module = {
  id: 'lto_level_7',
  title: 'Speed, Following, Overtaking, Expressways',
  sourceLevel: 7,
  desc: 'Learn to manage speed within the legal limits, keep a safe following distance, judge overtaking risk at higher speed, and drive an expressway correctly from merge to toll exit.',
  lessons: [
    {
      id: 'level-7-mission-briefing',
      title: 'Mission Briefing: Speed, Following, Overtaking, Expressways',
      text: 'Higher speed does not just make mistakes more likely, it makes every mistake bigger. The same following gap, the same overtaking decision, the same merge, all carry more consequence once speed goes up.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Higher speed does not just make mistakes more likely, it makes every mistake bigger. The same following gap, the same overtaking decision, the same merge, all carry more consequence once speed goes up.',
        },
        {
          type: 'paragraph',
          text: 'On this mission, the route moves onto a faster road: posted speed signs, a merge lane, the temptation to overtake in the wrong place, and a toll exit. You already know how to read a speed sign from Level 3 and how to overtake legally from Level 6; this level is about applying that judgment once speed is no longer low.',
        },
        {
          type: 'heading',
          text: 'Learning Goals',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Apply the RA 4136 prescribed speed limits for each type of road.',
            'Maintain a safe following distance using the two-or-three-second rule.',
            'Understand how perception distance, reaction distance, and braking distance combine into total stopping distance.',
            'Follow expressway-specific rules: banned vehicles, lane restrictions, and prohibited actions.',
            'Merge onto an expressway correctly and use the correct lane once merged.',
            'Read a toll gate lane indicator and exit safely.',
          ],
        },
      ],
    },
    {
      id: 'level-7-speed-limits',
      title: '1. Speed Limits Under RA 4136',
      text: 'Speed limits are not the same everywhere. The legal maximum depends on the type of road, the traffic around you, and the kind of vehicle you drive.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Speed limits are not the same everywhere. The legal maximum depends on the type of road, the traffic around you, and the kind of vehicle you drive. In the absence of a posted sign, RA 4136 Section 35(b) sets the default.',
        },
        {
          type: 'table',
          headers: ['Road Description', 'Passenger Cars And Motorcycles', 'Motor Trucks And Buses'],
          rows: [
            ['Open country roads, no blind corners, not closely bordered by homes', '80 km/h', '50 km/h'],
            ['Through streets or boulevards, clear of traffic, no blind corners, so designated', '40 km/h', '30 km/h'],
            ['City and municipal streets, light traffic, not designated through streets', '30 km/h', '30 km/h'],
            ['Crowded streets, blind-corner intersections, school zones, passing stationary vehicles, or similar dangerous conditions', '20 km/h', '20 km/h'],
          ],
        },
        {
          type: 'heading',
          text: 'Exemptions From Speed Restrictions',
        },
        {
          type: 'paragraph',
          text: 'Ordinary speed restrictions do not apply to a physician or the physician\'s driver responding to an emergency, a hospital ambulance, a driver bringing a wounded or sick person for treatment, a military vehicle in times of insurrection, riot, or invasion, a vehicle in pursuit of a criminal, a law-enforcement officer pursuing a traffic violator, and a fire truck responding to a call.',
        },
        {
          type: 'heading',
          text: 'Reading The Situation',
        },
        {
          type: 'paragraph',
          text: 'A posted sign always overrides this default table where one exists; you already know how to recognize maximum, minimum, and end-of-restriction signs from Level 3. The table above is what applies when no sign is posted.',
        },
        {
          type: 'heading',
          text: 'National Roads',
        },
        // FDM Vol. 1 p. 112 (DOTr-DPWH-DILG JMC 2018-001)
        {
          type: 'table',
          headers: ['Road', 'Flat', 'Rolling', 'Mountainous'],
          rows: [
            ['Primary national road', '80 kph', '60 kph', '50 kph'],
            ['Secondary national road', '70 kph', '60 kph', '40 kph'],
          ],
        },
        {
          type: 'heading',
          text: 'Controlling Speed On A Descent',
        },
        // FDM Vol. 1 pp. 111, 177, 180
        {
          type: 'list',
          ordered: false,
          items: [
            'Before driving down a steep road, shift to a low gear and use engine braking instead of riding the brakes.',
            'If a bus ahead speeds down a steep grade, keep within the speed limit and stay well back.',
            'Behind a long vehicle, stay further back to improve your view of the road ahead.',
          ],
        },
      ],
    },
    {
      id: 'level-7-following-distance',
      title: '2. Following And Stopping Distance',
      text: 'The gap you leave in front of your vehicle is the only tool you have to turn a sudden hazard into a controlled stop instead of a collision.',
      blocks: [
        {
          type: 'paragraph',
          text: 'The gap you leave in front of your vehicle is the only tool you have to turn a sudden hazard into a controlled stop instead of a collision.',
        },
        {
          type: 'heading',
          text: 'The Two-Or-Three-Second Rule',
        },
        {
          type: 'paragraph',
          text: 'The two-or-three-second rule is an informal method by which a driver keeps a safe distance at any speed, measured in time rather than meters since distance is hard to judge accurately while driving. Pick a fixed point on the roadway ahead, such as a sign, mailbox, or lamp post. When the vehicle in front passes that point, begin counting; you should not reach the same point for at least two to three seconds. Adjust the count upward for a bigger vehicle, a heavier load, higher speed, or slower reflexes.',
        },
        {
          type: 'paragraph',
          text: 'This practice reduces both the risk of a crash and the severity of one if it happens, and it also prevents tailgating and the road rage that tailgating provokes. Give a motorcycle the same following distance you would give any other vehicle; it is entitled to the same full lane length and width.',
        },
        {
          type: 'heading',
          text: 'Braking, Perception, And Total Stopping Distance',
        },
        {
          type: 'table',
          headers: ['Distance Type', 'What It Means', 'Example At 100 km/h'],
          rows: [
            ['Perception and reaction distance', 'The distance covered in the split second it takes your brain to notice a hazard and your body to react.', '20 meters'],
            ['Braking distance', 'The distance traveled from the moment you start braking until the vehicle fully stops.', '60 meters'],
            ['Total stopping distance', 'Perception, reaction, and braking distance combined; the real distance needed to stop.', '80 meters'],
          ],
        },
        {
          type: 'heading',
          text: 'Common Mistake',
        },
        {
          type: 'paragraph',
          text: 'Judging following distance by how close you feel comfortable, instead of by counting seconds, leads most drivers to leave far less room than they actually need to stop.',
        },
      ],
    },
    {
      id: 'level-7-expressway-rules',
      title: '3. Expressway Rules And Restricted Vehicles',
      text: 'An expressway is a Limited Access Facility. Entry and exit are only allowed at designated points, and several ordinary road behaviors are simply not permitted.',
      blocks: [
        {
          type: 'paragraph',
          text: 'An expressway is a Limited Access Facility. Entry and exit are only allowed at designated points, and several ordinary road behaviors are simply not permitted.',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'No person or vehicle may enter, exit, or cross the expressway except at designated entry, exit, or interchange points.',
            'It is unlawful to remove or damage the right-of-way fences along the expressway.',
            'Standing, stopping, loading, unloading, or parking is not allowed except in designated places.',
            'In case of breakdown, emergency, or accident, the impaired vehicle must be removed from the travel way by an authorized towing operator without delay, at the owner or driver\'s expense.',
            'The innermost lane (Lane 1), nearest the median barrier, is for overtaking only, within the allowed speed. An overtaking vehicle does not have right-of-way. Cargo trucks, buses, and slow-moving vehicles are never allowed in Lane 1.',
            'The owner or driver is responsible for damage to expressway property such as rail guards, lamp posts, the perimeter fence, or median barriers.',
          ],
        },
        {
          type: 'heading',
          text: 'Vehicles Not Allowed On The Expressway',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Motorcycles below 400cc, tricycles, scooters, and bicycles (an exception allows one back rider, with helmets required at all times).',
            'Vehicles being towed, except when being removed from the expressway itself.',
            'Dilapidated or non-roadworthy vehicles, such as those without headlights, taillights, or brake lights, or with a misaligned chassis or bald tires.',
            'Smoke-belching vehicles under the Clean Air Act.',
            'Trucks carrying construction aggregates that are not leveled or not covered.',
            'Vehicles with cargo that is not properly battened down or fastened.',
          ],
        },
        {
          type: 'heading',
          text: 'Expressway Speed Limits',
        },
        {
          type: 'paragraph',
          text: 'Except where a specific speed limit is posted, the expressway minimum speed is 60 km/h and the maximum is 100 km/h.',
        },
      ],
    },
    {
      id: 'level-7-expressway-lanes',
      title: '4. Expressway Lane Usage',
      text: 'An expressway assigns each lane to a category of vehicle. Staying in the correct lane is not optional courtesy, it is the rule.',
      blocks: [
        {
          type: 'paragraph',
          text: 'An expressway assigns each lane to a category of vehicle. Staying in the correct lane is not optional courtesy, it is the rule.',
        },
        {
          type: 'image',
          alt: 'Diagram showing expressway lane usage for different vehicle types.',
          src: IMG + 'expressway-lane-usage.jpg',
          size: 'large',
        },
        {
          type: 'table',
          headers: ['Total Lanes', 'Lane', 'Permitted Vehicles'],
          rows: [
            ['[rowspan:2]2 Lanes', 'Lane 1', 'For passing or overtaking.'],
            ['', 'Lane 2', 'All vehicles.'],
            ['[rowspan:3]3 Lanes', 'Lane 1', 'Vehicles from Lane 2 may use this lane for passing and overtaking.'],
            ['', 'Lane 2', 'Passenger cars, passenger buses, and freight vehicles with under 1.5 ton cargo.'],
            ['', 'Lane 3', 'Freight vehicles with over 1.5 ton cargo, special vehicles, and construction equipment.'],
            ['[rowspan:4]4 Lanes', 'Lane 1', 'Vehicles from Lane 2 may use this lane for passing and overtaking.'],
            ['', 'Lane 2', 'Passenger cars, small and medium passenger buses, and freight vehicles with under 1.5 ton cargo.'],
            ['', 'Lane 3', 'Large passenger buses and freight vehicles with over 1.5 ton cargo.'],
            ['', 'Lane 4', 'Special vehicles and construction equipment.'],
          ],
        },
        {
          type: 'paragraph',
          text: 'In every configuration, Lane 1 (the innermost, nearest the median) is where passing happens, not where slower or heavier vehicles travel.',
        },
      ],
    },
    {
      id: 'level-7-merging-and-toll',
      title: '5. Merging And Toll Exit Procedure',
      text: 'Merging and exiting are the two moments an expressway forces you to interact with other vehicles at speed. Both reward planning ahead over reacting at the last second.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Merging and exiting are the two moments an expressway forces you to interact with other vehicles at speed. Both reward planning ahead over reacting at the last second.',
        },
        {
          type: 'heading',
          text: 'Expressway Driving Tips',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Look ahead, enter slowly, and accelerate before merging, making full use of the acceleration (continuity) lane.',
            'After merging, move into the correct lane for your vehicle type; a car merging in typically settles into the rightmost general-traffic lane rather than the overtaking lane.',
            'Drive only in your vehicle\'s designated lane.',
            'Slow down at the entry and exit tolls.',
            'Do not slam on the brakes in case of a tire blowout or a flat tire.',
            'Maintain a safe following distance at all times.',
            'Be aware of crosswinds, especially on bridges and open stretches.',
            'Rest in a safe place when tired or sleepy; do not push through fatigue at expressway speed.',
          ],
        },
        {
          type: 'heading',
          text: 'Merge-Lane Warning Signage',
        },
        {
          type: 'table',
          headers: ['Visual', 'Sign', 'Meaning'],
          rows: [
            [`![Sign reading distance to the merging lanes is 500 meters](${IMG}merge-lanes-500-meters-ahead.png)`, 'Distance To The Merging Lanes Is 500 Meters', 'Gives 500 meters of advance notice before a merge point, so you can plan your lane early instead of reacting at the last moment.'],
            [`![Sign reading right lane ends, merge left](${IMG}right-lane-ends-merge-left.png)`, 'Right Lane Ends, Merge Left', 'The right lane is closing ahead; move left in good time rather than forcing a merge at the last car length.'],
            [`![Sign reading check brakes, reduce speed now](${IMG}check-brakes-reduce-speed.png)`, 'Check Brakes, Reduce Speed Now', 'Posted in conjunction with a merge or descent on the expressway; test your brakes and slow down before the situation demands it.'],
          ],
        },
        {
          type: 'heading',
          text: 'Toll Gate Lane Indicators',
        },
        {
          type: 'table',
          headers: ['Visual', 'Signal', 'Meaning'],
          rows: [
            [`[large]![Red X displayed above a toll lane](${IMG}toll-lane-closed-red-x.png)`, 'Red X', 'This lane is closed; you cannot drive through it.'],
          ],
        },
        {
          type: 'paragraph',
          text: 'Special signs appear as early as 200 meters before a toll exit to give you time to move into the correct lane; you already know how to read expressway signage from Level 3, so use that vocabulary here to plan your lane position well before the toll plaza, not at it.',
        },
        // FDM Vol. 1 p. 128
        {
          type: 'list',
          ordered: false,
          items: [
            'Plan your exit at least 1 kilometer ahead of the exit toll.',
            'On an expressway, switch on the hazard warning lights only when stopping for an emergency.',
            'At night, do not stare at the headlights of oncoming vehicles.',
          ],
        },
      ],
    },
    {
      id: 'level-7-overtaking-at-speed',
      title: '6. Overtaking Risk At Higher Speed',
      text: "You already know the legal rules for overtaking from Level 6. At higher speed, the same rules apply, but the margin for a wrong judgment shrinks.",
      blocks: [
        {
          type: 'paragraph',
          text: "You already know the legal rules for overtaking from Level 6: pass at a safe distance to the left, never cut in front too soon, and never overtake at an intersection, curve, crest, or railroad crossing. At higher speed, the same rules apply, but the margin for a wrong judgment shrinks.",
        },
        {
          type: 'table',
          headers: ['Road Type', 'Overtaking Rule'],
          rows: [
            ['Two-lane road, normal traffic', 'Overtaking is only allowed using the leftmost lane.'],
            ['One-way road', 'Overtaking is permitted on either the right or the left lane, provided that lane is free of obstruction.'],
            ['Expressway', 'Overtaking happens only in Lane 1, the innermost lane; an overtaking vehicle does not have right-of-way and must return to its own lane once clear.'],
          ],
        },
        {
          type: 'heading',
          text: 'The Temptation To Overtake',
        },
        {
          type: 'paragraph',
          text: 'A faster road makes overtaking feel more urgent and more available, since gaps open and close quickly. Judge each gap by whether it is actually large enough to complete the pass and return safely, not by how much the vehicle ahead is slowing you down. If there is any doubt, wait for the next gap.',
        },
        {
          type: 'heading',
          text: 'When You Are The One Being Overtaken',
        },
        // FDM Vol. 1 p. 166; FDM Vol. 2 p. 76 (JAO 2014-01)
        {
          type: 'list',
          ordered: false,
          items: [
            'When another vehicle signals and overtakes you, give way and do not increase your speed. Never race it.',
            'After you overtake, move back to the right only once you are safely clear of the overtaken vehicle. Cutting in early is a violation.',
          ],
        },
      ],
    },
    {
      id: 'level-7-method-and-recap',
      title: '7. Higher-Speed Method And Mission Recap',
      text: 'Use one repeatable method whenever speed increases: confirm the limit, widen the gap, plan the lane, then commit only when the move is clearly safe.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Use one repeatable method whenever speed increases: confirm the limit, widen the gap, plan the lane, then commit only when the move is clearly safe.',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Confirm the applicable speed limit, posted or default, for the road you are on.',
            'Keep at least a two-to-three-second following gap, adjusted upward for speed, load, or reduced visibility.',
            'Plan your lane position early: the correct traffic lane by default, Lane 1 only to overtake.',
            'Before overtaking, confirm the gap is large enough for the entire maneuver, not just the start of it.',
            'Before merging or exiting, use the acceleration or deceleration lane fully, and move into position well before the point of no return.',
          ],
        },
        {
          type: 'heading',
          text: 'Scenario',
        },
        {
          type: 'paragraph',
          text: 'The mission route enters an expressway through an acceleration lane, requiring the driver to build speed and merge smoothly into general traffic. A slower truck ahead creates the temptation to overtake; the driver checks Lane 1 for a genuinely clear gap before committing, then returns to the correct lane. Approaching the toll plaza, advance signage gives time to select an open lane, and the driver slows appropriately at the toll booth before exiting.',
        },
        {
          type: 'heading',
          text: 'Level Recap',
        },
        {
          type: 'paragraph',
          text: 'Speed limits depend on road type and vehicle class, with a default table applying wherever no sign is posted. A two-to-three-second following gap is the practical tool for surviving a sudden hazard, and total stopping distance grows fast as speed increases. An expressway is a Limited Access Facility with its own banned-vehicle list, lane assignments, and an overtaking-only innermost lane. Merge-lane signage gives you distance and lane warning well before the merge point itself, so merging rewards using the acceleration lane fully and settling into the correct lane early. A toll exit rewards planning your lane well before you reach the plaza.',
        },
      ],
    },
  ],
  quiz: [],
} satisfies LevelModule;

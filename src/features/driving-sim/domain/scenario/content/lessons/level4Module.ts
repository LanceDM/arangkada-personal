import type { LevelModule } from '@/features/driving-sim/domain/scenario/lessonModule';

const IMG = 'arangkada_extracted_images/level4/';

export const level4Module = {
  id: 'lto_level_4',
  title: 'Markings And Road Space',
  sourceLevel: 4,
  desc: 'Learn to read every category of pavement marking and use road space correctly: stop before the right line, keep intersections and crossings clear, respect the yellow box, and share reserved lanes with bikes, motorcycles, buses, and PUJs.',
  lessons: [
    {
      id: 'level-4-mission-briefing',
      title: 'Mission Briefing: Markings And Road Space',
      text: 'Signs tell you the rule. Markings tell you exactly where that rule applies on the pavement under your wheels.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Signs tell you the rule. Markings tell you exactly where that rule applies on the pavement under your wheels. Lines, boxes, symbols, and painted zones guide traffic, give advance warning, or impose a restriction, sometimes carrying the same legal weight as a posted sign.',
        },
        {
          type: 'paragraph',
          text: "This level covers every official category of pavement marking: longitudinal lines, traverse lines, other lines (turn lines, parking bays, loading zones, the yellow box, bus/PUJ lane lines), object markings, raised pavement markers, and the remaining special-purpose markings such as chevrons, rumble strips, and pavement arrows. The mission route runs through an intersection with a stop line, a pedestrian lane, a yellow box, a bus lane, a bike lane, and a motorcycle lane, so reading each marking correctly and positioning the vehicle the way it demands is the whole competency this level tests.",
        },
        {
          type: 'heading',
          text: 'Learning Goals',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Distinguish every longitudinal line type and what each allows or forbids.',
            'Stop at the correct traverse line: stop line, give-way/holding line, pedestrian crossing, or roundabout holding line.',
            'Recognize turn lines, parking bays, loading/unloading bay lines, the yellow box, and the bus/PUJ lane line.',
            'Identify object markings, raised pavement markers, and the remaining special-purpose pavement markings.',
            'Know where parking is always prohibited, marking or no marking.',
            'Share the road correctly with motorcycle, bicycle, and bus/PUJ lanes.',
            'Position the vehicle correctly around a pedestrian crossing without duplicating the warning-sign vocabulary already covered in Level 3.',
          ],
        },
      ],
    },
    {
      id: 'level-4-longitudinal-lines',
      title: '1. Longitudinal Lines',
      text: 'Longitudinal lines run along the direction of travel. They tell you whether crossing, overtaking, or changing lanes is allowed at that point on the road.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Longitudinal lines run along the direction of travel. They tell you whether crossing, overtaking, or changing lanes is allowed at that point on the road. Reading the line before you commit to a movement is a positioning skill, not a memorization exercise.',
        },
        {
          type: 'table',
          headers: ['Marking Image', 'Line', 'Meaning'],
          rows: [
            [`![Center or separation line](${IMG}center-or-separation-line.jpg)`, 'Center Or Separation Line', 'Crossing a solid white center line requires special care and is discouraged.'],
            [`![Lane line](${IMG}lane-line.jpg)`, 'Lane Line', 'Changing lanes is allowed provided it is safe and will not obstruct other traffic.'],
          ],
        },
        {
          type: 'heading',
          text: 'Barrier Line',
        },
        {
          type: 'paragraph',
          text: "A barrier line is not one single marking. It's the general term for the yellow line down the middle of the road that separates opposing traffic, and it comes in five variants, each permitting a different combination of crossing and overtaking.",
        },
        {
          type: 'table',
          headers: ['Marking Image', 'Barrier Line Type', 'Meaning'],
          rows: [
            [`![Double solid yellow line](${IMG}double-solid-yellow-line.jpg)`, 'Double Solid Yellow Line', 'No overtaking and no crossing.'],
            [`![Single solid yellow line](${IMG}single-solid-yellow-line.jpg)`, 'Single Solid Yellow Line', 'Crossing is allowed, but overtaking is not.'],
            [`![Single yellow line with broken white line](${IMG}single-yellow-line-with-broken-white-line.jpg)`, 'Single Yellow Line With Broken White Line', 'No overtaking or crossing on the solid-yellow side; overtaking and crossing allowed on the broken-white side.'],
            [`![Broken yellow line](${IMG}broken-yellow-line.jpg)`, 'Broken Yellow Line', 'Crossing and overtaking allowed, with necessary precaution.'],
            [`![Broken and solid yellow line](${IMG}broken-and-solid-yellow-line.jpg)`, 'Broken And Solid Yellow Line', 'Crossing and overtaking allowed on the broken-line side with caution; not allowed on the solid-line side.'],
          ],
        },
        {
          type: 'heading',
          text: 'Edge, Continuity, And Transition Lines',
        },
        {
          type: 'table',
          headers: ['Marking Image', 'Line', 'Meaning'],
          rows: [
            [`![Edge line](${IMG}edge-line.jpg)`, 'Edge Line', 'Separates the outside edge of the road from the shoulder.'],
            [`![Continuity line](${IMG}continuity-line.jpg)`, 'Continuity Line', 'On the right, the lane continues unaffected. On the left, the lane is ending or you are approaching an obstruction or a change of direction, and you must change lanes to continue.'],
            [`![Transition line](${IMG}transition-line.jpg)`, 'Transition Line', 'Guides traffic safely past obstructions such as islands, median strips, or bridge piers, or marks a change in the number or width of lanes.'],
          ],
        },
        {
          type: 'heading',
          text: 'Positioning Rule',
        },
        {
          type: 'paragraph',
          text: 'Before crossing any longitudinal line to change lane, overtake, or turn, confirm two things: is the maneuver legal at this specific line, and is it actually safe right now. A legal line does not remove the duty to check that the movement is safe.',
        },
      ],
    },
    {
      id: 'level-4-traverse-lines',
      title: '2. Traverse Lines',
      text: 'Traverse lines cross the carriageway instead of running along it. They mark exactly where a vehicle must stop, give way, or hold position before proceeding.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Traverse lines cross the carriageway instead of running along it. They mark exactly where a vehicle must stop, give way, or hold position before proceeding.',
        },
        {
          type: 'table',
          headers: ['Marking Image', 'Traverse Line', 'What It Requires'],
          rows: [
            [`![Stop line](${IMG}stop-line.jpg)`, 'Stop Line', 'Vehicles are required to stop before the white line, at a designated point tied to a Stop sign or signal.'],
            [`![Give-way or holding line](${IMG}give-way-or-holding-line.jpg)`, 'Give-Way Or Holding Line', 'Two adjacent broken white lines across the carriageway where the driver must give way to all traffic in accordance with the standard Give Way sign.'],
            [`![Signalized pedestrian crossing marking](${IMG}signalized-pedestrian-crossing-marking.jpg)`, 'Pedestrian Intersection (Signalized)', 'Marks the pedestrian crossing zone at a light-controlled intersection; the vehicle must stop clear of it, not on top of it.'],
            [`![Non-signalized pedestrian crossing marking](${IMG}non-signalized-pedestrian-crossing-marking.jpg)`, 'Pedestrian Intersection (Non-Signalized)', 'Marks a pedestrian crossing without a traffic light; the vehicle must still stop clear of it and yield to pedestrians.'],
            [`![Roundabout holding line](${IMG}roundabout-holding-line.png)`, 'Roundabout Holding Line', 'Vehicles already inside the rotunda have the right-of-way over vehicles about to enter; the holding line is where entering vehicles wait their turn.'],
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
            'Stopping on top of the pedestrian lane instead of behind it.',
            'Creeping past the stop line to see around traffic.',
            'Entering a roundabout without giving way to vehicles already circulating past the holding line.',
          ],
        },
      ],
    },
    {
      id: 'level-4-other-lines',
      title: '3. Other Lines: Turn Lines, Parking Bays, Loading Zones, And The Yellow Box',
      text: 'Some markings do not just guide movement, they protect road space so it stays usable for everyone.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Some markings do not just guide movement, they protect road space so it stays usable for everyone.',
        },
        {
          type: 'table',
          headers: ['Marking Image', 'Marking', 'Purpose'],
          rows: [
            [`![Turn line](${IMG}turn-line.jpg)`, 'Turn Line', 'Guides vehicles through a turning movement at an intersection.'],
            [`![Parking bay](${IMG}parking-bay.jpg)`, 'Parking Bay', 'Designates a legal parking space; watch for a PWD parking mark reserving the space for persons with disabilities.'],
            [`![Loading and unloading bay lane line](${IMG}loading-and-unloading-bay-lane-line.png)`, 'Loading And Unloading Bay Lane Line', 'A solid white line marking the proper location for loading and unloading, usually paired with parking restrictions.'],
            [`![Yellow box do not block intersection](${IMG}yellow-box-do-not-block-intersection.jpg)`, 'Yellow Box ("Do Not Block Intersection")', 'Yellow lines forming a box across the intersection, with diagonal lines forming an X inside it. No vehicle should stay inside the box, even while waiting in traffic, because it obstructs cross-traffic.'],
            [`![Bus and PUJ lane line](${IMG}bus-and-puj-lane-line.jpg)`, 'Bus And PUJ Lane Line', 'A solid yellow line separating other vehicles from buses and PUJs, often supplemented by raised pavement markers.'],
          ],
        },
        {
          type: 'heading',
          text: 'Yellow Box Rule',
        },
        {
          type: 'paragraph',
          text: 'Never enter a yellow box unless there is enough space on the far side to clear it completely. If traffic ahead is not moving, wait behind the box, even if your own light is green. Stopping inside the box blocks cross-traffic and defeats the reason the marking exists.',
        },
      ],
    },
    {
      id: 'level-4-shared-lanes',
      title: '4. Sharing The Road: Motorcycle, Bicycle, And Bus Lanes',
      text: 'Certain lanes are reserved for specific road users. A private car driver must recognize these lanes and stay out of them except when a rule allows entry.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Certain lanes are reserved for specific road users. Recognizing them, and staying out of them, is part of sharing the road correctly. These are the usage rules for the lanes you can already spot from their line markings.',
        },
        {
          type: 'table',
          headers: ['Marking Image', 'Lane', 'Rule'],
          rows: [
            [`![Motorcycle lane](${IMG}motorcycle-lane.jpg)`, 'Motorcycle Lane', 'Allotted for motorcycle riders and may be shared with other vehicles, but riders are not allowed to leave it for other lanes unless instructed by enforcers or turning into an intersection, and must signal that intention within 100 meters.'],
            [`![Bicycle lane](${IMG}bicycle-lane.jpg)`, 'Bicycle Lane', 'Painted on the pavement with a solid line along the side of the road, for bicycle use.'],
            // FDM Vol. 1 pp. 97, 180
            [`![Bus lane](${IMG}bus-lane.jpg)`, 'Bus Lane', 'A designated lane for buses; bus drivers are not allowed to use other lanes except when instructed by enforcers or turning into an intersection. Private vehicles may not drive in it, except to turn or to enter a garage within 100 meters.'],
          ],
        },
        {
          type: 'heading',
          text: 'Rules For Drivers Of Cars, Trucks, And Other Motorized Vehicles',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Do not travel or park in a bicycle or pedestrian lane.',
            'Give cyclists sufficient clearance and watch your speed when passing.',
            'Be extra careful when turning at intersections where a bike or motorcycle lane crosses your path.',
          ],
        },
      ],
    },
    {
      id: 'level-4-no-parking',
      title: '5. Where Parking Is Prohibited',
      text: 'A parking bay marking means parking is allowed there. Away from a marked bay, several specific places are always off-limits for parking, whether or not a sign is posted.',
      blocks: [
        {
          type: 'paragraph',
          text: 'A parking bay marking means parking is allowed there. Away from a marked bay, several specific places are always off-limits, whether or not a sign is posted.',
        },
        {
          type: 'paragraph',
          text: 'No driver shall park a vehicle, or permit it to stand, whether attended or unattended, upon a highway in any of the following places:',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Within an intersection.',
            'On a crosswalk.',
            'Within six meters of the intersection of curb lines.',
            'Within four meters of a driveway entrance to a fire station.',
            'Within four meters of a fire hydrant.',
            'In front of a private driveway.',
            'On the roadway side of any vehicle already stopped or parked at the curb or edge of the highway.',
            'At any place where an official sign prohibits parking.',
          ],
        },
        {
          type: 'heading',
          text: 'Painted Curb Markings',
        },
        {
          type: 'table',
          headers: ['Marking Image', 'Painted Curb', 'Meaning'],
          rows: [
            // FDM Vol. 1 p. 96: red = No Loading and Unloading, yellow = No Parking.
            // TODO(assets): the image file names below have the two meanings swapped; rename them when convenient.
            [`![Red-painted curb: no loading and unloading](${IMG}red-painted-curb-no-parking.jpg)`, 'Red-Painted Curb', 'No loading and unloading.'],
            [`![Yellow-painted curb: no parking](${IMG}yellow-painted-curb-no-loading-unloading.jpg)`, 'Yellow-Painted Curb', 'No parking.'],
          ],
        },
        {
          type: 'paragraph',
          text: "These are the pavement-and-curb markings; the matching posted signs (fire hydrant, tow-away zone, bus/PUJ stop zone, and so on) were already covered in Level 3's parking and stopping signs.",
        },
      ],
    },
    {
      id: 'level-4-object-and-other-markings',
      title: '6. Object Markings, Raised Pavement Markers, And Other Markings',
      text: 'Beyond painted lines and boxes, the road uses physical objects, reflective markers, and special-purpose markings to warn drivers about obstructions, guide them around hazards, and reinforce speed and direction.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Beyond painted lines and boxes, the road uses physical objects, reflective markers, and special-purpose markings to warn drivers about obstructions, guide them around hazards, and reinforce speed and direction.',
        },
        {
          type: 'heading',
          text: 'Object Markings',
        },
        {
          type: 'table',
          headers: ['Marking Image', 'Object Marking', 'Purpose'],
          rows: [
            [`![Traffic cones on the road](${IMG}traffic-cones-on-the-road.jpg)`, 'Traffic Cones On The Road', 'Temporarily mark a hazard, lane closure, or work area; treat the coned-off space as closed to traffic.'],
            [`![Concrete barriers](${IMG}concrete-barriers.jpg)`, 'Concrete Barriers', 'Physically separate traffic or protect a work zone or drop-off; give them clearance rather than hugging the edge.'],
          ],
        },
        {
          type: 'heading',
          text: 'Raised Pavement Markers',
        },
        {
          type: 'table',
          headers: ['Marking Image', 'Marker', 'Purpose'],
          rows: [
            [`![Cat's eye road stud](${IMG}cats-eye-road-stud.jpg)`, "Cat's Eye", "A retroreflective safety device, or road stud, used in road markings to separate traffic. Raised pavement markers can substitute for painted lane lines, and give a tactile and audible bump when a vehicle drifts across them."],
          ],
        },
        {
          type: 'heading',
          text: 'Other Markings',
        },
        {
          type: 'table',
          headers: ['Marking Image', 'Marking', 'Purpose'],
          rows: [
            [`![Approach markings to islands and obstructions](${IMG}approach-markings-to-islands-and-obstructions.jpg)`, 'Approach Markings To Islands And Obstructions', 'Guide traffic safely around a raised island, median, or fixed obstruction ahead.'],
            [`![Chevron marking](${IMG}chevron-marking.png)`, 'Chevron', 'Often used to guide traffic into the correct turning lane at a signalized intersection where an island separates movements, or to mark a change in horizontal alignment.'],
            [`![Rumble strips](${IMG}rumble-strips.png)`, 'Rumble Strips', 'Thermoplastic lane markings that give a visual, audio, and motion warning through a humming sound and bumpy ride when driven over, used to alert drivers and prompt a speed check.'],
            [`![Railroad crossing ahead marking](${IMG}railroad-crossing-ahead-marking.jpg)`, 'Railroad Crossing Ahead', 'Painted on the pavement in advance of a railroad crossing to warn the driver before reaching the tracks.'],
            [`![Pavement arrows](${IMG}pavement-arrows.jpg)`, 'Pavement Arrows', 'White arrows painted on the road surface used for lane control, showing which direction(s) a lane permits.'],
            [`![Speed limit painted on pavement](${IMG}speed-limit-painted-on-pavement.jpg)`, 'Speed Limit On Pavement', 'A numeral painted directly on the road surface (for example, a painted 60 km/h) reinforcing a posted or applicable speed limit; it must be followed the same as a speed-limit sign.'],
          ],
        },
        {
          type: 'heading',
          text: 'Driver Habit',
        },
        {
          type: 'paragraph',
          text: "Treat every object marking, raised marker, and special pavement symbol as advance information, not decoration. Cones and barriers mean adjust your path now. A cat's eye or rumble strip felt under the tires means you have drifted and should correct. A painted arrow or speed number is as binding as the matching sign.",
        },
      ],
    },
    {
      id: 'level-4-pedestrian-lane-positioning',
      title: '7. Crosswalk Positioning',
      text: "You already know the pedestrian crossing marking from the traverse-lines lesson, and Level 3 already covers the pedestrian, children, and PWD warning signs. What is left here is one habit: never block the crossing itself.",
      blocks: [
        {
          type: 'paragraph',
          text: "You already know the pedestrian crossing marking from the traverse-lines lesson, and Level 3 already covers the pedestrian, children, and PWD warning signs. What is left here is one habit: never block the crossing itself, no matter what is causing the delay.",
        },
        {
          type: 'heading',
          text: 'Driver Habit',
        },
        {
          type: 'paragraph',
          text: 'Never block a pedestrian lane or crossing while waiting in traffic. Stop behind it, even if that means stopping earlier than you would otherwise. A blocked crossing forces pedestrians, including PWDs and children, into moving traffic to get around your vehicle. Full right-of-way judgment for pedestrians is developed in the next level; this level only asks you to keep the marked space physically clear.',
        },
      ],
    },
    {
      id: 'level-4-positioning-method-and-recap',
      title: '8. Positioning Method And Mission Recap',
      text: 'Use one repeatable method every time a marking appears: detect, identify, interpret, position, then proceed.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Use one repeatable method every time a marking appears: detect, identify, interpret, position, then proceed.',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Detect the marking early, before you are on top of it.',
            'Identify its category: longitudinal line, traverse line, other line, shared lane, no-parking marking, or object/raised/other marking.',
            'Interpret what it allows, forbids, or requires you to do.',
            'Position the vehicle correctly: behind the stop line, clear of the crossing, outside the yellow box, out of a reserved lane, clear of cones and barriers.',
            'Proceed only when the position is correct and the movement is safe.',
          ],
        },
        {
          type: 'heading',
          text: 'Scenario',
        },
        {
          type: 'paragraph',
          text: 'The mission route reaches an intersection with a marked stop line, a pedestrian lane just past it, a yellow box in the middle of the intersection, a bus lane along the curb, and a bike lane and motorcycle lane further ahead. Traffic ahead is slow-moving. Stopping correctly means holding behind the stop line and the pedestrian lane, refusing to enter the yellow box even on a green light until the far side is clear, staying out of the bus lane, and giving the bike and motorcycle lanes their own space when passing.',
        },
        {
          type: 'heading',
          text: 'Level Recap',
        },
        {
          type: 'paragraph',
          text: 'Longitudinal lines control crossing, overtaking, and lane changes. Traverse lines mark exactly where to stop or give way. Turn lines, parking bays, loading zones, and the yellow box protect road space at and around intersections. Motorcycle, bicycle, and bus/PUJ lanes are reserved space that other vehicles must respect. Object markings, raised pavement markers, chevrons, rumble strips, and painted arrows or speed numbers reinforce hazards and rules the driver must not ignore. Parking is always off-limits in certain places, marking or no marking, and a pedestrian crossing must always be kept physically clear.',
        },
      ],
    },
  ],
  quiz: [],
} satisfies LevelModule;

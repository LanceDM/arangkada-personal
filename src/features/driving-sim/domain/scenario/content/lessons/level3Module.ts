import type { LevelModule } from '@/features/driving-sim/domain/scenario/lessonModule';

const IMG = 'arangkada_extracted_images/level3/';

export const level3Module = {
  id: 'lto_level_3',
  title: 'Signs And Signals',
  sourceLevel: 3,
  desc: 'Learn to recognize every LTO road sign category (A through G) and correctly interpret traffic light signals, building the complete sign vocabulary tested on the LTO written exam.',
  lessons: [
    {
      id: 'level-3-mission-briefing',
      title: 'Mission Briefing: Signs And Signals',
      text: 'Your vehicle is ready and your papers are in order. Now the city road itself starts talking to you through signs and signals, and you must understand what it is saying in time to respond safely.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Your vehicle is ready and your papers are in order. Now the city road itself starts talking to you through signs and signals, and you must understand what it is saying in time to respond safely.',
        },
        {
          type: 'paragraph',
          text: 'A driver who cannot read the road is dangerous no matter how legal or roadworthy the vehicle is. This level walks through every official LTO sign category, A through G, plus traffic lights and signals. Treat the reference tables as study material for the written exam, not just flavor text.',
        },
        {
          type: 'heading',
          text: 'Learning Goals',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Recognize regulatory signs and follow the instruction or prohibition they enforce.',
            'Recognize warning signs and adjust speed or attention before a hazard.',
            'Use guide and informative signs to understand direction, distance, and services.',
            'Recognize expressway, traffic-instruction, hazard-marker, and roadwork signs on sight.',
            'Correctly interpret solid and flashing traffic light signals.',
            'Build a complete working vocabulary of LTO sign types for exam review.',
          ],
        },
      ],
    },
    {
      id: 'level-3-sign-taxonomy-overview',
      title: '1. How LTO Organizes Road Signs',
      text: 'Every road sign belongs to one of seven official LTO categories, lettered A through G. Recognizing the category first, from shape and color, tells you how to react before you even read the specific symbol.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Every road sign belongs to one of seven official LTO categories, lettered A through G. Recognizing the category first, from shape and color, tells you how to react before you even read the specific symbol.',
        },
        {
          type: 'paragraph',
          text: 'Three broad visual habits apply across most categories: a red or black shape on white, often circular or octagonal, states a law. A white triangle with a red border warns of a hazard (crossing warnings for pedestrians, children and PWDs use a yellow-green background, and orange marks roadwork). A green, blue, or white rectangle gives direction or information. Traffic lights and signals sit outside this lettered system entirely, since they control movement in real time rather than through a fixed sign.',
        },
        {
          type: 'table',
          headers: ['Official Category', 'What It Covers'],
          rows: [
            ['A. Regulatory Signs', 'States a law or obligation; ignoring it is an offense.'],
            ['B. Warning Signs', 'Warns of a hazardous road condition ahead.'],
            ['C. Guide / Informative Signs', 'Gives direction, distance, or the location of a service.'],
            ['D. Signs On Expressways', 'Helps a driver position the vehicle correctly for expressway travel.'],
            ['E. Traffic Instruction Signs', 'Instructs a specific course of action, alongside a regulatory or warning sign.'],
            ['F. Hazard Markers', 'Emphasizes a marked change in road direction or the presence of an obstruction.'],
            ['G. Roadwork Signs', 'Marks construction or maintenance activity on the road.'],
          ],
        },
        {
          type: 'image',
          alt: 'Reference sheet showing the seven official LTO sign category shapes and colors side by side.',
          src: IMG + 'road-sign-categories.png',
        },
        {
          type: 'paragraph',
          text: 'This level covers all seven categories plus traffic lights and signals. Full expressway driving procedure, and the deeper judgment behind several instruction signs, are developed further in a later level; here the goal is to recognize every sign on sight.',
        },
      ],
    },
    {
      id: 'level-3-category-a-regulatory',
      title: 'A. Regulatory Signs',
      text: 'Regulatory signs are not suggestions. Each one enforces a specific rule, and disregarding it is a traffic offense.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Regulatory signs are not suggestions. Each one enforces a specific rule, and disregarding it is a traffic offense.',
        },
        {
          type: 'heading',
          text: '1. Priority Signs',
        },
        {
          type: 'paragraph',
          text: 'Priority signs settle who moves first at an intersection. These are the two most consequential regulatory signs a new driver will face, since misreading either one directly causes a collision.',
        },
        {
          type: 'table',
          headers: ['Sign Image', 'Sign Name', 'Meaning', 'Driver Action'],
          rows: [
            [`![Stop sign](${IMG}stop-sign-octagon.png)`, 'Stop Sign (Octagon)', 'Requires a full stop at the marked stop line.', 'Stop completely, even if the road looks clear. No parking within 6 meters.'],
            [`![Give Way sign](${IMG}give-way-yield-sign-inverted-triangle.png)`, 'Give Way / Yield Sign (Inverted Triangle)', 'Yield to vehicles on the right side of the intersection.', 'Slow down and be ready to stop; proceed only when safe.'],
            [`![Left Turner Must Give Way sign](${IMG}left-turner-must-give-way.png)`, 'Left Turner Must Give Way', 'A left-turning vehicle must yield to opposing traffic.', 'Do not turn left until oncoming traffic and pedestrians are clear.'],
          ],
        },
        {
          type: 'heading',
          text: '2. Directional Signs',
        },
        {
          type: 'paragraph',
          text: 'These signs indicate the only direction(s) a motorist is obliged to follow at that point.',
        },
        {
          type: 'table',
          headers: ['Sign Image', 'Sign Name', 'Meaning'],
          rows: [
            [`![Vehicle may pass either side sign](${IMG}vehicle-may-pass-either-side.png)`, 'Vehicle May Pass Either Side', 'A vehicle may pass on either side of the island or obstruction ahead.'],
          ],
        },
        {
          type: 'heading',
          text: '3. Prohibitive / Restrictive Signs',
        },
        {
          type: 'paragraph',
          text: 'A red circle with a bar or a pictured vehicle removes an option from the driver entirely. These signs do not warn, they forbid.',
        },
        {
          type: 'heading',
          text: 'Entry Prohibitions',
        },
        {
          type: 'table',
          headers: ['Sign Image', 'Sign Name', 'Meaning'],
          rows: [
            [`![No entry for all vehicles](${IMG}no-entry-all-vehicles.png)`, 'No Entry (All Vehicles)', 'A plain red circle with a white bar; no vehicle of any kind may enter.'],
            [`![No entry for cars](${IMG}no-entry-cars.png)`, 'No Entry (Cars)', 'Cars may not enter this road or lane.'],
            [`![No entry for jeepneys](${IMG}no-entry-jeepneys.png)`, 'No Entry (Jeepneys)', 'Jeepneys may not enter this road or lane.'],
            [`![No entry for buses](${IMG}no-entry-buses.png)`, 'No Entry (Buses)', 'Buses may not enter this road or lane.'],
            [`![No entry for trucks](${IMG}no-entry-trucks.png)`, 'No Entry (Trucks)', 'Trucks may not enter this road or lane.'],
            [`![No entry for bicycles](${IMG}no-entry-bicycles.png)`, 'No Entry (Bicycles)', 'Bicycles may not enter this road or lane.'],
            [`![No entry for motorcycles](${IMG}no-entry-motorcycles.png)`, 'No Entry (Motorcycles)', 'Motorcycles may not enter this road or lane.'],
            [`![No entry for tricycles](${IMG}no-entry-tricycles.png)`, 'No Entry (Tricycles)', 'Tricycles may not enter this road or lane.'],
            [`![No entry for animal-drawn vehicles](${IMG}no-entry-animal-drawn-vehicles.png)`, 'No Entry (Animal-Drawn Vehicles)', 'Animal-drawn vehicles may not enter this road or lane.'],
            [`![No entry for pushcarts](${IMG}no-entry-pushcarts.png)`, 'No Entry (Pushcarts)', 'Pushcarts may not enter this road or lane.'],
            [`![No entry for vehicles with trailer](${IMG}no-entry-vehicles-with-trailer.png)`, 'No Entry (Vehicles With Trailer)', 'Vehicles towing a trailer may not enter this road or lane.'],
          ],
        },
        {
          type: 'heading',
          text: 'Movement Prohibitions',
        },
        {
          type: 'table',
          headers: ['Sign Image', 'Sign Name', 'Meaning'],
          rows: [
            [`![No pedestrian crossing sign](${IMG}no-pedestrian-crossing.png)`, 'No Pedestrian Crossing', 'Pedestrians may not cross at this point; use the overpass or a marked pedestrian crossing instead.'],
            [`![No left turn sign](${IMG}no-left-turn.png)`, 'No Left Turn', 'A left turn is not allowed at this point.'],
            [`![No right turn sign](${IMG}no-right-turn.png)`, 'No Right Turn', 'A right turn is not allowed at this point.'],
            // FDM Vol. 1 p. 63
            [`![No U-turn sign](${IMG}no-u-turn.png)`, 'No U-Turn', 'A red-bordered circle with a crossed-out U-turn arrow: a U-turn is not allowed at this point.'],
            [`![No overtaking zone sign](${IMG}no-overtaking-zone.png)`, 'No Overtaking Zone', 'Passing another vehicle is not allowed in this zone.'],
          ],
        },
        {
          type: 'heading',
          text: '4. Speed Signs',
        },
        {
          type: 'paragraph',
          text: 'This level focuses on recognizing what each speed sign requires. Full speed management and following-distance judgment is developed in a later level.',
        },
        {
          type: 'table',
          headers: ['Sign Image', 'Sign Name', 'Meaning'],
          rows: [
            [`![Maximum speed restriction sign](${IMG}maximum-speed-restriction.png)`, 'Maximum Speed Restriction', 'Vehicles must not exceed the posted speed.'],
            [`![Minimum speed restriction sign](${IMG}minimum-speed-restriction.png)`, 'Minimum Speed Restriction', 'Vehicles must not travel slower than the posted speed.'],
            [`![End of speed restriction sign](${IMG}end-of-speed-restriction.png)`, 'End Of Speed Restriction', 'The posted speed limit no longer applies past this point.'],
          ],
        },
        {
          type: 'heading',
          text: '5. Parking And Stopping Signs',
        },
        {
          type: 'paragraph',
          text: 'This level asks you to recognize these signs on sight. Full parking maneuver rules are covered in a later level.',
        },
        {
          type: 'table',
          headers: ['Sign Image', 'Sign Name', 'Meaning'],
          rows: [
            [`![Allowable parking or loading zone sign](${IMG}allowable-parking-loading-zone.png)`, 'Allowable Parking / Loading Zone', 'Parking or loading is allowed only at the time and place shown.'],
            [`![No stopping anytime sign](${IMG}no-stopping-anytime.png)`, 'No Stopping Anytime', 'The vehicle may not stop in the marked area at any time.'],
            [`![No loading or unloading zone sign](${IMG}no-loading-unloading-zone.png)`, 'No Loading / Unloading Zone', 'Loading or unloading passengers or cargo is not allowed here.'],
            [`![No parking near fire hydrant sign](${IMG}no-parking-fire-hydrant.png)`, 'No Parking: Fire Hydrant', 'No parking within 4 meters of a fire hydrant.'],
            [`![No waiting sign](${IMG}no-waiting.png)`, 'No Waiting', 'Vehicles may not wait or idle in the marked area.'],
            [`![Bus-PUJ stop zone sign](${IMG}bus-puj-stop-zone.png)`, 'Bus-PUJ Stop Zone', 'Reserved for buses and jeepneys loading passengers; other vehicles may not park.'],
            [`![PUJ stop zone sign](${IMG}puj-stop-zone.png)`, 'PUJ Stop Zone', 'Reserved for jeepneys loading passengers; other vehicles may not park.'],
            [`![Bus stop zone sign](${IMG}bus-stop-zone.png)`, 'Bus Stop Zone', 'Reserved for buses loading passengers; other vehicles may not park.'],
            [`![No stopping or parking within yellow box sign](${IMG}no-stopping-parking-yellow-box.png)`, 'No Stopping / Parking: Yellow Box', 'No stopping or parking at any time within a marked yellow box.'],
            [`![No parking tow-away zone sign](${IMG}no-parking-tow-away-zone.png)`, 'No Parking: Tow-Away Zone', 'A vehicle parked here may be towed.'],
            [`![No parking Monday to Friday sign](${IMG}no-parking-monday-to-friday.png)`, 'No Parking, Monday To Friday', 'Parking is not allowed on the marked days regardless of time.'],
            [`![Right turner cross at broken lines sign](${IMG}right-turner-cross-at-broken-lines.png)`, 'Right Turner Cross At Broken Lines', 'Vehicles from the left lane may cross the broken line to turn right within a bus or PUJ zone.'],
          ],
        },
        {
          type: 'heading',
          text: '6. Miscellaneous Signs',
        },
        {
          type: 'table',
          headers: ['Sign Image', 'Sign Name', 'Meaning'],
          rows: [
            [`![No entry for vehicles exceeding axle load sign](${IMG}no-entry-axle-load-over-2-tons.png)`, 'No Entry: Axle Load Over 2 Tons', 'Vehicles exceeding the stated axle load may not enter.'],
            [`![No entry for vehicles exceeding gross vehicle mass sign](${IMG}no-entry-gross-vehicle-mass-over-5-tons.png)`, 'No Entry: Gross Vehicle Mass Over 5 Tons', 'Vehicles exceeding the stated weight may not enter.'],
            [`![No entry for vehicles exceeding length sign](${IMG}no-entry-length-over-10-meters.png)`, 'No Entry: Length Over 10 Meters', 'Vehicles exceeding the stated length may not enter.'],
            [`![No entry for vehicles exceeding width sign](${IMG}no-entry-width-over-2-meters.png)`, 'No Entry: Width Over 2 Meters', 'Vehicles exceeding the stated width may not enter.'],
            [`![No entry for vehicles exceeding height sign](${IMG}no-entry-height-over-3-5-meters.png)`, 'No Entry: Height Over 3.5 Meters', 'Vehicles exceeding the stated height may not enter.'],
            [`![No blowing of horns sign](${IMG}no-blowing-of-horns.png)`, 'No Blowing Of Horns', 'Horn use is prohibited here except for a genuine safety warning.'],
            [`![Use seat belt sign](${IMG}use-seat-belt.png)`, 'Use Seat Belt', 'Reminder sign for RA 8750, the Seat Belt Law.'],
            [`![Be aware of PWD crossing sign](${IMG}be-aware-of-pwd-crossing.png)`, 'Be Aware Of PWD Crossing', 'Watch for persons with disabilities crossing ahead.'],
            [`![Be aware of children crossing sign](${IMG}be-aware-of-children-crossing.png)`, 'Be Aware Of Children Crossing', 'Watch for children crossing, typically near a school.'],
            [`![Be aware of pedestrian crossing sign](${IMG}be-aware-of-pedestrian-crossing.png)`, 'Be Aware Of Pedestrian Crossing', 'Watch for pedestrians crossing ahead.'],
            [`![Bicycle lane ahead marker](${IMG}bicycle-lane-ahead.png)`, 'Bicycle Lane Ahead', 'A bicycle lane begins or crosses ahead; watch for cyclists.'],
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
            'Treating a Give Way sign as optional when the road looks empty.',
            'Parking or stopping within 6 meters of a Stop sign, or within 4 meters of a fire hydrant.',
            'Ignoring a "no entry for specific vehicle" sign because the road looks open.',
            'Confusing "no left/right turn" with "no U-turn"; they are separate prohibitions.',
          ],
        },
      ],
    },
    {
      id: 'level-3-category-b-warning',
      title: 'B. Warning Signs',
      text: 'Warning signs give a driver time to adjust speed and attention before reaching a hazard, not after.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Warning signs give a driver time to adjust speed and attention before reaching a hazard, not after.',
        },
        {
          type: 'paragraph',
          text: 'Unlike a regulatory sign, a warning sign does not forbid anything by itself. It tells you what condition is coming so you can decide the safe way to handle it: slow down, cover the brake, or simply pay closer attention.',
        },
        // FDM Vol. 1 pp. 67-72: warning signs are shown as white triangles with a red border.
        {
          type: 'paragraph',
          text: 'Most warning signs in the FDM share one shape: a white triangle, point up, with a red border and a black symbol. If you see that shape, expect a hazard ahead even before you read the symbol. Crossing warnings for pedestrians, children and PWDs use a bright yellow-green background so they stand out.',
        },
        {
          type: 'heading',
          text: '1. Horizontal Signs',
        },
        {
          type: 'table',
          headers: ['Sign Image', 'Sign Name', 'Meaning'],
          rows: [
            [`![Sharp turn sign](${IMG}sharp-turn.png)`, 'Sharp Turn', 'A single sharp bend is ahead in the indicated direction.'],
            [`![Double sharp turn sign](${IMG}double-sharp-turn.png)`, 'Double Sharp Turn', 'Two sharp bends follow one after another.'],
            [`![Curve sign](${IMG}curve.png)`, 'Curve', 'A gentler curve is ahead in the indicated direction.'],
            [`![Double curve sign](${IMG}double-curve.png)`, 'Double Curve', 'Two curves in opposite directions follow one another, forming an S-curve.'],
            [`![Winding road sign](${IMG}winding-road.png)`, 'Winding Road', 'A series of curves continues for some distance.'],
            [`![Hairpin bend sign](${IMG}hairpin-bend.png)`, 'Hairpin Bend', 'A very sharp, near-reversal turn is ahead; slow down significantly.'],
          ],
        },
        {
          type: 'heading',
          text: '2. Intersection Signs',
        },
        {
          type: 'table',
          headers: ['Sign Image', 'Sign Name', 'Meaning'],
          rows: [
            [`![Intersection ahead sign](${IMG}intersection-ahead.png)`, 'Intersection Ahead', 'A junction is coming up; be ready to yield or stop.'],
            [`![Approach to Intersection sign](${IMG}approach-to-intersection.png)`, 'Approach To Intersection', 'An intersection is being approached; begin observing cross traffic.'],
            [`![T-junction ahead sign](${IMG}t-junction-ahead.png)`, 'T-Junction Ahead', 'The road ends ahead in a T-shaped junction.'],
            [`![Y-junction ahead sign](${IMG}y-junction-ahead.png)`, 'Y-Junction Ahead', 'The road splits ahead in a Y-shaped junction.'],
            [`![Roundabout ahead sign](${IMG}roundabout-ahead-rotunda.png)`, 'Roundabout Ahead (Rotunda)', 'A roundabout is ahead; expect circulating traffic.'],
            [`![Side road junction ahead sign](${IMG}side-road-junction-ahead.png)`, 'Side Road Junction Ahead', 'A minor road joins from the side.'],
            [`![Approach to intersection side road sign](${IMG}approach-to-intersection-side-road.png)`, 'Approach To Intersection, Side Road', 'An intersection with a side road is approaching.'],
            [`![Approach to intersection merging traffic sign](${IMG}approach-to-intersection-merging-traffic.png)`, 'Approach To Intersection, Merging Traffic', 'Traffic from another road merges into your lane ahead.'],
          ],
        },
        {
          type: 'heading',
          text: '3. Advance Warning / Traffic Control Device Signs',
        },
        {
          type: 'paragraph',
          text: 'Used to indicate a signalized intersection and to warn of the presence of Stop and Give Way signs ahead.',
        },
        {
          type: 'table',
          headers: ['Sign Image', 'Sign Name', 'Meaning'],
          rows: [
            [`![Traffic lights ahead sign](${IMG}traffic-lights-ahead.png)`, 'Traffic Lights Ahead', 'A signalized intersection is ahead; no parking or stopping within 6 meters of this sign.'],
            [`![Stop sign ahead sign](${IMG}stop-sign-ahead.png)`, 'Stop Sign Ahead', 'A Stop sign is coming up; begin slowing now.'],
          ],
        },
        {
          type: 'heading',
          text: '4. Road Width Signs',
        },
        {
          type: 'table',
          headers: ['Sign Image', 'Sign Name', 'Meaning'],
          rows: [
            [`![Road narrows ahead sign](${IMG}road-narrows-ahead.png)`, 'Road Narrows Ahead', 'The road width is about to decrease.'],
            [`![Divided road ahead sign](${IMG}divided-road-ahead.png)`, 'Divided Road Ahead', 'A median divider begins ahead.'],
            [`![Give way sign ahead sign](${IMG}give-way-sign-ahead.png)`, 'Give Way Sign Ahead', 'A Give Way sign is coming up; begin slowing now.'],
            [`![Narrow bridge ahead sign](${IMG}narrow-bridge-ahead.png)`, 'Narrow Bridge Ahead', 'A bridge ahead is narrower than the current road.'],
            [`![End of divided road ahead sign](${IMG}end-of-divided-road-ahead.png)`, 'End Of Divided Road Ahead', 'The median divider ends ahead.'],
            [`![Two-way traffic sign](${IMG}two-way-traffic.png)`, 'Two-Way Traffic', 'Warns that opposing traffic should now be expected, typically where a divided or one-way section of road ends.'],
          ],
        },
        {
          type: 'heading',
          text: '5. Road Obstacle Signs',
        },
        {
          type: 'table',
          headers: ['Sign Image', 'Sign Name', 'Meaning'],
          rows: [
            [`![Opening bridge ahead sign](${IMG}opening-bridge-ahead.png)`, 'Opening Bridge Ahead', 'A bridge that can open for water traffic is ahead.'],
            [`![Uneven road ahead sign](${IMG}uneven-road-ahead.png)`, 'Uneven Road Ahead', 'The road surface ahead is rough or damaged.'],
            [`![Hump ahead sign](${IMG}hump-ahead.png)`, 'Hump Ahead', 'A speed hump is ahead; slow down.'],
            [`![Downhill sign](${IMG}downhill-sign.png)`, 'Downhill Sign', 'A steep downhill grade is ahead.'],
            [`![Uphill sign](${IMG}uphill-sign.png)`, 'Uphill Sign', 'A steep uphill grade is ahead.'],
            [`![Spillway sign](${IMG}spillway-sign.png)`, 'Spillway Sign', 'A low-lying spillway crossing is ahead, which may be underwater during heavy rain.'],
            [`![Flood-prone area sign](${IMG}flood-prone-area.png)`, 'Flood-Prone Area', 'The area is known to flood in certain conditions.'],
            [`![Landslide-prone area sign](${IMG}landslide-prone-area.png)`, 'Landslide-Prone Area', 'The area is known to experience landslides in certain conditions.'],
            [`![Low-flying airplane zone sign](${IMG}low-flying-airplane-zone.png)`, 'Low-Flying Airplane Zone', 'Aircraft may fly at low altitude near this area, typically close to an airport.'],
            [`![Animal crossing ahead sign](${IMG}animal-crossing-ahead.png)`, 'Animal Crossing Ahead', 'Animals may cross the road in this area.'],
            [`![Slippery road sign](${IMG}slippery-road.png)`, 'Slippery Road', 'The road surface may be slippery, especially when wet.'],
            [`![Danger from falling rocks sign](${IMG}danger-from-falling-rocks.png)`, 'Danger From Falling Rocks', 'Loose rocks or debris may fall onto the road, typically along a mountain or cliffside route.'],
          ],
        },
        {
          type: 'heading',
          text: '6. Pedestrian Signs',
        },
        {
          type: 'table',
          headers: ['Sign Image', 'Sign Name', 'Meaning'],
          rows: [
            [`![Pedestrian crossing ahead sign](${IMG}pedestrian-crossing-ahead.png)`, 'Pedestrian Crossing Ahead', 'A marked pedestrian crossing is ahead.'],
            [`![Be aware and stop for children crossing ahead sign](${IMG}be-aware-and-stop-for-children-crossing-ahead.png)`, 'Be Aware And Stop For Children Crossing Ahead', 'A school or area with frequent child pedestrians is ahead.'],
            [`![PWD crossing ahead sign](${IMG}pwd-crossing-ahead.png)`, 'PWD Crossing Ahead', 'Persons with disabilities may be crossing ahead.'],
            [`![Advice to cross at designated areas sign](${IMG}advice-to-cross-at-designated-areas.png)`, 'Advice To Cross At Designated Areas', 'Reminds pedestrians to use the marked crossing, not to cross anywhere.'],
            [`![Be aware and slow down bike lane ahead sign](${IMG}be-aware-and-slow-down-bike-lane-ahead.png)`, 'Be Aware And Slow Down: Bike Lane Ahead', 'A bicycle lane crosses or runs alongside the road ahead.'],
          ],
        },
        // FDM Vol. 1 pp. 124, 156, 167, 180
        {
          type: 'paragraph',
          text: 'When a pedestrian sign leads you to a crosswalk, slow down and stop to yield to pedestrians. Never park on a pedestrian lane, under any circumstances. Stopping a jeepney or bus on the crosswalk to wait for passengers is one of the common violations by PUV drivers.',
        },
        {
          type: 'heading',
          text: '7. Railway Level Crossing Signs',
        },
        {
          type: 'table',
          headers: ['Sign Image', 'Sign Name', 'Meaning'],
          rows: [
            [`![Advance railroad crossing warning sign](${IMG}advance-railroad-crossing-warning.png)`, 'Advance Railroad Crossing Warning', 'A railway crossing is coming up ahead; begin slowing down.'],
            [`![Railroad crossing sign](${IMG}railroad-crossing.png)`, 'Railroad Crossing', 'The road crosses railway tracks at this point; stop at the designated line or drive with caution.'],
            [`![Alternative railway crossing sign](${IMG}alternative-railway-crossing.png)`, 'Alternative Railway Crossing', 'Positioned in an area where it can be easily seen, as an additional warning ahead of the crossing.'],
          ],
        },
        {
          type: 'paragraph',
          text: 'If there are no warning devices such as a barrier or a light at a railway crossing, slow down, check both directions, then proceed with caution only if it is clearly safe.',
        },
        {
          type: 'heading',
          text: '8. Supplementary Signs',
        },
        {
          type: 'table',
          headers: ['Sign Image', 'Sign Name', 'Meaning'],
          rows: [
            [`![Preferred maximum speed sign](${IMG}preferred-maximum-speed-normal-weather.png)`, 'Preferred Maximum Speed (Normal Weather)', 'Suggests a safe speed for normal weather and traffic conditions.'],
            [`![Additional sign on roadworks ahead](${IMG}additional-sign-on-roadworks-ahead.png)`, 'Additional Sign On Roadworks Ahead', 'Supplements a roadwork sign with extra detail such as a temporary speed limit.'],
            [`![Signs for PWDs, senior citizens, schools, playgrounds](${IMG}signs-for-pwds-senior-citizens-schools-playgrounds.png)`, 'Signs For PWDs, Senior Citizens, Schools, Playgrounds', 'Marks an area with extra pedestrian caution needed for these groups.'],
            [`![When wet supplementary sign](${IMG}when-wet-supplementary-sign.png)`, 'When Wet (Supplementary Sign)', 'Combined with the Slippery Road sign; the hazard applies specifically when the road is wet.'],
          ],
        },
        {
          type: 'heading',
          text: '9. Other Warning Signs',
        },
        {
          type: 'table',
          headers: ['Sign Image', 'Sign Name', 'Meaning'],
          rows: [
            [`![For PUJ or buses supplementary sign](${IMG}for-puj-buses-supplementary-plate.png)`, 'For PUJ / Buses (Supplementary Plate)', 'Narrows the main sign\u2019s instruction to apply specifically to public utility jeepneys and buses.'],
            [`![Distance to next hazard area sign](${IMG}distance-to-next-hazard-area.png)`, 'Distance To Next Hazard Area', 'States how far ahead the next hazard area is located.'],
            [`![Vertical clearance 5.20 meters sign](${IMG}vertical-clearance-maximum-height-5-20-meters.png)`, 'Vertical Clearance: Maximum Height 5.20 Meters', 'Vehicles taller than 5.20 meters cannot safely pass underneath.'],
            [`![Vertical clearance 4.80 meters sign](${IMG}vertical-clearance-maximum-height-4-80-meters.png)`, 'Vertical Clearance: Maximum Height 4.80 Meters', 'Vehicles taller than 4.80 meters cannot safely pass underneath.'],
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
            'Treating a railway crossing without a barrier as safe to cross without looking both ways.',
            'Speeding through a hump or uneven-road sign because no hump is visible yet.',
            'Ignoring a children or PWD crossing sign because no one is visible at that moment.',
          ],
        },
      ],
    },
    {
      id: 'level-3-category-c-guide',
      title: 'C. Guide / Informative Signs',
      text: 'Guide and informative signs do not command or warn; they help a driver navigate.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Guide and informative signs do not command or warn; they help a driver navigate.',
        },
        {
          type: 'heading',
          text: '1-6. Direction And Place Signs',
        },
        {
          type: 'paragraph',
          text: 'These six sign types share the same visual language: rectangular signs in green, blue, or white, carrying text and sometimes an arrow. The manual itself illustrates each one with several real-world example photos rather than one fixed pictogram; a Street Name Sign, for instance, can read anything depending on the street. What actually distinguishes these six types from each other is not appearance, it is where and when each one appears on the road.',
        },
        {
          type: 'image',
          alt: 'Representative example of a green rectangular direction sign, showing the general visual style shared by this family of signs.',
          src: IMG + 'representative-example-of-a-green-rectangular-direction-sign-showing-the-general-visual-style-shared-by-this-family-of-signs.png',
        },
        {
          type: 'table',
          headers: ['Sign Type', 'When / Where It Appears'],
          rows: [
            ['Advance Direction Sign', 'Placed well before an intersection, previewing the routes and directions available further ahead.'],
            ['Intersection Direction Sign', 'Placed less than 1 kilometer before an intersection, confirming the routes available.'],
            ['Reassurance Direction Sign', 'Placed after a junction, confirming the approximate distance remaining to a particular exit or destination.'],
            ['Fingerboard Direction Sign', 'Placed at smaller, less major intersections, pointing toward nearby roads, streets, or towns.'],
            ['Street Name Sign', 'Placed along the road, naming the street currently being entered or passed.'],
            ['Town Name / Geographical Feature Sign', 'Placed at a town or provincial boundary, naming the place, boundary, or geographic feature being entered.'],
          ],
        },
        {
          type: 'heading',
          text: '7. Service Signs',
        },
        {
          type: 'paragraph',
          text: 'Service signs point to a facility a driver or passenger may need during a trip.',
        },
        {
          type: 'table',
          headers: ['Sign Image', 'Sign Name', 'Meaning'],
          rows: [
            [`![Hospital sign](${IMG}hospital.png)`, 'Hospital', 'Medical help is available in the indicated direction.'],
            [`![First aid station sign](${IMG}first-aid-station.png)`, 'First Aid Station', 'A first-aid facility is available.'],
            [`![Ambulance sign](${IMG}ambulance.png)`, 'Ambulance', 'Ambulance service is available in the indicated direction.'],
            [`![Breakdown station sign](${IMG}breakdown-station.png)`, 'Breakdown Station', 'Roadside assistance or vehicle breakdown help is available.'],
            [`![Telephone booth sign](${IMG}telephone-booth.png)`, 'Telephone Booth', 'A telephone facility is available.'],
            [`![Gasoline station sign](${IMG}gasoline-station.png)`, 'Gasoline Station', 'Fuel is available in the indicated direction.'],
            [`![Parking area sign](${IMG}parking-area.png)`, 'Parking Area', 'A parking facility is available.'],
            [`![Accommodation sign](${IMG}accommodation-hotel-motel.png)`, 'Accommodation (Hotel, Motel)', 'Lodging is available.'],
            [`![Caravan site or camping area sign](${IMG}caravan-site-camping-area.png)`, 'Caravan Site / Camping Area', 'Camping or caravan facilities are available.'],
            [`![Information center sign](${IMG}information-center.png)`, 'Information Center', 'Traveler information is available.'],
            [`![Restaurant or refreshment sign](${IMG}restaurant-refreshment.png)`, 'Restaurant / Refreshment', 'Food is available.'],
            [`![Rest area or picnic ground sign](${IMG}rest-area-picnic-ground.png)`, 'Rest Area / Picnic Ground', 'A place to stop and rest is available.'],
            [`![Directions of airport sign](${IMG}directions-of-airport.png)`, 'Directions Of Airport', 'Points toward the nearest airport.'],
            [`![Truck parking sign](${IMG}truck-parking.png)`, 'Truck Parking', 'A parking facility for trucks is available.'],
            [`![Rest rooms sign](${IMG}rest-rooms.png)`, 'Rest Rooms', 'Public restrooms are available.'],
            [`![Disabled service sign](${IMG}disabled-service.png)`, 'Disabled Service', 'Facilities for persons with disabilities are available.'],
            [`![Litter bin sign](${IMG}litter-bin.png)`, 'Litter Bin', 'A waste disposal point is available.'],
          ],
        },
        {
          type: 'heading',
          text: '8. Tourist Information And Tourist Destination Signs',
        },
        {
          type: 'table',
          headers: ['Sign Image', 'Sign Name', 'Meaning'],
          rows: [
            [`![Tourist information sign](${IMG}tourist-information-destination-sign.png)`, 'Tourist Information / Destination Sign', 'Points toward a tourist destination or point of interest.'],
          ],
        },
        {
          type: 'heading',
          text: '9. Route Markers',
        },
        {
          type: 'table',
          headers: ['Sign Image', 'Sign Name', 'Meaning'],
          rows: [
            [`![Philippine highway network route marker](${IMG}philippine-highway-network-route-marker.jpg)`, 'Philippine Highway Network Route Marker', 'Identifies the route number and direction of a national highway; distance is measured from each province Zero Kilometer Post.'],
          ],
        },
        {
          type: 'heading',
          text: '10. Asian Highway Route Markers',
        },
        {
          type: 'table',
          headers: ['Sign Image', 'Sign Name', 'Meaning'],
          rows: [
            [`![Asian highway route marker AH26](${IMG}asian-highway-route-marker.png)`, 'Asian Highway Route Marker', 'Identifies the route as part of the Asian Highway network; the Philippines is assigned AH26.'],
          ],
        },
      ],
    },
    {
      id: 'level-3-category-d-expressway',
      title: 'D. Signs On Expressways',
      text: 'Expressway signs give a driver advance information to position the vehicle in the correct lane before it is too late to react.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Expressway signs give a driver advance information to position the vehicle in the correct lane before it is too late to react. This level covers recognizing these signs; the full rules of expressway driving, such as merging procedure and allowed vehicle types, are covered in a later level.',
        },
        {
          type: 'heading',
          text: '1. Expressway Approach Signs',
        },
        {
          type: 'paragraph',
          text: 'Installed in advance of, or at, the nearest intersection or interchange leading to the expressway, so a driver knows the expressway is coming up.',
        },
        {
          type: 'heading',
          text: '2. Expressway Information Signs',
        },
        {
          type: 'table',
          headers: ['Sign Image', 'Sign Name', 'Meaning'],
          rows: [
            [`![Prohibited on expressway sign](${IMG}prohibited-on-expressway.png)`, 'Prohibited On Expressway', 'The pictured vehicle type or activity is not allowed on the expressway.'],
            [`![Lane direction sign](${IMG}lane-direction.png)`, 'Lane Direction', 'Guides motorists into the correct lane leading to an interchange.'],
            [`![Toll charges sign](${IMG}toll-charges.png)`, 'Toll Charges', 'States the amount required to pay at the toll plaza.'],
          ],
        },
        {
          type: 'heading',
          text: '3. Advance Exit Signs',
        },
        {
          type: 'paragraph',
          text: 'Placed in advance of an exit toll, giving the driver time to move into the correct lane before the exit.',
        },
        {
          type: 'heading',
          text: '4. Expressway Exit Direction Signs',
        },
        {
          type: 'paragraph',
          text: 'Posted overhead before the exit ramp of an interchange, confirming the exit is here.',
        },
        {
          type: 'heading',
          text: '5. Expressway Service Signs',
        },
        {
          type: 'table',
          headers: ['Sign Image', 'Sign Name', 'Meaning'],
          rows: [
            [`![Distance and direction to rest areas sign](${IMG}distance-and-direction-to-rest-areas.png)`, 'Distance And Direction To Rest Areas', 'States how far ahead a rest area is and in which direction.'],
            [`![Distance and direction to expressway services sign](${IMG}distance-and-direction-to-expressway-services.png)`, 'Distance And Direction To Expressway Services', 'States how far ahead a service facility is and in which direction.'],
          ],
        },
        {
          type: 'heading',
          text: '6. Start And End Of Expressway Signs',
        },
        {
          type: 'paragraph',
          text: 'Marks the exact point where the expressway begins or ends.',
        },
        {
          type: 'heading',
          text: '7. Expressway Traffic Instruction And Regulatory Signs',
        },
        {
          type: 'paragraph',
          text: 'Special signs seen exclusively on expressways, such as those posted 200 meters from a toll exit to prepare the driver for the upcoming maneuver.',
        },
      ],
    },
    {
      id: 'level-3-category-e-traffic-instruction',
      title: 'E. Traffic Instruction Signs',
      text: 'Traffic instruction signs work alongside a regulatory or warning sign, telling the driver the exact course of action to take.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Traffic instruction signs work alongside a regulatory or warning sign, telling the driver the exact course of action to take. This level focuses on recognizing what each sign instructs; the full judgment behind turning, lane changes, and detours is developed further in a later level.',
        },
        {
          type: 'table',
          headers: ['Sign Image', 'Sign Name', 'Meaning'],
          rows: [
            [`![Driver must slow down sign](${IMG}driver-must-slow-down.png)`, 'Driver Must Slow Down', 'Reduce speed immediately.'],
            [`![Stop on designated stop line sign](${IMG}stop-on-designated-stop-line.png)`, 'Stop On Designated Stop Line', 'Come to a full stop exactly at the marked line.'],
            [`![Vehicle may turn if intersection is clear sign](${IMG}vehicle-may-turn-left-or-right-if-intersection-is-clear.png)`, 'Vehicle May Turn Left Or Right If Intersection Is Clear', 'The turn is allowed only once the intersection is clear of conflicting traffic.'],
            [`![Vehicles over 4.8 meters must detour sign](${IMG}vehicles-over-4-8-meters-in-height-must-detour.png)`, 'Vehicles Over 4.8 Meters In Height Must Detour', 'Tall vehicles exceeding the stated height must follow the marked detour instead of proceeding.'],
            [`![Driver must give way to pedestrians sign](${IMG}driver-must-give-way-to-pedestrians.png)`, 'Driver Must Give Way To Pedestrians', 'Pedestrians have priority at this point.'],
            [`![Stay on right lane unless passing sign](${IMG}stay-on-right-lane-unless-passing.png)`, 'Stay On Right Lane Unless Passing', 'Keep to the right lane except when overtaking another vehicle.'],
            [`![Detour directional sign](${IMG}detour-directional-sign.png)`, 'Detour Directional Sign', 'Marks the alternate route to follow when the normal route is unavailable.'],
            [`![Turn right on green light only sign](${IMG}turn-right-on-green-light-only.png)`, 'Turn Right On Green Light Only', 'A right turn is allowed only on a green signal, not on red.'],
            [`![Approaching dead end sign](${IMG}approaching-dead-end.png)`, 'Approaching Dead End', 'The road ahead ends completely; there is no through passage.'],
            [`![Road closed to all vehicles sign](${IMG}road-closed-to-all-vehicles.png)`, 'Road Closed To All Vehicles', 'The road ahead is closed to all vehicle traffic.'],
            [`![Directional signs for trucks and buses](${IMG}directional-signs-for-trucks-and-buses.png)`, 'Directional Signs For Trucks And Buses', 'Shows the specific route trucks and buses must follow, separate from other traffic.'],
            [`![Drivers to form one lane only sign](${IMG}drivers-to-form-one-lane-only.png)`, 'Drivers To Form One Lane Only', 'Merge into a single lane ahead, typically due to an obstruction or lane closure.'],
          ],
        },
      ],
    },
    {
      id: 'level-3-category-f-hazard-markers',
      title: 'F. Hazard Markers',
      text: 'Hazard markers emphasize to an approaching driver a marked change in the direction of travel and the presence of an obstruction.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Hazard markers emphasize to an approaching driver a marked change in the direction of travel and the presence of an obstruction.',
        },
        {
          type: 'table',
          headers: ['Sign Image', 'Sign Name', 'Meaning'],
          rows: [
            [`![One-way hazard marker](${IMG}one-way-hazard-marker.png)`, 'One-Way Hazard Marker', 'Indicates the only direction to follow where the marker appears in the driving path.'],
            [`![Two-way hazard marker](${IMG}two-way-hazard-marker.png)`, 'Two-Way Hazard Marker', 'Warns the driver that the road ahead is about to change direction; traffic may pass on either side of the marked obstruction.'],
            [`![Chevron sign](${IMG}chevron-sign.jpg)`, 'Chevron Sign', 'Guides drivers through a change in the horizontal alignment of the road.'],
            [`![Median island or overpass column hazard marker](${IMG}median-island-overpass-column-marker.png)`, 'Median Island / Overpass Column Marker', 'Marks a wide column of an overpass structure or a median island so drivers see it in time.'],
            [`![Width marker](${IMG}width-marker.png)`, 'Width Marker', 'Marks narrowing vehicle-width clearance, often near a bridge approach.'],
            [`![Obstruction marker](${IMG}obstruction-marker.png)`, 'Obstruction Marker', 'Marks a road closure or obstruction ahead.'],
          ],
        },
      ],
    },
    {
      id: 'level-3-category-g-roadwork',
      title: 'G. Roadwork Signs',
      text: 'Roadwork signs mark construction or maintenance activity on the road.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Roadwork signs mark construction or maintenance activity on the road.',
        },
        {
          type: 'paragraph',
          text: 'Unlike categories A and B, the manual does not give roadwork signage a fixed set of numbered pictograms. It shows example photos of real work-zone signage instead, since this kind of sign is often temporary and site-specific. The one official warning triangle below is the closest thing to a standard pictogram; the board texts beneath it are common real-world examples, not a fixed catalog.',
        },
        {
          type: 'table',
          headers: ['Sign Image', 'Sign Name', 'Meaning'],
          rows: [
            [`![Roadwork or road construction ahead sign](${IMG}roadwork-road-construction-ahead.png)`, 'Roadwork / Road Construction Ahead', 'Official warning triangle; construction or maintenance activity is ahead.'],
          ],
        },
        {
          type: 'heading',
          text: 'Common Work-Zone Signage',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            '"Danger, Men At Work" — a temporary board marking a work crew on or near the road.',
            '"Men Working Overhead" — warns of work happening above the roadway, such as on a bridge or overpass.',
            '"Do Not Enter" — a barrier marking the work zone itself as off-limits to traffic.',
            '"Construction, Sorry For The Inconvenience" — a courtesy notice alongside the work zone.',
          ],
        },
        {
          type: 'paragraph',
          text: 'The exact wording varies by site, but the correct response does not: slow down, watch for workers and equipment, and follow any temporary detour.',
        },
      ],
    },
    {
      id: 'level-3-traffic-lights',
      title: 'Traffic Lights And Signals',
      text: 'A traffic light removes guesswork: the color tells you exactly what is allowed at this instant.',
      blocks: [
        {
          type: 'paragraph',
          text: 'A traffic light removes guesswork: the color tells you exactly what is allowed at this instant. Traffic lights sit outside the lettered A-G sign system, but they are just as critical to read correctly.',
        },
        {
          type: 'table',
          headers: ['Signal', 'Meaning'],
          rows: [
            ['Red (solid)', 'Bring the vehicle to a full stop at the marked stop line.'],
            ['Flashing red', 'Bring the vehicle to a full stop, then proceed only when it is safe, similar to a stop sign.'],
            ['Yellow / amber (solid)', 'The red signal is about to appear; prepare to stop if it is safe to do so.'],
            ['Flashing yellow', 'Slow down and proceed with caution.'],
            ['Green (solid)', 'Proceed, provided you yield to pedestrians and traffic lawfully using the intersection.'],
            ['Flashing green', 'Proceed with caution; commonly seen where a pedestrian crossing button is available.'],
            // FDM Vol. 1 pp. 170, 181
            ['Green arrow', 'Vehicles turning in the direction of the arrow may proceed.'],
            ['Steady yellow arrow', 'Turning vehicles facing the arrow must slow down and prepare to stop.'],
          ],
        },
        {
          type: 'heading',
          text: 'Key Reminder',
        },
        {
          type: 'paragraph',
          text: 'A green light does not remove the duty to yield. It only means the driver may proceed if the intersection is actually clear of pedestrians and lawfully present traffic. Detailed right-of-way judgment at intersections is covered in a later level; this level focuses on correctly reading and obeying each signal color.',
        },
        {
          type: 'heading',
          text: 'Common Mistakes',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            // FDM Vol. 1 p. 178
            'Treating yellow as a signal to speed up and beat the red light. Disregarding the yellow light to rush through is beating the red light, which amounts to reckless driving.',
            'Rolling through a flashing red without coming to a full stop first.',
            'Assuming flashing green means the same thing as solid green.',
          ],
        },
      ],
    },
    {
      id: 'level-3-sign-reading-method',
      title: 'Sign-Reading Method And Mission Recap',
      text: 'Use one repeatable method every time a sign or signal appears: detect, identify, interpret, decide, execute.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Use one repeatable method every time a sign or signal appears: detect, identify, interpret, decide, execute.',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Detect the sign or signal as early as possible.',
            'Identify its category: regulatory, warning, guide, expressway, traffic instruction, hazard marker, roadwork, or signal.',
            'Interpret the specific instruction or hazard it communicates.',
            'Decide the correct action: stop, yield, slow down, avoid a movement, or simply take note for navigation.',
            'Execute the action smoothly and in time, not at the last second.',
          ],
        },
        {
          type: 'heading',
          text: 'Scenario',
        },
        {
          type: 'paragraph',
          text: 'On this mission, the route passes an intersection with a Stop sign, a Give Way sign near a merging side road, a No Entry sign blocking a shortcut, a posted speed limit through a crowded street, warning signs for a curve and a pedestrian crossing, and a signalized intersection with a full red-yellow-green cycle. Reading and responding correctly to each one, in order, completes the mission.',
        },
        {
          type: 'heading',
          text: 'Level Recap',
        },
        {
          type: 'paragraph',
          text: 'Regulatory signs enforce a rule. Warning signs call for caution before a hazard. Guide and informative signs help with navigation. Expressway, traffic instruction, hazard marker, and roadwork signs each mark a more specific situation. Traffic lights and flashing signals control movement moment to moment. The reference tables in this level cover the full sign vocabulary the LTO written exam tests; the mission tests whether you can act on that vocabulary in real time.',
        },
      ],
    },
  ],
  quiz: [],
} satisfies LevelModule;

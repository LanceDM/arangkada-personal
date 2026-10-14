import type { LevelModule } from '@/features/driving-sim/domain/scenario/lessonModule';

const IMG = 'arangkada_extracted_images/level11/';

export const level11Module = {
  id: 'lto_level_11',
  title: 'Motorcycles, Tricycles, PUVs',
  sourceLevel: 11,
  desc: 'Learn the vehicle-specific rules for motorcycles, tricycles, and public utility vehicles: helmets, child riders, accessories, registration, franchise, loading, and passenger care.',
  lessons: [
    {
      id: 'level-11-mission-briefing',
      title: 'Mission Briefing: Motorcycles, Tricycles, PUVs',
      text: "Every vehicle class on the road plays by the same core traffic rules, but each also carries its own extra layer of law. This level is about knowing that extra layer.",
      blocks: [
        {
          type: 'paragraph',
          text: "Every vehicle class on the road plays by the same core traffic rules, but each also carries its own extra layer of law. This level is about knowing that extra layer.",
        },
        {
          type: 'paragraph',
          text: 'On this mission, the route is mixed-traffic: a motorcycle lane to respect, a tricycle stopping to load passengers, a PUV using a loading zone, and vulnerable road users throughout. You already know the lane markings from Level 4 and defensive courtesy from Level 8; this level adds the vehicle-specific law that governs motorcycles, tricycles, and PUVs themselves.',
        },
        {
          type: 'heading',
          text: 'Learning Goals',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Apply the Motorcycle Helmet Act, including its one exemption.',
            'Apply the Children\'s Safety on Motorcycles Act.',
            'Recognize the legal limits on motorcycle top boxes, saddle bags, and auxiliary lamps.',
            'Recognize the purpose of the Motorcycle Crime Prevention Act\'s plate requirements.',
            'Know tricycle registration, franchise, and the most common tricycle violations.',
            'Apply PUV driver duties for loading, unloading, fare, and passenger care.',
            'Know the proper PUV driver uniform, required trip documents, and gender-respectful conduct toward passengers.',
            'Recognize passenger and cargo overloading limits.',
          ],
        },
      ],
    },
    {
      id: 'level-11-motorcycle-helmet-act',
      title: '1. Motorcycle Helmet Act (RA 10054)',
      text: 'This law exists because a helmet is the single most effective protection a motorcycle rider has.',
      blocks: [
        {
          type: 'paragraph',
          text: 'This law exists because a helmet is the single most effective protection a motorcycle rider has. All motorcycle riders and back riders must wear a standard protective motorcycle helmet at all times while driving, on any type of road, whether the trip is long or short.',
        },
        {
          type: 'paragraph',
          text: 'A standard protective motorcycle helmet is a type that complies with the specifications issued by the DTI, evidenced by a Philippine Standard (PS) mark or an Import Commodity Clearance (ICC) sticker.',
        },
        {
          type: 'heading',
          text: 'Types Of Helmet',
        },
        {
          type: 'image',
          alt: 'Three types of standard protective motorcycle helmet side by side: full face, half face, and half head.',
          src: IMG + 'motorcycle-helmet-types.jpg',
          size: 'large',
        },
        {
          type: 'heading',
          text: 'Exemption',
        },
        {
          type: 'paragraph',
          text: 'Tricycle drivers are exempted from the mandatory wearing of motorcycle helmets under this Act.',
        },
        {
          type: 'heading',
          text: 'Fines And Penalties (Rider)',
        },
        {
          type: 'table',
          headers: ['Offense', 'Fine'],
          rows: [
            ['1st', 'Php 1,500'],
            ['2nd', 'Php 3,000'],
            ['3rd', 'Php 5,000'],
            ['4th and succeeding', 'Php 10,000 plus confiscation of driver\'s license'],
          ],
        },
        {
          type: 'paragraph',
          text: 'A new helmet with a proper PS mark or ICC sticker must be made available by sellers and dealers when a new motorcycle is purchased. Selling or using substandard helmets, or those without the required marks, is separately penalized, as is tampering with or forging the marks themselves.',
        },
      ],
    },
    {
      id: 'level-11-childrens-safety-motorcycles-act',
      title: "2. Children's Safety On Motorcycles Act (RA 10666)",
      text: 'This law protects the most vulnerable passenger a motorcycle can carry: a child too small to protect themselves in a crash.',
      blocks: [
        {
          type: 'paragraph',
          text: 'This law protects the most vulnerable passenger a motorcycle can carry: a child too small to protect themselves in a crash.',
        },
        {
          type: 'paragraph',
          text: 'It is unlawful to drive a two-wheeled motorcycle with a child on board on public roads with heavy traffic volume, a high density of fast-moving vehicles, or a speed limit over 60 km/h, unless all three conditions below are met.',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'The child\'s feet can comfortably reach the standard foot peg of the motorcycle.',
            'The child\'s arms can reach around and grasp the waist of the rider.',
            'The child is wearing a standard protective helmet.',
          ],
        },
        {
          type: 'heading',
          text: 'Exception',
        },
        {
          type: 'paragraph',
          text: 'The prohibition does not apply if the child being transported needs immediate medical attention.',
        },
        {
          type: 'heading',
          text: 'Fines And Penalties',
        },
        {
          type: 'table',
          headers: ['Offense', 'Fine'],
          rows: [
            ['1st', 'Php 3,000'],
            ['2nd', 'Php 5,000'],
            ['3rd', 'Php 10,000 and one month suspension of driver\'s license'],
            ['Succeeding', 'Php 10,000 and automatic revocation of driver\'s license'],
          ],
        },
        {
          type: 'paragraph',
          text: 'If the violation results in death, or serious or less serious injury to the child or any other person, the rider or operator faces one year of imprisonment in addition to the applicable penalties under the Revised Penal Code.',
        },
      ],
    },
    {
      id: 'level-11-motorcycle-accessories-and-riding',
      title: '3. Motorcycle Accessories And Riding Standards',
      text: "A motorcycle's accessories and the rider's basic habits are regulated in detail, because small deviations, an oversized top box, a modified light, an extra passenger, create outsized risk on two wheels.",
      blocks: [
        {
          type: 'paragraph',
          text: "A motorcycle's accessories and the rider's basic habits are regulated in detail, because small deviations, an oversized top box, a modified light, an extra passenger, create outsized risk on two wheels.",
        },
        {
          type: 'heading',
          text: 'Top Boxes And Saddle Bags',
        },
        {
          type: 'paragraph',
          text: 'A top box or saddle bag that is factory-made specifically for motorcycles/scooters and DTI-approved is not subject to inspection, registration, or apprehension, provided it is securely attached and meets the size limit for its type. A custom-made version (such as a fast-food delivery box) is subject to inspection and registration, and must meet the same limits. An unregistered custom-made top box or saddle bag is subject to apprehension with a Php 5,000 penalty.',
        },
        {
          type: 'table',
          headers: ['Accessory', 'Size Limit'],
          rows: [
            ['Top box', 'Must not exceed 2 feet x 2 feet x 2 feet, must be securely attached, must not obstruct the view from the side mirrors, and can carry a maximum of two full-faced helmets.'],
            ['Saddle bag', 'Must not be higher than the seat, must not exceed 14 inches from the sides, and its length must not exceed the tail end of the motorcycle.'],
          ],
        },
        {
          type: 'heading',
          text: 'Auxiliary Headlamps (LED)',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Must have a separate switch from the main headlight.',
            'Light must point rightward, not directly ahead.',
            'Must be white or yellowish white light, without vibration.',
            'Must not be used on a well-lit street, or when approaching an oncoming vehicle.',
            'Up to two lamps allowed, with a maximum of six bulbs per lamp.',
            'Light must be directed 20 cm downward at 10 meters forward.',
            'The lamp must not be mounted higher than the handlebar.',
            'Must never be used in place of the main headlamp.',
          ],
        },
        {
          type: 'heading',
          text: 'Other Accessory And Riding Standards',
        },
        {
          type: 'table',
          headers: ['Accessory Or Habit', 'Standard'],
          rows: [
            ['Headlight color', 'Yellowish white or yellow.'],
            ['Brake light color', 'Bright red.'],
            ['Blinker taillight', 'Not allowed; this counts as illegal modification under JAO No. 2014-01.'],
            ['Back riders', 'Only one back rider is allowed at a time.'],
            ['Blood Alcohol Content for riders', 'Must not exceed 0.00%.'],
          ],
        },
        {
          type: 'heading',
          text: 'General Riding Standards',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Wear bright clothing when riding at night for clear visibility to other motorists.',
            'Keep feet firmly on the footrests while riding.',
            'Check your side mirrors upon boarding and before moving off.',
            'Anticipate a longer braking distance when carrying a back rider.',
            'Never stop inside a yellow box, under any circumstance.',
            'Riders are prohibited from using sidewalks and center islands.',
            'A motorcycle needs at least 400cc engine displacement to be allowed on an expressway.',
            'Switch on headlights when riding, for safety, even in daylight.',
          ],
        },
      ],
    },
    {
      id: 'level-11-motorcycle-crime-prevention-act',
      title: '4. Motorcycle Crime Prevention Act (RA 11235)',
      text: 'This law targets the use of motorcycles in crime by requiring plates that are bigger, more readable, and color-coded.',
      blocks: [
        {
          type: 'paragraph',
          text: 'This law targets the use of motorcycles in crime by requiring plates that are bigger, more readable, and color-coded, so a motorcycle can be identified quickly at a distance.',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'The owner must register a motorcycle with the LTO within five days of acquiring ownership.',
            'Any subsequent sale or disposal must be reported to the LTO within three days, with the notarized deed of sale.',
            'The metal plate is 235mm wide by 135mm tall, made of durable reflectorized aluminum, with 60mm-tall alphanumeric characters.',
            'A decal plate is 135mm wide by 85mm tall, with 40mm-tall reflectorized alphanumeric characters.',
          ],
        },
        {
          type: 'heading',
          text: 'Plate Color Coding',
        },
        {
          type: 'table',
          headers: ['Motorcycle Type', 'Plate Background', 'Characters'],
          rows: [
            ['Private motorcycle', 'White with a region-specific color stripe', 'Black'],
            ['Public utility motorcycle', 'Yellow', 'Black'],
            ['Government motorcycle', 'White', 'Red'],
          ],
        },
        {
          type: 'paragraph',
          text: 'The exact color-stripe placement on a private plate identifies the region where the motorcycle is registered; the point for a driver is simply to recognize that a readable, correctly colored plate is a legal requirement, not a cosmetic choice.',
        },
      ],
    },
    {
      id: 'level-11-tricycles',
      title: '5. Tricycle Registration, Franchise, And Common Violations',
      text: 'A tricycle is registered like any other motor vehicle, but its franchise to operate for hire comes from a different authority than other PUVs.',
      blocks: [
        {
          type: 'paragraph',
          text: 'A tricycle is registered like any other motor vehicle, but its franchise to operate for hire comes from a different authority than other PUVs.',
        },
        {
          type: 'heading',
          text: 'Registration And Franchise',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'All tricycles must be registered with the LTO and renewed yearly, like any other motor vehicle.',
            'A brand new motorcycle with more than 200cc engine displacement has an initial registration validity of three years.',
            'A tricycle does not need a Certificate of Public Convenience (CPC) from the LTFRB; the concerned Local Government Unit regulates tricycle operation and grants franchises within its own territory.',
            'A Motorized Tricycle Operator\'s Permit (MTOP) with official receipt, an identification card, and the fare matrix must all be visible.',
          ],
        },
        {
          type: 'heading',
          text: 'Common Tricycle Violations',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Overcharging or fare matrix violations, especially during heavy traffic, rain, or unusual hours.',
            'Overloading passengers, especially K-12 students.',
            'Driving with expired registration, or with an invalid license or no license.',
            'Not wearing the proper TODA uniform, or wearing slippers and shorts.',
            'Illegal modification such as an open pipe.',
            'Illegal turns causing obstruction or a crash.',
            'Changing lanes or turning without a proper hand or switch signal.',
            'Disregarding traffic enforcers.',
            'Improper use of headlights or taillights: a red forward light, or a blinking red rear brake light.',
            'Traveling on national roads outside the LGU franchise, causing obstruction or a crash.',
            'Allowing children to ride at the back of the driver, or allowing children to drive.',
            'An unlighted interior, or illegal or improper sound system installation.',
            'Driving against the flow of traffic.',
            'Parking or waiting within six meters of an intersection.',
            'Parking or waiting on sidewalks meant for pedestrians.',
            'Improper balancing of passengers or loads.',
          ],
        },
        {
          type: 'heading',
          text: 'Proper Tricycle Operation',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Use a professional driver\'s license for a for-hire tricycle.',
            'Keep registration and license updated and renewed.',
            'Always be a disciplined driver, and wear the proper uniform with pants and shoes.',
            'Maintain roadworthiness, and never modify the motorcycle.',
            'Never overload passengers or cargo.',
            'Never be complacent when turning or changing lanes.',
            'Follow the authorized route and all traffic rules and regulations.',
          ],
        },
      ],
    },
    {
      id: 'level-11-puv-duties',
      title: '6. PUV Driver Duties And Passenger Care',
      text: 'A PUV driver has passengers to answer for, not just a vehicle to control. Fare, seating, and courtesy duties exist to protect people who have no control over how the trip is driven.',
      blocks: [
        {
          type: 'paragraph',
          text: 'A PUV driver has passengers to answer for, not just a vehicle to control. Fare, seating, and courtesy duties exist to protect people who have no control over how the trip is driven.',
        },
        {
          type: 'heading',
          text: 'Buses And Jeepneys',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Collect the appropriate fare and display the authorized fare matrix.',
            'Issue an official fare receipt or ticket, and return the full ticket amount if a trip is cut short.',
            'Convey passengers only up to the vehicle\'s sitting capacity.',
            'Accommodate PWDs, pregnant women, and senior citizens in designated seats, with fare discounts where applicable.',
            'Instruct passengers to fasten seat belts where provided.',
            'Inform passengers of the smoking prohibition on public utility vehicles.',
            'Instruct passengers not to distract the driver while the vehicle is moving.',
            'Pick up and drop off passengers only at the correct loading and unloading zones.',
            'Be polite and courteous, and assist passengers who need immediate emergency response.',
          ],
        },
        {
          type: 'heading',
          text: 'Designated PWD Seating',
        },
        {
          type: 'table',
          headers: ['Vehicle Type', 'Requirement'],
          rows: [
            ['Regular bus', 'At least 5 designated seats for PWDs near the passenger door.'],
            ['Air-conditioned bus', 'At least 4 designated seats near the passenger door.'],
            ['Jeepney', 'At least 2 designated seats for the convenience of PWDs.'],
          ],
        },
        {
          type: 'heading',
          text: 'Fare Discounts',
        },
        {
          type: 'table',
          headers: ['Passenger', 'Discount'],
          rows: [
            ['Children under 1 meter in height', 'Free of charge'],
            ['Children 1 to 1.3 meters in height', '50% fare discount'],
            ['Senior citizens and persons with disability', '20% fare discount'],
            ['Students, preschool to college', '20% fare discount'],
          ],
        },
        {
          type: 'heading',
          text: 'Correct Loading And Unloading',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Load and unload only at designated pick-up and drop-off points.',
            'Never load or unload passengers on a curve or at an intersection.',
            'Stop the vehicle out of the flow of traffic.',
            'Assist passengers as much as possible, and greet them with courtesy.',
          ],
        },
        {
          type: 'heading',
          text: 'Proper PUV Driver Uniform',
        },
        {
          type: 'paragraph',
          text: 'A PUV driver on duty must wear a polo, polo shirt, or collared t-shirt, decent long pants, rubber or leather shoes (slippers and sandals are not allowed), and a visible identification card. The required shirt color depends on the vehicle classification.',
        },
        {
          type: 'table',
          headers: ['PUV Classification', 'Shirt Color'],
          rows: [
            ['PUJ (jeepney)', 'Light blue'],
            ['PUB (bus)', 'White'],
            ['Taxi', 'Red'],
            ['UV Express', 'Green'],
            ['Trucks', 'Maroon'],
            ['Tourist, school, or shuttle service', 'Yellow'],
          ],
        },
        {
          type: 'heading',
          text: 'Required Documents Beyond OR/CR',
        },
        {
          type: 'paragraph',
          text: 'Level 2 already covered OR/CR, COC, and franchise documents. A PUV or truck driver carries additional trip-specific paperwork on top of those.',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Manifest, listing passengers and cargo for the trip.',
            'Trip Report or Dispatch Report.',
            'Insurance policy for the vehicle and its passengers or cargo.',
            'Any necessary special permit for the specific operation.',
          ],
        },
        {
          type: 'heading',
          text: 'Gender And Development',
        },
        {
          type: 'paragraph',
          text: 'The courtesy and respect covered in Level 8 apply directly here: a PUV driver interacts with far more passengers than a private driver, which means far more opportunities to either uphold or violate that standard. Treat every passenger, of any gender, with equal courtesy, patience, and right-of-way. Gender-based harassment of a passenger, including unwanted remarks or behavior toward a passenger or fellow road user, is a serious violation of both the law and the trust a passenger places in a public conveyance.',
        },
      ],
    },
    {
      id: 'level-11-overloading',
      title: '7. Passenger And Cargo Overloading',
      text: "A PUV that carries more than it should is not just uncomfortable, it is unlawful and directly unsafe.",
      blocks: [
        {
          type: 'paragraph',
          text: "A PUV that carries more than it should is not just uncomfortable, it is unlawful and directly unsafe.",
        },
        {
          type: 'heading',
          text: 'Overloading Passengers',
        },
        {
          type: 'table',
          headers: ['Offense', 'Fine'],
          rows: [
            ['1st', 'Php 5,000'],
            ['2nd', 'Php 10,000'],
            ['3rd and succeeding', 'Php 15,000 and cancellation of the unit\'s CPC'],
          ],
        },
        {
          type: 'paragraph',
          text: 'Passengers are not allowed to stand while a bus is in motion, at any time.',
        },
        {
          type: 'heading',
          text: 'Cargo Handling',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Passengers are entitled to up to 10 kilograms of baggage free of charge.',
            'Freight carried on the roof of a public utility bus must not exceed 20 kg per square meter.',
            'A load extending more than one meter beyond the vehicle body must be marked with a red flag during the day, or a red light at night.',
            'Never load unsecured items on the backseat or rear window deck; a sudden stop can turn them into a projectile.',
            'Stop regularly to check cargo on a long trip.',
            'Use a canvas cover when transporting gravel or sand.',
          ],
        },
      ],
    },
    {
      id: 'level-11-method-and-recap',
      title: '8. Mixed-Traffic Method And Mission Recap',
      text: 'Use one habit whenever a motorcycle, tricycle, or PUV is nearby: identify what class of vehicle it is, then apply the specific rule that governs it, on top of the ordinary traffic rules everyone follows.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Use one habit whenever a motorcycle, tricycle, or PUV is nearby: identify what class of vehicle it is, then apply the specific rule that governs it, on top of the ordinary traffic rules everyone follows.',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Identify the vehicle class: motorcycle, tricycle, or PUV.',
            'Give a motorcycle its lane and clearance, and expect it may be carrying a helmeted back rider.',
            'Expect a tricycle to stop for passengers along its route, often without much warning.',
            'Expect a PUV to stop at designated loading and unloading zones, not just anywhere convenient.',
            'Stay alert for the vulnerable road users these vehicles carry: children, PWDs, seniors, and pedestrians boarding or alighting.',
          ],
        },
        {
          type: 'heading',
          text: 'Scenario',
        },
        {
          type: 'paragraph',
          text: 'The mission route runs alongside a marked motorcycle lane where a rider and helmeted back rider travel; a tricycle ahead slows and stops to pick up a passenger without much advance warning; a jeepney pulls into a designated loading zone to let passengers board and alight; and a senior citizen needs extra time crossing near the PUV stop. Recognizing each vehicle\'s pattern in advance, rather than reacting at the last second, is what completes the mission safely.',
        },
        {
          type: 'heading',
          text: 'Level Recap',
        },
        {
          type: 'paragraph',
          text: 'Motorcycle law protects the rider directly: mandatory helmets, strict child-passenger conditions, and tight limits on accessories and modifications. Motorcycle plates exist to make a motorcycle identifiable at a glance. A tricycle answers to its local government franchise, not the LTFRB, and carries its own list of common violations around fare, loading, and route discipline. A PUV driver answers for the passengers on board: correct fare, correct seating and discounts for PWDs, seniors, and children, loading only at designated zones, the proper uniform and trip documents, and treating every passenger with equal respect regardless of gender. Overloading, whether passengers or cargo, is both unlawful and a direct safety risk for everyone on board and around the vehicle.',
        },
      ],
    },
  ],
  quiz: [],
} satisfies LevelModule;

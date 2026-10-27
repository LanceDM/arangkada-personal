import type { LevelModule } from '@/features/driving-sim/domain/scenario/lessonModule';

const IMG = 'arangkada_extracted_images/level1/';

export const level1Module = {
  id: 'lto_level_1',
  title: 'Legal To Drive',
  sourceLevel: 1,
  desc: 'Learn when a person is legally allowed to drive, which permit or license fits the situation, and why DL codes, clutch codes, conditions, and validity matter before a trip begins.',
  passingScore: 4,
  lessons: [
    {
      id: 'level-1-mission-briefing',
      title: 'Mission Briefing: Legal To Drive',
      text: 'Your first official trip begins before the engine starts. At an LTO-style checkpoint, the question is whether the driver is legally authorized to operate this vehicle for this trip.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Your first official trip begins before the engine starts. At an LTO-style checkpoint, the question is whether the driver is legally authorized to operate this vehicle for this trip.',
        },
        {
          type: 'paragraph',
          text: 'A legal driver does not proceed just because a card exists. The license or permit type, DL code, vehicle category, clutch code, license conditions, trip purpose, and validity must all match.',
        },
        {
          type: 'image',
          alt: "Driver's License front sample. Use it to locate the basic license identity and validity information.",
          src: IMG + 'drivers-license-front.png',
        },
        {
          type: 'heading',
          text: 'Learning Goals',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            "Distinguish Student-Driver's Permit, Conductor's License, Non-Professional Driver's License, and Professional Driver's License.",
            'Match DL codes to the vehicle categories they authorize.',
            'Recognize clutch code and license-condition limits.',
            'Explain why validity, renewal status, and demerit points matter to driver authority.',
            'Make a practical Go / No-Go decision at a checkpoint.',
          ],
        },
      ],
    },
    {
      id: 'level-1-license-privilege',
      title: '1. License Is Authority',
      text: "The LTO describes a driver's license as a privilege, not a right. It is authority to drive only within the limits granted by the LTO.",
      blocks: [
        {
          type: 'paragraph',
          text: "The LTO describes a driver's license as a privilege, not a right. It is authority to drive only within the limits granted by the LTO.",
        },
        {
          type: 'paragraph',
          text: 'Before any trip, ask whether the person, document, vehicle, purpose, and restrictions all match. If one part does not match, the correct legal decision is not to proceed.',
        },
        {
          type: 'table',
          headers: ['Checkpoint Question', 'What The Driver Must Prove'],
          rows: [
            ['Who is driving?', 'The person has driving authority, not only learner or conductor authority.'],
            ['What vehicle is being used?', 'The DL code matches the vehicle category.'],
            ['Why is the trip being made?', 'The license classification matches private or paid/professional driving.'],
            ['What limits apply?', 'Clutch code, condition code, validity, and license status are all followed.'],
          ],
        },
        {
          type: 'heading',
          text: 'Key Reminder',
        },
        {
          type: 'paragraph',
          text: 'The checkpoint is not asking whether the vehicle can move. It is asking whether this driver may legally move this vehicle today.',
        },
      ],
    },
    {
      id: 'level-1-permit-license-types',
      title: '2. Permit And License Types',
      text: 'Level 1 focuses on four kinds of LTO authority: SP, CL, NPDL, and PDL. They are not interchangeable.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Level 1 focuses on four kinds of LTO authority. They are not interchangeable.',
        },
        {
          type: 'table',
          headers: ['Document', 'Meaning', 'Go / No-Go Reminder'],
          rows: [
            [
              "Student-Driver's Permit (SP)",
              'Authority to learn how to operate a motor vehicle.',
              'The student driver must be accompanied by a duly licensed driver with the appropriate license code for the vehicle being practiced.',
            ],
            [
              "Conductor's License (CL)",
              'Authority to assist the driver of a public utility vehicle in fare collection and passenger or cargo safety.',
              'A CL does not authorize the holder to drive.',
            ],
            [
              "Non-Professional Driver's License (NPDL)",
              'Authority to operate a private motor vehicle.',
              'Private driving still requires the correct DL code, clutch code, conditions, and validity.',
            ],
            [
              "Professional Driver's License (PDL)",
              'Authority for a driver hired or paid for driving or operating a motor vehicle.',
              'Paid or professional driving requires professional authority and the proper DL code.',
            ],
          ],
        },
        {
          type: 'heading',
          text: 'Validity Awareness',
        },
        {
          type: 'paragraph',
          text: 'An SP is valid for one year from issuance. A new CL is valid for five years unless sooner revoked or suspended, with possible ten-year renewal for a clean record. Keep these details practical: expired, revoked, suspended, or otherwise invalid authority means No-Go.',
        },
      ],
    },
    {
      id: 'level-1-dl-codes',
      title: '3. DL Codes Match Drivers To Vehicles',
      text: 'A DL code shows what vehicle category the driver is allowed to operate. A real license can still be wrong for a specific vehicle.',
      blocks: [
        {
          type: 'paragraph',
          text: 'A DL code shows what vehicle category the driver is allowed to operate. A real license can still be wrong for a specific vehicle.',
        },
        {
          type: 'image',
          alt: "Driver's License back sample. Use it to connect DL codes, vehicle categories, conditions, and restrictions.",
          src: IMG + 'drivers-license-back.png',
        },
        {
          type: 'heading',
          text: "Restriction Code And Its Equivalent To Driver's License Code",
        },
        {
          type: 'table',
          headers: ['Old Restriction Code', 'DL Code', 'Vehicle Category Code', 'General Description', 'Clutch Code'],
          rows: [
            ['[rowspan:2]1', 'A', 'L1, L2, L3', 'Motorcycle', '[rowspan:9]Manual Transmission (MT) or Automatic Transmission (AT)'],
            ['', 'A1', 'L4, L5, L6, L7', 'Tricycle', ''],
            ['[rowspan:3]2 / 4', 'B', 'M1', 'Passenger car', ''],
            ['', 'B1', 'M2', 'Passenger van / jeepney', ''],
            ['', 'B2', 'N1', 'Light commercial vehicle', ''],
            ['[rowspan:2]3 / 5', 'C', 'N2, N3', 'Heavy commercial vehicle', ''],
            ['', 'D', 'M3', 'Heavy passenger bus', ''],
            ['6 / 7', 'BE', 'O1, O2', 'Light articulated vehicle', ''],
            ['8', 'CE', 'O3, O4', 'Heavy articulated vehicle', ''],
          ],
        },
        {
          type: 'paragraph',
          text: "This is the official equivalence table between the old Restriction Code system and the current Driver's License Code system. Use the DL Code and vehicle category when making the checkpoint decision.",
        },
        {
          type: 'heading',
          text: 'Gameplay Examples',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Code A allows motorcycle operation, not passenger car operation.',
            'Code B allows an M1 passenger car, but not a motorcycle unless Code A is also present.',
            'Heavier buses, trucks, and articulated combinations require the correct higher code.',
          ],
        },
      ],
    },
    {
      id: 'level-1-vehicle-categories',
      title: '4. Vehicle Category Reference',
      text: 'Vehicle categories explain what the DL code points to. You do not need to memorize every technical detail, but you should recognize the vehicle family.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Vehicle categories explain what the DL code points to. You do not need to memorize every technical detail in Level 1, but you should recognize the vehicle family before deciding if the driver may proceed.',
        },
        {
          type: 'table',
          headers: ['Category Family', 'Covers'],
          rows: [
            ['L', 'Motorcycles, tricycles, and other light L-category vehicles.'],
            ['M', 'Passenger vehicles such as cars, vans, jeepneys, and buses.'],
            ['N', 'Goods or commercial vehicles by gross vehicle weight.'],
            ['O', 'Trailers and articulated combinations by gross vehicle weight.'],
          ],
        },
        {
          type: 'heading',
          text: 'Checkpoint Habit',
        },
        {
          type: 'paragraph',
          text: 'Match the DL code to the vehicle family first. Then check whether the trip purpose, transmission, conditions, and validity also match.',
        },
        {
          type: 'table',
          headers: ['Vehicle Category', 'Specification', 'Sample'],
          rows: [
            ['L1', 'Two-wheeled vehicle with maximum design speed not exceeding 50 kph.', `[rowspan:3]![L1-L3 sample](${IMG}vehicle-categories-l1-l3.png)`],
            ['L2', 'Three-wheeled vehicle with maximum design speed not exceeding 50 kph.', ''],
            ['L3', 'Two-wheeled vehicle with maximum design speed exceeding 50 kph.', ''],

            ['L4', 'Three-wheeled vehicle arranged asymmetrically in relation to the longitudinal median plane, with maximum design speed exceeding 50 kph, commonly motorcycle with sidecar.', `![L4 sample](${IMG}vehicle-category-l4-motorcycle-with-sidecar.png)`],
            ['L5', 'Three-wheeled vehicle arranged symmetrically in relation to the longitudinal median plane, with maximum design speed exceeding 50 kph.', `![L5 sample](${IMG}vehicle-category-l5-three-wheeler.png)`],
            ['L6', 'Four-wheeled vehicle with unladen mass not more than 350 kg, excluding battery mass for electric vehicles, and maximum design speed not more than 45 kph.', `![L6 sample](${IMG}vehicle-category-l6-light-four-wheeler.png)`],
            ['L7', 'Four-wheeled vehicle other than L6, with unladen mass not more than 400 kg, or 550 kg for goods vehicles, excluding battery mass for electric vehicles, and maximum design speed not more than 45 kph.', `![L7 sample](${IMG}vehicle-category-l7-four-wheeler.png)`],
            ['M1', "Passenger vehicle with not more than eight seats in addition to the driver's seat, and gross vehicle weight not exceeding 5,000 kg.", `![M1 sample](${IMG}vehicle-category-m1-passenger-car.png)`],
            ['M2', "Passenger vehicle with more than eight seats in addition to the driver's seat, and gross vehicle weight not exceeding 5,000 kg.", `![M2 sample](${IMG}vehicle-category-m2-light-passenger-bus.png)`],
            ['M3', "Passenger vehicle with more than eight seats in addition to the driver's seat, and maximum gross vehicle weight exceeding 5,000 kg.", `![M3 sample](${IMG}vehicle-category-m3-heavy-passenger-bus.png)`],
            ['N1', 'Goods vehicle with maximum gross vehicle weight not exceeding 3,500 kg.', `![N1 sample](${IMG}vehicle-category-n1-light-goods-vehicle.png)`],
            
            ['N2', 'Goods vehicle with maximum gross vehicle weight exceeding 3,500 kg but not exceeding 12,000 kg.', `[rowspan:2]![N2-N3 sample](${IMG}vehicle-categories-n2-n3-goods-trucks.png)`],
            ['N3', 'Goods vehicle with maximum gross vehicle weight exceeding 12,000 kg.', ''],

            ['O1', 'Trailer with maximum gross vehicle weight not exceeding 750 kg.', `[rowspan:2]![O1-O2 sample](${IMG}vehicle-categories-o1-o2-light-trailers.png)`],
            ['O2', 'Trailer with maximum gross vehicle weight exceeding 750 kg but not exceeding 3,500 kg.', ''],

            ['O3', 'Trailer with maximum gross vehicle weight exceeding 3,500 kg but not exceeding 10,000 kg.', `[rowspan:2]![O3-O4 sample](${IMG}vehicle-categories-o3-o4-heavy-trailers.png)`],
            ['O4', 'Trailer with maximum gross vehicle weight exceeding 10,000 kg.', ''],
          ],
        },
        {
          type: 'heading',
          text: 'Image Note',
        },
        {
          type: 'paragraph',
          text: 'Some category rows share the closest available extracted sample image. Treat the image as a visual aid; the written category specification is the controlling reference.',
        },
      ],
    },
    {
      id: 'level-1-clutch-conditions',
      title: '5. Clutch Code And License Conditions',
      text: 'The vehicle category can be correct while the transmission or license condition is still wrong. These limits are part of legal authority.',
      blocks: [
        {
          type: 'paragraph',
          text: 'The vehicle category can be correct while the transmission or license condition is still wrong. These limits are part of legal authority.',
        },
        {
          type: 'table',
          headers: ['Authority', 'Allowed Operation'],
          rows: [
            ['Manual transmission (MT)', 'May operate manual and automatic vehicles within the allowed DL code.'],
            ['Automatic transmission (AT) only', 'May operate automatic vehicles only within the allowed DL code.'],
          ],
        },
        {
          type: 'paragraph',
          text: 'A DL holder with automatic transmission authority who intends to operate manual transmission must take and pass the required practical driving test.',
        },
        {
          type: 'table',
          headers: ['Condition Code', 'Driving Requirement'],
          rows: [
            ['1', 'Drive only with corrective lenses.'],
            ['2', 'Drive only with special equipment for upper limbs and/or lower limbs.'],
            ['3', 'Drive customized motor vehicle only.'],
            ['4', 'Drive only during daylight.'],
            ['5', 'Drive only with hearing aid.'],
          ],
        },
        {
          type: 'paragraph',
          text: 'If a license condition is not met, the driver should not proceed. For example, daylight-only authority does not support a night trip.',
        },
      ],
    },
    {
      id: 'level-1-validity-demerits',
      title: '6. Validity, Renewal, And Demerit Awareness',
      text: 'Legal authority also depends on whether the document is valid and whether the driver remains eligible to use or expand that authority.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Legal authority also depends on whether the document is valid and whether the driver remains eligible to use or expand that authority.',
        },
        {
          type: 'paragraph',
          text: "A new Driver's License is valid for five years from the licensee's birthdate unless sooner revoked or suspended. A professional or non-professional driver with no violations during the relevant period may be entitled to a ten-year renewal.",
        },
        {
          type: 'paragraph',
          text: 'Renewal after more than two years from expiration may require theoretical and practical examinations plus the corresponding penalty. For Level 1 gameplay, the key idea is simpler: expired, suspended, revoked, or invalid authority means No-Go.',
        },
        {
          type: 'table',
          headers: ['Violation Category', 'Demerit Points'],
          rows: [
            ['Grave violation', '5'],
            ['Less grave violation', '3'],
            ['Light violation or other violation not listed as grave or less grave', '1'],
          ],
        },
        {
          type: 'paragraph',
          text: 'Accumulated demerit points can prevent a driver from applying for additional DL codes or changing license classification for a period. Detailed apprehension, fines, and penalties are reserved for Level 12.',
        },
      ],
    },
    // Added in the FDM module revision (see the Arangkada question bank, Module Review sheet).
    {
      id: 'level-1-eligibility-renewal-carry',
      title: '7. Who May Apply, Renewing On Time, And What To Carry',
      text: 'A license is only as good as the rules behind it: who may hold one, when it must be renewed, and what the driver has to carry while driving.',
      blocks: [
        {
          type: 'paragraph',
          text: 'A license is only as good as the rules behind it: who may hold one, when it must be renewed, and what the driver has to carry while driving.',
        },
        {
          type: 'heading',
          text: 'Who May Apply',
        },
        // FDM Vol. 1 pp. 5, 9, 13, 24
        {
          type: 'table',
          headers: ['Rule', 'What The FDM Says'],
          rows: [
            ['Minimum age for a Student-Driver\'s Permit', 'At least 16 years old. Applicants below 18 need parental or guardian consent.'],
            ['Minimum age for a driver\'s license', 'At least 17 years old.'],
            ['First license for a new applicant', 'A first-time applicant may only be issued a non-professional license for DL Codes A, A1, B, B1 or B2.'],
            ['Tourist with a valid foreign license', 'May drive in the Philippines for no more than 90 days of their stay.'],
          ],
        },
        {
          type: 'heading',
          text: 'Renewing On Time',
        },
        // FDM Vol. 1 p. 27; FDM Vol. 2 p. 72 (JAO 2014-01)
        {
          type: 'list',
          ordered: false,
          items: [
            'A license may be renewed on or before its expiry date, but not earlier than 60 days before it. (It may be renewed up to a year early only with a ticket showing imminent travel.)',
            'An expired license is not a valid license. Driving on one is treated as driving without a valid driver\'s license.',
          ],
        },
        {
          type: 'heading',
          text: 'What To Carry While Driving',
        },
        // FDM Vol. 1 pp. 105, 162; FDM Vol. 2 p. 75
        {
          type: 'paragraph',
          text: 'The driver of a private car must carry three documents: the driver\'s license, the Certificate of Registration (CR), and the current Official Receipt (OR). Level 2 covers the vehicle documents in detail.',
        },
      ],
    },
    {
      id: 'level-1-go-no-go',
      title: '8. Checkpoint Go / No-Go Method',
      text: 'Use one decision method every time you reach the checkpoint: stop, inspect, match, then decide.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Use one decision method every time you reach the checkpoint: stop, inspect, match, then decide.',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Stop fully at the checkpoint.',
            'Identify the document type: SP, CL, NPDL, or PDL.',
            'Check whether a student driver needs a licensed companion.',
            'Match DL code to vehicle category.',
            'Match clutch code to the vehicle transmission.',
            'Check license conditions.',
            'Check whether the trip is private or paid/professional.',
            'Check validity and license status.',
            'Proceed only when every required authority matches.',
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
            'Thinking any LTO document allows driving.',
            'Letting a student driver proceed alone.',
            "Using a Conductor's License as driving authority.",
            'Matching the vehicle type but ignoring transmission limits.',
            'Ignoring license conditions or expired authority.',
          ],
        },
        {
          type: 'heading',
          text: 'Level Recap',
        },
        {
          type: 'paragraph',
          text: 'SP is supervised learning. CL is conductor duty, not driving. NPDL is for private driving within allowed codes. PDL is for paid or professional driving within allowed codes. DL code, clutch code, conditions, and validity must all match before the trip may continue.',
        },
      ],
    },
  ],
  quiz: [
    {
      question: "A student driver with only a Student-Driver's Permit wants to drive alone. What is the correct decision?",
      options: [
        'Do not proceed; a duly licensed companion with the proper vehicle code is required.',
        'Proceed if the route is short.',
        'Proceed if the vehicle is automatic.',
        'Proceed if the student driver already finished the written exam.',
      ],
      correct: 0,
      explanation: "A Student-Driver's Permit is learning authority. The student driver must be accompanied by a duly licensed driver with the proper authority for the vehicle.",
    },
    {
      question: "A person presents only a Conductor's License and says they will drive the vehicle. What should happen?",
      options: [
        'Do not proceed as the driver; a Conductor License is not driving authority.',
        'Proceed if the vehicle is a public utility vehicle.',
        'Proceed if the conductor knows the route.',
        'Proceed if there are passengers waiting.',
      ],
      correct: 0,
      explanation: "A Conductor's License authorizes conductor duties, not operation of a motor vehicle.",
    },
    {
      question: 'A driver has DL Code A only but is assigned to drive a passenger car. What is missing?',
      options: [
        'The proper DL code for a passenger car.',
        'A conductor license.',
        'A heavier vehicle category.',
        'A public utility route permit.',
      ],
      correct: 0,
      explanation: 'Code A covers motorcycles. A passenger car needs the proper light-vehicle authority, commonly Code B for this Level 1 situation.',
    },
    {
      question: 'A driver has Code B with automatic-only authority. The assigned car is manual transmission. What is the legal decision?',
      options: [
        'Do not proceed unless the license allows manual transmission.',
        'Proceed because Code B is enough by itself.',
        'Proceed if a passenger can shift gears.',
        'Proceed slowly until the checkpoint is passed.',
      ],
      correct: 0,
      explanation: 'Automatic-only authority does not allow operation of a manual vehicle, even when the DL code matches the vehicle category.',
    },
    {
      question: 'A driver has an NPDL and is asked to drive as paid work. What should be checked?',
      options: [
        'Whether professional authority is required for the trip purpose.',
        'Whether the vehicle has a loud horn.',
        'Whether the passenger owns the vehicle.',
        'Whether the route is familiar.',
      ],
      correct: 0,
      explanation: 'NPDL covers private motor vehicle operation. Paid or hired driving may require Professional Driver License authority plus the correct DL code.',
    },
    {
      question: 'At the checkpoint, the license is expired or suspended. What is the correct Go / No-Go decision?',
      options: [
        'No-Go; valid authority is required before driving.',
        'Go if the driver has used the license before.',
        'Go if the road is clear.',
        'Go if the driver promises to renew later.',
      ],
      correct: 0,
      explanation: 'The document must be valid. Expired, suspended, revoked, or invalid authority means the driver should not proceed.',
    },
  ],
} satisfies LevelModule;

import type { LevelModule } from '@/features/driving-sim/domain/scenario/lessonModule';

const IMG = 'arangkada_extracted_images/level2/';

export const level2Module = {
  id: 'lto_level_2',
  title: 'Vehicle Readiness',
  sourceLevel: 2,
  desc: 'Learn how to inspect a vehicle before driving, verify required vehicle documents, recognize unsafe conditions, and decide not to proceed when the vehicle is not roadworthy or legally ready.',
  lessons: [
    {
      id: 'level-2-mission-briefing',
      title: 'Mission Briefing: Vehicle Readiness',
      text: 'Your trip starts in the garage. Before the vehicle enters the road, you must prove that it is legal, roadworthy, and ready to control.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Your trip starts in the garage. Before the vehicle enters the road, you must prove that it is legal, roadworthy, and ready to control.',
        },
        {
          type: 'paragraph',
          text: 'A responsible driver does not begin a trip just because the engine can start. Documents, plates, safety equipment, tires, lights, brakes, fluids, and driver condition must all be checked first.',
        },
        {
          type: 'heading',
          text: 'Learning Goals',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Perform a basic pre-drive inspection using BLOWBAGETS.',
            'Identify the purpose of OR, CR, COC, plates, stickers, RFID, MVIR, CEC, and MVUC.',
            'Use the plate number to understand the registration month and weekly deadline.',
            'Recognize unsafe, overloaded, improperly marked, or unfit vehicle conditions.',
            'Prepare the vehicle controls, mirrors, seatbelt, doors, and gear position before starting.',
            'Choose No-Go when a vehicle or document issue makes driving unsafe or unlawful.',
          ],
        },
      ],
    },
    {
      id: 'level-2-readiness-decision',
      title: '1. Legal Vehicle, Safe Vehicle, Ready Driver',
      text: "A driver's license authorizes the person. Motor vehicle registration authorizes the vehicle. A safe trip begins only when both are in order.",
      blocks: [
        {
          type: 'paragraph',
          text: "A driver's license authorizes the person. Motor vehicle registration authorizes the vehicle. A safe trip begins only when both are in order.",
        },
        {
          type: 'table',
          headers: ['Readiness Question', 'What To Check', 'Go / No-Go Decision'],
          rows: [
            ['Is the vehicle legally documented?', 'OR/CR, COC, registration records, and applicable permits or franchise documents.', 'No-Go if required documents are missing or questionable.'],
            ['Can the vehicle be identified?', 'Clean, visible, legible, firmly attached plates plus sticker or RFID when present.', 'No-Go if the plate or identification item is missing, unreadable, covered, or tampered with.'],
            ['Is the vehicle roadworthy?', 'BLOWBAGETS, lights, tires, brakes, fluids, mirrors, horn, wipers, seatbelts, EWD, and tools.', 'No-Go if a visible safety defect is found.'],
            ['Is the driver ready?', 'The driver is healthy, awake, calm, focused, and able to control the vehicle.', 'No-Go if the driver is sick, sleepy, distracted, or emotionally unprepared.'],
          ],
        },
        {
          type: 'heading',
          text: 'Mission Habit',
        },
        {
          type: 'paragraph',
          text: 'In Level 2, the correct action may be not to drive. The mission rewards the driver who finds a problem before it becomes a crash or violation.',
        },
      ],
    },
    {
      id: 'level-2-documents',
      title: '2. OR/CR And Required Vehicle Documents',
      text: 'Before operating a vehicle, the driver should know where the important documents are and why they matter.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Before operating a vehicle, the driver should know where the important documents are and why they matter. The extracted LTO source states that a photocopy or the original CR must be preserved and carried in the car by the owner or driver.',
        },
        {
          type: 'image',
          alt: 'Updated Official Receipt reference.',
          src: IMG + 'official-receipt.png',
        },
        {
          type: 'image',
          alt: 'Certificate of Registration reference.',
          src: IMG + 'certificate-of-registration.png',
        },
        {
          type: 'table',
          headers: ['Document Or Term', 'Meaning', 'Readiness Reminder'],
          rows: [
            ['CR', "Certificate of Registration showing the vehicle's official registration record.", 'Required proof that the vehicle is registered.'],
            ['OR', 'Official Receipt showing registration payment or transaction payment.', 'Keep it with the vehicle records.'],
            ['COC', 'Certificate of Cover for insurance, commonly Third Party Liability insurance.', 'Required in registration transactions.'],
            ['MVIR', 'Motor Vehicle Inspection Report.', 'Shows vehicle inspection details.'],
            ['CEC', 'Certificate of Emission Compliance.', 'Required for renewal and some transactions.'],
            ['MVUC', "Motor Vehicle User's Charge.", 'Paid by the owner when registering the motor vehicle.'],
            ['RFID', 'Radio Frequency Identification sticker used in the newer registration and identification system.', 'Lost or damaged RFID has replacement requirements.'],
            ['Franchise, CPC, PA, MTOP, or special permit when applicable', 'Authority documents for public utility, for-hire, or special vehicle operation.', 'Needed only when the vehicle operation requires it.'],
          ],
        },
        {
          type: 'heading',
          text: 'Go / No-Go Rule',
        },
        {
          type: 'paragraph',
          text: 'If the vehicle lacks the required OR/CR or applicable authority documents, do not begin the trip until the issue is resolved.',
        },
      ],
    },
    {
      id: 'level-2-registration-plates',
      title: '3. Registration Schedule, Plates, Stickers, And RFID',
      text: 'Registration awareness means knowing whether the vehicle records and identity markings appear ready before driving.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Registration awareness means knowing whether the vehicle records and identity markings appear ready before driving. The plate number is used for the monthly staggered registration schedule.',
        },
        {
          type: 'table',
          headers: ['Last Digit Of Plate', 'Registration Month'],
          rows: [
            ['1', 'January'],
            ['2', 'February'],
            ['3', 'March'],
            ['4', 'April'],
            ['5', 'May'],
            ['6', 'June'],
            ['7', 'July'],
            ['8', 'August'],
            ['9', 'September'],
            ['0', 'October'],
          ],
        },
        {
          type: 'table',
          headers: ['Middle Or Second-To-Last Digit', 'Weekly Deadline'],
          rows: [
            ['1, 2, 3', '1st week, working days 1 to 7.'],
            ['4, 5, 6', '2nd week, working days 8 to 14.'],
            ['7, 8', '3rd week, working days 15 to 21.'],
            ['9, 0', '4th week, working days 22 to 31.'],
          ],
        },
        {
          type: 'paragraph',
          text: 'Vehicles may be registered two months in advance. Example: plate ABC 1435 ends in 5, so its registration month is May. Its second-to-last digit is 3, so the weekly deadline is the 1st week of May.',
        },
        {
          type: 'heading',
          text: 'Plate And RFID Check',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'For most motor vehicles, one plate is displayed in front and one at the rear.',
            'Plates must be clean, properly cared for, firmly affixed, entirely visible, and always legible.',
            'Validation stickers and RFID should be checked when present.',
            'Do not use imitation licenses, certificates, plates, tags, permits, or fraudulent documents.',
            'Do not proceed if the plate is missing, loose, covered, unreadable, tampered with, or does not match the documents.',
          ],
        },
      ],
    },
    {
      id: 'level-2-registration-awareness',
      title: '4. Motor Vehicle Registration Awareness',
      text: 'A beginner does not need to memorize every LTO office workflow, but should recognize the pattern behind a legally ready vehicle.',
      blocks: [
        {
          type: 'paragraph',
          text: 'A beginner does not need to memorize every LTO office workflow, but should recognize the pattern behind a legally ready vehicle: proof of ownership, proof of identity, insurance, inspection, emissions compliance, clearances, plates, and special authority documents may be required depending on the transaction.',
        },
        {
          type: 'paragraph',
          text: "When the extracted source conflicts with the LTO Citizen's Charter, the Citizen's Charter prevails.",
        },
        {
          type: 'table',
          headers: ['Registration Topic', 'Level 2 Reminder'],
          rows: [
            ['Initial registration', 'Commonly involves proof of purchase or stock reporting, insurance, and clearance documents.'],
            ['Renewal of registration', 'Commonly involves insurance COC, MVIR, and CEC.'],
            ['Lost or replacement plates, tags, sticker, or RFID', 'Requires replacement action, such as affidavit of loss or surrender of mutilated item as applicable.'],
            ['Vehicle changes or transfer of ownership', 'Official records should match the actual vehicle and ownership status.'],
            ['MVUC', 'Collected from the owner when registering the vehicle and used to help fund road maintenance.'],
          ],
        },
        {
          type: 'heading',
          text: 'Keep It Practical',
        },
        {
          type: 'paragraph',
          text: 'For Level 2 gameplay, the question is not whether you can process registration at an LTO office. The question is whether the vehicle has the required legal proof before it is driven.',
        },
      ],
    },
    {
      id: 'level-2-blowbagets',
      title: '5. BLOWBAGETS Pre-Drive Inspection',
      text: 'BLOWBAGETS is a simple do-it-yourself motor vehicle inspection used to avoid road crashes and breakdowns.',
      blocks: [
        {
          type: 'paragraph',
          text: 'BLOWBAGETS is a simple do-it-yourself motor vehicle inspection used to avoid road crashes and breakdowns. The extracted source also reminds drivers that regular preventive maintenance is cheaper than corrective maintenance.',
        },
        {
          type: 'table',
          headers: ['Letter', 'Check Area', 'What To Look For'],
          rows: [
            ['B', 'Battery', 'Bad condition, corrosion, loose clamps, unsecured battery, or accessories draining power while the engine is off.'],
            ['L', 'Lights', 'Busted bulbs, dirty lenses, unsafe high-beam use, poor wiring, excessive lights, or windshield and mirror visibility problems.'],
            ['O', 'Oil', 'Low or excessive oil level, leaks, overheating risk, or fluids that need checking when applicable.'],
            ['W', 'Water or coolant', 'Low coolant, leaks, hose problems, bad caps, overheating risk, or overfilled reservoir.'],
            ['B', 'Brakes', 'Hard or soft pedal, weak or noisy brakes, brake-fluid leaks, worn pads or rotors, and parking brake condition.'],
            ['A', 'Accessories or air pressure', 'Doors, windows, wipers, mirrors, horn, EWD, seatbelts, parking brake, switches, spare tire, AC components, and tire pressure.'],
            ['G', 'Gas or fuel', 'Enough fuel for the trip, no leaks, secure fuel cap, and driving habits that avoid high fuel consumption.'],
            ['E', 'Engine or electrical', 'Belts, pulleys, wiring, fuses, unsafe accessories, electrical overload, short circuit risk, and poor wiring.'],
            ['T', 'Tires or tools', 'Low pressure, cracks, uneven wear, toe-in or toe-out signs, spare tire, jack, wrenches, pliers, screwdrivers, rope or cable.'],
            ['S', 'Self', 'Driver is healthy, awake, focused, calm, and mentally prepared.'],
          ],
        },
        {
          type: 'heading',
          text: 'Motorcycle Add-On Checks',
        },
        {
          type: 'paragraph',
          text: 'Aside from BLOWBAGETS, motorcycle riders should check the accelerator and brake cable, throttle, drive chain or belt, side mirrors, riding position, and handlebar grip before moving.',
        },
      ],
    },
    {
      id: 'level-2-unsafe-conditions',
      title: '6. Unsafe Conditions And No-Go Decisions',
      text: 'The extracted source says motor vehicle registration may be suspended when a vehicle is unsafe, overloaded, improperly marked or equipped, unfit to be operated, capable of causing excessive highway damage, or not conforming to minimum standards.',
      blocks: [
        {
          type: 'paragraph',
          text: 'The extracted source says motor vehicle registration may be suspended when a vehicle is unsafe, overloaded, improperly marked or equipped, unfit to be operated, capable of causing excessive highway damage, or not conforming to minimum standards.',
        },
        {
          type: 'table',
          headers: ['Problem Found Before Driving', 'Correct Beginner Decision'],
          rows: [
            ['Missing OR/CR, COC, or required authority document.', 'Do not start the trip until the document issue is resolved.'],
            ['Plate, sticker, or RFID is missing, covered, tampered with, unreadable, or loose.', 'Do not drive until vehicle identification is corrected.'],
            ['Tire is flat, cracked, badly worn, or underinflated.', 'Do not drive until the tire is fixed or replaced.'],
            ['Brake concern, leak, weak brake feel, or parking brake problem.', 'Do not drive. Brakes are critical safety equipment.'],
            ['Lights, mirrors, wipers, horn, seatbelts, doors, or EWD are not ready.', 'Correct the issue before moving.'],
            ['Oil, coolant, brake fluid, fuel, or other important fluid is leaking or too low.', 'Stop and have the vehicle checked before driving.'],
            ['Vehicle is overloaded, improperly marked, improperly equipped, or visibly unfit to operate.', 'Do not proceed until it meets readiness requirements.'],
            ['Driver is sick, sleepy, distracted, angry, or unable to focus.', 'Delay the trip or let a fit, authorized driver take over.'],
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
            'Checking only fuel and ignoring tires, brakes, lights, and documents.',
            'Treating OR/CR or plate issues as minor.',
            'Starting the trip even after seeing a clear defect.',
            'Thinking the pre-drive check is mechanical repair instead of safety judgment.',
          ],
        },
      ],
    },
    {
      id: 'level-2-before-starting',
      title: '7. Before Starting The Engine',
      text: 'After the document check and walk-around inspection, prepare the driver position and controls before starting.',
      blocks: [
        {
          type: 'paragraph',
          text: 'After the document check and walk-around inspection, prepare the driver position and controls before starting.',
        },
        {
          type: 'table',
          headers: ['Driver Or Vehicle Setup', 'Required Action'],
          rows: [
            ['Manual transmission', 'Make sure the gear is in neutral before starting and know the gear shift operation.'],
            ['Automatic transmission', 'Make sure the shifting lever is in Park before starting.'],
            ['Seat and posture', 'Sit comfortably and adjust the seat so pedals and steering can be used without leaning forward or backward.'],
            ['Mirrors and visibility', 'Adjust rearview and side mirrors and remove anything that blocks the view.'],
            ['Seatbelts and doors', 'Wear the seatbelt, advise passengers to wear seatbelts, and lock all doors.'],
            ['Steering control', 'Grip the steering wheel at 9-and-3 or 10-and-2 and sit at a distance that allows safe control.'],
            ['Motorcycle position', 'Sit comfortably, hold the handlebar firmly, check side mirrors, keep balance, and avoid pushing the motorcycle to start the engine.'],
          ],
        },
        {
          type: 'heading',
          text: 'First Movement',
        },
        {
          type: 'paragraph',
          text: 'Before moving, check surroundings and signal when entering traffic. If reversing from a garage or driveway, remember that poor visibility is the main risk. Check blind spots, pedestrians, other motorists, parked vehicles, space, lighting, mirrors, and camera or sensor condition when available.',
        },
      ],
    },
    {
      id: 'level-2-routine-and-scenario',
      title: '8. Pre-Drive Routine And Scenario',
      text: 'Use the same readiness routine before every trip so the decision becomes automatic.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Use the same readiness routine before every trip so the decision becomes automatic.',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Check documents: license, OR/CR, COC, and permits or franchise when applicable.',
            'Check plate, sticker, and RFID visibility.',
            'Walk around the vehicle using BLOWBAGETS.',
            'Check tires, lights, mirrors, wipers, horn, seatbelts, and EWD.',
            'Check driver fitness: alert, healthy, calm, and focused.',
            'Sit properly.',
            'Adjust seat, mirrors, and steering position.',
            'Wear the seatbelt and remind passengers to wear theirs.',
            'Lock doors.',
            'For manual transmission, confirm neutral before starting.',
            'For automatic transmission, confirm Park before starting.',
            'Start the engine safely.',
            'Check surroundings before moving.',
            'Signal when entering traffic.',
            'Move smoothly and obey road rules.',
          ],
        },
        {
          type: 'heading',
          text: 'Scenario',
        },
        {
          type: 'paragraph',
          text: 'Ana is about to drive her family car with plate ABC 1435. The last digit is 5, so the registration month is May. The second-to-last digit is 3, so the weekly deadline is the 1st week of May.',
        },
        {
          type: 'paragraph',
          text: 'Before driving, Ana checks that the OR/CR is in the vehicle, the plate and RFID are clean and visible, and the registration is updated. She performs BLOWBAGETS, adjusts her seat and mirrors, wears her seatbelt, reminds passengers to wear theirs, locks the doors, confirms the safe gear position, checks surroundings, signals, and moves smoothly.',
        },
        {
          type: 'heading',
          text: 'Level Recap',
        },
        {
          type: 'paragraph',
          text: 'A responsible beginner driver checks legal documents, vehicle identity, vehicle condition, driver fitness, and control setup before moving. If the vehicle is not legal, not roadworthy, or not controllable, the correct decision is No-Go.',
        },
      ],
    },
  ],
  passingScore: 4,
  quiz: [
    {
      question: 'What is BLOWBAGETS used for?',
      options: [
        'A method for computing registration fees',
        'A type of driver license code',
        'A do-it-yourself pre-drive inspection of the vehicle',
        'A traffic signal sequence',
      ],
      correct: 2,
      explanation:
        'BLOWBAGETS is a simple do-it-yourself motor vehicle inspection done before driving, used to avoid road crashes and breakdowns.',
    },
    {
      question: 'During a pre-drive check you find the brake pedal is soft and brake fluid is leaking. What is the correct decision?',
      options: [
        'Do not drive until the brakes are repaired',
        'Drive slowly and brake earlier than usual',
        'Drive only on side streets until payday',
        'Continue, since the handbrake still works',
      ],
      correct: 0,
      explanation: 'Brakes are critical safety equipment. Do not drive until leaking or malfunctioning brakes are repaired.',
    },
    {
      question: 'A vehicle has plate number ABC 1435. In which month must it be registered?',
      options: ['March', 'May', 'April', 'January'],
      correct: 1,
      explanation: 'The last digit of the plate sets the registration month. The last digit here is 5, so the month is May.',
    },
    {
      question: 'For plate ABC 1435, which weekly deadline applies within that month?',
      options: [
        '2nd week, because the last digit is 5',
        '3rd week, because the plate has three letters',
        '4th week, because the first digit is 1',
        '1st week, because the second-to-last digit is 3',
      ],
      correct: 3,
      explanation:
        'The second-to-last digit sets the weekly deadline. Digits 1, 2, and 3 fall on the 1st week, working days 1 to 7.',
    },
    {
      question: 'Which documents should be carried in the vehicle before a trip?',
      options: [
        'Only the driver license',
        'The OR and CR, plus the COC when applicable',
        'Only the RFID sticker',
        'A receipt from the last fuel purchase',
      ],
      correct: 1,
      explanation:
        'A photocopy or the original CR must be carried in the vehicle, together with the OR and the insurance Certificate of Cover where applicable.',
    },
    {
      question: 'Before starting a manual transmission vehicle, what must be confirmed first?',
      options: [
        'The gear is in first',
        'The handbrake is released',
        'The gear is in neutral',
        'The headlights are switched on',
      ],
      correct: 2,
      explanation:
        'For manual transmission, make sure the gear is in neutral before starting. For automatic, confirm the lever is in Park.',
    },
  ],
} satisfies LevelModule;

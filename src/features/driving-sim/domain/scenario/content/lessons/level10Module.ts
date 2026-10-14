import type { LevelModule } from '@/features/driving-sim/domain/scenario/lessonModule';

const IMG = 'arangkada_extracted_images/level10/';

export const level10Module = {
  id: 'lto_level_10',
  title: 'Safety Laws In Daily Driving',
  sourceLevel: 10,
  desc: 'Learn the special laws that apply on every ordinary trip: seat belts, child restraints, distracted driving, drunk and drugged driving, vehicle emissions, overloading, and speed limiters.',
  lessons: [
    {
      id: 'level-10-mission-briefing',
      title: 'Mission Briefing: Safety Laws In Daily Driving',
      text: "These are not exotic rules for special situations. They apply on the most ordinary trip you will ever take, and most drivers break at least one of them without thinking twice.",
      blocks: [
        {
          type: 'paragraph',
          text: "These are not exotic rules for special situations. They apply on the most ordinary trip you will ever take, and most drivers break at least one of them without thinking twice.",
        },
        {
          type: 'paragraph',
          text: 'On this mission you drive the family home from a christening in the next town. Four decisions are made in the driveway before the engine starts, and seven more on the road out. None of them needs a rare emergency to happen; they are the everyday compliance decisions that keep an ordinary trip lawful and safe.',
        },
        {
          type: 'heading',
          text: 'Learning Goals',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Apply the Seat Belt Use Act correctly for drivers and passengers.',
            'Apply the Child Safety in Motor Vehicles Act, including the correct child restraint system for age and size.',
            'Apply the Anti-Distracted Driving Act and know its narrow exemptions.',
            'Recognize the legal consequences of drunk and drugged driving.',
            'Understand Clean Air Act emission compliance and smoke-belching enforcement.',
            'Recognize overloading limits under the Motor Vehicle User\'s Charge Law.',
            'Know the purpose of the Road Speed Limiter Act.',
          ],
        },
      ],
    },
    {
      id: 'level-10-seat-belt-act',
      title: '1. Seat Belt Use Act (RA 8750)',
      text: 'This law requires motorists of private and public vehicles to use seat belt devices, and requires manufacturers to install them.',
      blocks: [
        {
          type: 'paragraph',
          text: 'This law requires motorists of private and public vehicles to use seat belt devices, and requires manufacturers to install them, in order to protect passengers and drivers from the most severe effects of a road crash.',
        },
        {
          type: 'heading',
          text: 'Who Must Wear One',
        },
        {
          type: 'paragraph',
          text: 'Passengers seated facing forward in the front row of any vehicle, and those seated in the back row immediately behind the driver of private cars, SUVs, and for-hire vehicles, are required to wear seat belts while the engine is running. Back-row passengers of jeeps, passenger vans, AUVs, buses, trucks, vintage cars, and special purpose vehicles are exempted.',
        },
        {
          type: 'paragraph',
          text: 'For hire vehicles: the driver must inform and require front seat passengers to wear seat belts upon boarding. A passenger who refuses may not continue the trip, and must be informed that no insurance can be recovered in case of a crash. Appropriate signage must be posted in public or for-hire vehicles.',
        },
        {
          type: 'heading',
          text: 'Correct Seat Belt Fit',
        },
        {
          type: 'image',
          alt: 'Diagram of a correctly worn three-point seat belt, the shoulder strap resting across the torso.',
          src: IMG + 'correct-three-point-seat-belt-fit.png',
          size: 'normal',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'The safety belt should rest comfortably across the torso.',
            'Never use one seat belt for two or more people at the same time.',
          ],
        },
        {
          type: 'heading',
          text: 'Exemptions',
        },
        {
          type: 'paragraph',
          text: 'The law does not apply to certain seat types (folding seats not designed for permanent installation, a single seat beside the driver in some three-wheeled vehicles, sideward-facing seats, and seats near an emergency exit), and does not apply to a passenger or operator with a medically certified physically disabling condition that prevents appropriate restraint.',
        },
        {
          type: 'heading',
          text: 'Fines And Penalties',
        },
        {
          type: 'table',
          headers: ['Violation', 'Offense', 'Fine'],
          rows: [
            ['Failure to wear the prescribed seat belt, or allowing a child 6 years old and below to sit in the front passenger seat', '1st', 'Php 1,000'],
            ['Same violation', '2nd', 'Php 2,000'],
            ['Same violation', '3rd and succeeding', 'Php 5,000 plus one week suspension of driver\'s license'],
            ['Failure to post required seat belt signage, or failure to require a front-seat passenger to buckle up (PUV)', 'Any', 'Php 3,000, driver and operator both liable'],
          ],
        },
        {
          type: 'paragraph',
          text: 'Note: RA 8750\'s original "6 years old and below" front-seat restriction was later amended by RA 11229 (the Child Safety in Motor Vehicles Act, covered next) to age 12, matching that Act\'s own child restraint rules.',
        },
      ],
    },
    {
      id: 'level-10-child-safety-act',
      title: '2. Child Safety In Motor Vehicles Act (RA 11229)',
      text: "This law gives child passengers a layer of protection the ordinary seat belt cannot provide by itself.",
      blocks: [
        {
          type: 'paragraph',
          text: "This law gives child passengers a layer of protection the ordinary seat belt cannot provide by itself.",
        },
        {
          type: 'table',
          headers: ['Term', 'Definition'],
          rows: [
            ['Adult', 'Any person 18 years old and above.'],
            ['Child', 'Any person 12 years old and below.'],
            ['Covered vehicle', 'Any private motor vehicle, or a public motor vehicle as determined by the DOTr.'],
            ['Child Restraint System (CRS)', 'A DTI-approved device that seats a child and limits body movement to reduce injury risk during a collision or abrupt deceleration.'],
          ],
        },
        {
          type: 'heading',
          text: 'The Rule',
        },
        {
          type: 'paragraph',
          text: 'It is unlawful for the driver of a covered vehicle not to properly secure a child in a CRS at all times while the engine is running or the child is being transported, unless the child is at least 150 centimeters (59 inches) tall and is properly secured with the regular seat belt instead.',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'A child 12 years old and below must sit in the rear seat with a standard CRS.',
            'A child 12 and below may sit in front only if at least 150 cm tall and properly secured with a regular seat belt.',
            'The CRS must be correctly anchored, appropriate for the child\'s age/height/weight, with harness straps firmly buckled and not twisted, the shoulder strap crossing the chest (not the neck), and the lap belt across the thighs and hips (not the abdomen).',
            'A child in a CRS must never be left unaccompanied by an adult in the vehicle.',
          ],
        },
        {
          type: 'heading',
          text: 'Child Restraint System Groups',
        },
        {
          type: 'image',
          alt: 'Three child restraint system types side by side: an infant carrier/baby seat, a convertible child seat, and a junior booster seat, each sized for a different age range.',
          src: IMG + 'child-restraint-system-types.jpg',
          size: 'normal',
        },
        {
          type: 'table',
          headers: ['Group', 'Type', 'Age / Weight'],
          rows: [
            ['Group 0', 'Infant carrier / baby seat', 'Newborn to 13 kg, 0-2 years old'],
            ['Group I & II', 'Child seat / convertible seat', '9-18 kg, 9 months to 4 years, and 15-25 kg, 4-7 years'],
            ['Group III', 'Junior seat / booster seat', '22-36 kg, 6-12 years'],
          ],
        },
        {
          type: 'heading',
          text: 'Exceptional Circumstances',
        },
        {
          type: 'paragraph',
          text: 'The CRS requirement may be set aside during medical emergencies, when the child has a medical, mental, psychological, psychiatric, or developmental condition, or in other analogous circumstances determined by the DOTr in consultation with the DOH.',
        },
        {
          type: 'heading',
          text: 'Fines And Penalties',
        },
        {
          type: 'table',
          headers: ['Offense', 'Fine'],
          rows: [
            ['1st', 'Php 1,000'],
            ['2nd', 'Php 2,000'],
            ['3rd and succeeding', 'Php 5,000 and suspension of driver\'s license for one year'],
          ],
        },
      ],
    },
    {
      id: 'level-10-distracted-driving-act',
      title: '3. Anti-Distracted Driving Act (RA 10913)',
      text: "A phone in hand while the vehicle is moving, or even stopped at a light, is treated by law the same way: a distraction with a legal consequence.",
      blocks: [
        {
          type: 'paragraph',
          text: "A phone in hand while the vehicle is moving, or even stopped at a light, is treated by law the same way: a distraction with a legal consequence.",
        },
        {
          type: 'paragraph',
          text: 'All motorists are prohibited from using any communication device while the vehicle is in motion, or temporarily stopped at a red light or intersection. A hands-free device, such as Bluetooth or an earpiece, is permitted.',
        },
        {
          type: 'heading',
          text: 'Exemptions',
        },
        {
          type: 'paragraph',
          text: 'A motorist may use a device to call authorities in case of a crime, a road crash, a bomb or terrorist threat, fire, an explosion, the need for immediate medical attention, or when personal safety and security is compromised.',
        },
        {
          type: 'heading',
          text: 'Fines And Penalties',
        },
        {
          type: 'table',
          headers: ['Offense', 'Penalty'],
          rows: [
            ['1st', 'Php 5,000'],
            ['2nd', 'Php 10,000'],
            ['3rd', "Php 15,000 and a three-month suspension of the driver's license"],
            ['4th and succeeding', "Php 20,000 and revocation of the driver's license"],
          ],
        },
        {
          type: 'paragraph',
          text: 'Drivers of public utility vehicles, school buses or services, and common carriers of volatile, flammable, or toxic materials who violate this Act within a 50-meter radius of a school are subject to a Php 30,000 penalty and a three-month suspension of their driver\'s license.',
        },
      ],
    },
    {
      id: 'level-10-drunk-and-drugged-driving-act',
      title: '4. Anti-Drunk And Drugged Driving Act (RA 10586)',
      text: 'This law makes it unlawful to drive under the influence of alcohol, dangerous drugs, or similar substances, and sets out exactly how that influence is measured and proven.',
      blocks: [
        {
          type: 'paragraph',
          text: 'This law makes it unlawful to drive under the influence of alcohol, dangerous drugs, or similar substances, and sets out exactly how that influence is measured and proven.',
        },
        {
          type: 'heading',
          text: 'Blood Alcohol Concentration (BAC) Limits',
        },
        {
          type: 'table',
          headers: ['Vehicle Type', 'Conclusive Proof Of DUI'],
          rows: [
            ['Private motor vehicle, gross vehicle weight under 4,500 kg', 'BAC of 0.05% or higher'],
            ['Trucks, buses, motorcycles, and public utility vehicles', 'Any BAC above 0.00%'],
          ],
        },
        {
          type: 'heading',
          text: 'How A Stop Escalates',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Probable cause is established through a traffic offense such as lane straddling, sudden stops, overspeeding, swerving, or weaving, or through signs such as the smell of alcohol on the driver\'s breath, slurred speech, bloodshot eyes, a flushed face, or difficulty answering questions.',
            'If probable cause exists, the officer directs the driver to perform all three Field Sobriety Tests: the eye test (horizontal gaze nystagmus), the walk-and-turn (9 steps heel-to-toe and back), and the one-leg stand (raised about 6 inches for 30 seconds).',
            'If the driver passes all three tests, they are apprehended only for the underlying traffic offense.',
            'If the driver fails any test, the officer proceeds to an on-site Alcohol Breath Analyzer (ABA) test to determine BAC.',
            'A BAC above the prescribed limit results in arrest and the vehicle being impounded.',
            'Refusing mandatory testing is penalized with confiscation and automatic revocation of the driver\'s license.',
          ],
        },
        {
          type: 'heading',
          text: 'Fines And Penalties',
        },
        {
          type: 'table',
          headers: ['Outcome', 'Penalty'],
          rows: [
            ['Violation did not result in injury or death', '3 months imprisonment and a fine of Php 20,000 to Php 80,000'],
            ['Violation resulted in physical injuries', 'The higher of the applicable Revised Penal Code penalty, plus a fine of Php 100,000 to Php 200,000'],
            ['Violation resulted in homicide', 'The applicable Revised Penal Code penalty, plus a fine of Php 300,000 to Php 500,000'],
          ],
        },
        {
          type: 'paragraph',
          text: 'A professional driver\'s license is confiscated and perpetually revoked on the first conviction. A non-professional driver\'s license is confiscated and suspended for 12 months on the first conviction, and perpetually revoked on the second.',
        },
        {
          type: 'heading',
          text: 'Effects Of Alcohol And Drugs On Driving',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Slows brain function and reduces the ability to decide.',
            'Increases arrogance and aggressiveness.',
            'Reduces focus on the road.',
            'Causes drowsiness or fatigue.',
          ],
        },
      ],
    },
    {
      id: 'level-10-clean-air-act',
      title: '5. Clean Air Act And Smoke-Belching (RA 8749)',
      text: 'A vehicle that pollutes the air is also a vehicle that has failed a basic roadworthiness standard.',
      blocks: [
        {
          type: 'paragraph',
          text: 'A vehicle that pollutes the air is also a vehicle that has failed a basic roadworthiness standard.',
        },
        {
          type: 'table',
          headers: ['Vehicle Status', 'Registration Requirement'],
          rows: [
            ['New (imported or locally-assembled)', 'Must have a Certificate of Conformity (COC) proving compliance with emission standards before registration.'],
            ['Used or rebuilt', 'Must have a Certificate of Compliance to Emission Standard.'],
          ],
        },
        {
          type: 'paragraph',
          text: 'Test results must be presented to the LTO within 60 days of testing, as a prerequisite for registration or renewal.',
        },
        {
          type: 'heading',
          text: 'Roadside Inspection',
        },
        {
          type: 'paragraph',
          text: 'A vehicle found emitting excessive smoke while operating on any public highway is subject to an emission test by DOTr, LTO, or their deputized enforcement units.',
        },
        {
          type: 'heading',
          text: 'Fines And Penalties',
        },
        {
          type: 'table',
          headers: ['Offense', 'Fine'],
          rows: [
            ['1st', 'Not exceeding Php 2,000'],
            ['2nd', 'Not exceeding Php 4,000'],
            ['3rd and succeeding', 'Not exceeding Php 6,000, plus one year suspension of motor vehicle registration'],
          ],
        },
        {
          type: 'paragraph',
          text: 'The driver and operator of an apprehended vehicle must also attend a pollution control and management seminar conducted by the DOTr. Regularly checking your vehicle\'s smoke emission and keeping up proper maintenance is the simplest way to avoid all of this.',
        },
      ],
    },
    {
      id: 'level-10-overloading',
      title: '6. Overloading And The Motor Vehicle User\'s Charge Law (RA 8794)',
      text: "This law funds road maintenance and limits how much weight a vehicle can legally carry, for the sake of road safety and the road itself.",
      blocks: [
        {
          type: 'paragraph',
          text: "This law funds road maintenance and limits how much weight a vehicle can legally carry, for the sake of road safety and the road itself.",
        },
        {
          type: 'paragraph',
          text: 'The Motor Vehicle User\'s Charge (MVUC) is imposed on every motor vehicle, whether for hire, private, or government-owned, and is collected as part of annual registration.',
        },
        {
          type: 'heading',
          text: 'Why Overloading Is Restricted',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'For road safety.',
            'To prevent premature deterioration of the road.',
            'To prevent smoke-belching caused by an over-tasked engine.',
          ],
        },
        {
          type: 'heading',
          text: 'Overloading Penalty',
        },
        {
          type: 'paragraph',
          text: 'The owner of a truck or trailer loaded beyond the maximum allowable gross vehicle weight (GVW) pays a penalty equal to 25% of the applicable MVUC at the time of the violation. This penalty is waived if the load exceeds the GVW by a tolerance of less than 5%. No vehicle may proceed on the roadway if a dual-wheel axle load exceeds 13,500 kg, or if the vehicle load exceeds 150% of the maximum allowable GVW.',
        },
      ],
    },
    {
      id: 'level-10-speed-limiter-act',
      title: '7. Road Speed Limiter Act (RA 10916)',
      text: "This law requires public utility and certain other vehicles to physically cap their own top speed, rather than relying on the driver's discipline alone.",
      blocks: [
        {
          type: 'paragraph',
          text: "This law requires public utility and certain other vehicles to physically cap their own top speed, rather than relying on the driver's discipline alone.",
        },
        {
          type: 'heading',
          text: 'Fines And Penalties',
        },
        {
          type: 'table',
          headers: ['Violation', 'Fine'],
          rows: [
            ['Operating without a speed limiter, or with a nonfunctioning or tampered speed limiter', 'Php 50,000'],
          ],
        },
        {
          type: 'paragraph',
          text: 'In addition to the fine, a first offense suspends the driver\'s license for one month or the vehicle\'s franchise for three months. A second offense extends this to three months (license) or six months (franchise). A subsequent offense results in revocation of the license or a one-year suspension of the franchise. Tampering with a speed limiter carries a separate penalty of 6 months to 3 years imprisonment plus a Php 30,000 fine.',
        },
      ],
    },
    {
      id: 'level-10-method-and-recap',
      title: '8. Compliance Method And Mission Recap',
      text: 'Use one habit before every trip: confirm the belts are on, the child seat is correct, the phone is put away, and the vehicle itself is fit to be on the road.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Use one habit before every trip: confirm the belts are on, the child seat is correct, the phone is put away, and the vehicle itself is fit to be on the road.',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Confirm every required occupant is wearing a seat belt, correctly fitted.',
            'Confirm any child 12 or under is in the correct restraint system for their age and size, or meets the height exemption.',
            'Put communication devices away, or use hands-free only, before the vehicle starts moving.',
            'Never drive after drinking or using a substance that could affect judgment or reaction time.',
            'Watch for visible smoke-belching or overload signs before and during the trip.',
          ],
        },
        {
          type: 'heading',
          text: 'Scenario',
        },
        {
          type: 'paragraph',
          text: 'The mission is one trip. In the driveway you decide who takes the keys, whether the front row is correctly belted, which restraint each child needs, and what the car may carry. On the road your phone rings in traffic, a five-year-old works her way out of her harness, a jeepney ahead lays down smoke you have to hang back from, an enforcer waves you into a checkpoint, a truck sheds gravel you must not cross the line to pass, and a bus runs away down a grade you hold the posted limit on. The last stretch is a motorcycle rider down with nobody else around, and the one call on the whole trip that does not wait until you have parked: an emergency call is exempt from the ban.',
        },
        {
          type: 'heading',
          text: 'Level Recap',
        },
        {
          type: 'paragraph',
          text: 'The Seat Belt Use Act and the Child Safety in Motor Vehicles Act both protect occupants from the same underlying risk: an unrestrained body during sudden deceleration. The Anti-Distracted Driving Act treats a phone in hand as a legal violation, not just poor judgment, with narrow emergency exemptions. The Anti-Drunk and Drugged Driving Act sets a zero tolerance for trucks, buses, motorcycles and public utility vehicles, where any BAC above 0.00% is conclusive, and a strict measurable limit for private cars, backed by a defined testing procedure. The Clean Air Act ties a vehicle\'s registration to its emissions, and the Motor Vehicle User\'s Charge Law limits how much weight a vehicle may carry. The Road Speed Limiter Act adds a physical safeguard on top of driver judgment for the vehicles that need it most.',
        },
      ],
    },
  ],
  quiz: [],
} satisfies LevelModule;

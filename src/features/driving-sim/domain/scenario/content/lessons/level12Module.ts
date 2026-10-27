import type { LevelModule } from '@/features/driving-sim/domain/scenario/lessonModule';

export const level12Module = {
  id: 'lto_level_12',
  title: 'Enforcement And Final Road Exam',
  sourceLevel: 12,
  desc: 'Learn how traffic enforcement actually works, know your rights and duties when apprehended, understand the demerit point system, and bring together everything from every previous level for the final road exam.',
  lessons: [
    {
      id: 'level-12-mission-briefing',
      title: 'Mission Briefing: Enforcement And Final Road Exam',
      text: "Everything up to this point has been about driving correctly. This level is about what happens around that: how enforcement works, what your rights and duties are, and whether you can pull every previous level together under pressure.",
      blocks: [
        {
          type: 'paragraph',
          text: "Everything up to this point has been about driving correctly. This level is about what happens around that: how enforcement works, what your rights and duties are, and whether you can pull every previous level together under pressure.",
        },
        {
          type: 'paragraph',
          text: 'The final mission mixes a checkpoint, signs, a right-of-way decision, a hazard response, an emergency event, and a moment of real violation risk into one continuous drive. Nothing in it is new; all of it is a test of whether the last eleven levels actually became habit.',
        },
        {
          type: 'heading',
          text: 'Learning Goals',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Understand how traffic enforcement is organized and who is authorized to enforce it.',
            'Know your rights and duties during an apprehension.',
            'Understand the Temporary Operator\'s Permit and its deadlines.',
            'Understand the demerit point system and its consequences.',
            'Recognize the major categories of document and vehicle violations.',
            'Integrate signs, right-of-way, hazard response, and emergency procedure into one continuous drive.',
          ],
        },
      ],
    },
    {
      id: 'level-12-enforcement-system',
      title: '1. How Traffic Enforcement Works',
      text: 'Enforcement is not one agency doing one thing. It is several agencies, each with a defined role, and three different approaches working together.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Enforcement is not one agency doing one thing. It is several agencies, each with a defined role, and three different approaches working together.',
        },
        {
          type: 'heading',
          text: 'Types Of Enforcement',
        },
        {
          type: 'table',
          headers: ['Type', 'Description'],
          rows: [
            ['Punitive', 'Enforcement of traffic laws through apprehension and penalty.'],
            ['Preventive', 'Deployment of traffic enforcers on the road to prevent violations before they happen.'],
            ['Persuasive', 'Information and education campaigns that build voluntary compliance.'],
          ],
        },
        {
          type: 'heading',
          text: 'Agencies Involved In Traffic Administration',
        },
        {
          type: 'table',
          headers: ['Agency', 'Role'],
          rows: [
            ['DOTr', 'The primary policy, planning, and regulatory body for a dependable, coordinated transportation network.'],
            ['LTFRB', 'Issues the Certificate of Public Convenience for public utility vehicles and enforces the Public Service Law.'],
            ['PNP-HPG', 'Enforces RA 4136, the Land Transportation and Traffic Code.'],
            ['MMDA / LGUs', 'Responsible for traffic direction and control within Metro Manila and their own localities.'],
            ['DPWH', 'Responsible for road engineering, infrastructure, and installation of signs, signals, and pavement markings.'],
          ],
        },
        {
          type: 'heading',
          text: 'Deputized Enforcers',
        },
        {
          type: 'paragraph',
          text: 'The LTO deputizes expressway traffic regulation officers (covering NLEX, SCTEX, SFEX, TPLEX, SLEX, Skyway, Star Tollway, CAVITEX, MCEX, CALAEX, and the C5 Extension Expressway) to enforce RA 4136 and related regulations. Only LTO-deputized traffic enforcers are authorized to confiscate a driver\'s license.',
        },
        {
          type: 'heading',
          text: 'Ticketing System',
        },
        {
          type: 'table',
          headers: ['Document', 'Meaning'],
          rows: [
            ['Temporary Operator\'s Permit (TOP)', 'Issued by LTO-deputized enforcers for traffic and administrative violations.'],
            ['Traffic Violation Receipt (TVR)', 'Issued as a receipt acknowledging a recorded traffic violation.'],
            ['Traffic Citation Ticket (TCT)', 'Issued by an LGU under PD 1605.'],
            ['Ordinance Violation Receipt (OVR)', 'Issued for a violation of a local traffic ordinance.'],
            ['Uniform Ordinance Violation Receipt (UOVR)', 'Issued by LGUs in Metro Manila under the Single Ticketing System.'],
          ],
        },
      ],
    },
    {
      id: 'level-12-rights-and-duties',
      title: '2. Rights And Duties During An Apprehension',
      text: "Being stopped for a violation is not a moment without rules of its own. A driver has specific rights during an apprehension, and the Temporary Operator's Permit comes with specific deadlines.",
      blocks: [
        {
          type: 'paragraph',
          text: "Being stopped for a violation is not a moment without rules of its own. A driver has specific rights during an apprehension, and the Temporary Operator's Permit comes with specific deadlines.",
        },
        {
          type: 'heading',
          text: 'Rights Of A Driver When Apprehended',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'To be informed of the full name and agency of the apprehending officer.',
            'To know whether the apprehending officer is one for traffic direction and control, or a deputized officer.',
            'To be informed of the exact alleged traffic violation.',
            'The right not to step down from the vehicle.',
            'To know how and when to pay the violation.',
            'To contest the violation within a prescribed period.',
            'To explain the circumstances behind the apprehension.',
          ],
        },
        {
          type: 'paragraph',
          text: 'It is improper for any driver or any traffic enforcer to negotiate a violation. Any complaint or contest must be filed at the proper adjudication office, not settled at the roadside.',
        },
        {
          type: 'heading',
          text: 'The Temporary Operator\'s Permit (TOP)',
        },
        {
          type: 'paragraph',
          text: "The TOP serves three functions at once: a receipt for a confiscated driver's license, a notice and summons, and a temporary driver's license valid for 72 hours only.",
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'All apprehensions are deemed admitted unless contested in writing within 5 days of the apprehension.',
            'The driver has 15 days from the date of apprehension to settle the fine.',
            'Failure to settle within 15 days causes an automatic 30-day suspension of the driver\'s license, in addition to the fine itself.',
            'The LTO resolves a contested case within 5 days of receiving the written contest.',
          ],
        },
        {
          type: 'heading',
          text: 'General Duties Of A Driver',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Secure the appropriate driver\'s license and carry it at all times while driving.',
            'Know, follow, and abide by land transportation laws, rules, and regulations; ignorance of the law excuses no one.',
            'Be a defensive driver.',
            'Ensure the vehicle is duly registered, roadworthy, and emission compliant.',
            'Take appropriate measures to secure and safeguard the vehicle before leaving it.',
            'Know what to do in case of a road crash.',
            'Know your rights and privileges; a driver\'s license is a privilege, not a right.',
            'Ensure you are in a healthy condition to drive.',
          ],
        },
      ],
    },
    {
      id: 'level-12-demerit-points',
      title: '3. The Demerit Point System',
      text: 'A fine settles a single violation. Demerit points track a pattern, and the pattern is what eventually costs a driver their license.',
      blocks: [
        {
          type: 'paragraph',
          text: 'A fine settles a single violation. Demerit points track a pattern, and the pattern is what eventually costs a driver their license.',
        },
        {
          type: 'paragraph',
          text: 'A demerit point is the accumulated arithmetical value assigned to every traffic violation a driver commits during the validity of their license.',
        },
        {
          type: 'heading',
          text: 'Categories Of Violations',
        },
        {
          type: 'table',
          headers: ['Category', 'Demerit Points'],
          rows: [
            ['Grave violation', '5'],
            ['Less grave violation', '3'],
            ['Light violation (not otherwise listed as grave or less grave)', '1'],
          ],
        },
        {
          type: 'paragraph',
          text: 'Points accumulate during the validity of the license and revert to zero upon renewal. Drivers of public utility vehicles are given double demerit points for every violation committed while operating a for-hire vehicle, including a private vehicle operating as a PUV without proper LTFRB authority.',
        },
        {
          type: 'heading',
          text: 'Restriction On Adding DL Codes',
        },
        {
          type: 'table',
          headers: ['Demerit Points From Date Of Issuance', 'Period Of Prohibition'],
          rows: [
            ['1-2', '3 months'],
            ['3-4', '6 months'],
            ['5 or more', '1 year'],
          ],
        },
        {
          type: 'paragraph',
          text: 'During this prohibition period, a driver may not apply for an additional DL code or a change of DL classification, counted from the date the fines and penalties are settled.',
        },
        {
          type: 'heading',
          text: 'Accumulated Violation Points And Penalties',
        },
        {
          type: 'table',
          headers: ['Accumulated Points / Trigger', 'Consequence'],
          rows: [
            ['5-9 demerit points at DL renewal', 'Required to attend the Driving Enhancement Program (DEP) or an accredited service provider.'],
            ['10 or more demerit points', 'DEP plus a theoretical exam.'],
            ['10 demerit points, or the same violation committed at least 3 times', 'Required to attend the DEP.'],
            ['A franchise-related violation', 'Referred to the Driver\'s Academy with the LTFRB.'],
            ['40 or more demerit points', 'License revoked for at least 2 years.'],
            ["Holder of a Student-Driver's Permit (SP) with 5 demerit points", 'Confiscation and revocation of the SP; may apply again after one year. A third revocation is perpetual.'],
          ],
        },
        {
          type: 'paragraph',
          text: "A driver who does not complete a required intervention program within 30 days of their last apprehension, after notice has been given, will have their license suspended until they complete it.",
        },
      ],
    },
    {
      id: 'level-12-document-and-vehicle-violations',
      title: '4. Document And Vehicle Violations',
      text: "Beyond moving violations, a whole category of penalties exists for the paperwork and physical condition of the vehicle itself.",
      blocks: [
        {
          type: 'paragraph',
          text: "Beyond moving violations, a whole category of penalties exists for the paperwork and physical condition of the vehicle itself.",
        },
        {
          type: 'heading',
          text: 'Licensing Violations',
        },
        {
          type: 'table',
          headers: ['Violation', 'Fine'],
          rows: [
            ['Driving without a valid driver\'s license or conductor\'s permit (includes expired, revoked, suspended, wrong restriction code, wrong classification, fake license, an overstaying tourist license, or an unaccompanied student driver)', 'Php 3,000, plus disqualification from being granted a license for 1 year.'],
            ['Failure to carry driver\'s license, Certificate of Registration, or Official Receipt while driving', 'Php 1,000.'],
            ['Falsified documents, misrepresentation or cheating by an applicant for a driver\'s license (RA 10930)', 'Php 20,000. A license granted by it is revoked, and the applicant may not apply again for two years; a repeat means perpetual disqualification.'],
          ],
        },
        {
          type: 'heading',
          text: 'Registration And Vehicle Condition Violations',
        },
        {
          type: 'table',
          headers: ['Violation', 'Fine'],
          rows: [
            ['Driving an unregistered motor vehicle (expired, revoked, suspended, or invalid registration; fake substitute engine, engine block, or chassis)', 'Php 10,000. If unregistered for over a month, the vehicle is impounded until validly registered.'],
            ['Unauthorized motor vehicle modification (such as an unauthorized color change)', 'Php 5,000, plus impounding until the defect is corrected.'],
            ['Operating a right-hand drive motor vehicle', 'Php 50,000, plus impounding.'],
            ['Operating with defective, improper, or unauthorized accessories, devices, equipment, or parts (horns, sirens, EWD, brakes, lights, mirrors, mufflers, tires, speedometer, windshield, wipers, and similar)', 'Php 5,000, plus impounding until corrected.'],
            ['Improper attachment or tampering of license plates or the third plate sticker', 'Php 5,000, plus correction and confiscation of the unauthorized item.'],
            ['Fraud in relation to motor vehicle registration or renewal', 'Php 3,000, plus a one-year bar from registration.'],
          ],
        },
        {
          type: 'heading',
          text: 'Common Traffic Violations (RA 4136)',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Allowing passengers to ride on top of or cover a motor vehicle.',
            'Failing to provide a canvas cover for cargo that requires it.',
            'Permitting a person to ride on the running board, step board, or mudguard while the vehicle is moving.',
            'Failing to dim headlights when approaching another vehicle.',
            'Driving against traffic, or failing to pass to the right when meeting oncoming vehicles.',
            'Illegal turn: failing to keep to the right of the intersection center when turning left.',
            'Illegal overtaking: failing to pass to the left when overtaking, except where multiple lanes allow otherwise.',
            'Overtaking at an unsafe distance.',
            'Cutting an overtaken vehicle before being safely clear of it.',
            'Hitching a person, bicycle, motorcycle, tricycle, or skate roller to a moving motor vehicle.',
            'Failing to stop the motor and set the handbrake when a vehicle is left unattended.',
            'Unsafe towing.',
            'Obstruction: blocking the free passage of other vehicles while loading, unloading, or driving in a way that impedes traffic.',
          ],
        },
        {
          type: 'paragraph',
          text: 'Parking violations were already covered in Level 4: within an intersection, within 6 meters of it, in front of a driveway, within 4 meters of a fire hydrant, on the roadway side of a parked vehicle, or wherever a prohibition sign is posted, all fall under this same enforcement framework.',
        },
      ],
    },
    {
      id: 'level-12-final-recap',
      title: '5. Final Integrated Recap',
      text: 'Every level so far taught one layer of driving. This is the moment they all have to work together.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Every level so far taught one layer of driving. This is the moment they all have to work together.',
        },
        {
          type: 'table',
          headers: ['Level', 'Core Competency'],
          rows: [
            ['0', 'Basic vehicle control: start, steer, brake, and stop fully.'],
            ['1', 'Identify the correct license or permit, and recognize when a driver is not authorized.'],
            ['2', 'Complete a vehicle readiness check and decide not to proceed when something is unsafe.'],
            ['3', 'Respond correctly to signs, signals, and stop/yield controls.'],
            ['4', 'Position the vehicle correctly around markings, crossings, and lanes.'],
            ['5', 'Choose the correct yielding action at intersections, crossings, roundabouts, and for emergency vehicles.'],
            ['6', 'Execute safe turning, lane changes, overtaking, and parking.'],
            ['7', 'Manage speed, following distance, and expressway merging and exiting.'],
            ['8', 'Apply hazard prediction, courtesy, emotional control, and awareness of vulnerable road users.'],
            ['9', 'Select the safest response to mechanical failure, poor visibility, breakdown, and road crash.'],
            ['10', 'Apply the daily safety laws: seat belts, child restraints, phones, impairment, emissions, and loading.'],
            ['11', 'Share the road correctly with motorcycles, tricycles, PUVs, and other vehicle classes.'],
          ],
        },
        {
          type: 'paragraph',
          text: 'None of these competencies operate in isolation on a real road. A single stretch of driving can demand a sign response, a right-of-way decision, a hazard reaction, and a legal compliance check within the same minute, which is exactly what the final mission is built to test.',
        },
      ],
    },
    {
      id: 'level-12-final-mission-method',
      title: '6. Final Mission Method And Mission Recap',
      text: 'Use the same method you have used since Level 8, applied across every domain at once: search and scan continuously, identify what each situation actually requires, and act without hesitation once you have decided.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Use the same method you have used since Level 8, applied across every domain at once: search and scan continuously, identify what each situation actually requires, and act without hesitation once you have decided.',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'At a checkpoint, stop fully, and know your rights and duties if apprehended.',
            'Read every sign in advance and respond to it before you reach it.',
            'At each intersection, identify who has the right-of-way and yield accordingly.',
            'Scan continuously for hazards, and respond with control rather than panic.',
            'If an emergency event occurs, follow the correct emergency sequence: control the vehicle, make it visible, then attend to people.',
            'Recognize situations carrying real violation risk, and choose the lawful option even under time pressure.',
          ],
        },
        {
          type: 'heading',
          text: 'Scenario',
        },
        {
          type: 'paragraph',
          text: 'The final mission places a checkpoint early in the route, requiring a full stop and correct document readiness. Along the way, posted signs require a specific speed or maneuver, an intersection presents a right-of-way decision with cross-traffic, a sudden hazard tests scanning and reaction, an emergency vehicle or mechanical event requires the correct response sequence, and at least one moment presents a real temptation toward a violation, such as an unsafe overtake or a rolling stop. Completing the mission means handling every one of these correctly, in sequence, without any single lapse.',
        },
        {
          type: 'heading',
          text: 'Final Recap',
        },
        {
          type: 'paragraph',
          text: 'Enforcement in the Philippines runs through several agencies and three types of approach: punitive, preventive, and persuasive. A driver has real rights during an apprehension and real deadlines under the Temporary Operator\'s Permit. Demerit points turn repeated violations into escalating consequences, separate from the fine for any single one. Document and vehicle-condition violations exist alongside moving violations, and are enforced through the same system. Above all, this level confirms one thing: driving is not a set of isolated facts to recall one at a time, it is a single continuous judgment applied everywhere, all the time you are on the road.',
        },
      ],
    },
  ],
  quiz: [],
} satisfies LevelModule;
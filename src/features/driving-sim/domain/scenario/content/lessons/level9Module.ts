import type { LevelModule } from '@/features/driving-sim/domain/scenario/lessonModule';

const IMG = 'arangkada_extracted_images/level9/';

export const level9Module = {
  id: 'lto_level_9',
  title: 'Emergencies And Road Crashes',
  sourceLevel: 9,
  desc: 'Drive home over the ridge in the tail of a storm: poor visibility, a flooded dip, a throttle that sticks, a blowout, brakes that fade on the descent, and the crash at the bottom.',
  lessons: [
    {
      id: 'level-9-mission-briefing',
      title: 'Mission Briefing: Emergencies And Road Crashes',
      text: 'An emergency gives you no time to look up the right answer. Each one below has a fixed sequence, and knowing it before the moment is the whole of the skill.',
      blocks: [
        {
          type: 'paragraph',
          text: 'An emergency gives you no time to look up the right answer. Each one below has a fixed sequence, and knowing it before the moment is the whole of the skill.',
        },
        {
          type: 'paragraph',
          text: 'This mission is one drive home over a ridge in the tail of a storm: rain that closes the road down to a few car lengths, a flooded dip, a throttle that sticks open, a blowout, brakes that fade on the long descent, and a crash at the bottom of it.',
        },
        {
          type: 'paragraph',
          text: 'Before any of it, check what is in the vehicle. Always carry an emergency kit: a first aid kit, a flashlight, an Early Warning Device, and a Class ABC fire extinguisher. Being prepared before a breakdown is what makes the breakdown procedure possible to carry out at all.',
        },
        {
          type: 'heading',
          text: 'Learning Goals',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Respond correctly to a tire blowout or jammed accelerator.',
            'Respond correctly to brake loss and know the emergency braking technique.',
            'Control a skid and handle hydroplaning without overcorrecting.',
            'Drive safely in poor visibility and adverse road conditions.',
            'Respond correctly to an engine fire or a submerged vehicle.',
            'Execute a proper breakdown procedure, including Early Warning Device placement.',
            'Follow the correct road crash response and reporting duty.',
            'Know the limits of first aid a driver may safely give.',
          ],
        },
      ],
    },
    {
      id: 'level-9-tire-blowout-and-jammed-pedal',
      title: '1. Tire Blowout And Jammed Accelerator',
      text: 'Both of these tempt a driver into a sudden, hard reaction. The correct response to each is the opposite: controlled and gradual.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Both of these tempt a driver into a sudden, hard reaction. The correct response to each is the opposite: controlled and gradual.',
        },
        {
          type: 'heading',
          text: 'Tire Blowout',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Take your foot off the accelerator pedal.',
            'Do not slam on the brakes.',
            'Hold on to your steering wheel firmly.',
            'Slow down gradually.',
            'Apply the brake softly once the vehicle is under control.',
            'Pull the vehicle to the safe side of the road once you have slowed to a safe speed.',
            'Switch on hazard lights and properly place your Early Warning Device.',
          ],
        },
        {
          type: 'heading',
          text: 'Jammed Gas Pedal',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Release the accelerator pedal.',
            'Shift to neutral.',
            'Firmly press the brake pedal to slow the vehicle.',
            'Do not shut off the engine; you may lose the ability to steer.',
            'Maneuver the vehicle to a safe area, then stop and shut the engine off.',
          ],
        },
      ],
    },
    {
      id: 'level-9-brake-loss',
      title: '2. Loss Of Brake And Emergency Braking',
      text: 'Losing the brakes leaves you several ways to slow down, and you have to know them in advance to reach for them.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Losing the brakes leaves you several ways to slow down, and you have to know them in advance to reach for them.',
        },
        {
          type: 'heading',
          text: 'Loss Of Brake',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Aim toward your target or escape area.',
            'Release the accelerator.',
            'Control the steering.',
            'Downshift; do not switch off the engine.',
            'If possible, use the parking brake, keeping the release lever open, and use it as a brake.',
            'Use a soft crash area if necessary, as a last resort.',
          ],
        },
        {
          type: 'heading',
          text: 'Emergency Braking Technique',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'When the brake fails, rapidly pump the brake pedal several times to build brake fluid pressure. For a vehicle equipped with anti-lock brakes (ABS), do not pump the brake.',
            'Shift to a lower gear.',
            'Sound the horn and flash the lights if you cannot slow down, to alert pedestrians and other motorists.',
            'Sporadically use the parking brake to slow the vehicle.',
          ],
        },
      ],
    },
    {
      id: 'level-9-skid-and-hydroplaning',
      title: '3. Skid, Traction Loss, And Hydroplaning',
      text: 'Most skids happen when a driver turns too quickly or brakes too suddenly on a downhill, a curb, or slippery pavement such as wet road, gravel, or sand.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Most skids happen when a driver turns too quickly or brakes too suddenly on a downhill, a curb, or slippery pavement such as wet road, gravel, or sand.',
        },
        {
          type: 'heading',
          text: 'Skid And Traction Loss',
        },
        {
          type: 'table',
          headers: ['Principle', 'Action'],
          rows: [
            ['Look', 'Look where you want to go.'],
            ['Steer', 'Steer where you want to go.'],
            ['Off Pedals', 'Release the brake or accelerator to help the tires regain rolling traction.'],
            ['Never Give Up', 'Maintain constant attention to steering until the vehicle is back under control. Never take your hands off the steering wheel.'],
          ],
        },
        {
          type: 'heading',
          text: 'Hydroplaning',
        },
        {
          type: 'paragraph',
          text: 'On a dry road, tar, rubber, and oil residue build up on the surface; when it rains, this mixture becomes especially slippery.',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Slow down and drive in a lower gear.',
            'Stay away from mud or stagnant water.',
            'Do not jam the brake pedal.',
            'Do not make a sharp or quick turn.',
          ],
        },
        {
          type: 'heading',
          text: 'Flooded Road',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Be aware, calm, and ready.',
            'Avoid stepping on the brake as much as possible while in the water.',
            'Reduce speed by releasing the accelerator pedal.',
            'Gently step on the brake pedal after passing the flooded stretch, to dry the brake pads, rotors, linings, and drums.',
          ],
        },
      ],
    },
    {
      id: 'level-9-poor-visibility',
      title: '4. Poor Visibility',
      text: 'Fog, heavy rain or dust hides hazards from you, and hides your vehicle from everyone else at the same time.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Fog, heavy rain or dust hides hazards from you, and hides your vehicle from everyone else at the same time.',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Drive with lights on low beam.',
            'Slow down, and do not switch on hazard lights while still moving.',
            'Keep your eyes on the road.',
            'Use clean wipers or cloths if the windshield fogs up.',
            'If visibility becomes too poor to continue, stop at a safe place and turn on hazard lights there.',
          ],
        },
        {
          type: 'paragraph',
          text: 'Avoid using your high or "white" headlight beam in poor visibility conditions such as fog; it reflects back and can worsen your own view of the road.',
        },
      ],
    },
    {
      id: 'level-9-fire-and-submersion',
      title: '5. Engine Fire And Submerged Vehicle',
      text: 'In both of these, getting out of the vehicle quickly matters more than anything you could do from inside it.',
      blocks: [
        {
          type: 'paragraph',
          text: 'In both of these, getting out of the vehicle quickly matters more than anything you could do from inside it.',
        },
        {
          type: 'heading',
          text: 'Engine Fire',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Steer out of traffic, away from buildings, people, and other vehicles.',
            'Have all occupants leave the car immediately and move away.',
            'Do not open the hood.',
            'Turn off the ignition, then get out quickly.',
          ],
        },
        {
          type: 'heading',
          text: 'Any Vehicle Fire',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Call for assistance.',
            'Do not put water on a diesel or gasoline fire.',
            'Use an appropriate fire extinguisher (Class ABC).',
            'If you cannot stop the fire, leave the vehicle.',
          ],
        },
        {
          type: 'heading',
          text: 'Submerged Vehicle',
        },
        {
          type: 'image',
          alt: 'Occupants escaping a vehicle that has gone into a body of water, before it sinks below the surface.',
          src: IMG + 'submerged-vehicle-escape.jpg',
          size: 'normal',
        },
        {
          type: 'paragraph',
          text: 'Get out of the vehicle immediately. If you crash into a river or other body of water, the vehicle will typically only float on the surface for about 30 to 60 seconds before sinking.',
        },
      ],
    },
    {
      id: 'level-9-breakdown-procedure',
      title: '6. Breakdown Procedure And Early Warning Devices',
      text: 'A breakdown is not an emergency by itself. It becomes one only if the vehicle is left invisible and unmarked in traffic.',
      blocks: [
        {
          type: 'paragraph',
          text: 'A breakdown is not an emergency by itself. It becomes one only if the vehicle is left invisible and unmarked in traffic.',
        },
        {
          type: 'image',
          alt: 'Diagram showing Early Warning Device placement four meters apart behind a stopped vehicle on a one-way road, and on both sides on a two-way road.',
          src: IMG + 'early-warning-device-placement.png',
          size: 'large',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Move the vehicle to the safest available position, off the main travel lane if possible.',
            'Switch on hazard lights.',
            'Place your Early Warning Device, spaced about four meters apart, behind the vehicle on a one-way road, or on both sides on a two-way road.',
            'In case of a breakdown, emergency, or accident on an expressway, the impaired vehicle must be removed from the travel way by an authorized towing operator without delay, at the owner or driver\'s expense.',
            'Do not attempt a repair that requires standing in an active traffic lane.',
          ],
        },
        {
          type: 'heading',
          text: 'Emergency Kit',
        },
        {
          type: 'paragraph',
          text: 'Always carry an emergency kit in the vehicle: a first aid kit, a flashlight, and an Early Warning Device. Being prepared before a breakdown happens is what makes the procedure above actually possible to execute.',
        },
      ],
    },
    {
      id: 'level-9-road-crash-response',
      title: '7. Road Crash Response',
      text: 'After a crash the law gives the driver a duty, not just a procedure. Leaving without aiding the victim is unlawful except in three specific cases.',
      blocks: [
        {
          type: 'paragraph',
          text: 'After a crash the law gives the driver a duty, not just a procedure. Leaving without aiding the victim is unlawful except in three specific cases.',
        },
        {
          type: 'heading',
          text: 'Duty Of The Driver In Case Of A Crash',
        },
        {
          type: 'paragraph',
          text: 'In the event a road crash occurs, the driver present must show their driver\'s license and give their true name and address, along with the true name and address of the vehicle\'s owner. No driver involved in a road crash may leave the scene without aiding the victim, except if the driver is in imminent danger of serious harm because of the crash, if the driver reports the crash to the nearest law officer, or if the driver has to summon a physician or nurse to aid the victim.',
        },
        {
          type: 'heading',
          text: 'Immediate Response Sequence',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Stop.',
            'Turn on hazard flashers.',
            'Stay calm and check yourself, your passengers, and other road users for injuries.',
            'If anyone is injured, note your location and call 911, the national emergency hotline, or the Red Cross hotline (143) immediately.',
            'Check for injured or unconscious passengers; if possible, move them out of the vehicle to a safe place away from oncoming traffic.',
            'If injuries such as cuts or abrasions have occurred, administer first aid if you are able to.',
            'Photograph and document the scene: the vehicles, involved parties, witnesses, and any responding police officers.',
            'Call local law enforcement to report the crash.',
          ],
        },
      ],
    },
    {
      id: 'level-9-first-aid-limits',
      title: '8. First Aid Limits',
      text: "A driver's job at a crash scene is to help without making the injury worse, and to know exactly where that help should stop.",
      blocks: [
        {
          type: 'paragraph',
          text: "A driver's job at a crash scene is to help without making the injury worse, and to know exactly where that help should stop.",
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Attend first to anyone who is not yet walking and talking; they need the most urgent attention.',
            'If any part of the vehicle is on fire, remove all occupants and make sure everyone is safe first.',
            'Do not remove an injured person unless they are in a burning vehicle or facing other immediate danger. Unnecessary movement often makes injuries worse.',
            'If you are knowledgeable, check for breathing and apply mouth-to-mouth resuscitation if needed.',
            'Call for emergency response for any serious or physical injury.',
            'Do not attempt to give first aid beyond this unless you have been trained in it.',
          ],
        },
        {
          type: 'heading',
          text: 'The Core Limit',
        },
        {
          type: 'paragraph',
          text: 'A driver without medical training is not expected to diagnose or treat an injury. The role is to keep the person safe from further harm, get trained help on the way, and avoid actions that could make the outcome worse.',
        },
      ],
    },
    {
      id: 'level-9-method-and-recap',
      title: '9. Emergency Method And Mission Recap',
      text: 'One sequence covers every sudden emergency: control the vehicle first, make it visible second, then attend to people third.',
      blocks: [
        {
          type: 'paragraph',
          text: 'One sequence covers every sudden emergency: control the vehicle first, make it visible second, then attend to people third.',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Control the vehicle: release the accelerator, avoid slamming the brake, and steer toward your target or escape area.',
            'Bring the vehicle to a safe stop, off the main travel lane if at all possible.',
            'Make the vehicle visible: hazard lights, and an Early Warning Device if stopped.',
            'Check yourself and others for injury before doing anything else.',
            'Report and document: call the appropriate hotline or law enforcement, and photograph the scene.',
          ],
        },
        {
          type: 'heading',
          text: 'Scenario',
        },
        {
          type: 'paragraph',
          text: 'The route runs home over a ridge in the tail of a storm. The rain closes the road down to a few car lengths, so the speed has to come off to match what you can actually see. The dip below is under floodwater, which is crossed slowly and with the accelerator released rather than the brake jammed on. On the climb out, the accelerator sticks wide open, and the answer is neutral and a firm brake rather than switching the engine off. Near the top a tire lets go: the brake stays off until the vehicle is back under control, then a soft brake and a stop in the marked emergency parking area. The brakes fade on the long descent that follows, which calls for pumping the pedal, a lower gear, the horn, and the parking brake in bursts. At the bottom, a crash has already happened, and the duty there begins by stopping.',
        },
        {
          type: 'heading',
          text: 'Level Recap',
        },
        {
          type: 'paragraph',
          text: 'Every mechanical emergency, whether a tire blowout, jammed pedal, brake loss, skid, or hydroplaning, rewards a controlled and gradual response over a sudden one. Poor visibility calls for low beams, reduced speed, and stopping only somewhere safe. Engine fire and submersion both call for getting the occupants out immediately. A breakdown becomes safe once the vehicle is visible, with hazard lights and a correctly placed Early Warning Device. A road crash carries a legal duty to stop and aid the victim, and first aid from an untrained driver has real limits: protect from further harm, get trained help on the way, and do not attempt more than that.',
        },
      ],
    },
  ],
  quiz: [],
} satisfies LevelModule;

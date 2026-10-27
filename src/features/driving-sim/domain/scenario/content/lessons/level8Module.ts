import type { LevelModule } from '@/features/driving-sim/domain/scenario/lessonModule';

export const level8Module = {
  id: 'lto_level_8',
  title: 'Defensive Driving Mindset',
  sourceLevel: 8,
  desc: 'Learn to scan for hazards before they become emergencies, manage stress and road rage, extend courtesy to other road users, and protect pedestrians, cyclists, and other vulnerable people sharing the road.',
  lessons: [
    {
      id: 'level-8-mission-briefing',
      title: 'Mission Briefing: Defensive Driving Mindset',
      text: 'Every rule you have learned so far assumes you are calm, alert, and paying attention. This level is about staying that way when the road tests you.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Every rule you have learned so far assumes you are calm, alert, and paying attention. This level is about staying that way when the road tests you.',
        },
        {
          type: 'paragraph',
          text: 'On this mission the street gives you a school gate at drop-off, a motorcycle filtering past your door, a blind bend with a bus coming the other way, a jeepney nosed out of a side street and unable to join, a loaded truck slowing in stop-start traffic, and a school van unloading a child while somebody presses you from behind. None of these events require a new traffic rule; they require the mindset to scan ahead, keep time and space in hand, stay calm, and protect the people around you.',
        },
        {
          type: 'heading',
          text: 'Learning Goals',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Define defensive driving and identify the qualities of a defensive driver.',
            'Apply the SIPDE method to scan for and respond to hazards.',
            'Explain the doctrine of last clear chance.',
            'Show courtesy and self-discipline toward passengers, pedestrians, and other road users.',
            'Recognize how personal wellness and lifestyle factors affect driving safety.',
            'Recognize common causes of driving stress and handle them without endangering others.',
            'Recognize the bad habits of aggressive drivers and avoid becoming a victim of road rage.',
            'Give extra care and right-of-way to pedestrians, PWDs, seniors, children, pregnant women, road workers, and active transport users.',
          ],
        },
      ],
    },
    {
      id: 'level-8-what-is-defensive-driving',
      title: '1. What Is Defensive Driving',
      text: 'Defensive driving is the practice of using driving techniques to minimize risk and help avoid a road crash. It is a demonstration of attitude and awareness as much as it is a set of skills.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Defensive driving is the practice of using driving techniques to minimize risk and help avoid a road crash. It is a demonstration of attitude and awareness as much as it is a set of skills, aimed at efficiently and safely getting yourself, your passengers, or your cargo from origin to destination.',
        },
        {
          type: 'heading',
          text: 'Qualities Of A Defensive Driver',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Positive attitude on road safety.',
            'Physically and mentally fit to drive.',
            'Received proper training before driving.',
            'Applies basic knowledge of vehicle maintenance.',
          ],
        },
        {
          type: 'heading',
          text: 'Tips For Defensive Driving',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Follow the speed limit, taking weather and traffic conditions into account.',
            'Look ahead to have an advance plan for road crashes, emergencies, and similar situations.',
            'Follow the law on anti-distracted driving.',
            'Follow the rules on changing lanes, turning, stopping, and parking, even without traffic signals, signs, or enforcers present.',
            "Consider your vehicle's length, width, and weight when judging a safe following distance.",
            'Respect the rights and decisions of other road users.',
            'Give the right-of-way to pedestrians such as PWDs, senior citizens, children, pregnant women, and road workers.',
            'Give the right-of-way to priority vehicles such as emergency vehicles.',
            'Yield the right-of-way to ascending vehicles, school service vehicles, vehicles with a lesser steering radius, vehicles already turning left, and vehicles inside a yellow box.',
          ],
        },
      ],
    },
    {
      id: 'level-8-sipde',
      title: '2. SIPDE: The Hazard-Scanning Method',
      text: 'SIPDE is the driving method used to spot trouble before it reaches you, instead of reacting only once it does.',
      blocks: [
        {
          type: 'paragraph',
          text: 'SIPDE is the driving method used to spot trouble before it reaches you, instead of reacting only once it does.',
        },
        {
          type: 'table',
          headers: ['Step', 'What It Means'],
          rows: [
            ['Search / Scan', 'Continuously scan the road ahead, around, and behind the vehicle.'],
            ['Identify', 'Identify potential and immediate hazards on the road.'],
            ['Predict', 'Predict what other road users are likely to do.'],
            ['Decide', 'Decide what action avoids the unsafe situation.'],
            ['Execute', 'Carry out the action you decided on.'],
          ],
        },
        {
          type: 'heading',
          text: 'Common Driving Habits That Lead To A Crash',
        },
        {
          type: 'table',
          headers: ['Cause', 'Prevention'],
          rows: [
            ['Tailgating', 'Maintain a suitable braking distance when following a vehicle, especially on through highways.'],
            ['Carelessness in changing lanes, turning, and overtaking', 'Signal your intentions ahead of your actions, according to your speed. Avoid obstructing or inconveniencing other motorists. Do not overtake on a curve if it is not safe.'],
            ['Disregarding traffic signs, signals, and pavement markings', 'Follow the rules of traffic.'],
            ['Disregarding weather conditions', 'Observe safety practices during adverse weather.'],
            ['Insisting on the right-of-way', 'Never insist on the right-of-way; it can trigger a road crash or road rage.'],
          ],
        },
      ],
    },
    {
      id: 'level-8-last-clear-chance',
      title: '3. The Doctrine Of Last Clear Chance',
      text: 'This doctrine matters most in the exact moment where you can still avoid a crash that someone else caused.',
      blocks: [
        {
          type: 'paragraph',
          text: 'A person who has the last clear chance, or opportunity, of avoiding a road crash, and neglects to avoid it, may be jointly held liable.',
        },
        {
          type: 'paragraph',
          text: "In practice, this means the other driver being at fault does not excuse you from acting if you still had a clear opportunity to prevent the crash. A defensive driver treats every hazard, even one caused entirely by someone else's mistake, as something worth reacting to if a safe reaction is still possible.",
        },
      ],
    },
    {
      id: 'level-8-courtesy-and-discipline',
      title: '4. Courtesy And Road Discipline',
      text: 'Courtesy is showing politeness in your attitude and behavior toward other road users. Road discipline is knowing and abiding by traffic laws, rules, and regulations.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Courtesy is showing politeness in your attitude and behavior toward other road users. As a driver, be courteous, and give the right-of-way when appropriate. You may invoke your own right-of-way when it is proper, but always drive defensively while doing so.',
        },
        {
          type: 'heading',
          text: 'Be Courteous',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'To passengers.',
            'To pedestrians.',
            'To other road users.',
            'To other motorists.',
            'To traffic enforcers.',
          ],
        },
        {
          type: 'heading',
          text: 'Small Courtesies That Matter',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Say or signal "sorry" if you make a mistake.',
            'Say or signal "thank you" if another driver gives you the right-of-way.',
            'Never stare at the headlights of an oncoming vehicle at night; it worsens your own night vision.',
            'Never stare into the eyes of another driver when overtaking; treat it as a maneuver to complete, not a contest to win.',
          ],
        },
        {
          type: 'heading',
          text: 'Self-Discipline And Road Discipline',
        },
        {
          type: 'table',
          headers: ['Term', 'Meaning'],
          rows: [
            ['Self-discipline', 'The ability to control yourself in a particular way without needing outside supervision. Driving requires a determined level of self-control and a proper reaction to each situation.'],
            ['Road discipline', 'Knowing and abiding by traffic laws, rules, and regulations.'],
          ],
        },
      ],
    },
    {
      id: 'level-8-driver-wellness-and-human-factors',
      title: '5. Driver Wellness And Human Factors In Crashes',
      text: "A driver's own physical and mental condition is part of defensive driving. A well-rested, healthy, emotionally steady driver has more capacity to scan, predict, and react than one who is running on empty.",
      blocks: [
        {
          type: 'paragraph',
          text: "A driver's own physical and mental condition is part of defensive driving. A well-rested, healthy, emotionally steady driver has more capacity to scan, predict, and react than one who is running on empty.",
        },
        {
          type: 'heading',
          text: 'Physical And Mental Wellness',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Keep good hygiene, health, and safety habits; a driver who feels unwell is a driver with reduced reaction capacity.',
            'Understand the effects of drugs and alcohol on driving before ever getting behind the wheel.',
            'Manage fatigue: plan driving hours and rest stops in advance rather than pushing through tiredness.',
            'An early-to-bed, early-to-rise routine supports alertness during daytime driving.',
            'Regular exercise supports the physical stamina driving requires, especially on long trips.',
            'Personality and temperament affect driving: a driver aware of their own short temper or impatience can plan around it.',
            'Good moral character and driving etiquette are part of being a responsible driver, not separate from it.',
          ],
        },
        {
          type: 'heading',
          text: 'Human Factors That Lead To A Crash',
        },
        {
          type: 'paragraph',
          text: 'Beyond the driving-habit causes already covered, a driver\'s own lifestyle and state of mind can independently cause a crash.',
        },
        {
          type: 'table',
          headers: ['Cause', 'Prevention'],
          rows: [
            ['Fatigue, for various reasons', 'Observe reasonable driving hours and plan rest stops beforehand.'],
            ['Drunk driving and hangovers', "Don't drink and drive."],
            ['Partying and socializing', 'Limit the time spent before a drive.'],
            ['Gambling', 'Avoid gambling before a trip.'],
            ['Internet, social media, and watching movies', 'Limit screen time before driving.'],
            ['Hyper emotions (sadness, happiness, fear, boredom)', 'Control emotions and concentrate on the steering wheel.'],
            ['Loud music', 'Limit the volume.'],
            ['Eating while driving', 'Eat before driving, not during.'],
            ['Frequent conversation with passengers', 'Limit conversation to the minimum needed.'],
            ['Illness (flu, sore eyes, dehydration, and similar)', 'Avoid driving if not physically fit, and consult a doctor.'],
            ['Distracted driving (RA 10913 violations)', 'Put safety first and follow the law.'],
          ],
        },
        {
          type: 'paragraph',
          text: 'None of these causes involve another driver, a sign, or a hazard on the road. They start with the driver, before the trip even begins, which is exactly why they belong in a defensive driving mindset rather than a rules lesson.',
        },
      ],
    },
    {
      id: 'level-8-stress',
      title: '6. Managing Stress While Driving',
      text: 'Stress is the physical, mental, or emotional tension a person experiences that demands an immediate and fair decision. Every driver experiences it; the goal is to handle it without letting it affect your driving.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Stress is the physical, mental, or emotional tension a person experiences that demands an immediate and fair decision. Every driver experiences it; the goal is to handle it without letting it affect your driving and endanger your life or someone else\'s.',
        },
        {
          type: 'heading',
          text: 'Common Causes Of Stress While Driving',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Personal and family problems.',
            'Heavy traffic.',
            'Annoying or excessive horn use, or noisy mufflers.',
            'Undisciplined and discourteous motorists, passengers, and pedestrians.',
            'Malfunctioning traffic lights.',
            'Improper pavement markings or improper parking.',
            'Improper handling of traffic by law enforcers.',
            'Detours or road closures.',
            'Fake "emergency" vehicles, especially ambulances.',
            'Incorrect headlights from oncoming vehicles.',
            'Annoying tailgaters.',
            'An unexplained sudden stop by the vehicle in front.',
            'Right-of-way insistence.',
          ],
        },
        {
          type: 'heading',
          text: 'How To Handle Stress',
        },
        {
          type: 'table',
          headers: ['Source Of Stress', 'How To Respond'],
          rows: [
            ['Personal or family problems', 'Pull over if needed. Take deep breaths while counting backward. Play calming music at a low volume. Never drive unless you are fully in control of your emotions.'],
            ['Undisciplined motorists and pedestrians', 'Avoid crowded areas with heavy pedestrian or vendor activity when possible. Learn to recognize undisciplined drivers and keep your distance from them. Be humble and patient: slow down and yield to an aggressive overtaking driver, and let a pedestrian pass even if they are not in the correct crosswalk.'],
            ['Heavy traffic and bad road conditions', 'Reroute or adjust your departure time if possible. Stay calm and listen to music instead of fixating on the delay. Know flood-prone areas and alternative routes in advance. Consider carpooling to reduce road volume.'],
            ['Unlawful or difficult traffic enforcers', 'Be polite. Comply rather than argue at the roadside. Save formal complaints for the proper venue and time, not the driver\'s seat. Use a dashcam or phone to document an incident if needed.'],
          ],
        },
      ],
    },
    {
      id: 'level-8-road-rage',
      title: '7. Road Rage: Recognize It, Do Not Feed It',
      text: 'Road rage is an assault, in any manner, against another person, provoked by a misunderstanding, a lack of traffic knowledge, or discourtesy on the road.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Road rage is an assault, in any manner, against another person, provoked by a misunderstanding, a lack of traffic knowledge, or discourtesy on the road.',
        },
        {
          type: 'heading',
          text: 'A Driver Must Not',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Cut off other motorists.',
            'Make rude gestures.',
            'Tailgate.',
            'Blow the horn excessively or annoyingly.',
            'Cause obstructions, such as indiscriminate loading/unloading or lane straddling.',
          ],
        },
        {
          type: 'heading',
          text: "Don't Be A Victim",
        },
        {
          type: 'table',
          headers: ['Principle', 'Why It Works'],
          rows: [
            ['Avoid retaliation', 'It takes at least two people to have a fight; refusing to engage ends it before it starts.'],
            ['Keep distance', 'Let the angry driver pass you by rather than staying alongside them.'],
            ['Put away your pride', 'Forget about winning; driving is not a contest.'],
            ['Avoid eye contact', 'Eye contact with an angry driver can read as a provocation.'],
            ['Mind conditioning', 'Condition your mindset before you even leave the house or office.'],
            ['Get help', 'Call traffic authorities; they are the proper party to deal with an aggressive or dangerous driver.'],
          ],
        },
        {
          type: 'heading',
          text: 'Results Of Road Rage',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Emotional setback.',
            'Serious injury.',
            'Imprisonment.',
            'Fines and penalties.',
            'Suspension or revocation of driver\'s license.',
            'Suspension or termination from work.',
          ],
        },
        {
          type: 'heading',
          text: 'Bad Habits Of Aggressive Drivers',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Driving slowly in the left (overtaking) lane.',
            'Rude gestures.',
            'Tailgating.',
            'Annoying or excessive blowing of horns.',
            'Fighting over a parking space.',
          ],
        },
      ],
    },
    {
      id: 'level-8-vulnerable-road-users',
      title: '8. Protecting Pedestrians And Active Transport Users',
      text: "Right-of-way rules for pedestrians were covered in Level 5. This lesson is about the courtesy layer on top of the rule: giving vulnerable and active-transport road users room to be wrong, slow, or unpredictable without punishing them for it.",
      blocks: [
        {
          type: 'paragraph',
          text: "Right-of-way rules for pedestrians were covered in Level 5. This lesson is about the courtesy layer on top of the rule: giving vulnerable and active-transport road users room to be wrong, slow, or unpredictable without punishing them for it.",
        },
        {
          type: 'heading',
          text: 'Active Transport And Light Mobility Vehicles',
        },
        {
          type: 'paragraph',
          text: 'Active transport covers non-motorized transportation such as bicycles, skateboards, rollerskates, and personal mobility devices like electric seated scooters, e-bikes, segways, unicycles, electric kick scooters, and self-balancing scooters. The objective for every other road user is simple: give courtesy and respect to active transport users, and encourage the use of active transportation.',
        },
        {
          type: 'heading',
          text: 'Guidelines For Drivers Of Motorcycles, Cars, Trucks, And Other Motorized Vehicles',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Do not travel or park in a bicycle or pedestrian lane.',
            'Give cyclists sufficient clearance and watch your speed when passing.',
            'Be extra careful when turning at intersections where a bike or motorcycle lane crosses your path.',
            'Open vehicle doors with care, checking for approaching cyclists first.',
            'Check your blind spots before any movement that could affect a cyclist or active-transport user.',
          ],
        },
        {
          type: 'heading',
          text: 'Why It Matters',
        },
        {
          type: 'paragraph',
          text: 'Active transport reduces traffic volume, cuts emissions, and improves public health, which benefits every road user, including drivers. Treating a cyclist or pedestrian as an obstacle instead of a fellow road user is the mindset this level asks you to leave behind.',
        },
      ],
    },
    {
      id: 'level-8-gender-sensitivity',
      title: '9. Gender Sensitivity On The Road',
      text: 'Defensive driving includes treating every road user, passenger, and colleague with equal respect, regardless of gender.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Defensive driving includes treating every road user, passenger, and colleague with equal respect, regardless of gender. The Magna Carta of Women (RA 9710) seeks to eliminate discrimination against women by recognizing, protecting, fulfilling, and promoting their rights, particularly in marginalized sectors. RA 9262 defines and penalizes violence against women and their children.',
        },
        {
          type: 'paragraph',
          text: 'Gender and Development is not framed as a conflict between sexes; it recognizes that both men and women can be affected by discrimination, though women are affected more often. As a driver, this translates into a simple standard: courtesy, patience, and right-of-way decisions should never depend on who the other road user is.',
        },
      ],
    },
    // Added in the FDM module revision (see the Arangkada question bank, Module Review sheet).
    {
      id: 'level-8-lane-position-and-large-vehicles',
      title: '10. Lane Position, Counterflow, And Large Vehicles',
      text: 'Defensive driving starts with where you put the car: the lane you keep, the room you leave, and when you decide not to overtake.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Defensive driving starts with where you put the car: the lane you keep, the room you leave, and when you decide not to overtake.',
        },
        {
          type: 'heading',
          text: 'On Undivided Roads',
        },
        // FDM Vol. 1 p. 138
        {
          type: 'list',
          ordered: false,
          items: [
            'On an undivided two-lane road, keep to the outer lane and watch your speed.',
            'If a vehicle is counterflowing toward you, keep calm and do not insist on your right. Signal and change lanes with care, and avoid eye contact with the other driver.',
            'If an oncoming vehicle steers into your lane: read the road ahead, drive to the right, reduce speed, and be ready to drive off the road.',
            'If you are forced off the road and cannot avoid hitting something, aim for something soft such as bushes or plastic barriers, or glance off a fixed object such as a fence at an angle.',
          ],
        },
        {
          type: 'heading',
          text: 'Large And Long Vehicles',
        },
        // FDM Vol. 1 p. 140
        {
          type: 'list',
          ordered: false,
          items: [
            'Keep adequate space for long, wide or large vehicles.',
            'Never overtake a large hauling truck that is turning left or right; it may block all or some of the lanes.',
            'Long vehicles may straddle lanes while turning, so give them extra room.',
            'Overtake a large vehicle only when there is enough time and distance to complete the maneuver safely.',
          ],
        },
        {
          type: 'heading',
          text: 'Lane Habits That Cause Traffic And Crashes',
        },
        // FDM Vol. 1 pp. 89, 110, 119, 121, 139, 156
        {
          type: 'list',
          ordered: false,
          items: [
            'Lane straddling and swerving through indiscriminate, unsafe lane changes are common violations that cause heavy traffic and crashes.',
            'Motorcycles are entitled to the same full length and width of lane as all other vehicles.',
            'Before passing motorcyclists or cyclists, check for obstructions in front of them, behind them and on each side, and leave enough space.',
            'Before changing lanes, take a quick glance over your shoulder at the blind spot your mirrors do not show.',
            'Where a solid center line runs through a blind bend, stay in your lane and do not overtake.',
          ],
        },
      ],
    },
    // Added in the FDM module revision (see the Arangkada question bank, Module Review sheet).
    {
      id: 'level-8-hazards-and-courtesy',
      title: '11. Hazards Around You And Everyday Courtesy',
      text: 'Some hazards are built into the road and some come and go with the hour. Others are the drivers right behind you.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Some hazards are built into the road and some come and go with the hour. Others are the drivers right behind you.',
        },
        // FDM Vol. 1 p. 148
        {
          type: 'table',
          headers: ['Type', 'Examples'],
          rows: [
            ['Fixed hazards', 'Structures that may restrict your view: curves, hills, hidden driveways, intersections, merging roads.'],
            ['Dynamic hazards', 'Hazards that change through the day: school zones, market areas, commercial districts, emergency vehicles.'],
          ],
        },
        {
          type: 'heading',
          text: 'A Tailgater Behind You',
        },
        // FDM Vol. 1 p. 146
        {
          type: 'paragraph',
          text: 'Signal your intentions early with brake and signal lights, stop smoothly, keep ample distance ahead, and let the tailgater pass before you slow down.',
        },
        {
          type: 'heading',
          text: 'Courtesy And Fitness To Drive',
        },
        // FDM Vol. 1 pp. 71, 139, 169, 170, 172
        {
          type: 'list',
          ordered: false,
          items: [
            'The horn is for warning other road users of your presence, not for venting.',
            'Behind a student driver, be patient and expect mistakes.',
            'At a "Bicycle Lane Ahead" sign, be aware and slow down.',
            'Approach a pedestrian lane with extreme caution, ready to give way.',
            'If you are taking medicine that can affect your driving, do not drive, or consult a doctor first.',
          ],
        },
      ],
    },
    {
      id: 'level-8-method-and-recap',
      title: '12. Defensive Driving Method And Mission Recap',
      text: 'Use SIPDE as your default method for every hazard, and use courtesy and self-discipline as your default response to every provocation.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Use SIPDE as your default method for every hazard, and use courtesy and self-discipline as your default response to every provocation.',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Search and scan the road continuously, ahead, around, and behind.',
            'Identify hazards early, including aggressive drivers, cyclists, pedestrians, and roadwork.',
            'Predict what each hazard is likely to do next.',
            'Decide on the safest response, even if the other party is at fault.',
            'Execute the decision smoothly, without matching aggression with aggression.',
          ],
        },
        {
          type: 'heading',
          text: 'Scenario',
        },
        {
          type: 'paragraph',
          text: 'The mission route is the school run at 6:45, out of the barangay, along the river and into town. A van is stopped at a school gate with its hazards on and children waiting on the footpath; nothing is in the road yet, and the correct response is to have the speed off before you find out. A motorcycle filters past along the line between your lanes; the correct response is to hold your line and keep off the horn, because a rider beside your door has nowhere to go. The river road bends left behind a seawall with a bus coming the other way and the center line solid; the correct response is to be in the curb lane before you are in the bend. A jeepney is nosed out of a side street and cannot join; the correct response is to stop and let it out, which costs you seconds and nothing else. A loaded truck ahead keeps slowing in stop-start traffic; the correct response is the two-second gap, held while it slows rather than closed. A school van stops with a child at the curb while a car closes up behind you; the correct response is to stop for the child and let the driver behind wait.',
        },
        {
          type: 'heading',
          text: 'Level Recap',
        },
        {
          type: 'paragraph',
          text: 'Defensive driving is an attitude, not just a skill: scan continuously with SIPDE, and remember that having the last clear chance to avoid a crash means you should take it, regardless of who caused the hazard. A driver\'s own wellness, rest, and emotional state are part of that attitude; many crashes start with fatigue, illness, or a distracted mind rather than a road hazard. Courtesy and self-discipline reduce the stress that leads to road rage, and a driver who recognizes the causes of stress can respond to them without endangering anyone. Vulnerable road users, including PWDs, seniors, children, pregnant women, road workers, and active transport users, deserve extra patience and clearance, not impatience.',
        },
      ],
    },
  ],
  // Seven items, weighted the opposite way to the mission.
  //
  // Most levels quiz what the drive is about to test. This one cannot: the
  // drive grades a speed, a lane, a stop and a following gap, and half of this
  // module is about a driver's condition, temperament and conduct, which have
  // no vehicle behaviour attached to them. So the mission takes hazard
  // prediction, the space cushion, courtesy at a constrained section, the last
  // clear chance, the margin owed to a person in the road, not retaliating, and
  // the room a cyclist needs — while the quiz carries the weight of the
  // wellness, stress and gender-sensitivity lessons that the road section can
  // only gesture at.
  passingScore: 5,
  quiz: [
    {
      question:
        'You are following a delivery van that completely blocks your view of the road beyond it. Which SIPDE step are you most at risk of skipping?',
      options: [
        'Search — you can see the van perfectly well',
        'Predict — deciding in advance what could come out from behind it',
        'Execute — you have not had to do anything yet',
        'Identify — the van is already identified as a vehicle',
      ],
      correct: 1,
      explanation:
        'Search, Identify, Predict, Decide, Execute. Spotting the van is Search and Identify; the step drivers skip is Predict — working out what a hazard you cannot see past is likely to produce, and slowing before you find out rather than after.',
    },
    {
      question:
        'A pedestrian steps into the road well away from any crossing, entirely at fault, and you can still stop safely. What does the doctrine of last clear chance say about your position?',
      options: [
        'Their negligence transfers the liability entirely to them',
        'You may proceed as long as you sound the horn first',
        'If you had the last opportunity to avoid the crash and did not take it, you may be jointly held liable',
        'The doctrine only applies to collisions between two vehicles',
      ],
      correct: 2,
      explanation:
        'A person who has the last clear chance of avoiding a road crash and neglects to avoid it may be jointly held liable. The other party being at fault does not excuse you from acting when a safe reaction was still available to you.',
    },
    {
      question:
        'You slept badly, you are getting over the flu, and a long drive is booked for this afternoon. What does the module treat this as?',
      options: [
        'A reason to drive more slowly than usual, which is sufficient',
        'A human factor that can cause a crash on its own, so the trip should be delayed',
        'A private matter with no bearing on driving competence',
        'A problem only if the trip is longer than four hours',
      ],
      correct: 1,
      explanation:
        'Fatigue and illness are listed as human factors that lead to a crash without any hazard, sign or other driver involved. The prevention is to avoid driving when not physically fit, consult a doctor, and plan reasonable driving hours and rest stops beforehand.',
    },
    {
      question:
        'You are driving after a serious family argument and you keep replaying it instead of watching the road. What is the correct response?',
      options: [
        'Turn the music up loud to drown out the thoughts',
        'Drive faster so the trip is over sooner',
        'Pull over, take deep breaths counting backward, and drive only once you are in control',
        'Keep going, since stopping would make you late',
      ],
      correct: 2,
      explanation:
        'Pull over if needed, take deep breaths while counting backward, and play calming music at a low volume. Never drive unless you are fully in control of your emotions. Loud music is itself a listed crash cause, and hurrying is how a distracted driver becomes an aggressive one.',
    },
    {
      question:
        'Another driver cuts you off, gestures rudely, then slows down in front of you to provoke a reaction. What does the module say is the most reliable way not to become a victim of road rage?',
      options: [
        'Match their behavior so they understand how it feels',
        'Avoid retaliation and keep your distance, because a fight needs at least two people',
        'Stay directly alongside them so they cannot cut in again',
        'Hold eye contact so they know you are not intimidated',
      ],
      correct: 1,
      explanation:
        'Avoid retaliation, keep your distance and let the angry driver pass, put away your pride, and avoid eye contact, which can itself read as provocation. If it continues, call traffic authorities — they are the proper party to deal with a dangerous driver.',
    },
    {
      question:
        'You are about to pass a cyclist riding near the curb on a narrow street. What is required of you?',
      options: [
        'Sound the horn on approach so they move over for you',
        'Pass as close and as quickly as possible to spend less time alongside',
        'Give sufficient clearance and watch your speed, checking your blind spot first',
        'Wait behind them until the street ends, as passing a cyclist is prohibited',
      ],
      correct: 2,
      explanation:
        'Give cyclists sufficient clearance and watch your speed when passing, check your blind spots before any movement that could affect them, and never travel or park in a bicycle or pedestrian lane. Passing is allowed; passing close and fast is what the rule prohibits.',
    },
    {
      question:
        'Which statement matches the module on courtesy and gender sensitivity toward other road users?',
      options: [
        'Courtesy and right-of-way decisions should not depend on who the other road user is',
        'Extra courtesy is owed to women drivers specifically',
        'Gender and Development treats road conduct as a conflict between the sexes',
        'Courtesy is optional as long as no traffic law is broken',
      ],
      correct: 0,
      explanation:
        'Gender and Development is not framed as a conflict between sexes, and it recognizes that both men and women can be affected by discrimination. For a driver it reduces to one standard: courtesy, patience and right-of-way decisions never depend on who the other road user is. Courtesy is also not optional — it is one half of road discipline, alongside knowing and abiding by the law.',
    },
  ],
} satisfies LevelModule;
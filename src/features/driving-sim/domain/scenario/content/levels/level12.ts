import { getLevelModule } from '@/features/driving-sim/domain/scenario/content/lessons/lessonCatalog';
import { buildEvents, type SlotVariant } from '@/features/driving-sim/domain/scenario/pooling';
import { remediationCandidates } from '@/features/driving-sim/domain/scenario/remediationPool';
import type { DrivingCompetency, ViolationSeverity } from '@/domain/learner/competency';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { declaredLineSpans } from '@/features/driving-sim/domain/scenario/roadLine';

const levelModule = getLevelModule(12);

/**
 * The final road exam: eight slots, half of them this module's enforcement and
 * half the road the learner has already been taught, rolled from the attempt's
 * seed and nothing else.
 *
 * | # | Slot | Whose | Answered by |
 * |---|---|---|---|
 * | 1 | Roadside check     | this level's, 4 variants  | a full stop, then what the check comes to |
 * | 2 | Signs              | Level 3's, 44             | as graded there |
 * | 3 | Flagged down       | this level's, 3           | a full stop, then conduct and rights |
 * | 4 | Right-of-way       | Levels 2 and 5, 20        | as graded there |
 * | 5 | Ticket issued      | this level's, 3           | a full stop, then the TOP and the record |
 * | 6 | Hazard response    | Levels 7-11, 12           | as graded there |
 * | 7 | Violation risk     | Levels 4 and 6, 6         | as graded there: a line not crossed |
 * | 8 | Emergency          | this level's, 2           | a frozen prompt |
 *
 * The curriculum asks for a checkpoint, signs, right-of-way, hazard
 * response, an emergency event and violation risk; the module's own subject is
 * apprehension, the TOP, penalties, documents and demerits.
 *
 * ## The same test for every learner
 *
 * `createLevel12` takes a random stream and nothing else: no weak area, no sign
 * coverage, under every adaptive option. Pooling is what keeps a retake from
 * being a password; reading history would make it a different exam per learner.
 *
 * ## One scale, so the pass mark means one thing
 *
 * Every variant scores `POINTS` and is graded at `SEVERITY`, borrowed ones
 * included, so a correct answer is worth the same and a miss costs the same
 * whatever was rolled into the slot. Only those two numbers change on a
 * borrowed scenario; its question, grading and citation are its own. With eight
 * equal slots, 140 of 200 passes one miss always, three never, and two only
 * when both come before the running score has anything to lose (it cannot go
 * below zero). That is the 70% every level from 2 to 11 already asks; no LTO
 * source sets a pass mark.
 *
 * ## The enforcement half is asked at a stop
 *
 * What the sources give a driver who is stopped is conduct and rights: pull
 * over, stay seated with hands visible and papers ready, ask the reason and
 * who is asking, never negotiate, contest in writing. Everything else - the
 * TOP's 72 hours, the fines, the impound, demerit points - is a consequence the
 * law attaches, not a move. So the car is graded on the stop and the rest is
 * asked on the document card the officer holds. At the roadside check the stop
 * is a checkpoint's, a full stop in the zone; flagged down or ticketed, it is
 * the pull-over to the extreme right the sources give a driver stopped by an
 * enforcer, a full stop in the curb lane. None of the three grades braking,
 * pulling over or turning back for paperwork: no source says to.
 *
 * ## Where every claim comes from
 *
 * Each claim this file makes rests on quoted LTO material, by file and
 * heading, and what the sources leave open is left ungraded. The borrowed half
 * carries its own levels' claims. The emergencies rest on the
 * final-readiness row (E1*-E4*).
 */

/** What every slot scores, borrowed variants included. */
const POINTS = 25;

/** How grave a miss is on this exam, whatever its source level called it. */
const SEVERITY: ViolationSeverity = 'major';

/** The last level a borrowed scenario may come from: everything the learner has already been taught. */
const MAX_SOURCE_LEVEL = 11;

/**
 * Slots 3 and 5 are traffic stops: an enforcer at the curb flags the car down,
 * and the stop the car is graded on is a pull-over to the extreme right, not
 * a stop at a checkpoint's line. The roadside check (slot 1) is a
 * checkpoint, and declares none of this.
 */
const TRAFFIC_STOP = {
  missedMessage:
    "You did not pull over for the enforcer. If stopped by an enforcer, safely pull over to the extreme right, then stay in the driver's seat with your license and registration ready.",
};

/**
 * Every portable variant teaching `competency` from the levels before this one,
 * narrowed by a declared field where the slot asks for less than the whole
 * competency, and put on this level's scale.
 */
const borrowed = (
  competency: DrivingCompetency,
  keep: (variant: SlotVariant) => boolean = () => true
): SlotVariant[] =>
  remediationCandidates(competency, MAX_SOURCE_LEVEL)
    .map(candidate => candidate.variant)
    .filter(keep)
    .map(variant => ({ ...variant, points: POINTS, severity: SEVERITY }));

// 1. Roadside check - curriculum ingredient "checkpoint", and the module's
// documents and registration. The card says what was
// presented; the question is what the check comes to, which is the law's
// consequence and never a move the sources do not give. Amounts stay in the
// citations: the choices turn on which violation it is, and on the one-month
// impound threshold (Q3).
const roadsideCheckSlot: SlotVariant[] = [
  {
    id: 'level12.roadside-check.cr-at-home',
    label: 'Roadside check',
    type: 'scenario_trigger',
    description:
      'An enforcer at a roadside check waves you in. Your license and the Official Receipt are in the glovebox; the Certificate of Registration is at home.',
    question: 'The registration itself is current. What does this stop come to?',
    choices: [
      { label: 'Apprehended for driving an unregistered vehicle', action: 'brake' },
      { label: 'Apprehended for not carrying the CR', action: 'stop' },
      { label: 'Nothing: the OR alone shows the car is registered', action: 'accelerate' },
    ],
    correctAction: 'stop',
    points: POINTS,
    penaltyMessage:
      'The car is registered, and the OR shows it, but the CR has to ride in the car as well: the original or a photocopy. Driving without it is failure to carry, a violation of its own.',
    rewardMessage:
      'Right. Without the CR in the car, the stop ends in an apprehension for failure to carry it. The registration itself is not in question.',
    duration: 220,
    lawCitation:
      'RO105: "A photocopy or the original CR are required to be preserved and carried in the car by the owner or driver of a motor vehicle." JAO 2014-01, as printed in FDM Vol. 2: failure to carry the driver\'s license, Certificate of Registration or Official Receipt while driving a motor vehicle, Php 1,000. Driving an unregistered motor vehicle is a separate violation, Php 10,000.',
    competency: 'document_awareness',
    severity: SEVERITY,
    inspection: {
      officerLine: 'Magandang araw po. Pakita po ng lisensya at OR/CR.',
      documentType: 'Roadside Check — Documents',
      holder: 'REYES, MARCO D.',
      fields: [
        { label: "Driver's license", value: 'Non-Professional — valid' },
        { label: 'Official Receipt', value: 'Presented — registration current' },
        { label: 'Certificate of Registration', value: 'Not presented — at home' },
      ],
      vehicle: 'Private passenger car — plate NDA 4325',
      tripPurpose: 'Private trip',
    },
  },
  {
    id: 'level12.roadside-check.registration-lapsed',
    label: 'Roadside check',
    type: 'scenario_trigger',
    description:
      "An enforcer at a roadside check waves you in. The car's registration was due in May and was never renewed.",
    question: 'Check the registration. What does this stop come to?',
    choices: [
      { label: 'Apprehended for driving an unregistered vehicle, and the car is impounded until it is registered', action: 'stop' },
      { label: 'Apprehended for driving an unregistered vehicle; you drive it home and renew it this week', action: 'brake' },
      { label: 'Nothing: a lapsed registration only costs a penalty at renewal', action: 'accelerate' },
    ],
    correctAction: 'stop',
    points: POINTS,
    penaltyMessage:
      'A lapsed registration is not a fee waiting for the next visit to the LTO: driving the car is driving an unregistered motor vehicle. Once the lapse is past a month, the car is impounded and released only when it is validly registered.',
    rewardMessage:
      'Right. An expired registration makes it an unregistered vehicle, and past a month the car stays impounded until it is registered and the fines are paid.',
    duration: 220,
    lawCitation:
      'JAO 2014-01, as printed in FDM Vol. 2: driving an unregistered motor vehicle "includes driving with an improperly registered motor vehicle or a motor vehicle with expired, revoked, suspended or invalid registration", Php 10,000, and "in case of non-registration and the violation has exceeded one (1) month, the motor vehicle shall be impounded and shall be released only upon its valid registration and payment of appropriate fines and penalties." The last digit of the plate sets the month the registration is due.',
    competency: 'document_awareness',
    severity: SEVERITY,
    inspection: {
      officerLine: 'Magandang araw po. Pakita po ng lisensya at OR/CR.',
      documentType: 'Roadside Check — Registration',
      holder: 'SANTOS, ANA P.',
      fields: [
        { label: 'Plate', value: 'NCA 7215 — due in May' },
        { label: 'Checked on', value: '20 July 2026' },
        { label: 'Status', value: 'Not renewed — lapsed more than a month' },
      ],
      vehicle: 'Private passenger car — plate NCA 7215',
      tripPurpose: 'Private trip',
    },
  },
  {
    id: 'level12.roadside-check.registration-just-lapsed',
    label: 'Roadside check',
    type: 'scenario_trigger',
    description:
      "An enforcer at a roadside check waves you in. The car's registration was due at the end of June and has not been renewed yet.",
    question: 'Check the registration. What does this stop come to?',
    choices: [
      { label: 'The car is impounded on the spot', action: 'stop' },
      { label: 'Nothing yet: a registration has a month of grace after it is due', action: 'brake' },
      { label: 'Apprehended for driving an unregistered vehicle; the car is not impounded, as the lapse is under a month', action: 'accelerate' },
    ],
    correctAction: 'accelerate',
    points: POINTS,
    penaltyMessage:
      'An expired registration is an unregistered vehicle however recently it lapsed. What the one month decides is the impound: under it, the car is not impounded.',
    rewardMessage:
      'Right. Lapsed is unregistered, but the impound applies only once the lapse has passed a month.',
    duration: 220,
    lawCitation:
      'JAO 2014-01, as printed in FDM Vol. 2: driving an unregistered motor vehicle "includes driving with an improperly registered motor vehicle or a motor vehicle with expired, revoked, suspended or invalid registration", Php 10,000, and "in case of non-registration and the violation has exceeded one (1) month, the motor vehicle shall be impounded and shall be released only upon its valid registration and payment of appropriate fines and penalties."',
    competency: 'document_awareness',
    severity: SEVERITY,
    inspection: {
      officerLine: 'Magandang araw po. Pakita po ng lisensya at OR/CR.',
      documentType: 'Roadside Check — Registration',
      holder: 'DIAZ, ROMEO C.',
      fields: [
        { label: 'Plate', value: 'NCA 7296 — due in June, fourth week' },
        { label: 'Checked on', value: '10 July 2026' },
        { label: 'Status', value: 'Not renewed — lapsed ten days' },
      ],
      vehicle: 'Private passenger car — plate NCA 7296',
      tripPurpose: 'Private trip',
    },
  },
  {
    id: 'level12.roadside-check.plate-cover',
    label: 'Roadside check',
    type: 'scenario_trigger',
    description:
      "An enforcer at a roadside check waves you in. A tinted plastic cover sits over the car's rear plate.",
    question: 'The papers are in order. What does this stop come to?',
    choices: [
      { label: 'Nothing: the plate can still be read from up close', action: 'accelerate' },
      { label: 'Apprehended: the cover comes off and is confiscated, and there is a fine', action: 'stop' },
      { label: 'Apprehended for driving an unregistered vehicle', action: 'brake' },
    ],
    correctAction: 'stop',
    points: POINTS,
    penaltyMessage:
      'A plate has to be entirely visible and always legible. Anything fitted over it that impedes its visibility or reflectivity in any way is a violation of its own; readable up close is not the test.',
    rewardMessage: 'Right. The cover comes off and is confiscated, and there is a fine for it.',
    duration: 220,
    lawCitation:
      'RO105: "The number plates must be kept clean and cared for, and firmly affixed to the motor vehicle in such a manner as will make it entirely visible and always legible." JAO 2014-01, as printed in FDM Vol. 2: improper attachment of license plates includes "any accessory or device to and/or around the authorized motor vehicle license plate, or any manner of attachment that impedes in any way the visibility or reflectivity" of it, Php 5,000, with "the unauthorized plate, accessory and/or device removed and confiscated in favor of the government."',
    competency: 'document_awareness',
    severity: SEVERITY,
    inspection: {
      officerLine: 'Magandang araw po. Pakita po ng lisensya at OR/CR.',
      documentType: 'Roadside Check — Plates',
      holder: 'LIM, TERESA G.',
      fields: [
        { label: 'Papers', value: 'License, OR and CR presented' },
        { label: 'Registration', value: 'Current' },
        { label: 'Rear plate', value: 'Behind a tinted plastic cover' },
      ],
      vehicle: 'Private passenger car — plate NBQ 3018',
      tripPurpose: 'Private trip',
    },
  },
];

// 3. Flagged down - the module's apprehension, as the sources give it to the
// driver: conduct (FDM Vol. 1's law enforcement officer), rights (FDM Vol. 1,
// RO101), and no negotiating. The one thing the two rights lists disagree on,
// stepping down when told to, is asked nowhere.
const flaggedDownSlot: SlotVariant[] = [
  {
    id: 'level12.flagged-down.at-the-window',
    label: 'Flagged down',
    type: 'scenario_trigger',
    description: 'An enforcer at the curb ahead flags you down.',
    question: 'You have pulled over and the enforcer is walking up to your window. What do you do?',
    choices: [
      { label: 'Step out and walk back to meet the enforcer', action: 'accelerate' },
      { label: 'Have the fine ready, to settle it here', action: 'brake' },
      { label: 'Stay seated, hands where they can be seen, license and registration ready', action: 'stop' },
    ],
    correctAction: 'stop',
    points: POINTS,
    penaltyMessage:
      "Stay in the driver's seat and do not get out unless you are asked or directed. Keep your hands visible and your license and registration ready. A violation is never settled with the enforcer at the roadside: a complaint or contest goes to the proper adjudication office.",
    rewardMessage: "Right. Seated, hands visible, papers ready, and following the officer's instructions.",
    duration: 220,
    lawCitation:
      'FDM Vol. 1, law enforcement officer: "If stopped by an enforcer, safely pull over to the extreme right. Stay in the driver\'s seat. Do not get out of the vehicle unless asked or directed. Keep your hands visible. Sit calmly and follow the officer\'s instructions. Be ready to present your driver\'s license and motor vehicle registration." FDM Vol. 1 reviewer: "it is improper for any driver or any traffic enforcer to negotiate a violation. Any complaint/contest may be done at the proper adjudication office." RO101 lists the right not to step down from the vehicle.',
    competency: 'general_rules',
    severity: SEVERITY,
    inspection: {
      officerLine: 'Magandang araw po. Pakihinto lang po muna rito.',
      documentType: 'Traffic Stop',
      holder: 'REYES, MARCO D.',
      fields: [
        { label: 'Officer', value: 'Walking up to your window' },
        { label: 'Reason for the stop', value: 'Not yet stated' },
      ],
      vehicle: 'Private passenger car — plate NDA 4325',
      tripPurpose: 'Private trip',
      pullOver: TRAFFIC_STOP,
    },
  },
  {
    id: 'level12.flagged-down.no-violation',
    label: 'Flagged down',
    type: 'scenario_trigger',
    description: 'An enforcer at the curb ahead flags you down. As far as you know, you have broken no rule.',
    question: 'You are sure you did nothing wrong. What do you do?',
    choices: [
      { label: 'Stay stopped and politely ask why you were stopped', action: 'stop' },
      { label: 'Drive on: without a violation, the stop does not apply to you', action: 'accelerate' },
      { label: 'Hold your license back until the violation is proved', action: 'brake' },
    ],
    correctAction: 'stop',
    points: POINTS,
    penaltyMessage:
      "Believing you did nothing wrong does not end the stop. Stay at the roadside and politely ask the reason: the exact alleged violation, and the officer's name and agency, are yours to know. Your license is shown on demand, and a disagreement is contested afterwards at the proper office.",
    rewardMessage: 'Right. Stopped, and asking the reason: the exact violation, and who is apprehending you, are yours to know.',
    duration: 220,
    lawCitation:
      'FDM Vol. 1 reviewer, stopped by an enforcer when you believe you did not violate any rule: "Stop at the roadside and politely ask the reason why you were being stopped." FDM Vol. 1: during an apprehension a driver has the right to know the complete name and agency of the apprehending officer and the exact alleged traffic violation, and to contest within a prescribed period. RO105: the license "shall be shown and/or surrendered for cause and upon demand to any person with authority under this RA 4136 to confiscate the same."',
    competency: 'general_rules',
    severity: SEVERITY,
    inspection: {
      officerLine: 'Magandang araw po. Pakitabi po muna.',
      documentType: 'Traffic Stop',
      holder: 'SANTOS, ANA P.',
      fields: [
        { label: 'Officer', value: 'At your window' },
        { label: 'Reason for the stop', value: 'Not yet stated' },
        { label: 'As far as you know', value: 'No rule broken' },
      ],
      vehicle: 'Private passenger car — plate NCA 7215',
      tripPurpose: 'Private trip',
      pullOver: TRAFFIC_STOP,
    },
  },
  {
    id: 'level12.flagged-down.contest',
    label: 'Flagged down',
    type: 'scenario_trigger',
    description:
      'An LTO-deputized enforcer at the curb ahead flags you down and apprehends you for a violation you are sure you did not commit.',
    question: 'You think the apprehension is wrong. How do you dispute it?',
    choices: [
      { label: 'Argue it out with the enforcer before you drive off', action: 'accelerate' },
      { label: 'Contest it in writing at the proper office, within five days', action: 'stop' },
      { label: 'Leave it: an apprehension nobody pays for lapses', action: 'brake' },
    ],
    correctAction: 'stop',
    points: POINTS,
    penaltyMessage:
      'An apprehension is deemed admitted unless it is contested in writing within five days, and the roadside is not where it is settled. Left unpaid for fifteen days, it suspends the license for thirty, on top of the fine.',
    rewardMessage: 'Right. A written contest within five days; the LTO resolves it within five days of receiving it.',
    duration: 220,
    lawCitation:
      'JAO 2014-01, as printed in FDM Vol. 2: "All apprehensions are deemed admitted unless contested by filling a written contest within five (5) days from date of apprehension. … The LTO shall resolve a contested case within five (5) days from receipt of said written contest." FDM Vol. 1 reviewer: "it is improper for any driver or any traffic enforcer to negotiate a violation. Any complaint/contest may be done at the proper adjudication office."',
    competency: 'general_rules',
    severity: SEVERITY,
    inspection: {
      officerLine: "Heto po ang inyong Temporary Operator's Permit.",
      documentType: "Temporary Operator's Permit",
      holder: 'DIAZ, ROMEO C.',
      fields: [
        { label: 'Issued by', value: 'LTO-deputized enforcer' },
        { label: 'Violation', value: 'Disregarding traffic signs' },
        { label: "Driver's statement", value: 'Denies the violation' },
      ],
      vehicle: 'Private passenger car — plate NCA 7296',
      tripPurpose: 'Private trip',
      pullOver: TRAFFIC_STOP,
    },
  },
];

// 5. Ticket issued - the TOP and the license record. What the TOP lets you do and what an unpaid one costs are FDM Vol. 2's
// and RO105's; the renewal is FDM Vol. 1's demerit table, asked by total and
// never by what a violation's category is.
const ticketIssuedSlot: SlotVariant[] = [
  {
    id: 'level12.ticket-issued.top-in-hand',
    label: 'Ticket issued',
    type: 'scenario_trigger',
    description:
      "An LTO-deputized enforcer at the curb ahead flags you down, apprehends you, keeps your license and hands you a Temporary Operator's Permit.",
    question: 'May you keep driving?',
    choices: [
      { label: 'No-Go — not until the fine has been paid', action: 'stop' },
      { label: 'Go — the TOP covers you until the case is settled', action: 'brake' },
      { label: 'Go — the TOP is your license for 72 hours', action: 'accelerate' },
    ],
    correctAction: 'accelerate',
    points: POINTS,
    penaltyMessage:
      'The TOP is three things at once: the receipt for your confiscated license, a notice and summons, and a temporary license. It serves as a permit to drive for 72 hours only, not until the case is settled.',
    rewardMessage: 'Right. You drive on the TOP, for 72 hours.',
    duration: 220,
    lawCitation:
      'JAO 2014-01, as printed in FDM Vol. 2: the TOP "Serves as a permit to operate a motor vehicle for a period of seventy-two (72) hours only." RO105: issued by LTO-deputized enforcers, it serves as "Receipt for driver\'s license confiscated; Notice and Summon; Temporary driver\'s license (for 72 hrs. only)". Only LTO-deputized traffic enforcers may confiscate a license.',
    competency: 'driver_legality',
    severity: SEVERITY,
    inspection: {
      officerLine: "Kukunin ko po muna ang lisensya ninyo. Heto po ang inyong Temporary Operator's Permit.",
      documentType: "Temporary Operator's Permit",
      holder: 'LIM, TERESA G.',
      fields: [
        { label: 'Issued by', value: 'LTO-deputized enforcer' },
        { label: "Driver's license", value: 'Confiscated' },
        { label: 'Issued', value: '20 July 2026, 08:40' },
      ],
      vehicle: 'Private passenger car — plate NBQ 3018',
      tripPurpose: 'Private trip',
      pullOver: TRAFFIC_STOP,
    },
  },
  {
    id: 'level12.ticket-issued.fifteen-days',
    label: 'Ticket issued',
    type: 'scenario_trigger',
    description:
      "An LTO-deputized enforcer at the curb ahead flags you down, apprehends you and hands you a Temporary Operator's Permit. You do not dispute the violation.",
    question: 'What happens if the fine is not paid within fifteen days?',
    choices: [
      { label: 'The license is suspended for thirty days, and the fine is still owed', action: 'stop' },
      { label: 'Nothing, until the license comes up for renewal', action: 'accelerate' },
      { label: 'The license is revoked', action: 'brake' },
    ],
    correctAction: 'stop',
    points: POINTS,
    penaltyMessage:
      'Fifteen days from the apprehension is the deadline to pay. Miss it, and the license is suspended automatically for thirty days from the date of apprehension, in addition to the fine.',
    rewardMessage: 'Right. Pay within fifteen days, or lose the license for thirty days and still owe the fine.',
    duration: 220,
    lawCitation:
      'JAO 2014-01, as printed in FDM Vol. 2: "Failure of the driver to pay the corresponding penalty within fifteen (15) days from the date of apprehension shall cause automatic suspension of his driver\'s license for a period of thirty (30) days from the date of apprehension, in addition to the fines and penalties prescribed hereunder." RO105: "5 days to contest, 15 days to settle; otherwise, 30 days suspension of driver\'s license will be meted".',
    competency: 'driver_legality',
    severity: SEVERITY,
    inspection: {
      officerLine: "Heto po ang inyong Temporary Operator's Permit.",
      documentType: "Temporary Operator's Permit",
      holder: 'REYES, MARCO D.',
      fields: [
        { label: 'Issued by', value: 'LTO-deputized enforcer' },
        { label: 'Violation', value: 'Admitted' },
        { label: 'Issued', value: '20 July 2026, 08:40' },
      ],
      vehicle: 'Private passenger car — plate NDA 4325',
      tripPurpose: 'Private trip',
      pullOver: TRAFFIC_STOP,
    },
  },
  {
    id: 'level12.ticket-issued.demerits-at-renewal',
    label: 'Ticket issued',
    type: 'scenario_trigger',
    description:
      "An LTO-deputized enforcer at the curb ahead flags you down, apprehends you and reads out your license record: six demerit points this license period, counting today's. The license is due for renewal next month.",
    question: 'What will the renewal ask of you first?',
    choices: [
      { label: 'The Driving Enhancement Program and a theoretical exam', action: 'brake' },
      { label: 'Nothing: demerit points only count from forty', action: 'accelerate' },
      { label: 'The Driving Enhancement Program', action: 'stop' },
    ],
    correctAction: 'stop',
    points: POINTS,
    penaltyMessage:
      "Five to nine demerit points at renewal means the Driving Enhancement Program, or an accredited service provider's course, first. The theoretical exam is added from ten points, and forty revokes the license for at least two years.",
    rewardMessage:
      'Right. With five to nine points, the renewal waits on the Driving Enhancement Program. The points go back to zero once the license is renewed.',
    duration: 220,
    lawCitation:
      'FDM Vol. 1, accumulated violation points: "5 -- 9 demerit points -- applicants for renewal of DL — Driving Enhancement Program (DEP) or accredited service provider"; "10 or more demerit points — DEP plus Theoretical Exam"; "at least forty (40) demerit points — Revoked for at least two (2) years". Demerit points accumulate during the validity of the license "and will revert to zero (0) after renewal."',
    competency: 'driver_legality',
    severity: SEVERITY,
    inspection: {
      officerLine: 'Heto po ang record ng lisensya ninyo.',
      documentType: "Driver's License Record",
      holder: 'SANTOS, ANA P.',
      fields: [
        { label: 'License', value: 'Non-Professional' },
        { label: 'Demerit points this period', value: "6, counting today's" },
        { label: 'Renewal', value: 'Due next month' },
      ],
      vehicle: 'Private passenger car — plate NCA 7215',
      tripPurpose: 'Private trip',
      pullOver: TRAFFIC_STOP,
    },
  },
];

// 8. Emergency - curriculum ingredient "emergency event". A frozen prompt is
// never portable (`isPortableRemediation`), so both are written here, on this
// level's town road rather than Level 9's descent. The skid and the brake loss
// are the two failures Level 9's module teaches that a prompt can ask.
const emergencySlot: SlotVariant[] = [
  {
    id: 'level12.final-wet-road-skid',
    label: 'Wet road',
    type: 'scenario_trigger',
    scene: 'wet',
    cutscene: true,
    emergency: 'skid',
    description:
      'Rain has been falling on a road that has not seen any for weeks. Coming off the last junction the back of the car steps out and the curb starts sliding across the windscreen.',
    question: 'The rear of the vehicle has broken traction and is sliding. What do you do?',
    choices: [
      { label: 'Off the pedals, and steer gently toward where you want to go', action: 'turn_left' },
      { label: 'Brake hard and hold the wheel straight until it grips again', action: 'stop' },
      { label: 'Accelerate to pull the car straight out of the slide', action: 'accelerate' },
    ],
    correctAction: 'turn_left',
    points: POINTS,
    penaltyMessage:
      'In a skid the brake is the pedal to leave alone if you can, and the accelerator is the other one to come off. Take your feet off both, look where you want to go and steer gently there, then straighten the wheels as the car comes back under control.',
    rewardMessage: 'Right. Off the pedals, eyes and wheel on where you wanted to go, then straight again as it gripped.',
    duration: 220,
    lawCitation:
      'FDM Vol. 1, skidding: "1. Do not use your brake, if possible. 2. Take off your foot on the gas pedal. 3. Identify your escape route and slightly turn the wheel in the direction you want to go. 4. Then, straighten the wheels to bring the vehicle under control." RO101, skid and traction loss: look and steer where you want to go, release the brake or accelerator to maintain rolling traction, and never take your hands off the steering wheel.',
    competency: 'hazard_awareness',
    severity: SEVERITY,
  },
  {
    // Answered as `stop`, and the wrong answers as other acts: `brake` would be
    // satisfied by a `stop` distractor (`actionSatisfies`), as Level 9 found.
    id: 'level12.soft-pedal',
    label: 'Soft pedal',
    type: 'scenario_trigger',
    cutscene: true,
    emergency: 'brake_loss',
    description:
      'You press the brake and the pedal goes soft, then sinks toward the floor. The car barely slows.',
    question: 'The brakes have failed. What do you do?',
    choices: [
      { label: 'Switch the engine off so the car stops', action: 'brake' },
      { label: 'Off the accelerator, shift down, and slow it with the parking brake', action: 'stop' },
      { label: 'Hold your speed and steer through until the road clears', action: 'accelerate' },
    ],
    correctAction: 'stop',
    points: POINTS,
    penaltyMessage:
      'The engine stays on: the loss-of-brake drill says so in as many words, and holding your speed only uses up road. Release the accelerator, shift down, and slow the car on the parking brake, its release lever held open.',
    rewardMessage: 'Right. Off the accelerator, a lower gear, and the parking brake doing the stopping.',
    duration: 220,
    lawCitation:
      'RO101, loss of brake: "Aim to the target or escape area. Release the accelerator. Control steering. Downshift. Do not switch off the engine. If possible, use parking brake, keep the release lever open and use it as a brake. Use soft crash area if necessary." FDM Vol. 1, emergency braking: pump the brake pedal to build pressure (but not on a car with anti-lock brakes), shift to a lower gear, sound the horn and flash the lights if you cannot slow down, and use the parking brake sporadically.',
    competency: 'hazard_awareness',
    severity: SEVERITY,
  },
];

export const SLOT_DISTANCES = [600, 1300, 2000, 2700, 3400, 4100, 4800, 5500];

export const SLOTS: SlotVariant[][] = [
  roadsideCheckSlot,
  // 2. Signs - Level 3's catalogue.
  borrowed('road_signs'),
  flaggedDownSlot,
  // 4. Right-of-way - Levels 2 and 5: junctions, crossings, emergency
  // vehicles and yellow boxes, each with its mirrored case where priority is
  // yours.
  borrowed('right_of_way'),
  ticketIssuedSlot,
  // 6. Hazard response - the road hazards of Levels 7 to 11.
  borrowed('hazard_awareness'),
  // 7. Violation risk - the lesson's "unsafe overtake": every portable lane
  // rule whose line may not be crossed even briefly (`requiredLane.strict`),
  // which is Level 4's barrier lines and Level 6's double yellow.
  borrowed('lane_discipline', variant => variant.requiredLane?.strict === true),
  emergencySlot,
];

/** Fixed parts of the drive. Eight slots at `POINTS` make every roll worth 200. */
const level12Base = {
  id: 12,
  name: levelModule.title,
  moduleId: levelModule.id,
  description: levelModule.desc,
  // Eight events 700 apart, with 700 of road behind the last.
  roadLength: 6200,
  speedLimit: 60,
  // 70%, 83% and 95% of 200: the marks Levels 2-11 set on their own totals.
  requiredScore: 140,
  stars2: 166,
  stars3: 190,
  /**
   * An ordinary two-way street, and this is load-bearing for the borrowed half
   * of the route rather than decoration.
   *
   * A lane requirement is stored as a *role* (`inner`, `curb`) and resolved
   * against the host level's `oncomingLanes` at grading time - so a rule that
   * asks for the lane nearest the centre line means lane 2 on a two-way road
   * and lane 0 on a one-way one. Every lane-dependent variant this level can
   * borrow comes from a level that declares `oncomingLanes: 2`, and matching it
   * is what makes a borrowed scenario grade here the way it graded where it was
   * written. `scenarioData.test.ts` guards the assumption.
   *
   * Broken yellow wherever the roll puts nothing else. Its spans are the lines
   * the rolled scenarios declare, added per attempt in `assemble`.
   */
  paint: {
    oncomingLanes: 2,
    base: 'broken_yellow',
  },
} as const;

/**
 * Assembles a rolled route into a playable level, paint and all.
 *
 * The violation-risk slot grades a line that may not be crossed, and which
 * line depends on the roll; the hazard slot can roll a truck refused over a
 * double yellow. Each brings its line as a declaration (`declaredLine`), as
 * Level 4's markings do on their own level, and the road carries it over every
 * frame the scenario is graded. A road left broken yellow there showed a
 * driver a line that permits the pass and then failed them for making it.
 *
 * Exported for the dev tools that stage events by hand, so a staged exam is
 * painted the way a roll of it would be.
 */
export const assembleLevel12 = (events: ScenarioEvent[]): LevelConfig => ({
  ...level12Base,
  events,
  paint: { ...level12Base.paint, spans: declaredLineSpans(events) },
});

/**
 * A fresh roll of the final exam: one variant per slot, drawn from `rng` and
 * nothing else, so every learner sits the same exam for the same seed.
 */
export const createLevel12 = (rng: () => number = Math.random): LevelConfig =>
  assembleLevel12(buildEvents(SLOTS, SLOT_DISTANCES, pool => pool[Math.floor(rng() * pool.length)]));

export const level12: LevelConfig = assembleLevel12(buildEvents(SLOTS, SLOT_DISTANCES, pool => pool[0]));

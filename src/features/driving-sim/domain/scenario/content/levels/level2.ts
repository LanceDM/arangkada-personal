import { getLevelModule } from '@/features/driving-sim/domain/scenario/content/lessons/lessonCatalog';
import { buildEvents, pickWeighted, type SlotVariant } from '@/features/driving-sim/domain/scenario/pooling';
import type { DrivingCompetency } from '@/domain/learner/competency';
import type { SignCoverage } from '@/features/driving-sim/domain/adaptive/signCoverage';
import type { GarageHotspot, LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';

const levelModule = getLevelModule(2);

// ── Garage hotspots ─────────────────────────────
// Each hotspot's position on the garage minimap (id/label/area/x/y/detail)
// stays fixed - only the inspection content (what's found, the correct call)
// is pooled, so the same eight points on the vehicle stay in the same place
// every attempt while what you find there varies.
type HotspotShell = Pick<GarageHotspot, 'id' | 'label' | 'area' | 'x' | 'y' | 'detail'>;
type HotspotContent = Omit<GarageHotspot, 'id' | 'label' | 'area' | 'x' | 'y' | 'detail'>;

const documentsShell: HotspotShell = { id: 'documents', label: 'Glove Box — Vehicle Documents', area: 'Documents', x: 0.6, y: 0.36 };
const documentsPool: HotspotContent[] = [
  {
    observation:
      'The OR and CR are both in the glove box, and the insurance Certificate of Cover is still within its validity period.',
    question: 'The vehicle paperwork is laid out in front of you. Is this vehicle legally documented for the trip?',
    choices: [
      { label: 'No-Go — a photocopy of the CR is never acceptable', action: 'stop' },
      { label: 'Go — OR, CR, and COC are all present and valid', action: 'accelerate' },
      { label: 'No-Go — an MVIR must be carried on every trip', action: 'brake' },
    ],
    correctAction: 'accelerate',
    points: 20,
    penaltyMessage: 'The paperwork was complete. Refusing a properly documented trip is also a wrong call.',
    rewardMessage: 'Correct. OR, CR, and COC are present and valid.',
    lawCitation:
      'A photocopy or the original Certificate of Registration must be preserved and carried in the vehicle by the owner or driver.',
    competency: 'document_awareness',
    severity: 'minor',
    document: {
      officerLine: 'Check the vehicle records before anything else.',
      documentType: 'Vehicle Registration Records',
      holder: 'ABC 1435 — Toyota Vios',
      fields: [
        { label: 'CR', value: 'Present, original' },
        { label: 'OR', value: 'Present, paid' },
        { label: 'COC (Insurance)', value: 'Valid until 2027-02-11' },
        { label: 'CEC', value: 'On file' },
        { label: 'RFID', value: 'Affixed, readable' },
      ],
      vehicle: 'Private passenger car — category M1',
      tripPurpose: 'Private family trip',
    },
  },
  {
    observation:
      'The glove box has no CR at all, not even a photocopy, though the OR is present and the insurance COC is valid.',
    question: 'The vehicle paperwork is laid out in front of you. Is this vehicle legally documented for the trip?',
    choices: [
      { label: 'Go — the OR alone is enough to prove registration', action: 'accelerate' },
      { label: 'No-Go — at least a photocopy of the CR must be carried', action: 'stop' },
      { label: 'Go — the COC alone proves the vehicle is registered', action: 'honk' },
    ],
    correctAction: 'stop',
    points: 20,
    penaltyMessage: 'Without at least a photocopy of the CR on board, the vehicle documentation is incomplete.',
    rewardMessage: 'Correct no-go. A photocopy or the original CR must be preserved and carried in the vehicle.',
    lawCitation:
      'A photocopy or the original Certificate of Registration must be preserved and carried in the vehicle by the owner or driver.',
    competency: 'document_awareness',
    severity: 'minor',
    document: {
      officerLine: 'Check the vehicle records before anything else.',
      documentType: 'Vehicle Registration Records',
      holder: 'XYZ 8821 — Honda Civic',
      fields: [
        { label: 'CR', value: 'Not present, not even a copy' },
        { label: 'OR', value: 'Present, paid' },
        { label: 'COC (Insurance)', value: 'Valid until 2027-08-19' },
        { label: 'CEC', value: 'On file' },
        { label: 'RFID', value: 'Affixed, readable' },
      ],
      vehicle: 'Private passenger car — category M1',
      tripPurpose: 'Private family trip',
    },
  },
  {
    observation:
      'The OR and CR are both present, but the insurance Certificate of Cover expired two weeks ago.',
    question: 'The vehicle paperwork is laid out in front of you. Is this vehicle legally documented for the trip?',
    choices: [
      { label: 'Go — an insurance grace period covers this automatically', action: 'accelerate' },
      { label: 'No-Go — an expired Certificate of Cover leaves the vehicle uninsured', action: 'stop' },
      { label: 'Go — insurance only matters after an accident happens', action: 'honk' },
    ],
    correctAction: 'stop',
    points: 20,
    penaltyMessage: 'Driving with an expired Certificate of Cover leaves the vehicle without required insurance coverage.',
    rewardMessage: 'Correct no-go. Insurance coverage must be valid and unexpired before the trip.',
    lawCitation:
      'Comprehensive or CTPL insurance coverage must be valid and unexpired for the vehicle to be legally used on the road.',
    competency: 'document_awareness',
    severity: 'minor',
    document: {
      officerLine: 'Check the vehicle records before anything else.',
      documentType: 'Vehicle Registration Records',
      holder: 'JKL 2290 — Mitsubishi Mirage',
      fields: [
        { label: 'CR', value: 'Present, original' },
        { label: 'OR', value: 'Present, paid' },
        { label: 'COC (Insurance)', value: 'Expired 2026-04-15' },
        { label: 'CEC', value: 'On file' },
        { label: 'RFID', value: 'Affixed, readable' },
      ],
      vehicle: 'Private passenger car — category M1',
      tripPurpose: 'Private family trip',
    },
  },
  {
    observation:
      'The OR is present and paid, the insurance COC is valid, and a clearly preserved photocopy of the CR is in the glove box — the original is kept at home.',
    question: 'The vehicle paperwork is laid out in front of you. Is this vehicle legally documented for the trip?',
    choices: [
      { label: 'No-Go — only the original CR is ever acceptable', action: 'stop' },
      { label: 'Go — a preserved photocopy of the CR is acceptable alongside the OR and valid COC', action: 'accelerate' },
      { label: 'No-Go — the original must always be physically in the vehicle', action: 'brake' },
    ],
    correctAction: 'accelerate',
    points: 20,
    penaltyMessage: 'A preserved photocopy of the CR was on board and everything else checked out. Refusing a documented trip is also a wrong call.',
    rewardMessage: 'Correct. A photocopy or the original CR must be preserved and carried, and this one was.',
    lawCitation:
      'A photocopy or the original Certificate of Registration must be preserved and carried in the vehicle by the owner or driver.',
    competency: 'document_awareness',
    severity: 'minor',
    document: {
      officerLine: 'Check the vehicle records before anything else.',
      documentType: 'Vehicle Registration Records',
      holder: 'MNO 7734 — Suzuki Ertiga',
      fields: [
        { label: 'CR', value: 'Present, photocopy (original kept at home)' },
        { label: 'OR', value: 'Present, paid' },
        { label: 'COC (Insurance)', value: 'Valid until 2027-01-30' },
        { label: 'CEC', value: 'On file' },
        { label: 'RFID', value: 'Affixed, readable' },
      ],
      vehicle: 'Private passenger car — category M1',
      tripPurpose: 'Private family trip',
    },
  },
];

const plateShell: HotspotShell = { id: 'plate', label: 'Rear Plate & RFID', area: 'Registration', x: 0.5, y: 0.86, detail: 'plate' };
const platePool: HotspotContent[] = [
  {
    observation:
      'The plate reads ABC 1435. It is clean, firmly attached, and fully legible, and the RFID sticker is intact. Today is the 20th of May.',
    question:
      'Work out this plate’s registration deadline. Today is 20 May. Is the registration still within schedule?',
    choices: [
      { label: 'Go — digit 3 means the 3rd week, so there is still time', action: 'accelerate' },
      { label: 'Go — last digit 5 means the deadline is not until the 5th month next year', action: 'brake' },
      { label: 'No-Go — last digit 5 means May, and digit 3 means the 1st week; the deadline has passed', action: 'stop' },
    ],
    correctAction: 'stop',
    points: 25,
    penaltyMessage:
      'Misreading the staggered schedule leaves the vehicle unregistered on the road. Last digit sets the month, second-to-last sets the week.',
    rewardMessage:
      'Correct. Last digit 5 is May, second-to-last digit 3 is the 1st week, so the 20th is already past due.',
    lawCitation:
      'The last digit of the plate sets the registration month and the second-to-last digit sets the weekly deadline; digits 1 to 3 fall on the 1st week.',
    competency: 'document_awareness',
    severity: 'major',
  },
  {
    observation:
      'The plate reads XYZ 8829. It is clean, firmly attached, and fully legible, and the RFID sticker is intact. Today is the 20th of May.',
    question:
      'Work out this plate’s registration deadline. Today is 20 May. Is the registration still within schedule?',
    choices: [
      { label: 'Go — last digit 9 means the deadline is September, still months away', action: 'accelerate' },
      { label: 'No-Go — any plate ending in an odd number is already overdue by May', action: 'stop' },
      { label: 'Go — an intact RFID sticker means registration never needs checking', action: 'honk' },
    ],
    correctAction: 'accelerate',
    points: 25,
    penaltyMessage:
      'The registration deadline was still months away. Refusing a properly-scheduled vehicle is also a wrong call.',
    rewardMessage:
      'Correct. Last digit 9 means the deadline is September - this plate is still within schedule.',
    lawCitation:
      'The last digit of the plate sets the registration month and the second-to-last digit sets the weekly deadline; digits 1 to 3 fall on the 1st week.',
    competency: 'document_awareness',
    severity: 'major',
  },
  {
    observation:
      'The plate reads DEF 4471. It is clean, firmly attached, and fully legible, and the RFID sticker is intact. The OR in the glove box shows the last renewal was in January of last year. Today is the 20th of May.',
    question:
      'Work out this plate’s registration deadline. Today is 20 May. Is the registration still within schedule?',
    choices: [
      { label: 'Go — last digit 1 means January, and January is already past, so nothing is due', action: 'accelerate' },
      { label: 'No-Go — last digit 1 means January, so this plate is already overdue', action: 'stop' },
      { label: 'Go — the RFID sticker being intact means the plate is current', action: 'honk' },
    ],
    correctAction: 'stop',
    points: 25,
    penaltyMessage:
      'Misreading the staggered schedule leaves the vehicle unregistered on the road. Last digit sets the month, second-to-last sets the week.',
    rewardMessage:
      'Correct. Last digit 1 is January, and the OR shows January this year was missed, so the plate is already overdue.',
    lawCitation:
      'The last digit of the plate sets the registration month and the second-to-last digit sets the weekly deadline; digits 1 to 3 fall on the 1st week.',
    competency: 'document_awareness',
    severity: 'major',
  },
  {
    observation:
      'The plate reads GHK 5508. It is clean, firmly attached, and fully legible, and the RFID sticker is intact. Today is the 20th of May.',
    question:
      'Work out this plate’s registration deadline. Today is 20 May. Is the registration still within schedule?',
    choices: [
      { label: 'Go — last digit 8 means August, still months away', action: 'accelerate' },
      { label: 'No-Go — any plate ending in an even number is overdue by May', action: 'stop' },
      { label: 'Go — the plate looking clean means it was recently renewed', action: 'honk' },
    ],
    correctAction: 'accelerate',
    points: 25,
    penaltyMessage:
      'The registration deadline was still months away. Refusing a properly-scheduled vehicle is also a wrong call.',
    rewardMessage:
      'Correct. Last digit 8 means the deadline is August — this plate is still within schedule.',
    lawCitation:
      'The last digit of the plate sets the registration month and the second-to-last digit sets the weekly deadline; digits 1 to 3 fall on the 1st week.',
    competency: 'document_awareness',
    severity: 'major',
  },
];

const tiresShell: HotspotShell = { id: 'tires', label: 'Front Left Tire', area: 'BLOWBAGETS — T (Tires)', x: 0.25, y: 0.24, detail: 'tire' };
const tiresPool: HotspotContent[] = [
  {
    observation:
      'The front left tire is visibly soft, the sidewall has fine cracks running along it, and the tread is worn unevenly.',
    question: 'You have finished checking this tire. What is the correct decision?',
    choices: [
      { label: 'No-Go — do not drive until the tire is repaired or replaced', action: 'stop' },
      { label: 'Go — drive slowly to the nearest vulcanising shop', action: 'brake' },
      { label: 'Go — the spare can be fitted later if it gets worse', action: 'accelerate' },
    ],
    correctAction: 'stop',
    points: 20,
    penaltyMessage: 'Driving on a flat, cracked, or underinflated tire risks a blowout at speed.',
    rewardMessage: 'Correct no-go decision. The tire is fixed before the trip starts.',
    lawCitation: 'A driver must not operate a vehicle with a tire that is flat, cracked, badly worn, or underinflated.',
    competency: 'hazard_awareness',
    severity: 'major',
  },
  {
    observation:
      'The front left tire is firm, the sidewall is smooth with no cracks, and the tread is even and well within legal depth.',
    question: 'You have finished checking this tire. What is the correct decision?',
    choices: [
      { label: 'Go — the tire is in good condition', action: 'accelerate' },
      { label: 'No-Go — tires should be replaced every six months regardless of condition', action: 'stop' },
      { label: 'Go — but only after topping up the pressure first', action: 'brake' },
    ],
    correctAction: 'accelerate',
    points: 20,
    penaltyMessage: 'The tire was in good condition. Delaying a trip over a healthy tire is also a wrong call.',
    rewardMessage: 'Correct go decision. The tire is firm, uncracked, and evenly worn.',
    lawCitation: 'A driver must not operate a vehicle with a tire that is flat, cracked, badly worn, or underinflated.',
    competency: 'hazard_awareness',
    severity: 'major',
  },
  {
    observation:
      'The front left tire looks visually fine, but pressing on the sidewall shows it is noticeably underinflated, well below the recommended pressure.',
    question: 'You have finished checking this tire. What is the correct decision?',
    choices: [
      { label: 'No-Go — an underinflated tire must be corrected before the trip', action: 'stop' },
      { label: 'Go — a slightly soft tire firms up once driving', action: 'accelerate' },
      { label: 'Go — underinflation only matters on long highway trips', action: 'brake' },
    ],
    correctAction: 'stop',
    points: 20,
    penaltyMessage: 'Driving on a flat, cracked, or underinflated tire risks a blowout at speed.',
    rewardMessage: 'Correct no-go decision. The tire is corrected before the trip starts.',
    lawCitation: 'A driver must not operate a vehicle with a tire that is flat, cracked, badly worn, or underinflated.',
    competency: 'hazard_awareness',
    severity: 'major',
  },
  {
    observation:
      'The front left tire is brand new, with full tread depth, correct pressure, and no visible defects.',
    question: 'You have finished checking this tire. What is the correct decision?',
    choices: [
      { label: 'Go — the tire is in good condition', action: 'accelerate' },
      { label: 'No-Go — a new tire needs a break-in period before any trip', action: 'stop' },
      { label: 'Go — but only at reduced speed for the first day', action: 'brake' },
    ],
    correctAction: 'accelerate',
    points: 20,
    penaltyMessage: 'The tire was in good condition. Delaying a trip over a healthy tire is also a wrong call.',
    rewardMessage: 'Correct go decision. Full tread, correct pressure, no defects.',
    lawCitation: 'A driver must not operate a vehicle with a tire that is flat, cracked, badly worn, or underinflated.',
    competency: 'hazard_awareness',
    severity: 'major',
  },
];

const brakesShell: HotspotShell = { id: 'brakes', label: 'Brake Pedal & Lines', area: 'BLOWBAGETS — B (Brakes)', x: 0.4, y: 0.52, detail: 'brakes' };
const brakesPool: HotspotContent[] = [
  {
    observation:
      'The brake pedal sinks softly towards the floor, and there is a wet patch of brake fluid on the garage floor under the vehicle.',
    question: 'The brake check is complete. What is the correct decision?',
    choices: [
      { label: 'Go — brake earlier than normal to compensate', action: 'brake' },
      { label: 'No-Go — brakes are critical safety equipment and must be repaired first', action: 'stop' },
      { label: 'Go — the handbrake still works as a backup', action: 'accelerate' },
    ],
    correctAction: 'stop',
    points: 25,
    penaltyMessage: 'Critical safety violation: leaking or soft brakes must be repaired before the vehicle moves.',
    rewardMessage: 'Correct. Brakes are critical safety equipment and must be repaired first.',
    lawCitation: 'Do not drive until leaking or malfunctioning brakes are repaired.',
    competency: 'hazard_awareness',
    severity: 'critical',
  },
  {
    observation:
      'The brake pedal feels firm with normal travel, and the garage floor under the vehicle is completely dry.',
    question: 'The brake check is complete. What is the correct decision?',
    choices: [
      { label: 'Go — the brake pedal is firm and there is no sign of a leak', action: 'accelerate' },
      { label: 'No-Go — brake fluid should always be topped off before every trip', action: 'stop' },
      { label: 'Go — but only using the handbrake for the whole trip', action: 'brake' },
    ],
    correctAction: 'accelerate',
    points: 25,
    penaltyMessage: 'The brakes checked out fine. Delaying a trip over healthy brakes is also a wrong call.',
    rewardMessage: 'Correct. Firm pedal, no leak - the brakes are ready.',
    lawCitation: 'Do not drive until leaking or malfunctioning brakes are repaired.',
    competency: 'hazard_awareness',
    severity: 'critical',
  },
  {
    observation:
      'The brake pedal feels firm, but there is a metallic grinding sound when the pedal is tested, suggesting worn brake pads.',
    question: 'The brake check is complete. What is the correct decision?',
    choices: [
      { label: 'No-Go — grinding brakes indicate worn pads that must be repaired first', action: 'stop' },
      { label: 'Go — grinding is normal for an older vehicle', action: 'accelerate' },
      { label: 'Go — a firm pedal means the brakes are fine regardless of noise', action: 'brake' },
    ],
    correctAction: 'stop',
    points: 25,
    penaltyMessage: 'Critical safety violation: worn or grinding brakes must be repaired before the vehicle moves.',
    rewardMessage: 'Correct. Grinding brakes are repaired before the vehicle moves.',
    lawCitation: 'Do not drive until leaking or malfunctioning brakes are repaired.',
    competency: 'hazard_awareness',
    severity: 'critical',
  },
  {
    observation:
      'The brake pedal is firm, there is no leak, and a service sticker on the master cylinder shows the brakes were serviced last month.',
    question: 'The brake check is complete. What is the correct decision?',
    choices: [
      { label: 'Go — firm pedal, no leak, and recently serviced', action: 'accelerate' },
      { label: 'No-Go — brakes must be serviced again before every single trip', action: 'stop' },
      { label: 'Go — but only if driven under 20 km/h', action: 'brake' },
    ],
    correctAction: 'accelerate',
    points: 25,
    penaltyMessage: 'The brakes checked out fine. Delaying a trip over healthy, serviced brakes is also a wrong call.',
    rewardMessage: 'Correct. Firm pedal, no leak, recently serviced - the brakes are ready.',
    lawCitation: 'Do not drive until leaking or malfunctioning brakes are repaired.',
    competency: 'hazard_awareness',
    severity: 'critical',
  },
];

const lightsShell: HotspotShell = { id: 'lights', label: 'Headlights & Signals', area: 'BLOWBAGETS — L (Lights)', x: 0.5, y: 0.11, detail: 'lights' };
// Light, trunk, tire, brake and engine checks are all vehicle readiness and
// share one tag, hazard_awareness (catalogue review 2026-10-28): the trunk's
// EWD, spare and tools are equipment, not documents.
const lightsPool: HotspotContent[] = [
  {
    observation:
      'Headlights, tail lights, brake lights, and both signal lights all light up. The lenses are clean and the windshield is clear.',
    question: 'The lighting check is complete. What is the correct decision?',
    choices: [
      { label: 'No-Go — the high beam should be left on at all times', action: 'stop' },
      { label: 'No-Go — extra auxiliary lamps are required before any trip', action: 'brake' },
      { label: 'Go — all lights work and visibility is clear', action: 'accelerate' },
    ],
    correctAction: 'accelerate',
    points: 15,
    penaltyMessage: 'Every lamp checked out and visibility was clear; this vehicle was ready on lights.',
    rewardMessage: 'Correct. Lights and visibility are ready for the trip.',
    lawCitation: 'Check for busted bulbs, dirty lenses, and anything blocking windshield or mirror visibility.',
    competency: 'hazard_awareness',
    severity: 'minor',
  },
  {
    observation:
      'The left brake light does not come on, and the right headlight lens is cracked and noticeably dim.',
    question: 'The lighting check is complete. What is the correct decision?',
    choices: [
      { label: 'Go — one working brake light is enough', action: 'accelerate' },
      { label: 'No-Go — a busted brake light and a damaged headlight must be fixed first', action: 'stop' },
      { label: 'Go — this can be fixed after the trip', action: 'brake' },
    ],
    correctAction: 'stop',
    points: 15,
    penaltyMessage:
      'A busted brake light and a damaged headlight reduce visibility and signal clearly to other drivers - this must be fixed first.',
    rewardMessage: 'Correct no-go. Busted bulbs and a damaged lens are fixed before the trip starts.',
    lawCitation: 'Check for busted bulbs, dirty lenses, and anything blocking windshield or mirror visibility.',
    competency: 'hazard_awareness',
    severity: 'minor',
  },
  {
    observation:
      'Both left and right turn signal lights fail to blink, though the headlights and brake lights work normally.',
    question: 'The lighting check is complete. What is the correct decision?',
    choices: [
      { label: 'No-Go — non-working signal lights must be fixed before the trip', action: 'stop' },
      { label: 'Go — hand signals can fully substitute for turn signals', action: 'accelerate' },
      { label: 'Go — signal lights are optional if the road is empty', action: 'brake' },
    ],
    correctAction: 'stop',
    points: 15,
    penaltyMessage: 'Non-working turn signals leave other drivers with no warning of your intentions - this must be fixed first.',
    rewardMessage: 'Correct no-go. Non-working signal lights are fixed before the trip starts.',
    lawCitation: 'Check for busted bulbs, dirty lenses, and anything blocking windshield or mirror visibility.',
    competency: 'hazard_awareness',
    severity: 'minor',
  },
  {
    observation:
      'All lights work, and the previously cracked headlight lens has been replaced with a new clear one.',
    question: 'The lighting check is complete. What is the correct decision?',
    choices: [
      { label: 'Go — all lights work and the lens is clear', action: 'accelerate' },
      { label: 'No-Go — a replaced lens needs a week to cure before use', action: 'stop' },
      { label: 'Go — but only during the day', action: 'brake' },
    ],
    correctAction: 'accelerate',
    points: 15,
    penaltyMessage: 'Every lamp checked out and the lens was clear; this vehicle was ready on lights.',
    rewardMessage: 'Correct. Lights and visibility are ready for the trip.',
    lawCitation: 'Check for busted bulbs, dirty lenses, and anything blocking windshield or mirror visibility.',
    competency: 'hazard_awareness',
    severity: 'minor',
  },
];

const engineBayShell: HotspotShell = { id: 'engine-bay', label: 'Engine Bay — Battery, Oil, Coolant', area: 'BLOWBAGETS — B, O, W', x: 0.5, y: 0.22, detail: 'engine' };
const engineBayPool: HotspotContent[] = [
  {
    observation:
      'Engine oil sits between the minimum and maximum marks, the coolant reservoir is at the correct level with no hose leaks, and the battery is clamped down with no corrosion.',
    question: 'The engine bay check is complete. What is the correct decision?',
    choices: [
      { label: 'Go — oil, coolant, and battery are all within normal condition', action: 'accelerate' },
      { label: 'No-Go — the coolant reservoir should always be filled to the brim', action: 'stop' },
      { label: 'No-Go — engine oil must be changed before every long trip', action: 'brake' },
    ],
    correctAction: 'accelerate',
    points: 20,
    penaltyMessage: 'Oil, coolant, and battery were all within normal range. Overfilling a reservoir is itself a fault.',
    rewardMessage: 'Correct. Fluids and battery are within normal condition.',
    lawCitation: 'Check for low or excessive oil, low coolant, leaks, bad caps, loose clamps, and corrosion.',
    competency: 'hazard_awareness',
    severity: 'minor',
  },
  {
    observation:
      'Engine oil sits below the minimum mark, there is a fresh coolant stain under the radiator hose, and the battery terminals show white corrosion buildup.',
    question: 'The engine bay check is complete. What is the correct decision?',
    choices: [
      { label: 'No-Go — low oil, a coolant leak, and corroded terminals need attention first', action: 'stop' },
      { label: 'Go — oil only needs topping up after the trip', action: 'accelerate' },
      { label: 'Go — corrosion on terminals is only a cosmetic issue', action: 'honk' },
    ],
    correctAction: 'stop',
    points: 20,
    penaltyMessage: 'Low oil, a coolant leak, and corroded terminals can strand the vehicle mid-trip.',
    rewardMessage: 'Correct no-go. Low oil, a leak, and corroded terminals are fixed before the trip.',
    lawCitation: 'Check for low or excessive oil, low coolant, leaks, bad caps, loose clamps, and corrosion.',
    competency: 'hazard_awareness',
    severity: 'minor',
  },
  {
    observation:
      'Oil and coolant are at normal levels, but the fan belt looks loose and worn, with visible fraying.',
    question: 'The engine bay check is complete. What is the correct decision?',
    choices: [
      { label: 'No-Go — a loose, fraying belt should be replaced before the trip', action: 'stop' },
      { label: 'Go — a worn belt only matters on long trips', action: 'accelerate' },
      { label: 'Go — the engine will compensate for a loose belt automatically', action: 'honk' },
    ],
    correctAction: 'stop',
    points: 20,
    penaltyMessage: 'A loose, fraying belt can snap and strand the vehicle mid-trip.',
    rewardMessage: 'Correct no-go. A worn belt is replaced before the trip.',
    lawCitation: 'Check for low or excessive oil, low coolant, leaks, bad caps, loose clamps, and corrosion.',
    competency: 'hazard_awareness',
    severity: 'minor',
  },
  {
    observation:
      'Oil was just topped up to the correct level, coolant is full with no leaks, and the battery terminals are clean and tight.',
    question: 'The engine bay check is complete. What is the correct decision?',
    choices: [
      { label: 'Go — oil, coolant, and battery are all in normal condition', action: 'accelerate' },
      { label: 'No-Go — freshly topped oil needs to settle for an hour first', action: 'stop' },
      { label: 'No-Go — a battery should always be replaced yearly regardless of condition', action: 'brake' },
    ],
    correctAction: 'accelerate',
    points: 20,
    penaltyMessage: 'Oil, coolant, and battery were all within normal range. Delaying a ready trip is also a wrong call.',
    rewardMessage: 'Correct. Fluids and battery are within normal condition.',
    lawCitation: 'Check for low or excessive oil, low coolant, leaks, bad caps, loose clamps, and corrosion.',
    competency: 'hazard_awareness',
    severity: 'minor',
  },
];

const trunkShell: HotspotShell = { id: 'trunk', label: 'Trunk — EWD, Spare & Tools', area: 'BLOWBAGETS — A, T (Tools)', x: 0.5, y: 0.74, detail: 'trunk' };
const trunkPool: HotspotContent[] = [
  {
    observation:
      'There is no Early Warning Device in the trunk, the spare tire is missing, and the jack and wrench are nowhere to be found.',
    question: 'The trunk check is complete. What is the correct decision?',
    choices: [
      { label: 'Go — an EWD is only needed for provincial trips', action: 'accelerate' },
      { label: 'Go — hazard lights fully replace an Early Warning Device', action: 'brake' },
      { label: 'No-Go — the EWD, spare, and tools must be on board before the trip', action: 'stop' },
    ],
    correctAction: 'stop',
    points: 15,
    penaltyMessage: 'Without an EWD, spare, and tools, a simple breakdown becomes a roadside hazard.',
    rewardMessage: 'Correct. The EWD, spare tire, and tools are sorted before leaving.',
    lawCitation:
      'Vehicles must carry a reflectorized early warning device; the accessories and tools check also covers the spare tire, jack, and wrenches.',
    competency: 'hazard_awareness',
    severity: 'major',
  },
  {
    observation:
      'The Early Warning Device, spare tire, jack, and wrench are all present and in good condition in the trunk.',
    question: 'The trunk check is complete. What is the correct decision?',
    choices: [
      { label: 'Go — the EWD, spare, and tools are all present and in good condition', action: 'accelerate' },
      { label: 'No-Go — the EWD must be replaced every year regardless of condition', action: 'stop' },
      { label: 'Go — but only if the spare tire matches the other three exactly', action: 'brake' },
    ],
    correctAction: 'accelerate',
    points: 15,
    penaltyMessage: 'Everything required was present and in good condition. Delaying a properly-equipped trip is also a wrong call.',
    rewardMessage: 'Correct. EWD, spare tire, and tools are all accounted for.',
    lawCitation:
      'Vehicles must carry a reflectorized early warning device; the accessories and tools check also covers the spare tire, jack, and wrenches.',
    competency: 'hazard_awareness',
    severity: 'major',
  },
  {
    observation:
      'The Early Warning Device and tools are present, but the spare tire itself is completely flat.',
    question: 'The trunk check is complete. What is the correct decision?',
    choices: [
      { label: 'No-Go — a flat spare is as good as no spare at all', action: 'stop' },
      { label: 'Go — a flat spare can be pumped up on the roadside later', action: 'accelerate' },
      { label: 'Go — the EWD and tools being present is enough', action: 'honk' },
    ],
    correctAction: 'stop',
    points: 15,
    penaltyMessage: 'A flat spare cannot help with a real breakdown - this must be sorted before the trip.',
    rewardMessage: 'Correct no-go. A usable spare is sorted before leaving.',
    lawCitation:
      'Vehicles must carry a reflectorized early warning device; the accessories and tools check also covers the spare tire, jack, and wrenches.',
    competency: 'hazard_awareness',
    severity: 'major',
  },
  {
    observation:
      'The EWD, spare tire, jack, and wrench are all present, and a checklist taped inside the trunk shows they were verified last week.',
    question: 'The trunk check is complete. What is the correct decision?',
    choices: [
      { label: 'Go — everything required is present and verified', action: 'accelerate' },
      { label: 'No-Go — the checklist itself must be notarized to count', action: 'stop' },
      { label: 'Go — but only the EWD actually matters', action: 'brake' },
    ],
    correctAction: 'accelerate',
    points: 15,
    penaltyMessage: 'Everything required was present and verified. Delaying a properly-equipped trip is also a wrong call.',
    rewardMessage: 'Correct. EWD, spare tire, and tools are all accounted for.',
    lawCitation:
      'Vehicles must carry a reflectorized early warning device; the accessories and tools check also covers the spare tire, jack, and wrenches.',
    competency: 'hazard_awareness',
    severity: 'major',
  },
];

const cockpitShell: HotspotShell = { id: 'cockpit', label: "Driver's Seat — Setup & Self", area: 'BLOWBAGETS — S (Self)', x: 0.38, y: 0.42, detail: 'cockpit' };
const cockpitPool: HotspotContent[] = [
  {
    observation:
      'The manual gear lever is still in first gear, the mirrors are angled down from the last driver, and you have had almost no sleep after a night shift.',
    question: 'You are about to start the engine. What is the correct decision?',
    choices: [
      { label: 'Go — start in gear and fix the mirrors while moving', action: 'accelerate' },
      { label: 'No-Go — a drowsy driver should not start the trip at all', action: 'stop' },
      { label: 'Go — coffee on the way will handle the drowsiness', action: 'brake' },
    ],
    correctAction: 'stop',
    points: 20,
    penaltyMessage:
      'Starting in gear lurches the vehicle, and a sleepy driver is as unfit to drive as an unroadworthy car.',
    rewardMessage:
      'Correct. Neutral before starting, mirrors set, and an unfit driver does not take the wheel.',
    lawCitation:
      'For manual transmission, confirm neutral before starting. Delay the trip if the driver is sick, sleepy, distracted, or unable to focus.',
    competency: 'general_rules',
    severity: 'major',
  },
  {
    observation:
      'The gear lever is in neutral, the mirrors are already adjusted to your seating position, and you feel well-rested and alert.',
    question: 'You are about to start the engine. What is the correct decision?',
    choices: [
      { label: 'Go — neutral, mirrors set, and the driver is alert', action: 'accelerate' },
      { label: 'No-Go — mirrors must be re-checked every time regardless of position', action: 'stop' },
      { label: 'Go — but only after skipping the mirror check to save time', action: 'honk' },
    ],
    correctAction: 'accelerate',
    points: 20,
    penaltyMessage: 'Neutral, mirrors set, driver alert - this was ready to go. Delaying it is also a wrong call.',
    rewardMessage: 'Correct. Neutral gear, mirrors set, and an alert driver - ready for the trip.',
    lawCitation:
      'For manual transmission, confirm neutral before starting. Delay the trip if the driver is sick, sleepy, distracted, or unable to focus.',
    competency: 'general_rules',
    severity: 'major',
  },
  {
    observation:
      'The gear lever is in neutral and the mirrors are set, but the driver is scrolling on a phone and not paying attention to the road ahead.',
    question: 'You are about to start the engine. What is the correct decision?',
    choices: [
      { label: 'No-Go — a distracted driver should not start the trip until focused', action: 'stop' },
      { label: 'Go — checking the phone quickly before moving is fine', action: 'accelerate' },
      { label: 'Go — neutral and mirrors set is all that matters', action: 'honk' },
    ],
    correctAction: 'stop',
    points: 20,
    penaltyMessage: 'A distracted driver is as unfit to drive as an unroadworthy car.',
    rewardMessage: 'Correct. Delay the trip until the driver is actually focused.',
    lawCitation:
      'For manual transmission, confirm neutral before starting. Delay the trip if the driver is sick, sleepy, distracted, or unable to focus.',
    competency: 'general_rules',
    severity: 'major',
  },
  {
    observation:
      'The gear lever is in neutral, the mirrors are set, the driver is alert, and the seatbelt is already fastened.',
    question: 'You are about to start the engine. What is the correct decision?',
    choices: [
      { label: 'Go — neutral, mirrors set, alert, and belted in', action: 'accelerate' },
      { label: 'No-Go — the seatbelt should only be fastened after moving', action: 'stop' },
      { label: 'Go — but only if the trip is short', action: 'brake' },
    ],
    correctAction: 'accelerate',
    points: 20,
    penaltyMessage: 'Neutral, mirrors set, driver alert and belted in - this was ready to go. Delaying it is also a wrong call.',
    rewardMessage: 'Correct. Neutral gear, mirrors set, alert, and belted in - ready for the trip.',
    lawCitation:
      'For manual transmission, confirm neutral before starting. Delay the trip if the driver is sick, sleepy, distracted, or unable to focus.',
    competency: 'general_rules',
    severity: 'major',
  },
];

// Exported (rather than kept module-private) so the dev scenario harness can
// index into each hotspot's exact pool the same way it already does for
// SLOTS/SLOT_DISTANCES above.
// Two general-rules points added 2026-10-28 (DRAFT, for review), so a drive
// can give general_rules its 3 scenarios: the module's Before Starting The
// Engine table, split across the passenger side and the controls.
const beltsShell: HotspotShell = { id: 'belts', label: 'Seatbelts & Doors', area: 'Before Starting — Occupants', x: 0.62, y: 0.5, detail: 'belt' };
const beltsPool: HotspotContent[] = [
  {
    observation: 'You are belted in. Your passenger in the front seat has not fastened theirs and says the trip is only five minutes.',
    question: 'You are about to move off. What is the correct decision?',
    choices: [
      { label: 'Go — a five-minute trip does not need belts', action: 'accelerate' },
      { label: 'No-Go — advise the passenger to belt up and lock the doors first', action: 'stop' },
      { label: 'Go — only the driver has to wear a belt', action: 'brake' },
    ],
    correctAction: 'stop',
    points: 20,
    penaltyMessage: 'Belts are worn on every trip, however short, and the driver advises the passengers to wear theirs.',
    rewardMessage: 'Correct. Everyone belted and the doors locked, then you move off.',
    lawCitation: 'Level 2 module, Before Starting The Engine: "Wear the seatbelt, advise passengers to wear seatbelts, and lock all doors."',
    competency: 'general_rules',
    severity: 'major',
  },
  {
    observation: 'You and your front passenger are both belted in, and all four doors are locked.',
    question: 'You are about to move off. What is the correct decision?',
    choices: [
      { label: 'Go — belts on and doors locked', action: 'accelerate' },
      { label: 'No-Go — doors must stay unlocked while driving', action: 'stop' },
      { label: 'No-Go — passengers may not wear belts in the front', action: 'brake' },
    ],
    correctAction: 'accelerate',
    points: 20,
    penaltyMessage: 'Belts on and doors locked: this was ready to go. Delaying it is also a wrong call.',
    rewardMessage: 'Correct. Belted and locked, ready for the trip.',
    lawCitation: 'Level 2 module, Before Starting The Engine: "Wear the seatbelt, advise passengers to wear seatbelts, and lock all doors."',
    competency: 'general_rules',
    severity: 'major',
  },
];

const controlsShell: HotspotShell = { id: 'controls', label: 'Gear Lever & Seat Position', area: 'Before Starting — Controls', x: 0.38, y: 0.62, detail: 'cockpit' };
const controlsPool: HotspotContent[] = [
  {
    observation: 'The car is an automatic. The shifting lever is in Drive, and the seat is so far back you have to stretch to reach the pedals.',
    question: 'You are about to start the engine. What is the correct decision?',
    choices: [
      { label: 'Go — start it in Drive and adjust the seat at the first stop', action: 'accelerate' },
      { label: 'No-Go — lever to Park and the seat adjusted before starting', action: 'stop' },
      { label: 'Go — stretching for the pedals is fine on a short trip', action: 'brake' },
    ],
    correctAction: 'stop',
    points: 20,
    penaltyMessage: 'An automatic is started in Park, and the seat is set so the pedals and wheel can be used without leaning.',
    rewardMessage: 'Correct. Park before starting, and a seat that lets you reach everything.',
    lawCitation: 'Level 2 module, Before Starting The Engine: "Automatic transmission — make sure the shifting lever is in Park before starting." "Sit comfortably and adjust the seat so pedals and steering can be used without leaning forward or backward."',
    competency: 'general_rules',
    severity: 'major',
  },
  {
    observation: 'The car is an automatic with the lever in Park. The seat lets you reach the pedals comfortably, and you hold the wheel at 9 and 3.',
    question: 'You are about to start the engine. What is the correct decision?',
    choices: [
      { label: 'Go — Park, seat set, hands at 9 and 3', action: 'accelerate' },
      { label: 'No-Go — an automatic must be started in Neutral only', action: 'stop' },
      { label: 'No-Go — hands belong at 12 o\'clock', action: 'brake' },
    ],
    correctAction: 'accelerate',
    points: 20,
    penaltyMessage: 'Park, the seat set and a proper grip: this was ready to go. Delaying it is also a wrong call.',
    rewardMessage: 'Correct. Ready to start.',
    lawCitation: 'Level 2 module, Before Starting The Engine: lever in Park for an automatic; seat adjusted; "Grip the steering wheel at 9-and-3 or 10-and-2."',
    competency: 'general_rules',
    severity: 'major',
  },
];

export const HOTSPOTS: { shell: HotspotShell; pool: HotspotContent[] }[] = [
  { shell: documentsShell, pool: documentsPool },
  { shell: plateShell, pool: platePool },
  { shell: tiresShell, pool: tiresPool },
  { shell: brakesShell, pool: brakesPool },
  { shell: lightsShell, pool: lightsPool },
  { shell: engineBayShell, pool: engineBayPool },
  { shell: trunkShell, pool: trunkPool },
  { shell: cockpitShell, pool: cockpitPool },
  { shell: beltsShell, pool: beltsPool },
  { shell: controlsShell, pool: controlsPool },
];

export const buildHotspots = (pick: (pool: HotspotContent[]) => HotspotContent): GarageHotspot[] =>
  HOTSPOTS.map(({ shell, pool }) => ({ ...shell, ...pick(pool) }));

// ── Road events (drive out of the driveway) ─────
export const SLOT_DISTANCES = [840, 1500, 2160];

const driveOutSlot: SlotVariant[] = [
  {
    id: 'level2.drive-out.neighbour',
    scenePrefab: { kind: 'driveway_crossing' },
    type: 'pedestrian_crossing',
    description: 'Driveway mouth: a neighbor is crossing the footpath ahead.',
    correctAction: 'stop',
    points: 30,
    penaltyMessage:
      'Pedestrians already crossing a driveway have priority. Nosing out into them is a critical failure.',
    rewardMessage: 'Correct. You held back at the footpath until the pedestrian was clear.',
    duration: 200,
    lawCitation:
      'Check surroundings before moving off. Pedestrians already crossing a driveway or footpath have the right of way.',
    competency: 'pedestrians',
    severity: 'critical',
  },
  {
    id: 'level2.drive-out.schoolchildren',
    scenePrefab: { kind: 'driveway_crossing' },
    type: 'pedestrian_crossing',
    description: 'Driveway mouth: a group of schoolchildren is crossing the footpath ahead.',
    correctAction: 'stop',
    points: 30,
    penaltyMessage:
      'Pedestrians already crossing a driveway have priority, and a group of children takes longer to clear it.',
    rewardMessage: 'Correct. You held back at the footpath until the whole group was clear.',
    duration: 200,
    lawCitation:
      'Check surroundings before moving off. Pedestrians already crossing a driveway or footpath have the right of way.',
    competency: 'pedestrians',
    severity: 'critical',
  },
  {
    id: 'level2.drive-out.elderly',
    scenePrefab: { kind: 'driveway_crossing' },
    type: 'pedestrian_crossing',
    description: 'Driveway mouth: an elderly pedestrian is crossing the footpath ahead.',
    correctAction: 'stop',
    points: 30,
    penaltyMessage:
      'Pedestrians already crossing a driveway have priority, and an elderly pedestrian needs more time to clear it.',
    rewardMessage: 'Correct. You held back at the footpath until they were clear.',
    duration: 200,
    lawCitation:
      'Check surroundings before moving off. Pedestrians already crossing a driveway or footpath have the right of way.',
    competency: 'pedestrians',
    severity: 'critical',
  },
  {
    id: 'level2.drive-out.dog-walker',
    scenePrefab: { kind: 'driveway_crossing' },
    type: 'pedestrian_crossing',
    description: 'Driveway mouth: someone walking a dog is crossing the footpath ahead.',
    correctAction: 'stop',
    points: 30,
    penaltyMessage:
      'Pedestrians already crossing a driveway have priority. Nosing out into them is a critical failure.',
    rewardMessage: 'Correct. You held back at the footpath until they and the dog were clear.',
    duration: 200,
    lawCitation:
      'Check surroundings before moving off. Pedestrians already crossing a driveway or footpath have the right of way.',
    competency: 'pedestrians',
    severity: 'critical',
  },
];

const mergeSlot: SlotVariant[] = [
  {
    id: 'level2.merge.traffic-flow',
    scenePrefab: { kind: 'main_road_junction' },
    type: 'scenario_trigger',
    description: 'Main road ahead: traffic is already flowing across the junction.',
    correctAction: 'brake',
    points: 30,
    penaltyMessage:
      'Pushing into a moving traffic stream without signaling or yielding invites a side collision.',
    rewardMessage: 'Correct. You signaled, yielded, and merged once a safe gap opened.',
    duration: 200,
    lawCitation: 'RA 4136, as given in this module: a vehicle entering a highway from a private road or driveway shall yield the right-of-way to all vehicles approaching on that highway. Check your surroundings and signal before you pull out.',
    competency: 'right_of_way',
    severity: 'major',
  },
  {
    id: 'level2.merge.jeepney',
    scenePrefab: { kind: 'main_road_junction' },
    type: 'scenario_trigger',
    description: 'Main road junction ahead: a jeepney is approaching from the right.',
    correctAction: 'brake',
    points: 30,
    penaltyMessage:
      'Pulling out ahead of an approaching jeepney without yielding invites a side collision.',
    rewardMessage: 'Correct. You signaled, yielded to the jeepney, and merged once it had passed.',
    duration: 200,
    lawCitation: 'RA 4136, as given in this module: a vehicle entering a highway from a private road or driveway shall yield the right-of-way to all vehicles approaching on that highway. Check your surroundings and signal before you pull out.',
    competency: 'right_of_way',
    severity: 'major',
  },
  {
    id: 'level2.merge.tricycle',
    scenePrefab: { kind: 'main_road_junction' },
    type: 'scenario_trigger',
    description: 'Main road junction ahead: a tricycle is approaching from the left.',
    correctAction: 'brake',
    points: 30,
    penaltyMessage:
      'Pulling out ahead of an approaching tricycle without yielding invites a side collision.',
    rewardMessage: 'Correct. You signaled, yielded to the tricycle, and merged once it had passed.',
    duration: 200,
    lawCitation: 'RA 4136, as given in this module: a vehicle entering a highway from a private road or driveway shall yield the right-of-way to all vehicles approaching on that highway. Check your surroundings and signal before you pull out.',
    competency: 'right_of_way',
    severity: 'major',
  },
  {
    id: 'level2.merge.delivery-motorcycle',
    scenePrefab: { kind: 'main_road_junction' },
    type: 'scenario_trigger',
    description: 'Main road junction ahead: a delivery motorcycle is weaving through the traffic.',
    correctAction: 'brake',
    points: 30,
    penaltyMessage:
      'Pushing out into a lane a weaving motorcycle is using without yielding invites a side collision.',
    rewardMessage: 'Correct. You signaled, yielded until the motorcycle cleared, and merged into a safe gap.',
    duration: 200,
    lawCitation: 'RA 4136, as given in this module: a vehicle entering a highway from a private road or driveway shall yield the right-of-way to all vehicles approaching on that highway. Check your surroundings and signal before you pull out.',
    competency: 'right_of_way',
    severity: 'major',
  },
];

// A posted maximum, which is how a speed_limit event is graded whether or not
// it says so. Declared so the cue has something to point at: the speed, read at
// the sign the event draws. Not `postedSpeed`, which would hold the item to
// Level 2's limit on every level it is appended to as practice.
const settleSlot: SlotVariant[] = [
  {
    id: 'level2.settle.posted-limit',
    type: 'speed_limit',
    speedRule: 'maximum',
    description: 'Residential street: the posted limit applies from here.',
    correctAction: 'brake',
    points: 20,
    penaltyMessage:
      'Moving smoothly means settling to the posted limit once you are in the traffic stream.',
    rewardMessage: 'Correct. You settled to the posted limit and kept the drive smooth.',
    duration: 200,
    lawCitation:
      'Move smoothly and obey road rules; observe the posted speed limit for the road you have entered.',
    competency: 'speed_control',
    severity: 'minor',
  },
  {
    id: 'level2.settle.parked-cars',
    type: 'speed_limit',
    speedRule: 'maximum',
    description: 'Narrow residential street: cars are parked on both sides.',
    correctAction: 'brake',
    points: 20,
    penaltyMessage:
      'A street narrowed by parked cars on both sides needs the posted limit respected, not exceeded.',
    rewardMessage: 'Correct. You settled to the posted limit through the narrowed street.',
    duration: 200,
    lawCitation:
      'Move smoothly and obey road rules; observe the posted speed limit for the road you have entered.',
    competency: 'speed_control',
    severity: 'minor',
  },
  {
    id: 'level2.settle.blind-bend',
    type: 'speed_limit',
    speedRule: 'maximum',
    description: 'Residential street: sight distance drops just past a bend.',
    correctAction: 'brake',
    points: 20,
    penaltyMessage:
      'Reduced sight distance past a bend still means settling to the posted limit, not exceeding it.',
    rewardMessage: 'Correct. You settled to the posted limit through the reduced-visibility stretch.',
    duration: 200,
    lawCitation:
      'Move smoothly and obey road rules; observe the posted speed limit for the road you have entered.',
    competency: 'speed_control',
    severity: 'minor',
  },
  {
    id: 'level2.settle.school-zone',
    type: 'speed_limit',
    speedRule: 'maximum',
    description: 'Residential street: a school zone stretch begins here.',
    correctAction: 'brake',
    points: 20,
    penaltyMessage:
      'A school zone stretch still means settling to the posted limit, not exceeding it.',
    rewardMessage: 'Correct. You settled to the posted limit through the school zone stretch.',
    duration: 200,
    lawCitation:
      'Move smoothly and obey road rules; observe the posted speed limit for the road you have entered.',
    competency: 'speed_control',
    severity: 'minor',
  },
];

export const SLOTS: SlotVariant[][] = [driveOutSlot, mergeSlot, settleSlot];

const level2Base = {
  id: 2,
  name: levelModule.title,
  moduleId: levelModule.id,
  description: levelModule.desc,
  // The bulk of this level is the garage stage; the road section is only the
  // drive out of the driveway.
  roadLength: 2560,
  speedLimit: 30,
  // Garage is worth 160 and the drive 80. The pass mark sits above 160 on
  // purpose, so a flawless inspection still has to be driven out properly.
  requiredScore: 170,
  stars2: 200,
  stars3: 230,
} as const;

/**
 * A fresh roll of the drive: one inspection finding per garage hotspot, plus
 * one road scenario per slot. No sign/marking catalogue here (this level's
 * content is vehicle-inspection and driveway scenarios, not signs), so
 * `coverage` is accepted only for signature parity with the other pool-based
 * levels and is unused. A weakCompetency narrows each pool to variants tagged
 * with that competency first - a no-op for pools that are entirely one
 * competency.
 */
export const createLevel2 = (
  _coverage?: SignCoverage,
  weakCompetency?: DrivingCompetency | null,
  rng: () => number = Math.random
): LevelConfig => {
  const pick = <T extends { competency?: DrivingCompetency }>(pool: T[]): T =>
    pickWeighted(pool, weakCompetency ?? null, rng);

  return {
    ...level2Base,
    garage: {
      plate: 'ABC 1435',
      intro:
        'Your trip starts in the garage. Inspect every point on the vehicle before the engine is started, and decide Go or No-Go for each one.',
      hotspots: buildHotspots(pick),
    },
    events: buildEvents(SLOTS, SLOT_DISTANCES, pick),
  };
};

/**
 * Stable version of the level used for the level map, briefing and results,
 * where the metadata matters and the specific inspection findings do not.
 * The played drive comes from `createLevel2()` instead.
 */
export const level2: LevelConfig = {
  ...level2Base,
  garage: {
    plate: 'ABC 1435',
    intro:
      'Your trip starts in the garage. Inspect every point on the vehicle before the engine is started, and decide Go or No-Go for each one.',
    hotspots: buildHotspots(pool => pool[0]),
  },
  events: buildEvents(SLOTS, SLOT_DISTANCES, pool => pool[0]),
};

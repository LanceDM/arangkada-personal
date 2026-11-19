"""
Scenario and lesson wording, law first (2026-11-13).

1. PHRASES: exact replacements that drop the manual, reviewer (RO10x) and LTO
   attributions and name the law instead.
2. PREFIX: puts the governing law in front of a scenario's lawCitation, found
   by the scenario id, when the citation does not already name one.

Run from the repo root:  python3 scripts/content/scenarioCitations.py
Every replacement must match exactly once (or the count given); the script
stops otherwise, so a stale anchor never passes silently.
"""
import re
import sys
from pathlib import Path

ROOT = Path('src/features/driving-sim/domain/scenario/content')
LV = ROOT / 'levels'
LS = ROOT / 'lessons'

DPWH_SIGN = 'Road sign standard (DPWH DO 41, s. 2012)'
DPWH_MARK = 'Pavement marking standard (DPWH DO 41, s. 2012)'
SIGNALS = 'PD 207 (Vienna Convention on Road Signs and Signals), Art. 23'

# (file, old, new, count)
PHRASES: list[tuple[Path, str, str, int]] = [
    # Level 1
    (LV / 'level1.ts', "'LTO checkpoint: ", "'Roadside checkpoint: ", 20),
    (LV / 'level1.ts', "\"Only a valid driver's license, student permit, or equivalent LTO-issued authority may be used to operate a motor vehicle.\"",
     "\"RA 4136, Sec. 19: only a valid driver's license, or a student-driver's permit used under its conditions (Sec. 30), authorizes operating a motor vehicle.\"", 1),
    (LV / 'level1.ts', 'validity must be confirmed with the LTO hotline first', 'validity must be confirmed by phone first', 1),
    # Level 2 garage: the module quoted as if it were the source
    (LV / 'level2.ts', "lawCitation: 'Level 2 module, Before Starting The Engine: \"Wear the seatbelt, advise passengers to wear seatbelts, and lock all doors.\"'",
     "lawCitation: 'RA 8750 (Seat Belts Use Act), Sec. 4: the driver and front-seat passengers wear seat belts while the vehicle is running. Before starting the engine: wear the seatbelt, advise passengers to wear theirs, and lock all doors.'", 2),
    (LV / 'level2.ts', "lawCitation: 'Level 2 module, Before Starting The Engine: \"Automatic transmission — make sure the shifting lever is in Park before starting.\" \"Sit comfortably and adjust the seat so pedals and steering can be used without leaning forward or backward.\"'",
     "lawCitation: 'Before starting the engine: with an automatic transmission, make sure the lever is in Park; sit comfortably and adjust the seat so the pedals and steering can be used without leaning forward or backward.'", 1),
    (LV / 'level2.ts', "lawCitation: 'Level 2 module, Before Starting The Engine: lever in Park for an automatic; seat adjusted; \"Grip the steering wheel at 9-and-3 or 10-and-2.\"'",
     "lawCitation: 'Before starting the engine: lever in Park for an automatic; seat adjusted; grip the steering wheel at 9-and-3 or 10-and-2.'", 1),
    # Level 5
    (LV / 'level5.ts', "'FDM Vol. 1 p. 141: when an emergency vehicle approaches,", "'RA 4136, Sec. 49: when an emergency vehicle approaches,", 1),
    # Level 6
    (LV / 'level6.ts', 'RA 4136 Sec. 41 (FDM Vol. 1 p. 121): overtaking on the right', 'RA 4136, Sec. 39: overtaking on the right', 1),
    (LV / 'level6.ts', "'FDM Vol. 1 p. 96, painted curbs:", "'Painted curbs:", 1),
    (LV / 'level6.ts', "'FDM Vol. 1, Parking Prohibitions In Specified Places: \"No driver shall park a vehicle, or permit it to stand, whether attended or unattended, upon a highway in any of the following places: … Within four meters of a fire hydrant.\" RO102: \"Within 4 meters from a fire hydrant.\" FDM Vol. 1\\'s review item: never park or stop at the side of the road within 4 meters from a fire hydrant, pursuant to R.A. No. 4136.'",
     "'RA 4136, Sec. 46(e): no driver shall park a vehicle, or permit it to stand, attended or unattended, within four meters of a fire hydrant. Never park or stop at the side of the road within 4 meters of a hydrant.'", 1),
    (LV / 'level6.ts', "'FDM Vol. 1, Parking Prohibitions In Specified Places: \"No driver shall park a vehicle, or permit it to stand, whether attended or unattended, upon a highway in any of the following places: … At any place where official signs have been displayed prohibiting parking.\" The sign, in FDM Vol. 1 and RO102: \"NO PARKING: TOW-AWAY ZONE -- parked vehicle will be towed.\"'",
     "'RA 4136, Sec. 46(h): no driver shall park a vehicle, or permit it to stand, at any place where official signs prohibit parking. The sign reads: NO PARKING, TOW-AWAY ZONE; a parked vehicle will be towed.'", 1),
    (LV / 'level6.ts', "'FDM Vol. 1, parallel parking: \"driving slightly past the parking space, parallel to the parked vehicles in front of that space, keeping a safe distance, then followed by reversing into that space.\"",
     "'Parallel parking: drive slightly past the space, parallel to the vehicle parked in front of it and at a safe distance, then reverse into the space.", 1),
    # Level 8, 9
    (LV / 'level8.ts', 'give way to it (Level 2 module, right-of-way).', 'give way to it.', 1),
    (LV / 'level9.ts', '4 meters behind the vehicle (FDM Vol. 1 p. 160).', '4 meters behind the vehicle (LOI 229, 1974).', 1),
    # Level 10, 11
    (LV / 'level10.ts', "label: 'LTO checkpoint'", "label: 'Roadside checkpoint'", 1),
    (LV / 'level10.ts', 'set under LTO or LTFRB supervision to the maximum allowed', 'set to the maximum allowed', 1),
    (LV / 'level11.ts', "\"The LTO's guidelines for drivers of motorcycles,", '"Guidelines for drivers of motorcycles,', 1),
    (LV / 'level11.ts', 'A tricycle is registered with the LTO and renewed every', 'A tricycle is registered and renewed every', 1),
    # Level 12
    (LV / 'level12.ts', "'RO105: \"A photocopy or the original CR are required to be preserved and carried in the car by the owner or driver of a motor vehicle.\" JAO 2014-01, as printed in FDM Vol. 2: failure",
     "'RA 4136, Sec. 15: the Certificate of Registration, or a copy, is kept in the vehicle. JAO 2014-01: failure", 1),
    (LV / 'level12.ts', 'a fee waiting for the next visit to the LTO:', 'a fee waiting for the next renewal:', 1),
    (LV / 'level12.ts', "'RO105: \"The number plates must be kept clean and cared for, and firmly affixed to the motor vehicle in such a manner as will make it entirely visible and always legible.\" JAO 2014-01, as printed in FDM Vol. 2:",
     "'RA 4136, Sec. 18: number plates are firmly affixed, kept clean and always entirely visible and legible. JAO 2014-01:", 1),
    (LV / 'level12.ts', "'FDM Vol. 1, law enforcement officer: \"If stopped by an enforcer, safely pull over to the extreme right. Stay in the driver\\'s seat. Do not get out of the vehicle unless asked or directed. Keep your hands visible. Sit calmly and follow the officer\\'s instructions. Be ready to present your driver\\'s license and motor vehicle registration.\" FDM Vol. 1 reviewer: \"it is improper for any driver or any traffic enforcer to negotiate a violation. Any complaint/contest may be done at the proper adjudication office.\" RO101 lists the right not to step down from the vehicle.'",
     "'RA 4136, Sec. 19: the license is shown on demand. When stopped by an enforcer, pull over safely to the extreme right, stay in the driver\\'s seat unless asked to step out, keep your hands visible, follow the officer\\'s instructions, and have your license and registration ready. Neither driver nor enforcer may negotiate a violation; a contest goes to the proper adjudication office (JAO 2014-01).'", 1),
    (LV / 'level12.ts', "'FDM Vol. 1 reviewer, stopped by an enforcer when you believe you did not violate any rule: \"Stop at the roadside and politely ask the reason why you were being stopped.\" FDM Vol. 1: during an apprehension a driver has the right to know the complete name and agency of the apprehending officer and the exact alleged traffic violation, and to contest within a prescribed period. RO105: the license \"shall be shown and/or surrendered for cause and upon demand to any person with authority under this RA 4136 to confiscate the same.\"'",
     "'RA 4136, Secs. 19 and 29: the license is shown, or surrendered for cause, on demand of a person with authority to confiscate it. Stopped when you believe you did not violate any rule: stop at the roadside and politely ask the reason. During an apprehension you have the right to know the officer\\'s complete name and agency and the exact alleged violation, and to contest it within the period set by JAO 2014-01.'", 1),
    (LV / 'level12.ts', "'JAO 2014-01, as printed in FDM Vol. 2: \"All apprehensions are deemed admitted unless contested by filling a written contest within five (5) days from date of apprehension. … The LTO shall resolve a contested case within five (5) days from receipt of said written contest.\" FDM Vol. 1 reviewer: \"it is improper for any driver or any traffic enforcer to negotiate a violation. Any complaint/contest may be done at the proper adjudication office.\"'",
     "'JAO 2014-01: all apprehensions are deemed admitted unless contested in writing within five (5) days from the date of apprehension, and a contested case is resolved within five (5) days of receiving the written contest. Neither driver nor enforcer may negotiate a violation; a contest goes to the proper adjudication office.'", 1),
    (LV / 'level12.ts', "'JAO 2014-01, as printed in FDM Vol. 2: the TOP \"Serves as a permit to operate a motor vehicle for a period of seventy-two (72) hours only.\" RO105: issued by LTO-deputized enforcers, it serves as \"Receipt for driver\\'s license confiscated; Notice and Summon; Temporary driver\\'s license (for 72 hrs. only)\". Only LTO-deputized traffic enforcers may confiscate a license.'",
     "'RA 4136, Sec. 29; JAO 2014-01: the Temporary Operator\\'s Permit (TOP) serves as a permit to operate a motor vehicle for seventy-two (72) hours only. It is the receipt for the confiscated license, the notice and summons, and a temporary license for 72 hours. Only deputized traffic enforcers may confiscate a license.'", 1),
    (LV / 'level12.ts', "'JAO 2014-01, as printed in FDM Vol. 2: \"Failure", "'JAO 2014-01: \"Failure", 1),
    (LV / 'level12.ts', " RO105: \"5 days to contest, 15 days to settle; otherwise, 30 days suspension of driver\\'s license will be meted\".'",
     " In short: 5 days to contest, 15 days to settle, or a 30-day suspension.'", 1),
    (LV / 'level12.ts', "'FDM Vol. 1, accumulated violation points:", "'IRR of RA 10930, demerit points:", 1),
    (LV / 'level12.ts', "'FDM Vol. 1, skidding: \"1. Do not use your brake, if possible. 2. Take off your foot on the gas pedal. 3. Identify your escape route and slightly turn the wheel in the direction you want to go. 4. Then, straighten the wheels to bring the vehicle under control.\" RO101, skid and traction loss:",
     "'Skidding: do not use the brake if possible, take your foot off the gas pedal, identify your escape route and turn the wheel slightly in the direction you want to go, then straighten the wheels to bring the vehicle under control. Skid and traction loss:", 1),
    (LV / 'level12.ts', "'RO101, loss of brake: \"Aim to the target or escape area. Release the accelerator. Control steering. Downshift. Do not switch off the engine. If possible, use parking brake, keep the release lever open and use it as a brake. Use soft crash area if necessary.\" FDM Vol. 1, emergency braking:",
     "'Loss of brake: aim for the target or escape area, release the accelerator, control the steering, downshift, and do not switch off the engine. If possible, use the parking brake with the release lever held open, as a brake, and use a soft crash area if necessary. Emergency braking:", 1),
    (LV / 'level12.ts', 'JAO 2014-01, as printed in FDM Vol. 2:', 'JAO 2014-01:', 2),
    (LV / 'level12.ts', "'An LTO-deputized enforcer at the curb", "'A deputized enforcer at the curb", 1),
    (LV / 'level12.ts', '"An LTO-deputized enforcer at the curb', '"A deputized enforcer at the curb', 3),
    (LV / 'level12.ts', "value: 'LTO-deputized enforcer'", "value: 'Deputized traffic enforcer'", 3),
    (LV / 'level12.ts', 'the LTO resolves it within five days of receiving it.', 'it is resolved within five days of receipt.', 1),
    # Stage extras: the module quoted as if it were the source
    (LV / 'stageExtraScenarios.ts', "'Level 7 module, Expressway Driving Tips: \"Be aware of crosswinds, especially on bridges and open stretches.\" Level 7 module, Speed Limits Under RA 4136:",
     "'RA 4136, Sec. 35(a): drive at a careful and prudent speed. Be aware of crosswinds, especially on bridges and open stretches. Speed limits:", 1),
    (LV / 'stageExtraScenarios.ts', "'Level 7 module, Merging And Toll Exit Procedure: \"On an expressway, switch on the hazard warning lights only when stopping for an emergency.\" Expressway Driving Tips: \"Maintain a safe following distance at all times.\"'",
     "'On an expressway, switch on the hazard warning lights only when stopping for an emergency, and keep a safe following distance at all times.'", 1),
    (LV / 'stageExtraScenarios.ts', "'Level 7 module, Expressway Rules: \"Standing, stopping, loading, unloading, or parking is not allowed except in designated places.\" Level 6 module, Before You Choose The Space: do not stop where official signs prohibit it.'",
     "'RA 2000 (Limited Access Highway Act) and expressway rules: standing, stopping, loading, unloading or parking only in designated places. RA 4136, Sec. 46(h): do not stop where official signs prohibit it.'", 1),
    (LV / 'stageExtraScenarios.ts', "'Level 7 module, Expressway Rules: \"No person or vehicle may enter, exit, or cross the expressway except at designated entry, exit, or interchange points.\" \"Standing, stopping, loading, unloading, or parking is not allowed except in designated places.\"'",
     "'RA 2000 (Limited Access Highway Act): enter, exit or cross the expressway only at designated entry, exit or interchange points; stand, stop, load, unload or park only in designated places.'", 1),
    (LV / 'stageExtraScenarios.ts', "'Level 7 module, Merge-Lane Warning Signage: \"Check Brakes, Reduce Speed Now — posted in conjunction with a merge or descent on the expressway; test your brakes and slow down before the situation demands it.\"'",
     "'Road sign standard (DPWH DO 41, s. 2012): Check Brakes, Reduce Speed Now is posted with a merge or descent on the expressway; test your brakes and slow down before the situation demands it.'", 1),
    (LV / 'stageExtraScenarios.ts', "'Level 8 module, Managing Stress While Driving, unlawful or difficult traffic enforcers: \"Be polite. Comply rather than argue at the roadside. Save formal complaints for the proper venue and time, not the driver\\'s seat. Use a dashcam or phone to document an incident if needed.\" Courtesy And Road Discipline: be courteous to traffic enforcers.'",
     "'Difficult traffic enforcers: be polite, comply rather than argue at the roadside, and save formal complaints for the proper venue (JAO 2014-01 sets the contest). Use a dashcam or phone to document an incident if needed, and be courteous to enforcers.'", 1),
    (LV / 'stageExtraScenarios.ts', "'Level 8 module, Driver Wellness And Human Factors In Crashes: fatigue — \"Observe reasonable driving hours and plan rest stops beforehand\"; partying — \"Limit the time spent before a drive\"; illness — \"Avoid driving if not physically fit.\" Hazards Around You: \"If you are taking medicine",
     "'Driver wellness: observe reasonable driving hours and plan rest stops; limit partying before a drive; avoid driving if not physically fit. \"If you are taking medicine", 1),
    (LV / 'stageExtraScenarios.ts', "'Level 3 module: a flashing yellow signal means slow down and proceed with caution. Level 8 module, Managing Stress:",
     "'PD 207 (Vienna Convention on Road Signs and Signals), Art. 23: a flashing yellow signal means slow down and proceed with caution. Managing stress:", 1),
    (LV / 'stageExtraScenarios.ts', "'Level 9 module, Breakdown Procedure: \"Move the vehicle to the safest available position, off the main travel lane if possible.\" Level 6 module, Before You Choose The Space: do not stop where official signs prohibit it.'",
     "'Breakdown: move the vehicle to the safest available position, off the main travel lane if possible, and set the early warning devices (LOI 229, 1974). RA 4136, Sec. 46(h): do not stop where official signs prohibit it.'", 1),
    (LV / 'stageExtraScenarios.ts', "label: 'LTO checkpoint'", "label: 'Roadside checkpoint'", 1),
    (LV / 'stageExtraScenarios.ts', '"Level 10 module, Anti-Drunk And Drugged Driving Act (RA 10586): \\"A professional',
     '"RA 10586 (Anti-Drunk and Drugged Driving Act), Sec. 12: \\"A professional', 1),
    (LV / 'stageExtraScenarios.ts', 'before going to the LTO to renew the registration.', 'before going to renew the registration.', 1),
    (LV / 'stageExtraScenarios.ts', "'Emission test results must be presented to the LTO within 60 days of testing,", "'Emission test results must be presented within 60 days of testing,", 1),
    (LV / 'stageExtraScenarios.ts', "'Level 10 module, Clean Air Act (RA 8749): \"Test results must be presented to the LTO within 60 days of testing, as a prerequisite for registration or renewal.\"'",
     "'RA 8749 (Clean Air Act), Sec. 21: an emission test is a prerequisite for registration or renewal, and its results must be presented within 60 days of testing.'", 1),
    (LV / 'stageExtraScenarios.ts', '"Level 11 module, Proper Tricycle Operation: \\"Use a professional driver\'s license for a for-hire tricycle.\\" Common Tricycle Violations: \\"Driving with expired registration, or with an invalid license or no license.\\""',
     '"RA 4136, Sec. 24: a vehicle for hire, a tricycle included, is driven on a professional driver\'s license. Driving with expired registration, or with an invalid license or none, is a violation (JAO 2014-01)."', 1),
    (LV / 'stageExtraScenarios.ts', "'Go — current LTO registration is all a tricycle needs'", "'Go — current registration is all a tricycle needs'", 1),
    (LV / 'stageExtraScenarios.ts', '"Level 11 module, Tricycle Registration, Franchise: \\"A tricycle does not need',
     '"RA 7160 (Local Government Code), Sec. 458: \\"A tricycle does not need', 1),
    (LV / 'stageExtraScenarios.ts', "{ label: 'LTO registration', value: 'Current' }", "{ label: 'Registration', value: 'Current' }", 1),
    (LV / 'stageExtraScenarios.ts', "'Level 11 module, Common Tricycle Violations: \"Parking or waiting within six meters of an intersection.\" Level 6 module, Before You Choose The Space: \"Not within 6 meters of the intersection of curb lines.\"'",
     "'RA 4136, Sec. 46(c): no parking or waiting within six meters of the intersection of curb lines; a tricycle waiting there is a common violation.'", 1),
]

# Scenario id -> law put in front of its lawCitation, when it names none yet.
PREFIX: list[tuple[str, str]] = [
    (r'^level1\.(code-match|category-match|clutch-code)\.', 'RA 4136, Sec. 24'),
    (r'^level1\.driving-authority\.conductors-license$', 'RA 4136, Sec. 24'),
    (r'^level1\.driving-authority\.student-permit', 'RA 4136, Sec. 30, as amended by BP 398'),
    (r'^level1\.validity\.expired-license$', 'RA 4136, Secs. 19 and 26'),
    (r'^level1\.validity\.lenses-condition-not-met$', 'RA 4136, Sec. 24'),
    (r'^level2\.drive-out\.', 'RA 4136, Sec. 44(a)'),
    (r'^level2\.settle\.posted-limit$', 'RA 4136, Sec. 35'),
    (r'^level3\.signal\.', SIGNALS),
    (r'^level3\.priority-stop\.(stop-sign|designated-stop-line)$', DPWH_SIGN),
    (r'^level3\.(priority-yield|route-restriction|speed|lane-guidance|bend-warning|pedestrian)\.', DPWH_SIGN),
    (r'^level4\.junction-space\.yellow-box$', f'{DPWH_MARK}; RA 4136, Sec. 54'),
    (r'^level4\.', DPWH_MARK),
    (r'^level5\.signal-right-of-way\.', SIGNALS),
    (r'^level5\.yellow-box\.', 'RA 4136, Sec. 54 (obstruction of traffic)'),
    (r'^level6\.red-curb-no-parking$', DPWH_MARK),
    (r'^level7\.(merging-traffic-minimum-speed|lane1-|toll-plaza)', 'RA 2000 (Limited Access Highway Act) and expressway rules'),
    (r'^level7\.check-brakes-reduce-speed$', DPWH_SIGN),
    (r'^level7\.following-distance', 'RA 4136, Sec. 35(a)'),
    (r'^level9\.crash-at-the-bottom$', 'RA 4136, Sec. 55'),
    (r'^level11\.riders-in-their-lane$', DPWH_MARK),
    (r'^level11\.delivery-box$', 'JAO 2014-01'),
    (r'^level11\.jeepney-stop$', 'RA 4136, Sec. 54'),
    (r'^level11\.crossing-at-the-stop$', 'RA 4136, Sec. 42(c)'),
    (r'^level11\.overloaded-jeepney$', 'RA 4136, Secs. 32 and 34(i)'),
    (r'^level11\.tricycle-in-the-box$', 'RA 4136, Secs. 46(c) and 54'),
]

# RA 4136 citations that name the code but not the section.
SECTIONS: list[tuple[str, str, int]] = [
    ("'RA 4136, as given in this module: a vehicle entering a highway from a private road", "'RA 4136, Sec. 43(a): a vehicle entering a highway from a private road", 1),
    ("'RA 4136, as taught in Levels 2 and 5: a driver about to traverse a railroad crossing", "'RA 4136, Sec. 42(d): a driver about to traverse a railroad crossing", 1),
    ("'RA 4136: the vehicle on the left shall yield the right-of-way to the vehicle on the right", "'RA 4136, Sec. 42(a): the vehicle on the left shall yield the right-of-way to the vehicle on the right", None),
    ("RA 4136: a driver shall yield to a vehicle already within the intersection, or one turning left", "RA 4136, Sec. 42(b): a driver shall yield to a vehicle already within the intersection, or one turning left", None),
    ("RA 4136: a driver approaching but not yet within an intersection", "RA 4136, Sec. 42(b): a driver approaching but not yet within an intersection", None),
    ("RA 4136: the driver shall yield the right-of-way to a pedestrian crossing within a crosswalk", "RA 4136, Sec. 42(c): the driver shall yield the right-of-way to a pedestrian crossing within a crosswalk", None),
    ("RA 4136: a pedestrian crossing at a point other than a crosswalk", "RA 4136, Sec. 42(c): a pedestrian crossing at a point other than a crosswalk", None),
    ("RA 4136: at a Stop sign", "RA 4136, Sec. 43(c): at a Stop sign", None),
    ("RA 4136: at a Give Way sign", "RA 4136, Sec. 43(c): at a Give Way sign", None),
    ("RA 4136: drivers shall yield the right-of-way to police, fire department vehicles and ambulances", "RA 4136, Secs. 43(b) and 49: drivers shall yield the right-of-way to police, fire department vehicles and ambulances", None),
    ("RA 4136: a vehicle entering a highway from a private road or driveway", "RA 4136, Sec. 43(a): a vehicle entering a highway from a private road or driveway", None),
    ("RA 4136: a driver shall drive at a careful and prudent speed", "RA 4136, Sec. 35(a): a driver shall drive at a careful and prudent speed", None),
    ("RA 4136: proceed to the right lane well in advance", "RA 4136, Sec. 45(a): proceed to the right lane well in advance", None),
    ("RA 4136: when turning left from one highway to another", "RA 4136, Sec. 45(b): when turning left from one highway to another", None),
    ("RA 4136: do not drive to the left of the center line", "RA 4136, Sec. 41(a): do not drive to the left of the center line", None),
]

NAMES_LAW = re.compile(r"^\s*['\"`](RA |PD |JAO|BP |LOI |IRR |DOTC|DPWH|Road sign standard|Pavement marking standard)")


def replace_exact(path: Path, old: str, new: str, count: int | None) -> None:
    text = path.read_text()
    found = text.count(old)
    if found == 0 or (count is not None and found != count):
        sys.exit(f'{path}: expected {count} of {old[:90]!r}, found {found}')
    path.write_text(text.replace(old, new))


def scenario_files() -> list[Path]:
    return sorted(p for p in LV.rglob('*.ts') if not p.name.endswith('.test.ts'))


def prefix_law(scenario_id: str, law: str) -> bool:
    """Puts `law: ` in front of the lawCitation of every object whose id matches."""
    changed = False
    for path in scenario_files():
        text = path.read_text()
        out = []
        pos = 0
        for m in re.finditer(r"\bid:\s*'([^']+)'", text):
            if not re.search(scenario_id, m.group(1)):
                continue
            # The citation of this object: the first lawCitation after its id,
            # before the next id.
            nxt = re.search(r"\bid:\s*'", text[m.end():])
            end = m.end() + (nxt.start() if nxt else len(text) - m.end())
            cit = re.search(r'lawCitation:\s*\n?\s*([\'"`])', text[m.end():end])
            if not cit:
                continue
            at = m.end() + cit.end()  # just after the opening quote
            line_start = m.end() + cit.start(1)
            if NAMES_LAW.match(text[line_start:line_start + 40]):
                continue
            out.append(text[pos:at])
            out.append(f'{law}: ')
            pos = at
            changed = True
        if out:
            out.append(text[pos:])
            path.write_text(''.join(out))
    return changed


def main() -> None:
    for path, old, new, count in PHRASES:
        replace_exact(path, old, new, count)
    for old, new, count in SECTIONS:
        hits = [p for p in scenario_files() if old in p.read_text()]
        if not hits:
            sys.exit(f'no file has {old[:80]!r}')
        for p in hits:
            replace_exact(p, old, new, None)
    for pattern, law in PREFIX:
        if not prefix_law(pattern, law):
            print(f'note: nothing to prefix for {pattern}')
    print('done')


if __name__ == '__main__':
    main()

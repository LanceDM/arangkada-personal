"""
Law-first sources for the question bank (2026-11-13).

Each item's `source` becomes: the law or regulation it rests on, then the
Driver's Manual page kept as a reference. Items that teach a driving technique
with no statute behind it keep the manual page alone ("ref."). Run from the
repo root:  python3 scripts/content/lawCitations.py
"""
import json
import re
import sys

BANK = 'src/domain/assessment/questionBank.json'

# The instruments, one short form each.
R = 'RA 4136'
BP398 = 'as amended by BP 398'
RA10930 = 'RA 10930, Sec. 2 (amending RA 4136, Sec. 23)'
PD207 = 'PD 207 (1968 Vienna Convention on Road Signs and Signals)'
PD207T = 'PD 207 (1968 Vienna Convention on Road Traffic)'
DPWH = 'DPWH Highway Safety Design Standards, Part 2: Road Signs and Pavement Markings (DO 41, s. 2012)'
JAO = 'JAO 2014-01'
JMC = 'DOTr-DPWH-DILG JMC 2018-001 (speed limits)'

def ra(sec: str) -> str:
    return f'{R}, Sec. {sec}'

LAW: dict[str, str] = {}

def put(ids: str, law: str) -> None:
    for i in ids.split():
        LAW[i] = law

# Level 1: authority to drive and documents
put('L1-DL-01 L1-DL-07 L1-DL-10', f'{ra("30")}, {BP398}')
put('L1-DL-02 L1-DL-04 L1-DL-05 L1-DL-06 L1-DL-12 L1-DL-13', f'{ra("24")}, {BP398}')
put('L1-DL-03 L1-DL-14', f'{ra("24")}, {BP398} (owners may hire only licensed professional drivers)')
put('L1-DL-08', f'{R}, Secs. 22 and 24, {BP398}')
put('L1-DL-09', ra('21'))
put('L1-DL-11', f'{R}, Secs. 19 and 24')
put('L1-DA-01', f'{R}, Secs. 15 and 19')
put('L1-DA-02 L1-DA-03', RA10930)
put('L1-DA-04 L1-DA-05', f'{R}, Secs. 22 and 24, {BP398}')
put('L1-DA-06', f'{ra("30")}, {BP398}; LTO AO 92-010')
put('L1-DA-07 L1-DA-08', f'{ra("26")}, {BP398}')
put('L1-DA-09 L1-DA-10', f'{ra("19")}; {JAO}')
# Level 2: vehicle and pre-drive
put('L2-DA-01 L2-DA-02 L2-DA-03 L2-DA-04', f'{R}, Secs. 5 and 6')
put('L2-DA-05', 'RA 8749 (Clean Air Act), Sec. 21')
put('L2-DA-06', 'Insurance Code (PD 612, as amended by RA 10607), compulsory motor vehicle liability insurance')
put('L2-DA-07', JAO)
put('L2-DA-08 L2-DA-10', f'{R}, Secs. 14 and 15')
put('L2-DA-09', 'RA 11235 (Motorcycle Crime Prevention Act)')
put('L2-RW-01', ra('43(a)'))
put('L2-RW-02 L2-RW-06', ra('43(c)'))
put('L2-RW-03', ra('42(a)'))
put('L2-RW-04', ra('48'))
put('L2-RW-08', ra('42(d)'))
put('L2-RW-09', f'{R}, Secs. 42 and 43')
put('L2-PD-01 L2-PD-02', ra('44(a)'))
put('L2-PD-04 L2-PD-10', ra('35(b)'))
put('L2-PD-07', ra('42(c)'))
put('L2-PD-08', ra('35(a)'))
put('L2-SC-01 L2-SC-02 L2-SC-03 L2-SC-05 L2-SC-07', ra('35(b)'))
put('L2-SC-04', JMC)
put('L2-SC-06', f'{R}, Secs. 35 and 38; {JMC}')
put('L2-SC-08 L2-SC-09', ra('35(c)'))
put('L2-HA-06 L2-HA-10', ra('34(b)'))
put('L2-HA-08', ra('34(c)'))
put('L2-GR-03', 'RA 8750 (Seat Belts Use Act), Sec. 4')
put('L2-GR-09', ra('47'))
# Level 3: signals and signs
for n in range(1, 11):
    LAW[f'L3-TS-{n:02d}'] = f'{PD207}, Art. 23'
LAW['L3-TS-09'] = f'{ra("48")}; {PD207}, Art. 23'
for n in range(1, 13):
    LAW[f'L3-RS-{n:02d}'] = DPWH
for n in range(1, 7):
    LAW[f'L3-PD-{n:02d}'] = DPWH
put('L3-PD-07', ra('42(c)'))
put('L3-PD-08', ra('46(b)'))
put('L3-PD-09', f'{R}, Secs. 46(b) and 54')
for n in range(1, 10):
    LAW[f'L3-LD-{n:02d}'] = DPWH
# Level 4: markings
for n in range(1, 9):
    LAW[f'L4-LD-{n:02d}'] = DPWH
LAW['L4-LD-08'] = f'{DPWH}; {ra("54")}'
# Level 5: intersections
put('L5-TS-01 L5-TS-02', f'{PD207}, Art. 23; {ra("42(b)")}')
put('L5-TS-03 L5-TS-04 L5-TS-05 L5-TS-11', f'{PD207}, Art. 23; {ra("45(a)")}')
put('L5-TS-07', ra('54'))
put('L5-TS-08', f'{PD207}, Art. 23')
put('L5-TS-09', DPWH)
put('L5-TS-10', f'{PD207T}, Art. 6 (an official\'s directions take precedence over signals)')
put('L5-RW-01 L5-RW-10', ra('42(a)'))
put('L5-RW-02', f'{R}, Secs. 42(a) and 43(c)')
put('L5-RW-03', f'{ra("43(c)")}; {DPWH}')
put('L5-RW-04 L5-RW-08', ra('42(b)'))
put('L5-RW-05 L5-RW-12', ra('49'))
put('L5-RW-07', f'{R}, Secs. 42(b), 42(c) and 45')
put('L5-RW-09 L5-RW-11', ra('43(c)'))
put('L5-RW-14', f'{DPWH}; {ra("54")}')
put('L5-PD-01 L5-PD-02 L5-PD-03 L5-PD-05 L5-PD-06 L5-PD-07 L5-PD-10 L5-PD-11 L5-PD-12', ra('42(c)'))
put('L5-PD-04', f'{R}, Secs. 44(a) and 45(a)')
put('L5-PD-08', f'{PD207}, Art. 23')
# Level 6: turning, lanes, parking
put('L6-LD-01', ra('45(a)'))
put('L6-LD-02', ra('45(b)'))
put('L6-LD-04', ra('44(a)'))
put('L6-LD-05 L6-LD-06 L6-LD-07 L6-LD-11', ra('44(b)'))
put('L6-LD-08', ra('41(b)'))
put('L6-LD-09 L6-LD-12 L6-LD-15', ra('39'))
put('L6-LD-10', f'{R}, Secs. 37 and 45(b)')
put('L6-LD-13', f'{R}, Sec. 41(b) and (c)')
put('L6-LD-14', DPWH)
put('L6-PK-01', ra('46(e)'))
put('L6-PK-02', ra('46(c)'))
put('L6-PK-03 L6-PK-11', ra('46(g)'))
put('L6-PK-09', 'BP 344 (Accessibility Law) and its IRR')
put('L6-PK-12', ra('54'))
# Level 7: speed, following, expressways
put('L7-SC-01 L7-SC-02', ra('35(b)'))
put('L7-SC-03 L7-SC-04 L7-LD-01 L7-LD-02 L7-LD-04 L7-LD-07 L7-HA-07 L7-SC-09 L7-SC-06', 'RA 2000 (Limited Access Highway Act) and expressway operating rules')
put('L7-SC-08', JMC)
put('L7-SC-10', ra('35'))
put('L7-LD-05', 'DOTC DO 2007-38 (motorcycles on limited access facilities)')
put('L7-LD-08 L7-LD-10', ra('40'))
put('L7-LD-09', ra('39'))
put('L7-LD-03', ra('39'))
# Level 8: defensive driving
put('L8-PD-01 L8-PD-02', 'Doctrine of last clear chance (Picart v. Smith, G.R. No. L-12219, 1918)')
put('L8-PD-07', DPWH)
put('L8-PD-09', ra('42(c)'))
put('L8-LD-01 L8-LD-02 L8-HA-06', ra('37'))
put('L8-LD-03 L8-LD-05', ra('41(a)'))
put('L8-LD-06 L8-LD-09', ra('48'))
put('L8-LD-08', f'{ra("41(b)")}; {DPWH}')
put('L8-GR-06', ra('34(b-1)'))
# Level 9: emergencies and crashes
put('L9-GR-01 L9-GR-04 L9-GR-05', ra('55'))
put('L9-GR-02', ra('34(g)'))
put('L9-GR-07', 'LOI 229 (1974), early warning devices')
put('L9-GR-08', 'RA 10586 (Anti-Drunk and Drugged Driving Act), Sec. 6')
put('L9-GR-09', 'RA 2000 (Limited Access Highway Act) and expressway operating rules')
# Level 10: safety laws
put('L10-SC-01 L10-SC-02 L10-SC-03 L10-SC-04 L10-SC-05', 'RA 10916 (Road Speed Limiter Act)')
put('L10-SC-06 L10-SC-07 L10-SC-09', ra('35(a)'))
put('L10-HA-04 L10-HA-05', ra('34(i)'))
put('L10-HA-06 L10-HA-09', 'RA 8749 (Clean Air Act), Sec. 46')
put('L10-HA-07 L10-HA-08', 'RA 2000 (Limited Access Highway Act) and expressway operating rules')
put('L10-GR-01 L10-GR-02 L10-GR-13', 'RA 10913 (Anti-Distracted Driving Act), Sec. 4')
put('L10-GR-03 L10-GR-04 L10-GR-06 L10-GR-11', 'RA 10586 (Anti-Drunk and Drugged Driving Act) and its IRR')
put('L10-GR-05', 'RA 10586 (Anti-Drunk and Drugged Driving Act), Sec. 15')
put('L10-GR-07 L10-GR-08 L10-GR-10 L10-GR-12', 'RA 11229 (Child Safety in Motor Vehicles Act), Secs. 4 and 5')
put('L10-GR-09', 'RA 8750 (Seat Belts Use Act), Sec. 11')
# Level 11: motorcycles, tricycles, PUVs
put('L11-PD-02 L11-HA-10', ra('54'))
put('L11-PD-03', ra('46(b)'))
put('L11-LD-08', ra('52'))
put('L11-LD-09', DPWH)
put('L11-HA-01 L11-GR-05 L11-GR-06', 'RA 10054 (Motorcycle Helmet Act)')
put('L11-HA-05', f'{ra("34")}; {JAO}')
put('L11-GR-01 L11-GR-02 L11-GR-09', 'RA 10666 (Children\'s Safety on Motorcycles Act)')
put('L11-GR-03', ra('32'))
put('L11-GR-04', 'RA 7160 (Local Government Code), Sec. 458')

# Text fixes: the law decides where it and the manual differ, and no item
# names the manual or the LTO as its authority.
FIX = {
    'L2-HA-08': {
        'question': "When must a car's headlights be on?",
        'choices': [
            'Only on expressways',
            'Only when it is completely dark',
            'From half an hour after sunset to half an hour before sunrise, and in poor visibility',
            'Only when it rains',
        ],
        'answer': 2,
    },
    'L10-GR-08': {
        'question': 'Under the Child Safety in Motor Vehicles Act (RA 11229), when may a child 12 years old or below sit in the front seat?',
        'choices': [
            'Only if the child is at least 150 cm tall and properly secured with the seat belt',
            'Whenever an adult holds the child on their lap',
            'Only on trips shorter than 5 km',
            'Never, even if the child is 150 cm or taller',
        ],
        'answer': 0,
    },
    'L3-TS-09': {'question': 'Rushing through an intersection on a yellow light to beat the red is treated as what?'},
    'L8-GR-08': {'question': 'Another driver gives way to you. What is the courteous response?'},
    'L9-GR-06': {'question': 'A person is lying unconscious after a crash involving a pedestrian. What should you do?'},
    'L2-DA-09': {'question': 'Under the Motorcycle Crime Prevention Act, how soon must a newly bought motorcycle be registered?'},
}
NOTES = {
    'L5-TS-10': None,  # settled: the Vienna Convention on Road Traffic, Art. 6
    'L6-PK-06': 'The manual is inconsistent (p. 123 says toward the curb both ways; pp. 168, 182 say away uphill). Kept the standard rule: uphill with a curb, wheels away from the curb. No statute covers it.',
    'L2-SC-04': 'Check the barangay-road figure against the JMC 2018-001 road-class table.',
    'L7-SC-03': 'Expressway maximum and minimum speeds are set by the operating rules; check the current figures.',
    'L7-SC-04': 'Expressway maximum and minimum speeds are set by the operating rules; check the current figures.',
}


def manual_ref(source: str) -> str:
    """The manual page(s) the item cited, renamed, without app provenance or bracketed law."""
    s = re.sub(r';?\s*adapted from .*$', '', source)
    s = re.sub(r'\s*\((RA|JAO)[^)]*\)', '', s)
    s = s.replace('FDM Vol. 1 (2021), ', "Driver's Manual Vol. 1 (2021), ").replace('FDM Vol. 2 (2021), ', "Driver's Manual Vol. 2 (2021), ")
    s = s.replace('FDM Vol. 1 (2021)', "Driver's Manual Vol. 1 (2021)").replace('FDM Vol. 2 (2021)', "Driver's Manual Vol. 2 (2021)")
    return s.strip().rstrip(';').strip()


def main() -> None:
    bank = json.load(open(BANK))
    missing = []
    for item in bank:
        old = item['source']
        if 'Driver\'s Manual' in old and not old.startswith('FDM'):
            continue  # already converted
        ref = manual_ref(old)
        law = LAW.get(item['id'])
        source = f'{law}; ref. {ref}' if law else f'Ref. {ref}'
        if len(source) > 200:
            source = f'{law}; ref. {ref.split(";")[0]}' if law else f'Ref. {ref.split(";")[0]}'
        if len(source) > 200:
            sys.exit(f'{item["id"]}: source over 200 characters: {source}')
        item['source'] = source
        for key, value in FIX.get(item['id'], {}).items():
            item[key] = value
        if item['id'] in NOTES:
            if NOTES[item['id']] is None:
                item.pop('reviewerNotes', None)
            else:
                item['reviewerNotes'] = NOTES[item['id']]
        if not law:
            missing.append(item['id'])
    with open(BANK, 'w') as f:
        f.write(json.dumps(bank, indent=1, ensure_ascii=False))
    print(f'{len(bank)} items; {len(bank) - len(missing)} cite a law, {len(missing)} cite the manual alone (technique).')


if __name__ == '__main__':
    main()

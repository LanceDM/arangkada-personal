"""
Lesson modules and interface text, law first (2026-11-13): no lesson presents
its content as the LTO's or the manual's; each rule names the law it comes
from. The LTO stays only where it is a fact (the Terms say the app is not an
official LTO product; the consent text names the license exam).

Run from the repo root:  python3 scripts/content/lessonWording.py
"""
import sys
from pathlib import Path

LS = Path('src/features/driving-sim/domain/scenario/content/lessons')
UI = Path('src/features/driving-sim/presentation/ui/messages.ts')

PHRASES: list[tuple[Path, str, str, int]] = [
    # Level 0
    (LS / 'level0Module.ts', 'The quiz is timed, like the LTO written exam:', 'The quiz is timed, like the written licensing exam:', 2),
    (LS / 'level0Module.ts', 'Level 1 will begin the actual LTO-based lesson about permits,', 'Level 1 begins the first lesson, on RA 4136 (the Land Transportation and Traffic Code): permits,', 2),
    # Level 1
    (LS / 'level1Module.ts', 'At an LTO-style checkpoint, the question', 'At a roadside checkpoint, the question', 2),
    (LS / 'level1Module.ts', "\"The LTO describes a driver's license as a privilege, not a right. It is authority to drive only within the limits granted by the LTO.\"",
     "\"A driver's license is a privilege, not a right. Under RA 4136 (Sec. 24), it is authority to drive only the kinds of vehicles, and only within the conditions, written on it.\"", 2),
    (LS / 'level1Module.ts', 'Level 1 focuses on four kinds of LTO authority: SP, CL, NPDL, and PDL.', 'Level 1 focuses on four kinds of authority under RA 4136: SP, CL, NPDL, and PDL.', 1),
    (LS / 'level1Module.ts', 'Level 1 focuses on four kinds of LTO authority. They are not interchangeable.', 'Level 1 focuses on four kinds of authority under RA 4136. They are not interchangeable.', 1),
    (LS / 'level1Module.ts', "headers: ['Rule', 'What The FDM Says'],", "headers: ['Rule', 'What The Law Says'],", 1),
    (LS / 'level1Module.ts', "'At least 16 years old. Applicants below 18 need parental or guardian consent.'",
     "'At least 16 years old (RA 4136, Sec. 30, as amended by BP 398). Applicants below 18 need parental or guardian consent.'", 1),
    (LS / 'level1Module.ts', "'At least 17 years old.'", "'At least 17 for a non-professional license, 18 for a professional one (RA 4136, Sec. 22, as amended by BP 398).'", 1),
    (LS / 'level1Module.ts', "'May drive in the Philippines for no more than 90 days of their stay.'", "'May drive in the Philippines for no more than 90 days of their stay (RA 4136, Sec. 21).'", 1),
    (LS / 'level1Module.ts', "'Thinking any LTO document allows driving.'", "'Thinking any government ID or document allows driving.'", 1),
    # Level 2
    (LS / 'level2Module.ts', 'The extracted LTO source states that a photocopy or the original CR must be preserved and carried in the car by the owner or driver.',
     'Under RA 4136 (Sec. 15), the Certificate of Registration, or a copy, is kept in the vehicle, and the driver carries the license at all times (Sec. 19).', 1),
    (LS / 'level2Module.ts', 'A beginner does not need to memorize every LTO office workflow,', 'A beginner does not need to memorize every registration workflow,', 2),
    (LS / 'level2Module.ts', "          text: \"When the extracted source conflicts with the LTO Citizen's Charter, the Citizen's Charter prevails.\",",
     "          text: 'Every motor vehicle must be registered before it is used on a public highway (RA 4136, Sec. 5).',", 1),
    (LS / 'level2Module.ts', 'the question is not whether you can process registration at an LTO office.', 'the question is not whether you can process a registration yourself.', 1),
    (LS / 'level2Module.ts', 'This is the approach the FDM encourages.', 'This is the approach to follow.', 1),
    (LS / 'level2Module.ts', "text: 'Checks The FDM Highlights',", "text: 'Checks To Highlight',", 1),
    (LS / 'level2Module.ts', 'must be registered with the LTO within 5 days', 'must be registered within 5 days', 1),
    # Level 3
    (LS / 'level3Module.ts', 'every LTO road sign category (A through G)', 'every road sign category (A through G)', 1),
    (LS / 'level3Module.ts', 'tested on the LTO written exam.', 'tested on the written licensing exam.', 1),
    (LS / 'level3Module.ts', 'walks through every official LTO sign category, A through G,', 'walks through every road sign category, A through G, as set by the DPWH road sign standards (DO 41, s. 2012),', 1),
    (LS / 'level3Module.ts', 'vocabulary of LTO sign types for exam review.', 'vocabulary of sign types for exam review.', 1),
    (LS / 'level3Module.ts', "title: '1. How LTO Organizes Road Signs',", "title: '1. How Road Signs Are Organized',", 1),
    (LS / 'level3Module.ts', 'one of seven official LTO categories, lettered A through G.', 'one of seven categories, lettered A through G.', 2),
    (LS / 'level3Module.ts', 'the seven official LTO sign category shapes', 'the seven sign category shapes', 1),
    (LS / 'level3Module.ts', 'Most warning signs in the FDM share one shape:', 'Most warning signs share one shape:', 1),
    (LS / 'level3Module.ts', 'the full sign vocabulary the LTO written exam tests;', 'the full sign vocabulary the written licensing exam tests;', 1),
    # Level 10
    (LS / 'level10Module.ts', 'Test results must be presented to the LTO within 60 days of testing,', 'Test results must be presented within 60 days of testing (RA 8749, Sec. 21),', 1),
    (LS / 'level10Module.ts', 'subject to an emission test by DOTr, LTO, or their deputized enforcement units.', 'subject to a roadside emission test by the DOTr or its deputized enforcement units (RA 8749, Sec. 46).', 1),
    # Level 11
    (LS / 'level11Module.ts', 'The owner must register a motorcycle with the LTO within five days of acquiring ownership.', 'The owner must register a motorcycle within five days of acquiring ownership (RA 11235).', 1),
    (LS / 'level11Module.ts', 'must be reported to the LTO within three days,', 'must be reported within three days (RA 11235),', 1),
    (LS / 'level11Module.ts', 'All tricycles must be registered with the LTO and renewed yearly,', 'All tricycles must be registered and renewed yearly (RA 4136, Sec. 5),', 1),
    (LS / 'level11Module.ts', 'which the FDM treats as tantamount to reckless driving.', 'which can amount to reckless driving (RA 4136, Sec. 48).', 1),
    # Level 12
    (LS / 'level12Module.ts', "'The LTO deputizes expressway traffic regulation officers (covering", "'Deputized expressway traffic regulation officers (covering", 1),
    (LS / 'level12Module.ts', 'to enforce RA 4136 and related regulations. Only LTO-deputized traffic enforcers are authorized', 'enforce RA 4136 and related regulations. Only deputized traffic enforcers are authorized', 1),
    (LS / 'level12Module.ts', "'Issued by LTO-deputized enforcers for traffic and administrative violations.'", "'Issued by deputized enforcers for traffic and administrative violations (JAO 2014-01).'", 1),
    (LS / 'level12Module.ts', "'The LTO resolves a contested case within 5 days of receiving the written contest.'", "'A contested case is resolved within 5 days of receiving the written contest (JAO 2014-01).'", 1),
    # Interface
    (UI, "manualModule: { en: 'LTO Manual Module' },", "manualModule: { en: 'Lesson Module' },", 1),
    (UI, "Study the key LTO concepts, pass the checkpoint, then drive the level's scenarios.", "Study the traffic laws for this level, pass the checkpoint, then drive the level's scenarios.", 1),
    (UI, "Study the key LTO concepts, then drive the level's scenarios.", "Study the traffic laws for this level, then drive the level's scenarios.", 1),
    (UI, 'ltoModule: (level: number | undefined): Localized => ({ en: `LTO Module ${level}` }),', 'ltoModule: (level: number | undefined): Localized => ({ en: `Module ${level}` }),', 1),
    (UI, "ltoCheckpoint: { en: 'LTO checkpoint' },", "ltoCheckpoint: { en: 'Roadside checkpoint' },", 1),
    (Path('src/features/driving-sim/domain/scene/SceneBuilder.ts'), "const CHECKPOINT_LABEL = 'LTO CHECKPOINT';", "const CHECKPOINT_LABEL = 'ROADSIDE CHECKPOINT';", 1),
    (Path('src/features/driving-sim/presentation/canvas/rendering/renderers/checkpointRenderer.ts'), "'LTO', 'CHECKPOINT',", "'TRAFFIC', 'CHECKPOINT',", 1),
    (Path('src/features/daily-challenge/domain/dailyScenarios.ts'), "'LTO Advisory — Avoid flooded roads. Water above tire level can stall engines and cause accidents.'",
     "'RA 4136, Sec. 48 (reckless driving): avoid flooded roads. Water above tire level can stall engines and cause accidents.'", 1),
    (Path('src/pages/landing/LandingPage.tsx'), "'Every scenario maps to actual LTO exam questions and Philippine traffic laws.'", "'Every scenario rests on Philippine traffic laws and the topics of the license exam.'", 1),
    (Path('src/pages/landing/LandingPage.tsx'), 'Real LTO questions.', 'Questions grounded in Philippine traffic law.', 1),
    (Path('src/pages/mode-select/ModeSelectPage.tsx'), "subtitle: 'LTO Mock Exam',", "subtitle: 'Mock Exam',", 1),
    (Path('src/pages/mode-select/ModeSelectPage.tsx'), "'40-item exam based on the real LTO test. See your weak areas and get recommendations.'", "'40-item practice exam in the license exam format, grounded in traffic law. See your weak areas and get recommendations.'", 1),
    (Path('src/features/mock-exam/presentation/ExamIntro.tsx'), 'LTO Theoretical Exam Simulation', 'Theoretical Exam Practice', 1),
]


def main() -> None:
    for path, old, new, count in PHRASES:
        text = path.read_text()
        found = text.count(old)
        if found != count:
            sys.exit(f'{path}: expected {count} of {old[:90]!r}, found {found}')
        path.write_text(text.replace(old, new))
    print('done')


if __name__ == '__main__':
    main()

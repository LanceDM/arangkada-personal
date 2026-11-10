// @vitest-environment jsdom
/**
 * The drive's screens follow the language chosen. A text with no
 * Filipino is marked `[EN]` in a development build, as tests run, so the mark
 * proves a text went through the language layer rather than being written in
 * the screen; where the team has written Filipino, it is what shows.
 */
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TouchInput } from '@/features/driving-sim/presentation/input/touchInput';
import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { RoadPosition } from '@/features/driving-sim/domain/world/routeGeometry';
import { LanguageProvider } from '@/shared/i18n/language';
import { FALLBACK_MARK } from '@/shared/i18n/useText';
import { competencyText } from '@/domain/learner/profile';
import { speedTargetText } from '@/features/driving-sim/domain/evaluation/eventTelemetry';
import { compositionParts, postedLimitsLine } from '@/features/driving-sim/domain/scenario/missionComposition';
import { scenarioInstruction } from '@/features/driving-sim/domain/scenario/scenarioCopy';
import { scenarioOwner } from '@/features/driving-sim/domain/scenario/scenarioTexts';
import { supportCue } from '@/features/driving-sim/domain/scenario/scenarioSupport';
import { englishText, textIn, type Language } from '@/shared/lib/localized';
import ResultCard from './feedback/ResultCard';
import { actionLabel, expectedLabel } from './actionCopy';
import { roadPositionCue } from './roadPositionLabel';
import RoadPrompt from './RoadPrompt';
import ScenarioBriefing from './ScenarioBriefing';
import { PedalPad } from './TouchControls';

vi.spyOn(console, 'warn').mockImplementation(() => {});

const render = (node: ReactElement, language: Language) =>
  renderToStaticMarkup(
    <LanguageProvider value={{ language, chosen: true, choose: () => {} }}>{node}</LanguageProvider>
  );

const event = {
  id: 'test.stop',
  type: 'scenario_trigger',
  description: 'A sign ahead.',
  recommendedMove: 'Stop at the line.',
  correctAction: 'stop',
  competency: 'road_signs',
  severity: 'minor',
} as unknown as ScenarioEvent;

const result = { label: 'A sign', correct: false, message: 'Wrong.', points: -5, action: 'accelerate', expectedAction: 'stop', move: 'Stop.' };

/** Wraps what it is handed, so a word that skipped the language layer shows bare. */
const say = (text: { en: string }) => `<${text.en}>`;

describe('the words the domain builds', () => {
  it('put every part of a cue through the language', () => {
    const cue = supportCue(
      { ...event, sign: undefined, npc: { vehicleKind: 'jeepney', path: 'crossing_from_left' }, following: { seconds: 2, tooCloseMessage: '' } } as unknown as ScenarioEvent,
      say
    );
    expect(cue).toBe('<Watch <<the jeepney> <coming from your left>>.> <Check <the gap to the vehicle ahead>.>');
  });

  it('read as they always did with no language in hand', () => {
    expect(supportCue({ ...event, sign: undefined, actor: { kind: 'jeepney' } } as unknown as ScenarioEvent)).toBe('Watch the jeepney.');
    expect(scenarioInstruction({ ...event, recommendedMove: undefined })).toBe('Come to a full stop before the line.');
    expect(speedTargetText({ at: 'most', speed: 20 })).toBe('20 km/h or less');
  });

  it('put the instruction, the target and the composition through it', () => {
    expect(scenarioInstruction({ ...event, recommendedMove: undefined }, say)).toBe('<Come to a full stop before the line.>');
    expect(speedTargetText({ at: 'least', speed: 40 }, say)).toBe('<40 km/h or more>');
    expect(compositionParts({ road: 2, garage: 1, aftermath: 0, practice: 1, maxScore: 0 } as never, say)).toEqual([
      '<1 garage check>',
      '<2 road events>',
      '<+1 practice (not scored)>',
    ]);
    expect(postedLimitsLine([{ speed: 60, rule: 'minimum' }], say)).toBe('<Other limits on this route: minimum 60 km/h.>');
  });

  it('name a competency in English until the team writes it', () => {
    expect(competencyText('road_signs')).toEqual({ en: 'Road Signs' });
    expect(textIn('fil')({ en: 'Brake', fil: 'Preno' })).toBe('Preno');
    expect(textIn('fil')({ en: 'Brake' })).toBe('Brake');
    expect(englishText({ en: 'Brake', fil: 'Preno' })).toBe('Brake');
  });

  it('write out a derived scenario name, so it can be translated with the rest', () => {
    const unnamed = { id: 'level3.priority.merging-traffic', description: 'x' };
    expect(scenarioOwner(unnamed as never)).toMatchObject({ label: 'Merging Traffic' });
    const named = { ...unnamed, label: 'A name' };
    expect(scenarioOwner(named as never)).toBe(named);
    const signed = { ...unnamed, sign: { name: 'STOP' } };
    expect(scenarioOwner(signed as never)).toBe(signed);
  });
});

describe("the drive's screens in the language chosen", () => {
  it('mark the panel that holds the drive, and leave English as it was', () => {
    const fil = render(<ScenarioBriefing event={event} support="full" onContinue={() => {}} />, 'fil');
    expect(fil).toContain(`${FALLBACK_MARK}Continue driving`);
    expect(fil).toContain(`${FALLBACK_MARK}Paused`);
    const en = render(<ScenarioBriefing event={event} support="full" onContinue={() => {}} />, 'en');
    expect(en).toContain('Continue driving');
    expect(en).not.toContain(FALLBACK_MARK);
  });

  it('mark the road prompt and the result card', () => {
    expect(render(<RoadPrompt tone="react" label="A sign" instruction={null} approach={0.5} />, 'fil')).toContain(`${FALLBACK_MARK}Act now`);
    expect(render(<ResultCard result={result} onDismiss={() => {}} />, 'fil')).toContain(`${FALLBACK_MARK}Do this`);
  });

  it('show the Filipino the team has written', () => {
    const pad = render(<PedalPad input={new TouchInput()} />, 'fil');
    expect(pad).toContain('Preno');
    expect(render(<PedalPad input={new TouchInput()} />, 'en')).toContain('Brake');
  });

  it('put the words the helpers build through the language too', () => {
    expect(actionLabel('stop', say)).toBe('<came to a full stop>');
    expect(expectedLabel('stop', say)).toBe('<a full stop>');
    // An action no table knows is still read, not lost.
    expect(actionLabel('new_action', say)).toBe('new action');
    const position = { place: 'toll-approach' } as unknown as RoadPosition;
    expect(roadPositionCue(position, null, say).place).toBe('<TOLL APPROACH>');
  });
});

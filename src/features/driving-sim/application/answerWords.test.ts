import { describe, expect, it } from 'vitest';
import { answerWords, wantedLaneKey } from './useScenarioEvaluation';

const question = {
  correctAction: 'stop' as const,
  choices: [
    { label: 'Lena goes in a child seat.', action: 'stop' as const },
    { label: 'Nothing — both are belted.', action: 'accelerate' as const },
  ],
};

describe('a wrong answer to a question, in its own words', () => {
  it('names the answer given and the right one', () => {
    expect(answerWords(question, 'accelerate')).toEqual({
      answered: 'Nothing — both are belted.',
      rightAnswer: 'Lena goes in a child seat.',
    });
  });

  it('names only the right one when no answer was given', () => {
    expect(answerWords(question, 'no_answer')).toEqual({ rightAnswer: 'Lena goes in a child seat.' });
  });

  it('says nothing for a scenario with no choices', () => {
    expect(answerWords({ correctAction: 'stop' }, 'accelerate')).toBeNull();
  });
});

describe('a wrong-lane verdict names the lane it wanted', () => {
  const lane = (l: 'curb' | 'inner' | 'middle', strict?: boolean) => ({
    lane: l,
    hint: '',
    wrongLaneMessage: '',
    ...(strict ? { strict } : {}),
  });

  it('a lane direction sign wants its lane, not "carry on"', () => {
    expect(wantedLaneKey({ requiredLane: lane('curb') })).toBe('lane:curb');
  });

  it('a turn wants the lane it is made from', () => {
    expect(wantedLaneKey({ maneuver: { ...lane('inner'), direction: 'left' } as never })).toBe('lane:inner');
  });

  it('a no-crossing line wants you to stay in your lane', () => {
    expect(wantedLaneKey({ requiredLane: lane('inner', true) })).toBe('lane:stay');
  });

  it('a scenario with no lane leaves the expected action as it is', () => {
    expect(wantedLaneKey({})).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import { answerWords } from './useScenarioEvaluation';

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

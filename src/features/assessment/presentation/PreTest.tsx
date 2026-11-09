/**
 * The pre-test's screens, on the shared
 * sitting screens: what the pre-test says, and nothing else of its own.
 */
import { usePreTest, type PreTestInput } from '@/features/assessment/application/usePreTest';
import { PRE_TEST_SECONDS, PRE_TEST_SIZE } from '@/features/assessment/domain/preTestForm';
import { Say } from '@/shared/i18n/language';
import { preTestMessages as m } from './messages';
import { TestSittingScreen, type TestCopy } from './TestSittingScreen';

interface PreTestProps extends PreTestInput {
  /** Leaves the screen; a sitting in progress keeps its clock running. */
  onLeave: () => void;
}

const minutes = PRE_TEST_SECONDS / 60;

const PRE_TEST_COPY: TestCopy = {
  title: m.title,
  notParticipant: m.notParticipant,
  couldNotOpen: m.couldNotOpen,
  intro: (
    <ul className="space-y-3 text-foreground list-disc pl-5">
      <li><Say {...m.count(PRE_TEST_SIZE)} /></li>
      <li><Say {...m.time(minutes)} /></li>
      <li><Say {...m.oneAtATime} /></li>
      <li><Say {...m.noScore} /></li>
    </ul>
  ),
  startLabel: m.start,
  continueLabel: m.continue,
  notReady: () => m.notReady,
  preview: count => m.preview(count, PRE_TEST_SIZE),
};

export const PreTest = ({ onLeave, ...input }: PreTestProps) => (
  <TestSittingScreen state={usePreTest(input)} copy={PRE_TEST_COPY} onLeave={onLeave} />
);

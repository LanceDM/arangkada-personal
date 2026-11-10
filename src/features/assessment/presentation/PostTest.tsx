/**
 * The post-test's screens, on the shared
 * sitting screens. The test is two parts of 15, each with its own clock. The
 * screen between them never names the block the first part routed to: that
 * would tell the participant how the first part went.
 */
import { usePostTest, type PostTestInput } from '@/features/assessment/application/usePostTest';
import type { NotReadyReason } from '@/features/assessment/application/useTestSitting';
import { postTestStageSeconds } from '@/features/assessment/domain/postTestForm';
import { Say } from '@/shared/i18n/language';
import type { Localized } from '@/shared/lib/localized';
import { postTestMessages as m } from './messages';
import { TestSittingScreen, type TestCopy } from './TestSittingScreen';

interface PostTestProps extends PostTestInput {
  /** Leaves the screen; a sitting in progress keeps its clock running. */
  onLeave: () => void;
}

/** A routing block of 15, then a block of 15. */
const PART_SIZE = 15;
const partMinutes = postTestStageSeconds(PART_SIZE) / 60;

const NOT_READY: Record<NotReadyReason, Localized> = {
  'pre-test': m.notReadyPreTest,
  design: m.notReadyDesign,
  items: m.notReadyItems,
};

const POST_TEST_COPY: TestCopy = {
  title: m.title,
  notParticipant: m.notParticipant,
  couldNotOpen: m.couldNotOpen,
  intro: (
    <ul className="space-y-3 text-foreground list-disc pl-5">
      <li><Say {...m.count(PART_SIZE)} /></li>
      <li><Say {...m.time(partMinutes)} /></li>
      <li><Say {...m.oneAtATime} /></li>
      <li><Say {...m.noScore} /></li>
    </ul>
  ),
  startLabel: m.start,
  continueLabel: m.continue,
  notReady: reason => NOT_READY[reason],
  preview: count => m.preview(count),
  part: stageIndex => m.part(stageIndex),
  between: (
    <div className="space-y-3 text-foreground">
      <p><Say {...m.part1Done} /></p>
      <p><Say {...m.part2(PART_SIZE, partMinutes)} /></p>
    </div>
  ),
  beginStage2Label: m.startPart2,
};

export const PostTest = ({ onLeave, ...input }: PostTestProps) => (
  <TestSittingScreen state={usePostTest(input)} copy={POST_TEST_COPY} onLeave={onLeave} />
);

/**
 * The verdict on the last scenario, in one card.
 *
 * Deliberately not a stack any more. A reward toast, a correction card and a
 * law card could all be up at once, in a 340px column, while the next scenario
 * was already announcing itself above them — four things to read and a road to
 * drive. One card, one verdict, one score change, and the rule behind it folded
 * away until somebody asks for it.
 */
import ResultCard, { type ScenarioResult } from './ResultCard';

interface FeedbackStackProps {
  result: ScenarioResult | null;
  onDismiss: () => void;
}

const FeedbackStack = ({ result, onDismiss }: FeedbackStackProps) =>
  result ? <ResultCard result={result} onDismiss={onDismiss} /> : null;

export default FeedbackStack;

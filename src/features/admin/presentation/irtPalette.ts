/**
 * The IRT section's block colours: the dataviz reference palette's
 * categorical slots 1-4, one per post-test block, light and dark. Checked
 * with its validator in both modes; two sit under 3:1 on the light surface,
 * so every curve also carries its name and the routing table is the table
 * view.
 */
import type { TestBlock } from '@/domain/assessment/twoStageDesign';

export const BLOCK_COLOR: Readonly<Record<TestBlock, string>> = {
  routing: 'text-[#2a78d6] dark:text-[#3987e5]',
  easy: 'text-[#eb6834] dark:text-[#d95926]',
  medium: 'text-[#1baf7a] dark:text-[#199e70]',
  hard: 'text-[#eda100] dark:text-[#c98500]',
};
export const BLOCK_LABEL: Readonly<Record<TestBlock, string>> = { routing: 'Routing', easy: 'Easy', medium: 'Medium', hard: 'Hard' };

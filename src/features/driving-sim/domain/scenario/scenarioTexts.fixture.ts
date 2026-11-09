/**
 * A catalogue with every text in the game rewritten and reviewed: what the
 * language-independence tests lay over the levels. It holds no real translation.
 */
import { scenarioRoster } from './scenarioRoster';
import { scenarioFingerprint, textsOf, type TranslationCatalogue, type TranslationEntry } from './scenarioTexts';

export const rewrittenCatalogue = (): TranslationCatalogue => {
  const catalogue: Record<string, TranslationEntry> = {};
  for (const { key, owner, paths } of scenarioRoster()) {
    const texts = textsOf(owner, paths);
    catalogue[key] = {
      source: scenarioFingerprint(texts),
      status: 'reviewed',
      fil: Object.fromEntries(Object.keys(texts).map(path => [path, `XXXX ${texts[path]} XXXX`])),
    };
  }
  return catalogue;
};

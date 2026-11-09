/**
 * What the team supplies before the study opens. Kept
 * in the source, so the study-freeze tag pins exactly what participants saw.
 *
 * TEAM TO SUPPLY: replace each placeholder, then rebuild. Until then the
 * survey says it is not ready, and help shows the placeholder.
 */

const PLACEHOLDER = 'TEAM_TO_SUPPLY';

/**
 * The team's ISO/IEC 25010 + TAM Google Form: its "Get pre-filled link" URL
 * up to `viewform`, and the entry id of the question that holds the
 * participant code. Only the code is ever put in the link: never a name or an
 * age.
 */
export const SURVEY_FORM_URL = `https://docs.google.com/forms/d/e/${PLACEHOLDER}/viewform`;
export const SURVEY_CODE_ENTRY = `entry.${PLACEHOLDER}`;

/** How a participant reaches the team, shown on every study screen. */
export const HELP_CONTACT = {
  en: `Message the team: ${PLACEHOLDER}`,
  fil: `Mag-message sa team: ${PLACEHOLDER}`,
};

export const surveyConfigured = (): boolean => !SURVEY_FORM_URL.includes(PLACEHOLDER) && !SURVEY_CODE_ENTRY.includes(PLACEHOLDER);

/** The survey's link with the code filled in, and nothing else. */
export const surveyLink = (code: string, formUrl = SURVEY_FORM_URL, entry = SURVEY_CODE_ENTRY): string => {
  const url = new URL(formUrl);
  url.searchParams.set('usp', 'pp_url');
  url.searchParams.set(entry, code);
  return url.toString();
};

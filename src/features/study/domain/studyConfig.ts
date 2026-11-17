/**
 * What the team supplies before the study opens. Kept
 * in the source, so the study-freeze tag pins exactly what participants saw.
 *
 * The survey says it is not ready while its address is still the placeholder.
 */

const PLACEHOLDER = 'TEAM_TO_SUPPLY';

/**
 * The team's ISO/IEC 25010 + TAM Google Form. The link carries nothing about
 * the participant: no code, no name, no age (the developers' decision,
 * 2026-11-17), so a response cannot be matched to a code from the link.
 */
export const SURVEY_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLScp9jZxj269v6RtqZ_sxw-V7eWcbkBUYOdFMpMTtKYXcu6vIw/viewform';

/**
 * How a participant reaches the team, shown on every study screen: the team's
 * addresses as plain text. They are only shown: never sent anywhere, never put
 * in a link or a URL (no mailto).
 */
export const HELP_CONTACT = {
  intro: { en: 'Message the team:', fil: 'Mag-message sa team:' },
  emails: ['kdelacuesta@fit.edu.ph', 'ldmendoza@fit.edu.ph', 'bsportugal@fit.edu.ph', 'edsantos1@fit.edu.ph'],
} as const;

export const surveyConfigured = (formUrl = SURVEY_FORM_URL): boolean => !formUrl.includes(PLACEHOLDER);

/** The survey's link, exactly the form's address: no query, so nothing about the participant. */
export const surveyLink = (formUrl = SURVEY_FORM_URL): string => {
  const url = new URL(formUrl);
  url.search = '';
  url.hash = '';
  return url.toString();
};

/**
 * Post-study questionnaires (ISO/IEC 25010 quality and TAM acceptance): one
 * record per participant per instrument, item id to a 1-5 Likert value.
 * The items themselves are not in the app yet; this is the storage shape.
 */
export type SurveyInstrument = 'iso25010' | 'tam';

export interface SurveyResponse {
  schemaVersion: 1;
  instrument: SurveyInstrument;
  /** The version of the questionnaire's wording. */
  formVersion: number;
  /** Item id to Likert value, 1 (strongly disagree) to 5 (strongly agree). */
  answers: Record<string, number>;
  timestamp: number;
}

export const isLikert = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 5;

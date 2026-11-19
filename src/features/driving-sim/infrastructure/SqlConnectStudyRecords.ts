/**
 * Implementation B (Firestore + SQL Connect) of the form record the
 * participant writes: the background form, one row per answer in PostgreSQL. The operations are in `dataconnect/connector/`.
 *
 * Every operation runs as the signed-in participant: the connector's @auth
 * rules key each row by `auth.uid`, so a participant can write and read only
 * their own rows.
 */
import { executeMutation, executeQuery, mutationRef, queryRef } from 'firebase/data-connect';
import { sqlConnect } from '@/shared/infrastructure/firebase/dataConnect';
import type { BackgroundResponse } from '@/domain/study/backgroundForm';
import type { BackgroundFormRepository } from '@/features/driving-sim/application/ports';

const iso = (ms: number) => new Date(ms).toISOString();

/** Makes sure the participant's `User` row exists: every other row refers to it. */
const upsertMe = () => executeMutation(mutationRef(sqlConnect(), 'UpsertMe'));

interface BackgroundRow {
  questionId: string;
  formVersion: number;
  answer: string;
  answeredAt: string;
}

export const sqlBackgroundFormRepository: BackgroundFormRepository = {
  async load() {
    const { data } = await executeQuery(queryRef<{ backgroundResponses: BackgroundRow[] }>(sqlConnect(), 'MyBackground'));
    const rows = data.backgroundResponses;
    if (rows.length === 0) return null;
    return {
      schemaVersion: 1,
      formVersion: rows[0].formVersion,
      answers: Object.fromEntries(rows.map(row => [row.questionId, row.answer])),
      timestamp: Math.max(...rows.map(row => Date.parse(row.answeredAt))),
    } satisfies BackgroundResponse;
  },
  async save(_uid, response) {
    await upsertMe();
    for (const [questionId, answer] of Object.entries(response.answers)) {
      await executeMutation(
        mutationRef(sqlConnect(), 'SaveBackgroundAnswer', {
          questionId,
          formVersion: response.formVersion,
          answer,
          answeredAt: iso(response.timestamp),
        })
      );
    }
  },
};

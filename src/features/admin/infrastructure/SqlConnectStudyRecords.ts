/**
 * Implementation B (SQL Connect) of the admin's people, roles and settings
 * reads. The queries are in `dataconnect/connector/queries.gql`; each one is
 * restricted to tokens with the `admin` claim.
 */
import { executeQuery, queryRef } from 'firebase/data-connect';
import { sqlConnect } from '@/shared/infrastructure/firebase/dataConnect';
import type { StudyRecordsRepository } from '@/features/admin/application/ports';
import type { BackgroundRow } from '@/features/admin/domain/adminReport';

const ms = (value: string | null | undefined) => (value ? Date.parse(value) : null);

interface ParticipantSql {
  code: string;
  user: { uid: string; email: string | null };
  consentVersion: string;
  consentedAt: string;
  enrolledAt: string;
  finishedAt: string | null;
  note: string | null;
}

interface RoleGrantSql {
  id: string;
  user: { uid: string; email: string | null };
  role: 'admin';
  action: 'grant' | 'revoke';
  by: string;
  at: string;
  reason: string | null;
}

interface ConfigVersionSql {
  tag: string;
  fingerprint: string;
  config: Record<string, unknown>;
  activeFrom: string;
  activeTo: string | null;
  note: string | null;
}

export const sqlStudyRecords: StudyRecordsRepository = {
  async participants() {
    const { data } = await executeQuery(queryRef<{ participants: ParticipantSql[] }>(sqlConnect(), 'ListParticipants'));
    return data.participants.map(p => ({
      code: p.code,
      uid: p.user.uid,
      email: p.user.email,
      consentVersion: p.consentVersion,
      consentedAt: ms(p.consentedAt)!,
      enrolledAt: ms(p.enrolledAt)!,
      finishedAt: ms(p.finishedAt),
      note: p.note,
    }));
  },
  async roleGrants() {
    const { data } = await executeQuery(queryRef<{ roleGrants: RoleGrantSql[] }>(sqlConnect(), 'ListRoleGrants'));
    return data.roleGrants.map(g => ({ id: g.id, uid: g.user.uid, email: g.user.email, role: g.role, action: g.action, by: g.by, at: ms(g.at)!, reason: g.reason }));
  },
  async configVersions() {
    const { data } = await executeQuery(queryRef<{ configVersions: ConfigVersionSql[] }>(sqlConnect(), 'ListConfigVersions'));
    return data.configVersions.map(c => ({ ...c, activeFrom: ms(c.activeFrom)!, activeTo: ms(c.activeTo) }));
  },
};

interface BackgroundSql {
  user: { uid: string };
  questionId: string;
  formVersion: number;
  answer: string;
  answeredAt: string;
}

/** Implementation B's background answers, one row per question, grouped back into one record per participant. */
export const sqlBackgrounds = async (): Promise<BackgroundRow[]> => {
  const { data } = await executeQuery(queryRef<{ backgroundResponses: BackgroundSql[] }>(sqlConnect(), 'ListBackgroundResponses'));
  const byUser = new Map<string, BackgroundRow>();
  for (const row of data.backgroundResponses) {
    const current = byUser.get(row.user.uid) ?? { userId: row.user.uid, formVersion: row.formVersion, answers: {}, timestamp: 0 };
    current.answers[row.questionId] = row.answer;
    current.timestamp = Math.max(current.timestamp, Date.parse(row.answeredAt));
    byUser.set(row.user.uid, current);
  }
  return [...byUser.values()];
};

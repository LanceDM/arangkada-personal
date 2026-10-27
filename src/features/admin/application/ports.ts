/**
 * What Admin needs from the outside world, stated as an interface.
 *
 * One port rather than four: the report is a single cross-user read, and every
 * screen wants all of it at once. The Firestore implementation is bound by this
 * feature's `composition.ts`.
 */
import type {
  AttemptRow,
  DailyRow,
  ExamRow,
  UserRow,
} from '@/features/admin/domain/adminReport';

export interface AdminReportRepository {
  users(): Promise<UserRow[]>;
  attempts(): Promise<AttemptRow[]>;
  examResults(): Promise<ExamRow[]>;
  dailyResults(): Promise<DailyRow[]>;
}

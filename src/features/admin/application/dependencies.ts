/** The bound implementations of Admin's ports. Provided by `app/dependencies`. */
import type { IrtRepository } from './irtPorts';
import type { PilotPoolRepository, PilotRecordsRepository, StudyInvitesRepository } from './pilotPorts';
import type { AdminReportRepository } from './ports';
import type { QuizEditorRepository } from './quizPorts';

export interface AdminDependencies {
  report: AdminReportRepository;
  pilotPool: PilotPoolRepository;
  invites: StudyInvitesRepository;
  pilotRecords: PilotRecordsRepository;
  quizEditor: QuizEditorRepository;
  irt: IrtRepository;
}

let bound: AdminDependencies | null = null;

export const provideAdminDependencies = (dependencies: AdminDependencies) => {
  bound = dependencies;
};

export const adminDeps = (): AdminDependencies => {
  if (!bound) {
    throw new Error('Admin dependencies were not provided. app/dependencies must run first.');
  }
  return bound;
};

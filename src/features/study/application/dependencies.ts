/** The bound implementations of the study's ports. Provided by `app/dependencies`. */
import type { StudyAccountsGateway, StudyRecordsRepository, StudyRegistryRepository, StudySources } from './ports';

export interface StudyDependencies {
  registry: StudyRegistryRepository;
  accounts: StudyAccountsGateway;
  records: StudyRecordsRepository;
  sources: StudySources;
}

let bound: StudyDependencies | null = null;

export const provideStudyDependencies = (dependencies: StudyDependencies) => {
  bound = dependencies;
};

export const studyDeps = (): StudyDependencies => {
  if (!bound) {
    throw new Error('Study dependencies were not provided. app/dependencies must run first.');
  }
  return bound;
};

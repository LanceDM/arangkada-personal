/** Mock Exam's wiring, for the composition root alone. Kept out of `index.ts`. */
import { provideMockExamDependencies } from './application/dependencies';
import { firebaseExamRepository } from './infrastructure/FirebaseExamRepository';

export const composeMockExam = () => provideMockExamDependencies({ exam: firebaseExamRepository });

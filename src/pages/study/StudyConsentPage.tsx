/** `/study/consent`: the study information and consent. Its step's screen, and only at that step. */
import { ConsentStep } from '@/features/study';
import { StudyStepPage } from './studyStepPage';

const StudyConsentPage = () => <StudyStepPage stage="consent">{({ uid, code, username, done }) => <ConsentStep uid={uid} code={code} username={username} onDone={done} />}</StudyStepPage>;

export default StudyConsentPage;

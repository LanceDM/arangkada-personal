/** `/study/done`: the thank-you and debrief. Its step's screen, and only at that step. */
import { StudyDebrief } from '@/features/study';
import { StudyStepPage } from './studyStepPage';

const StudyDonePage = () => <StudyStepPage stage="done">{({ code }) => <StudyDebrief code={code} />}</StudyStepPage>;

export default StudyDonePage;

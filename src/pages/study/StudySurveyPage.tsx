/** `/study/survey`: the survey, opened with the participant code. Its step's screen, and only at that step. */
import { SurveyStep } from '@/features/study';
import { StudyStepPage } from './studyStepPage';

const StudySurveyPage = () => <StudyStepPage stage="survey">{({ uid, code, surveyOpened, done }) => <SurveyStep uid={uid} code={code} opened={surveyOpened} onDone={done} />}</StudyStepPage>;

export default StudySurveyPage;

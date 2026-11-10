/** `/study/background`: the two questions about the participant. Its step's screen, and only at that step. */
import { BackgroundForm } from '@/features/study';
import { StudyStepPage } from './studyStepPage';

const StudyBackgroundPage = () => <StudyStepPage stage="background">{({ uid, done }) => <BackgroundForm uid={uid} onDone={done} />}</StudyStepPage>;

export default StudyBackgroundPage;

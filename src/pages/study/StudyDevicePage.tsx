/** `/study/device`: the device check, before the pre-test (D3). Its step's screen, and only at that step. */
import { DeviceCheck } from '@/features/study';
import { StudyStepPage } from './studyStepPage';

const StudyDevicePage = () => <StudyStepPage stage="device">{({ uid, done }) => <DeviceCheck uid={uid} onDone={done} />}</StudyStepPage>;

export default StudyDevicePage;

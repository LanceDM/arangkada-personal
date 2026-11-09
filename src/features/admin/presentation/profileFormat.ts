import type { DeviceType, GamingFrequency } from '@/domain/study/consentRecords';
import type { TestProgress } from '@/domain/study/studyStage';
import type { PilotDeviceCheck } from '@/features/admin/domain/pilotProgress';

const GAMING_LABEL: Record<GamingFrequency, string> = {
  never: 'Never',
  'less-than-monthly': 'Less than once a month',
  monthly: 'About once a month',
  weekly: 'Every week',
  daily: 'Every day',
};

const DEVICE_LABEL: Record<DeviceType, string> = { phone: 'Phone', tablet: 'Tablet', laptop: 'Laptop', desktop: 'Desktop computer' };

const TEST_LABEL: Record<TestProgress, string> = { none: 'Not started', open: 'Started, not finished', finished: 'Finished' };

export const gamingLabel = (gaming: GamingFrequency | null) => (gaming ? GAMING_LABEL[gaming] : '—');

export const deviceLabel = (device: DeviceType | null) => (device ? DEVICE_LABEL[device] : '—');

export const testLabel = (test: TestProgress) => TEST_LABEL[test];

export const deviceCheckLabel = (check: PilotDeviceCheck | null) =>
  check
    ? `${check.touch ? 'Touch' : 'Keyboard'} · ${Math.round(check.medianFps)} fps · ${check.width}×${check.height}${check.slow ? ' · slow, warned' : ''}`
    : '—';

export const dateTime = (at: number | null) =>
  at === null ? '—' : new Date(at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

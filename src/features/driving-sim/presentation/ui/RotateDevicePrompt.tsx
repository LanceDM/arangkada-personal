/**
 * Asks a touch player to turn the device on its side.
 *
 * The road is tall and the thumbs need the space either side of it, so the
 * drive is laid out for landscape only. While this is up the drive does not
 * advance at all - the host stops updating it, as it does for a hidden tab -
 * so turning the device costs no road.
 */
import { RotateCcw } from 'lucide-react';
import { Say } from '@/shared/i18n/language';
import { driveMessages as m } from './messages';

const RotateDevicePrompt = () => (
  <div
    role="alertdialog"
    aria-labelledby="rotate-device-title"
    className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-4 bg-background px-8 text-center"
    data-testid="rotate-device"
  >
    <RotateCcw className="h-12 w-12 text-primary" aria-hidden />
    <p id="rotate-device-title" className="font-display text-lg font-black uppercase tracking-[0.12em] text-foreground">
      <Say {...m.turnDevice} />
    </p>
    <p className="max-w-xs text-[15px] leading-6 text-muted-foreground">
      <Say {...m.turnDeviceNote} />
    </p>
  </div>
);

export default RotateDevicePrompt;

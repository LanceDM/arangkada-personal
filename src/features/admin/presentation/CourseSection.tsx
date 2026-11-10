/**
 * Admin > Course: the per-competency course the study plays. The shared
 * Q-table as it learns, live (8 states by 3 actions, warm-up phase,
 * exploring or exploiting, the newest updates), and the study export. Every
 * figure is from real participants: nothing here is simulated.
 */
import { Download, RefreshCw } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { STUDY_EXPORTS, useStudyExport } from '@/features/admin/application/useStudyExport';
import { Panel, SectionHeader } from './adminUi';
import { QTablePanel } from './QTablePanel';

export const CourseSection = ({ enabled }: { enabled: boolean }) => {
  const study = useStudyExport(enabled);
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Course"
        description="The per-competency course: the shared Q-table the routing FSM learns online from participants, and the study data export (BKT per participant, decisions, rewards, Q updates)."
        meta={study.loading ? 'Reading the report…' : `${study.participants} participant(s) with course records`}
        actions={
          <Button variant="outline" size="sm" onClick={() => void study.refresh()} disabled={study.loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />
      <QTablePanel />
      <Panel
        title="Study export"
        description="BKT is replayed per participant from their evidence and also exported as logged; the Q-table export is its update log, in order."
      >
        <div className="flex flex-wrap gap-2">
          {STUDY_EXPORTS.map(({ kind, label }) => (
            <Button key={kind} variant={kind === 'json' ? 'default' : 'outline'} disabled={study.busy !== null || study.loading} onClick={() => void study.exportStudy(kind)}>
              <Download className="mr-2 h-4 w-4" />
              {study.busy === kind ? 'Exporting…' : label}
            </Button>
          ))}
        </div>
        {study.error && <p className="mt-3 text-sm text-destructive">{study.error}</p>}
      </Panel>
    </div>
  );
};

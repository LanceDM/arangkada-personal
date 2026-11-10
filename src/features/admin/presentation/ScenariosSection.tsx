/**
 * Admin > Scenarios: every level's road and every scenario a drive can put on
 * it, with the numbers the game runs on: where it stands, how far ahead it is
 * announced, the speed limit and any posted speed, and each target it is
 * graded against (shown to the player the same way). Read straight from the
 * level content, so it is always the configuration this build plays.
 */
import { Fragment, useMemo, useState } from 'react';
import type { LevelConfigRow, ScenarioConfigRow } from '@/features/driving-sim';
import { Badge } from '@/shared/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { COMPETENCIES, getCompetencyLabel } from '@/domain/learner/profile';
import { Legend, Panel, SearchField, SectionHeader } from './adminUi';

const dash = (value: number | null | undefined, unit = '') => (value === null || value === undefined ? '–' : `${value}${unit}`);

const LevelsPanel = ({ levels }: { levels: readonly LevelConfigRow[] }) => (
  <Panel
    title="Levels"
    description="Each level's road. Metres are on the speed scale (how far the car travels at its speed); seconds at the limit leave out stops and questions. The time limit is twice the longest correct reference drive (time-limits:update)."
    bodyClassName="p-0"
  >
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Level</TableHead>
            <TableHead>Road</TableHead>
            <TableHead>Speed limit</TableHead>
            <TableHead>Length</TableHead>
            <TableHead>At the limit</TableHead>
            <TableHead>Time limit</TableHead>
            <TableHead>Pass mark</TableHead>
            <TableHead>On its road</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {levels.map(level => (
            <TableRow key={level.id}>
              <TableCell className="text-xs font-semibold">
                L{level.id} {level.name}
              </TableCell>
              <TableCell className="text-xs">{level.roadClass}</TableCell>
              <TableCell className="text-xs">{level.speedLimit} km/h</TableCell>
              <TableCell className="text-xs">
                {level.roadLengthM} m <span className="text-muted-foreground">({level.roadLengthUnits} u)</span>
              </TableCell>
              <TableCell className="text-xs">{level.secondsAtLimit} s</TableCell>
              <TableCell className="text-xs">{dash(level.timeLimitS, ' s')}</TableCell>
              <TableCell className="text-xs">{level.requiredScore}</TableCell>
              <TableCell className="text-xs">
                {level.roadEvents} road events
                {level.garageChecks ? ` · ${level.garageChecks} garage` : ''}
                {level.aftermathChecks ? ` · ${level.aftermathChecks} crash scene` : ''}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  </Panel>
);

export const ScenariosSection = ({ levels, scenarios }: { levels: readonly LevelConfigRow[]; scenarios: readonly ScenarioConfigRow[] }) => {
  const [level, setLevel] = useState('');
  const [competency, setCompetency] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return scenarios.filter(
      row =>
        (!level || String(row.levelId) === level) &&
        (!competency || row.competency === competency) &&
        (!needle || `${row.id} ${row.label} ${row.description} ${row.instruction}`.toLowerCase().includes(needle))
    );
  }, [scenarios, level, competency, search]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Scenarios"
        description="Every level's road and every scenario its drives can draw, with the numbers each is configured and graded on. Read from this build's content."
        meta={`${scenarios.length} scenarios over ${levels.length} levels`}
      />
      <Legend
        title="Legend: scenarios"
        items={[
          { term: 'Answered by', meaning: 'driving (graded on what the car does), question (multiple choice), or inspection (a document check). "correct" is the action that passes.' },
          { term: 'road / garage / aftermath', meaning: 'On the road, at the garage check before the drive, or at the crash scene after it.' },
          { term: 'Source', meaning: "level road: on the level's own road; pool slot N: one of the variants drawn for that slot; stage extra / borrowed: added to course drives for a competency." },
          { term: 'at N m', meaning: 'Where it stands on the road, in metres on the speed scale (how far the car travels at its speed).' },
          { term: 'Warning', meaning: 'How far ahead it is announced, in metres and in seconds at the speed limit.' },
          { term: 'limit / posted', meaning: "The road's speed limit, and a different speed its sign posts." },
          { term: 'Targets', meaning: 'Every number it is graded on, word for word as the player reads it.' },
          { term: 'u', meaning: "The game's route units (about 10.8 per metre at the default pace)." },
        ]}
      />
      <LevelsPanel levels={levels} />
      <Panel
        title="Scenarios"
        description="Click a scenario for its situation, the instruction the player reads (targets included) and the rule it cites. Road position and warning are in metres on the speed scale, and seconds at the limit."
        actions={
          <div className="flex flex-wrap gap-2">
            <select aria-label="Level" value={level} onChange={e => setLevel(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-xs">
              <option value="">Every level</option>
              {levels.map(l => (
                <option key={l.id} value={l.id}>
                  L{l.id} {l.name}
                </option>
              ))}
            </select>
            <select aria-label="Competency" value={competency} onChange={e => setCompetency(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-xs">
              <option value="">Every competency</option>
              {COMPETENCIES.map(c => (
                <option key={c} value={c}>
                  {getCompetencyLabel(c)}
                </option>
              ))}
            </select>
            <SearchField label="Search scenarios" value={search} onChange={setSearch} />
          </div>
        }
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Level</TableHead>
                <TableHead>Scenario</TableHead>
                <TableHead>Competency</TableHead>
                <TableHead>Answered by</TableHead>
                <TableHead>Where</TableHead>
                <TableHead>Warning</TableHead>
                <TableHead>Speed</TableHead>
                <TableHead>Targets</TableHead>
                <TableHead>Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => {
                const key = `${row.levelId}|${row.id}`;
                return (
                  <Fragment key={key}>
                    <TableRow className="cursor-pointer align-top" onClick={() => setOpen(open === key ? null : key)}>
                      <TableCell className="text-xs">L{row.levelId}</TableCell>
                      <TableCell className="text-xs">
                        <div className="font-semibold">{row.label}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{row.id}</div>
                      </TableCell>
                      <TableCell className="text-xs">{row.competency ? getCompetencyLabel(row.competency) : '–'}</TableCell>
                      <TableCell className="text-xs">
                        {row.answeredBy}
                        <div className="text-muted-foreground">correct: {row.correctAction}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="secondary">{row.place}</Badge>
                        <div className="mt-1 text-muted-foreground">{row.source}</div>
                        {row.atM !== null && <div>at {row.atM} m</div>}
                      </TableCell>
                      <TableCell className="text-xs">{row.warningM !== null ? `${row.warningM} m · ${row.warningS} s` : '–'}</TableCell>
                      <TableCell className="text-xs">
                        limit {row.speedLimit}
                        {row.postedSpeed !== null && <div>posted {row.postedSpeed}</div>}
                      </TableCell>
                      <TableCell className="max-w-xs text-xs">{row.targets.length ? row.targets.map(t => t.replace(/^Target: /, '')).join(' · ') : '–'}</TableCell>
                      <TableCell className="text-xs">
                        {row.points}
                        {row.severity && <div className="text-muted-foreground">{row.severity}</div>}
                      </TableCell>
                    </TableRow>
                    {open === key && (
                      <TableRow>
                        <TableCell colSpan={9} className="bg-muted/30 text-xs">
                          <p>
                            <span className="font-semibold">Situation:</span> {row.description}
                          </p>
                          <p className="mt-1">
                            <span className="font-semibold">The player reads:</span> {row.instruction || '–'}
                          </p>
                          {row.lawCitation && (
                            <p className="mt-1">
                              <span className="font-semibold">Rule:</span> {row.lawCitation}
                            </p>
                          )}
                          <p className="mt-1 text-muted-foreground">
                            Type {row.type}
                            {row.atUnits !== null ? ` · trigger at ${row.atUnits} route units` : ''} · applies {row.appliesSpeed} km/h
                          </p>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Panel>
    </div>
  );
};

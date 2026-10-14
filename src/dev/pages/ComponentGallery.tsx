// Dev-only. Mounts every popup/card/HUD component in isolation, fed from the
// real content catalog in src/dev/scenarioCatalog.ts, so every visual variant
// can be browsed without playing the game. Only registered as a route when
// import.meta.env.DEV (see app/router/AppRouter.tsx) - never reachable in production.
import { useState, type ReactNode } from 'react';
import type { GarageHotspot } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import ResultCard from '@/features/driving-sim/presentation/ui/feedback/ResultCard';
import { scenarioLabel } from '@/features/driving-sim/domain/scenario/scenarioCopy';
import CheckpointInspection from '@/features/driving-sim/presentation/ui/decisions/CheckpointInspection';
import RoadDecision from '@/features/driving-sim/presentation/ui/decisions/RoadDecision';
import SignPlateCard from '@/features/driving-sim/presentation/ui/SignPlateCard';
import MarkingPlateCard from '@/features/driving-sim/presentation/ui/MarkingPlateCard';
import GarageStage from '@/features/driving-sim/presentation/ui/GarageStage';
import MissionQuiz from '@/features/driving-sim/presentation/ui/MissionQuiz';
import MissionBriefing from '@/features/driving-sim/presentation/ui/MissionBriefing';
import LessonReader from '@/features/driving-sim/presentation/ui/LessonReader';
import MissionPanel from '@/features/driving-sim/presentation/ui/MissionPanel';
import GameHUD from '@/features/driving-sim/presentation/ui/GameHUD';
import { LevelComplete } from '@/features/progression/index';
import SaveProgressModal from '@/features/progression/presentation/SaveProgressModal';
import type { DecisionEntry } from '@/features/driving-sim/application/useScenarioEvaluation';
import type { LevelResult } from '@/domain/learner/attempt';
import Stepper from '@/dev/components/Stepper';
import { allScenarioEvents, signEvents, markingEvents, inspectionEvents, cutsceneEvents, emergencyEvents, stages, garageHotspots, garageHotspotSlots, defaultGarage, levelModules, levelConfigs, labelForEvent, } from '@/dev/fixtures/scenarioCatalog';
import EmergencyDecision from '@/features/driving-sim/presentation/ui/decisions/EmergencyDecision';
import CrashResponseStage from '@/features/driving-sim/presentation/ui/stage/CrashResponseStage';


const CATEGORIES = [
  'correction-card', 'law-card', 'checkpoint-inspection',
  'road-decision', 'emergency', 'sign-plate', 'marking-plate', 'game-hud', 'mission-panel',
  'garage-stage', 'crash-scene', 'mission-quiz', 'mission-briefing', 'lesson-reader',
  'level-complete', 'save-progress-modal',
] as const;
type CategoryKey = (typeof CATEGORIES)[number];

/**
 * Answers are shuffled per mission attempt in the real game. The gallery pins
 * the seed to 0, which is the authored order: a stage opened for visual QA
 * should look the same every time it is opened.
 */
const GALLERY_CHOICE_SEED = 0;

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  'correction-card': 'Result — got it wrong',
  'law-card': 'Result — got it right',
  'checkpoint-inspection': 'Checkpoint Inspection',
  'road-decision': 'Road Decision',
  emergency: 'Emergency Decision',
  'sign-plate': 'Sign Plate',
  'marking-plate': 'Marking Plate',
  'game-hud': 'Game HUD',
  'mission-panel': 'Mission Panel',
  'garage-stage': 'Garage Stage',
  'crash-scene': 'Crash Response',
  'mission-quiz': 'Mission Quiz',
  'mission-briefing': 'Mission Briefing',
  'lesson-reader': 'Lesson Reader',
  'level-complete': 'Level Complete',
  'save-progress-modal': 'Save Progress Modal',
};

const useVariant = <T,>(items: T[]) => {
  const [index, setIndex] = useState(0);
  const clamped = Math.min(index, Math.max(items.length - 1, 0));
  return { item: items[clamped], items, index: clamped, setIndex, count: items.length };
};

/** The `Stepper` dropdown wrapper style used throughout this page - a full-width header bar rather than Renderer Lab's boxed sidebar control. */
const GALLERY_STEPPER_CLASS = 'border-b border-border bg-card/60 px-4 py-2';

const noop = () => {};

/**
 * The stage every component previews inside. Most of these components use
 * `fixed inset-0`; giving this box its own CSS transform makes those fixed
 * descendants position relative to *it* instead of the viewport (a standard
 * CSS containment trick), so a full-screen modal doesn't bury the sidebar.
 */
const Stage = ({ children }: { children: ReactNode }) => (
  <div
    className="relative h-[80vh] min-h-[520px] w-full overflow-auto rounded-xl border border-border bg-background"
    style={{ transform: 'translateZ(0)' }}
  >
    {children}
  </div>
);

const ComponentGallery = () => {
  const [category, setCategory] = useState<CategoryKey>('correction-card');

  const correction = useVariant(allScenarioEvents.filter(e => e.penaltyMessage));
  const law = useVariant(allScenarioEvents.filter(e => e.lawCitation));
  const inspection = useVariant(inspectionEvents);
  const roadCall = useVariant(cutsceneEvents);
  const emergency = useVariant(emergencyEvents);
  const stage = useVariant(stages);
  const sign = useVariant(signEvents);
  const marking = useVariant(markingEvents);
  const level = useVariant(levelConfigs);
  const module_ = useVariant(levelModules);
  const hotspotSwap = useVariant(garageHotspots);

  const wrongAction = correction.item
    ? (correction.item.correctAction === 'brake' ? 'accelerate' : 'brake')
    : 'brake';

  const mockDecisions: DecisionEntry[] = allScenarioEvents.slice(0, 3).map((event, i) => ({
    id: i,
    isCorrect: i % 2 === 0,
    competency: event.competency,
    action: event.correctAction,
    expectedAction: i % 2 === 0 ? undefined : event.correctAction,
    kind: 'road',
    title: event.description,
  }));

  const mockResult: LevelResult = {
    levelId: level.item?.id ?? 1,
    score: 85,
    stars: 3,
    completed: true,
    violations: 2,
    correctActions: 6,
    logs: [],
  };

  const swappedGarage = hotspotSwap.item
    ? {
        ...defaultGarage,
        hotspots: defaultGarage.hotspots.map((h, i): GarageHotspot =>
          garageHotspotSlots[i]?.shell.id === hotspotSwap.item.id ? hotspotSwap.item : h
        ),
      }
    : defaultGarage;

  return (
    <div className="flex h-screen w-screen bg-background text-foreground">
      <aside className="flex w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border p-3">
        <p className="mb-2 font-display text-xs uppercase tracking-wider text-muted-foreground">
          Component Gallery
        </p>
        {CATEGORIES.map(key => (
          <button
            key={key}
            onClick={() => setCategory(key)}
            className={`rounded-md px-2.5 py-1.5 text-left text-xs font-semibold ${
              category === key ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'
            }`}
          >
            {CATEGORY_LABELS[key]}
          </button>
        ))}
      </aside>

      <main className="flex-1 overflow-y-auto p-4">
        {category === 'correction-card' && correction.item && (
          <>
            <Stepper
              index={correction.index}
              count={correction.count}
              onChange={correction.setIndex}
              labels={correction.items.map(labelForEvent)}
              wrapperClassName={GALLERY_STEPPER_CLASS}
            />
            <Stage>
              <div className="absolute bottom-4 left-4 w-[340px]">
                <ResultCard
                  result={{
                    label: scenarioLabel(correction.item),
                    correct: false,
                    message: correction.item.penaltyMessage,
                    points: -Math.ceil(correction.item.points / 2),
                    action: wrongAction,
                    expectedAction: correction.item.correctAction,
                    citation: correction.item.lawCitation,
                  }}
                  onDismiss={noop}
                />
              </div>
            </Stage>
          </>
        )}

        {category === 'law-card' && law.item && (
          <>
            <Stepper
              index={law.index}
              count={law.count}
              onChange={law.setIndex}
              labels={law.items.map(labelForEvent)}
              wrapperClassName={GALLERY_STEPPER_CLASS}
            />
            <Stage>
              <div className="absolute bottom-4 left-4 w-[340px]">
                <ResultCard
                  result={{
                    label: scenarioLabel(law.item),
                    correct: true,
                    message: law.item.rewardMessage,
                    points: law.item.points,
                    citation: law.item.lawCitation,
                  }}
                  onDismiss={noop}
                />
              </div>
            </Stage>
          </>
        )}

        {category === 'checkpoint-inspection' && inspection.item && (
          <>
            <Stepper
              index={inspection.index}
              count={inspection.count}
              onChange={inspection.setIndex}
              labels={inspection.items.map(labelForEvent)}
              wrapperClassName={GALLERY_STEPPER_CLASS}
            />
            <Stage>
              <CheckpointInspection event={inspection.item} onAnswer={noop} choiceSeed={GALLERY_CHOICE_SEED} />
            </Stage>
          </>
        )}

        {category === 'road-decision' && roadCall.item && (
          <>
            <Stepper
              index={roadCall.index}
              count={roadCall.count}
              onChange={roadCall.setIndex}
              labels={roadCall.items.map(labelForEvent)}
              wrapperClassName={GALLERY_STEPPER_CLASS}
            />
            <Stage>
              {/* No driving canvas behind it here, so the resolution it
                  normally waits on can never arrive: `played` is pinned true
                  so choosing an answer steps straight to the verdict and both
                  states stay previewable in isolation. */}
              <RoadDecision
                event={roadCall.item}
                onPlay={noop}
                played
                onAnswer={noop}
                choiceSeed={GALLERY_CHOICE_SEED}
              />
            </Stage>
          </>
        )}

        {category === 'emergency' && emergency.item && (
          <>
            <Stepper
              index={emergency.index}
              count={emergency.count}
              onChange={emergency.setIndex}
              labels={emergency.items.map(labelForEvent)}
              wrapperClassName={GALLERY_STEPPER_CLASS}
            />
            <Stage>
              {/* Every phase is reachable from here: the panel plays the
                  emergency out on its own clock, so picking an answer steps
                  through resolving to the verdict without a drive behind it. */}
              <EmergencyDecision event={emergency.item} onAnswer={noop} choiceSeed={GALLERY_CHOICE_SEED} />
            </Stage>
          </>
        )}

        {category === 'crash-scene' && stage.item && (
          <>
            <Stepper
              index={stage.index}
              count={stage.count}
              onChange={stage.setIndex}
              labels={stage.items.map(entry => entry.name)}
              wrapperClassName={GALLERY_STEPPER_CLASS}
            />
            <Stage>
              {/* A crash scene gets its own screen; a pre-drive garage keeps
                  the inspection one. Stepping through every stage in the game
                  here is what makes the difference between them visible. */}
              {stage.item.stage.scene === 'crash_scene' ? (
                <CrashResponseStage
                  stage={stage.item.stage}
                  levelName={stage.item.name}
                  score={0}
                  choiceSeed={GALLERY_CHOICE_SEED}
                  onAnswer={noop}
                  onComplete={noop}
                  onExit={noop}
                />
              ) : (
                <GarageStage
                  garage={stage.item.stage}
                  levelName={stage.item.name}
                  score={0}
                  choiceSeed={GALLERY_CHOICE_SEED}
                  onAnswer={noop}
                  onComplete={noop}
                  onExit={noop}
                />
              )}
            </Stage>
          </>
        )}

        {category === 'sign-plate' && sign.item?.sign && (
          <>
            <Stepper
              index={sign.index}
              count={sign.count}
              onChange={sign.setIndex}
              labels={sign.items.map(labelForEvent)}
              wrapperClassName={GALLERY_STEPPER_CLASS}
            />
            <Stage>
              <div className="p-4">
                <SignPlateCard sign={sign.item.sign} />
              </div>
            </Stage>
          </>
        )}

        {category === 'marking-plate' && marking.item?.marking && (
          <>
            <Stepper
              index={marking.index}
              count={marking.count}
              onChange={marking.setIndex}
              labels={marking.items.map(labelForEvent)}
              wrapperClassName={GALLERY_STEPPER_CLASS}
            />
            <Stage>
              <div className="p-4">
                <MarkingPlateCard marking={marking.item.marking} />
              </div>
            </Stage>
          </>
        )}

        {category === 'game-hud' && (
          <>
            <Stage>
              <GameHUD
                score={1240}
                speed={42}
                levelName="Barangay Streets"
                levelId={1}
                onExit={noop}
                position={{ place: 'through-lane', lane: 1, auxiliary: null, crossingOpen: false }}
                cue={{ place: 'LANE 2', action: null, note: null, tone: 'neutral' }}
                requiredLanes={[0]}
                targetSpeed={40}
              />
            </Stage>
          </>
        )}

        {category === 'mission-panel' && level.item && (
          <>
            <Stepper
              index={level.index}
              count={level.count}
              onChange={level.setIndex}
              labels={level.items.map(l => l.name)}
              wrapperClassName={GALLERY_STEPPER_CLASS}
            />
            <Stage>
              <div className="max-w-[340px] p-4">
                <MissionPanel
                  level={level.item}
                  score={140}
                  progress={0.6}
                  eventsCleared={2}
                  decisions={mockDecisions}
                />
              </div>
            </Stage>
          </>
        )}

        {category === 'garage-stage' && hotspotSwap.item && (
          <>
            <Stepper
              index={hotspotSwap.index}
              count={hotspotSwap.count}
              onChange={hotspotSwap.setIndex}
              labels={hotspotSwap.items.map(h => `${h.id} — ${h.label}`)}
              wrapperClassName={GALLERY_STEPPER_CLASS}
            />
            <Stage>
              <GarageStage
                garage={swappedGarage}
                levelName="Garage Readiness"
                score={0}
                choiceSeed={GALLERY_CHOICE_SEED}
                onAnswer={noop}
                onComplete={noop}
                onExit={noop}
              />
            </Stage>
          </>
        )}

        {category === 'mission-quiz' && module_.item && (
          <>
            <Stepper
              index={module_.index}
              count={module_.count}
              onChange={module_.setIndex}
              labels={module_.items.map(m => m.title)}
              wrapperClassName={GALLERY_STEPPER_CLASS}
            />
            <Stage>
              <MissionQuiz module={module_.item} onPass={noop} onClose={noop} />
            </Stage>
          </>
        )}

        {category === 'mission-briefing' && level.item && (
          <>
            <Stepper
              index={level.index}
              count={level.count}
              onChange={level.setIndex}
              labels={level.items.map(l => l.name)}
              wrapperClassName={GALLERY_STEPPER_CLASS}
            />
            <Stage>
              <MissionBriefing level={level.item} onBack={noop} onStartGame={noop} />
            </Stage>
          </>
        )}

        {category === 'lesson-reader' && module_.item && (
          <>
            <Stepper
              index={module_.index}
              count={module_.count}
              onChange={module_.setIndex}
              labels={module_.items.map(m => m.title)}
              wrapperClassName={GALLERY_STEPPER_CLASS}
            />
            <Stage>
              <LessonReader module={module_.item} onClose={noop} onFinish={noop} />
            </Stage>
          </>
        )}

        {category === 'level-complete' && level.item && (
          <>
            <Stepper
              index={level.index}
              count={level.count}
              onChange={level.setIndex}
              labels={level.items.map(l => l.name)}
              wrapperClassName={GALLERY_STEPPER_CLASS}
            />
            <Stage>
              <LevelComplete
                result={mockResult}
                level={level.item}
                onNext={noop}
                onRetry={noop}
                onMenu={noop}
                hasNextLevel
              />
            </Stage>
          </>
        )}

        {category === 'save-progress-modal' && (
          <Stage>
            <SaveProgressModal totalScore={12500} completedLevels={7} onDismiss={noop} />
          </Stage>
        )}
      </main>
    </div>
  );
};

export default ComponentGallery;

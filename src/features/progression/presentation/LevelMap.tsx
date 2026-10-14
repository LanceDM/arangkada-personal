import { useProgressStore } from '@/features/progression';
import { LEVELS } from '@/features/driving-sim';
import { Star, Lock, Trophy, ArrowLeft, Flag, Car, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Button } from '@/shared/ui/button';

/**
 * The course in a New group: the routing FSM decides the next course
 * entry, so the ladder offers Continue, levels already passed as free replays,
 * and locks the rest. Absent in Legacy, where every level stays open as today.
 */
export interface LevelMapCourse {
  /** The level Continue plays next; null once certified or while the course loads. */
  frontierLevelId: number | null;
  certified: boolean;
  /** Every level free to play: developers and admins, for testing. */
  openAll: boolean;
  loading: boolean;
  onContinue: () => void;
}

interface LevelMapProps {
  onSelectLevel: (levelId: number) => void;
  course?: LevelMapCourse | null;
  /** Rendered under the header: the developers' and admins' routing override. */
  aside?: ReactNode;
}

const LevelMap = ({ onSelectLevel, course, aside }: LevelMapProps) => {
  const { levelResults, totalScore } = useProgressStore();

  const navigate = useNavigate();

  return (
    <div className="min-h-screen pt-10 pb-12 px-6 flex flex-col items-center">
      {/* Back Button */}
      <div className="mb-6 flex w-full max-w-2xl justify-start">
        <Button variant="ghost" size="sm" onClick={() => navigate('/play')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
      </div>
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="font-display text-5xl md:text-6xl font-bold text-primary text-glow-yellow tracking-wider">
          ARANGKADA
        </h1>
        <p className="text-muted-foreground mt-2 text-sm tracking-widest uppercase">
          Driving Simulation System
        </p>
        <div className="flex items-center justify-center gap-2 mt-4 bg-card rounded-xl px-6 py-3 border border-border">
          <Trophy className="w-5 h-5 text-primary" />
          <span className="font-display text-lg text-primary">{totalScore}</span>
          <span className="text-muted-foreground text-sm">Total Points</span>
        </div>
        {course && (
          <div className="mt-4 flex justify-center">
            {course.certified ? (
              <span className="rounded-xl border border-accent/40 bg-accent/10 px-6 py-3 font-display text-sm tracking-wider text-accent">
                COURSE COMPLETE
              </span>
            ) : (
              <button
                onClick={course.onContinue}
                disabled={course.loading || course.frontierLevelId === null}
                className="rounded-xl bg-primary px-8 py-3 font-display text-sm tracking-wider text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {course.loading ? 'LOADING YOUR COURSE…' : 'CONTINUE COURSE →'}
              </button>
            )}
          </div>
        )}
        {aside && <div className="mt-4 flex justify-center">{aside}</div>}
      </div>

      {/* Road Map */}
      <div className="relative w-full max-w-md">
        {/* Road background */}
        <div className="absolute left-1/2 top-0 bottom-0 w-16 -translate-x-1/2 bg-secondary rounded-full" />
        <div className="absolute left-1/2 top-0 bottom-0 w-1 -translate-x-1/2 road-stripe opacity-60" />

        {/* Level nodes */}
        <div className="relative flex flex-col items-center gap-4 pb-8">
          {/* Finish flag at top */}
          <div className="relative z-10 flex flex-col items-center mb-2">
            <div className="w-14 h-14 rounded-full bg-card border-2 border-primary flex items-center justify-center glow-yellow">
              <Flag className="h-6 w-6 text-primary" />
            </div>
            <span className="font-display text-xs text-primary mt-1">FINISH</span>
          </div>

          {[...LEVELS].reverse().map((level, idx) => {
            // Legacy: const isUnlocked = unlockedLevels.includes(level.id);
            // In a New group the routing FSM's frontier decides instead: what
            // is below it can be replayed, the frontier is Continue, and what
            // is above it waits.
            const isFrontier = course ? level.id === course.frontierLevelId : false;
            const isUnlocked = course
              ? course.certified ||
                course.openAll ||
                (course.frontierLevelId !== null && level.id <= course.frontierLevelId)
              : true; // For testing purposes, all levels are unlocked
            const select = () => (isFrontier ? course!.onContinue() : onSelectLevel(level.id));
            const result = levelResults[level.id];
            const stars = result?.stars || 0;
            const isLeft = idx % 2 === 0;

            return (
              <div
                key={level.id}
                className={`relative z-10 flex items-center gap-4 w-full max-w-xs ${isLeft ? 'flex-row-reverse mr-auto ml-8' : 'ml-auto mr-8'}`}
              >
                {/* Info card */}
                <div className={`flex-1 ${isLeft ? 'text-right' : 'text-left'}`}>
                  <p className="font-display text-xs text-muted-foreground">LEVEL {level.id}</p>
                  <p className="font-body text-sm font-semibold text-foreground">{level.name}</p>
                  <div className="flex gap-0.5 mt-1" style={{ justifyContent: isLeft ? 'flex-end' : 'flex-start' }}>
                    {[1, 2, 3].map(s => (
                      <Star
                        key={s}
                        className={`w-3.5 h-3.5 ${s <= stars ? 'text-primary fill-primary' : 'text-muted-foreground/30'}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Node button */}
                <button
                  disabled={!isUnlocked}
                  onClick={() => isUnlocked && select()}
                  className={`relative w-16 h-16 rounded-full border-3 flex items-center justify-center transition-all duration-300 shrink-0
                    ${isUnlocked
                      ? 'bg-card border-primary hover:scale-110 cursor-pointer glow-yellow active:scale-95'
                      : 'bg-secondary border-border cursor-not-allowed opacity-50'
                    }`}
                >
                  {isUnlocked ? (
                    <span className="font-display text-xl font-bold text-primary">{level.id}</span>
                  ) : (
                    <Lock className="w-5 h-5 text-muted-foreground" />
                  )}
                  {isFrontier && (
                    <span className="absolute -bottom-2 rounded-full bg-primary px-2 font-display text-[9px] font-black text-primary-foreground">
                      NEXT
                    </span>
                  )}
                  {result?.completed && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-accent rounded-full flex items-center justify-center">
                      <Check className="h-3 w-3 text-accent-foreground" />
                    </div>
                  )}
                </button>
              </div>
            );
          })}

          {/* Start flag at bottom */}
          <div className="relative z-10 flex flex-col items-center mt-2">
            <div className="w-14 h-14 rounded-full bg-card border-2 border-accent flex items-center justify-center glow-green">
              <Car className="h-6 w-6 text-accent" />
            </div>
            <span className="font-display text-xs text-accent mt-1">START</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LevelMap;

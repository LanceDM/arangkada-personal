/**
 * The player report's state: the four collections it reads, the player
 * search and selection, the attempts' filters and how many are shown, the
 * rule search, and the two downloads.
 */
import { useMemo, useState } from 'react';
import { LEVELS } from '@/features/driving-sim';
import { buildAdminJSONExport, buildAttemptsCSV, downloadFile } from '@/features/admin/domain/adminExport';
import { buildRuleSummaries } from '@/features/admin/domain/adminRules';
import {
  filterAttempts,
  matchesPlayer,
  playerLevels,
  recentDecisions,
  reportPlayers,
  reportTotals,
} from '@/features/admin/domain/playerReport';
import { useAdminData } from './useAdminData';

/** Attempts shown at first, and added by each "Show more". */
export const ATTEMPTS_PAGE = 50;

export const usePlayerReport = (enabled: boolean) => {
  const source = useAdminData(enabled);
  const { users, attempts, examResults, dailyResults } = source;

  const [playerQuery, setPlayerQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [attemptLevel, setAttemptLevel] = useState<number | null>(null);
  const [attemptQuery, setAttemptQuery] = useState('');
  const [attemptsShown, setAttemptsShown] = useState(ATTEMPTS_PAGE);
  const [ruleQuery, setRuleQuery] = useState('');

  const data = useMemo(() => ({ users, attempts, examResults, dailyResults }), [users, attempts, examResults, dailyResults]);
  const totals = useMemo(() => reportTotals(data), [data]);
  const allPlayers = useMemo(() => reportPlayers(data), [data]);
  const playersById = useMemo(() => new Map(allPlayers.map(player => [player.id, player])), [allPlayers]);
  const players = useMemo(() => allPlayers.filter(player => matchesPlayer(player, playerQuery)), [allPlayers, playerQuery]);

  const selected = useMemo(() => {
    const player = selectedId ? playersById.get(selectedId) : undefined;
    if (!player) return null;
    const own = attempts.filter(attempt => attempt.userId === player.id);
    return {
      player,
      levels: playerLevels(own),
      decisions: recentDecisions(own),
      exams: examResults.filter(exam => exam.userId === player.id).sort((a, b) => b.timestamp - a.timestamp),
      legacy: users.find(user => user.id === player.id)?.progress ?? null,
    };
  }, [selectedId, playersById, attempts, examResults, users]);

  const filteredAttempts = useMemo(
    () => filterAttempts(attempts, playersById, { levelId: attemptLevel, query: attemptQuery }),
    [attempts, playersById, attemptLevel, attemptQuery]
  );

  const rules = useMemo(() => buildRuleSummaries(), []);
  const filteredRules = useMemo(() => {
    const needle = ruleQuery.trim().toLowerCase();
    return needle === ''
      ? rules
      : rules.filter(rule =>
          [rule.id, rule.type, rule.expectedAction, rule.lawCitation ?? ''].some(field => field.toLowerCase().includes(needle))
        );
  }, [rules, ruleQuery]);

  return {
    loading: source.isLoading,
    loadedAt: source.loadedAt,
    loadError: source.loadError,
    collectionErrors: source.collectionErrors,
    refresh: () => void source.loadAdminData(),

    totals,
    players,
    playerCount: allPlayers.length,
    playersById,
    playerQuery,
    setPlayerQuery,
    selected,
    selectPlayer: setSelectedId,

    levels: LEVELS.map(level => ({ id: level.id, name: level.name })),
    attempts: filteredAttempts.slice(0, attemptsShown),
    attemptsMatching: filteredAttempts.length,
    attemptLevel,
    setAttemptLevel: (levelId: number | null) => {
      setAttemptLevel(levelId);
      setAttemptsShown(ATTEMPTS_PAGE);
    },
    attemptQuery,
    setAttemptQuery: (query: string) => {
      setAttemptQuery(query);
      setAttemptsShown(ATTEMPTS_PAGE);
    },
    showMoreAttempts: () => setAttemptsShown(shown => shown + ATTEMPTS_PAGE),

    rules: filteredRules,
    ruleCount: rules.length,
    ruleQuery,
    setRuleQuery,

    exportAttemptsCSV: () => downloadFile(`arangkada_attempts_${Date.now()}.csv`, buildAttemptsCSV(attempts), 'text/csv'),
    exportJSON: () =>
      downloadFile(`arangkada_admin_${Date.now()}.json`, buildAdminJSONExport(data, rules), 'application/json'),
  };
};

export type PlayerReportState = ReturnType<typeof usePlayerReport>;

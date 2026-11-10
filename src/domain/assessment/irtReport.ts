/**
 * The Rasch analysis as the admin area's IRT section shows it: `irt_reports/current`, written by the developers' script
 * a developers' script and read by an admin alone.
 *
 * Every number in it was computed by the scripts under a developers' script,
 * the same functions `raschScore.ts` and `raschAssemble.ts` run. The app only
 * reads it: no app code estimates anything, so IRT stays off gameplay.
 *
 * A number the analysis could not give (an SE of an extreme item, a
 * reliability over one person) is null, never NaN.
 */
import type { RoutingCuts, Stage2Block, TestBlock } from './twoStageDesign';

export const IRT_REPORT_SCHEMA_VERSION = 1;

/** Where the report is published. */
export const IRT_REPORT_PATH = 'irt_reports/current';

export type IrtItemStatus = 'estimated' | 'all-correct' | 'all-wrong';

export interface IrtItemRow {
  readonly itemId: string;
  readonly competency: string;
  readonly status: IrtItemStatus;
  /** The frozen CML difficulty, in logits; null for an item left out by the extreme-score rule. */
  readonly difficulty: number | null;
  readonly se: number | null;
  /** At the frozen b, on the pre-test. */
  readonly infit: number | null;
  readonly outfit: number | null;
  readonly pctCorrectPre: number | null;
  readonly nPre: number;
  /** Among those routed to the item. */
  readonly pctCorrectPost: number | null;
  readonly nPost: number;
  /** Mean of (answer − P(θ_post, b)): positive = easier after than the frozen scale predicts. Descriptive. */
  readonly postResidual: number | null;
  /** The post-test block the design puts it in; null without a design. */
  readonly block: TestBlock | null;
}

export interface IrtPersonRow {
  /** A participant code (or a `PH-` placeholder). Never a name. */
  readonly playerCode: string;
  readonly thetaPre: number;
  readonly sePre: number;
  readonly scorePre: number;
  readonly itemsPre: number;
  readonly thetaPost: number | null;
  readonly sePost: number | null;
  readonly scorePost: number | null;
  readonly itemsPost: number | null;
  readonly gain: number | null;
  readonly gainSe: number | null;
  readonly gainBeyondError: boolean | null;
}

export interface IrtSittingSummary {
  readonly n: number;
  /** Metric 9, the Ability Estimation Error: √(mean SE²). */
  readonly rmse: number | null;
  readonly reliability: number | null;
}

export interface IrtGainSummary {
  readonly n: number;
  readonly mean: number;
  readonly sd: number;
  readonly se: number;
  readonly meanCi: readonly [number, number];
  readonly t: number;
  readonly df: number;
  readonly p: number;
  readonly dz: number;
  readonly dzCi: readonly [number, number];
  /** Gains larger than 1.96 of their own SE. */
  readonly beyondError: number;
}

export interface IrtRoutingCheck {
  readonly playerCode: string;
  readonly routingScore: number | null;
  readonly routed: string;
  readonly consistent: boolean;
  readonly mostInformative: Stage2Block | null;
}

/** One row of the routing table `raschAssemble.ts` builds the cut points from. */
export interface IrtRoutingRow {
  readonly score: number;
  readonly theta: number;
  readonly block: Stage2Block;
  readonly information: Readonly<Record<Stage2Block, number>>;
}

/** Each block's test information over a grid of θ. */
export interface IrtInformationCurves {
  readonly theta: readonly number[];
  readonly routing: readonly number[];
  readonly easy: readonly number[];
  readonly medium: readonly number[];
  readonly hard: readonly number[];
}

export type IrtCohort = 'study' | 'dryrun' | 'test' | 'placeholder' | 'other';

export interface IrtReportDoc {
  readonly schemaVersion: typeof IRT_REPORT_SCHEMA_VERSION;
  readonly generatedAt: number;
  /** True when any item or person is a `PH-` placeholder (the emulator test kit): never a result. */
  readonly placeholder: boolean;
  readonly calibrationId: string;
  readonly method: 'CML';
  /** Pre-tests the calibration read, and how many sat at an extreme score. */
  readonly calibrationPlayers: number;
  readonly extremePlayers: number;
  readonly scaleItems: number;
  readonly designId: string | null;
  readonly cuts: RoutingCuts | null;
  readonly designMatchesCalibration: boolean | null;
  /** How many people of each cohort the analysed responses hold, by their code. */
  readonly cohorts: Readonly<Partial<Record<IrtCohort, number>>>;
  readonly items: readonly IrtItemRow[];
  readonly kr20Pre: number | null;
  readonly pre: IrtSittingSummary;
  readonly post: IrtSittingSummary | null;
  readonly gain: IrtGainSummary | null;
  readonly persons: readonly IrtPersonRow[];
  readonly routing: readonly IrtRoutingCheck[];
  readonly revisionChanges: number;
  readonly routingTable: readonly IrtRoutingRow[] | null;
  readonly curves: IrtInformationCurves | null;
}

/** The cohort a code names: `P-` study, `D-` dry run, `T-` test, `PH-` the kit's placeholders. */
export const irtCohortOfCode = (code: string): IrtCohort =>
  code.startsWith('PH-') ? 'placeholder'
    : /^P-\d{4}$/.test(code) ? 'study'
      : /^D-\d{4}$/.test(code) ? 'dryrun'
        : /^T-\d{4}$/.test(code) ? 'test'
          : 'other';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * The report as Firestore hands it back, or null when it is not one. Only the
 * developers' script writes it, so this checks its frame, not every number.
 */
export const readIrtReport = (data: unknown): IrtReportDoc | null => {
  if (!isObject(data)) return null;
  if (
    data.schemaVersion !== IRT_REPORT_SCHEMA_VERSION || typeof data.calibrationId !== 'string' ||
    typeof data.generatedAt !== 'number' || typeof data.placeholder !== 'boolean' ||
    !Array.isArray(data.items) || !Array.isArray(data.persons) || !Array.isArray(data.routing) || !isObject(data.pre)
  ) {
    return null;
  }
  return data as unknown as IrtReportDoc;
};

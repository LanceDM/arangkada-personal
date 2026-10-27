import { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  ListChecks,
  X,
} from 'lucide-react';
import type { LessonBlock, LevelModule } from '@/features/driving-sim/domain/scenario/lessonModule';

interface LessonReaderProps {
  module: LevelModule;
  onClose: () => void;
  onFinish: () => void;
}

const estimateReadMinutes = (module: LevelModule) => {
  const wordCount = module.lessons.reduce((total, lesson) => {
    return total + lesson.text.split(/\s+/).filter(Boolean).length;
  }, 0);

  return Math.max(2, Math.ceil(wordCount / 180));
};

const renderInline = (value: string) =>
  value
    .replace(/!\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .trim();

const imageFromMarkdown = (value: string) => {
  const match = value.match(/!\[(.*?)\]\((.*?)\)/);
  if (!match) return null;

  return {
    alt: renderInline(match[1]),
    src: match[2].trim().replace(/^\.\.\//, '').replace(/^\.\/?/, ''),
  };
};

const TABLE_IMAGE_SIZES = {
  normal: {
    frame: 'min-w-36',
    image: 'h-24 w-32',
    caption: 'max-w-36',
  },
  medium: {
    frame: 'min-w-44',
    image: 'h-32 w-44',
    caption: 'max-w-44',
  },
  large: {
    frame: 'min-w-56',
    image: 'h-40 w-56',
    caption: 'max-w-56',
  },
  extraLarge: {
    frame: 'min-w-72',
    image: 'h-52 w-72',
    caption: 'max-w-72',
  },
} as const;

type TableImageSize = keyof typeof TABLE_IMAGE_SIZES;

const tableImageSizeFromValue = (value: string): TableImageSize => {
  const match = value.match(/^\[(?:image:)?(normal|medium|large|xlarge|extra-large|extraLarge)\]\s*/i);
  if (!match) return 'normal';

  const size = match[1].toLowerCase();
  return size === 'xlarge' || size === 'extra-large' || size === 'extralarge' ? 'extraLarge' : (size as TableImageSize);
};

const stripTableImageSize = (value: string) =>
  value.replace(/^\[(?:image:)?(?:normal|medium|large|xlarge|extra-large|extraLarge)\]\s*/i, '');

const rowSpanFromValue = (value: string) => {
  const match = value.match(/^\[rowspan:(\d+)\]\s*(.*)$/i);
  if (!match) return { rowSpan: 1, value };

  return {
    rowSpan: Math.max(1, Number.parseInt(match[1], 10) || 1),
    value: match[2],
  };
};

const TableCell = ({ value }: { value: string }) => {
  const imageSize = tableImageSizeFromValue(value);
  const image = imageFromMarkdown(stripTableImageSize(value));
  const sizeClasses = TABLE_IMAGE_SIZES[imageSize];

  if (image) {
    return (
      <div className={`flex ${sizeClasses.frame} flex-col items-center gap-2`}>
        <img
          src={`/${image.src}`}
          alt={image.alt}
          className={`${sizeClasses.image} rounded-md border border-border bg-background object-contain p-2`}
          loading="lazy"
        />
        <span className={`${sizeClasses.caption} text-center text-[10px] leading-4 text-muted-foreground`}>
          {image.alt}
        </span>
      </div>
    );
  }

  return renderInline(value);
};

const LessonBlockView = ({ block }: { block: LessonBlock }) => {
  const [hoveredTableRow, setHoveredTableRow] = useState<number | null>(null);

  if (block.type === 'paragraph') {
    return (
      <p className="max-w-3xl text-base leading-8 text-muted-foreground">
        {renderInline(block.text)}
      </p>
    );
  }

  if (block.type === 'list') {
    const ListTag = block.ordered ? 'ol' : 'ul';

    return (
      <ListTag className={`max-w-3xl space-y-3 text-muted-foreground ${block.ordered ? 'list-decimal' : 'list-disc'} pl-6`}>
        {block.items.map((item, index) => (
          <li key={`${item}-${index}`} className="pl-2 leading-7">
            {renderInline(item)}
          </li>
        ))}
      </ListTag>
    );
  }

  if (block.type === 'table') {
    const rowSpanSkips: number[] = Array(block.headers.length).fill(0);
    const rowHoverRanges = block.rows.map((_, rowIndex) => ({
      start: rowIndex,
      end: rowIndex,
    }));

    block.rows.forEach((row, rowIndex) => {
      row.forEach(cell => {
        const { rowSpan } = rowSpanFromValue(cell ?? '');
        if (rowSpan <= 1) return;

        const spanEnd = Math.min(block.rows.length - 1, rowIndex + rowSpan - 1);
        for (let index = rowIndex; index <= spanEnd; index += 1) {
          rowHoverRanges[index].start = Math.min(rowHoverRanges[index].start, rowIndex);
          rowHoverRanges[index].end = Math.max(rowHoverRanges[index].end, spanEnd);
        }
      });
    });

    return (
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead className="bg-primary/10 text-primary">
              <tr>
                {block.headers.map((header, index) => (
                  <th
                    key={`${header}-${index}`}
                    className="border-b border-primary/20 px-4 py-3 font-display text-[10px] font-black uppercase tracking-widest"
                  >
                    {renderInline(header)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {block.rows.map((row, rowIndex) => {
                const hoveredRange = hoveredTableRow === null ? null : rowHoverRanges[hoveredTableRow];
                const rowIsHovered =
                  hoveredRange !== null &&
                  rowIndex >= hoveredRange.start &&
                  rowIndex <= hoveredRange.end;
                const cells = block.headers.map((_, cellIndex) => {
                  if (rowSpanSkips[cellIndex] > 0) {
                    rowSpanSkips[cellIndex] -= 1;
                    return null;
                  }

                  const parsed = rowSpanFromValue(row[cellIndex] ?? '');
                  if (parsed.rowSpan > 1) {
                    rowSpanSkips[cellIndex] = parsed.rowSpan - 1;
                  }
                  const cellIsInGroupedRow = parsed.rowSpan > 1 || rowHoverRanges[rowIndex].end > rowHoverRanges[rowIndex].start;

                  return (
                    <td
                      key={cellIndex}
                      rowSpan={parsed.rowSpan}
                      className={`px-4 py-3 leading-6 text-muted-foreground transition-colors ${parsed.rowSpan > 1 ? 'align-middle' : 'align-top'} ${
                        rowIsHovered
                          ? 'bg-secondary/50'
                          : cellIsInGroupedRow
                            ? 'bg-background/40'
                            : ''
                      }`}
                    >
                      <TableCell value={parsed.value} />
                    </td>
                  );
                });

                return (
                  <tr
                    key={rowIndex}
                    onMouseEnter={() => setHoveredTableRow(rowIndex)}
                    onMouseLeave={() => setHoveredTableRow(null)}
                    className={`transition-colors ${
                      rowIsHovered
                        ? '[&>td]:bg-secondary/50'
                        : rowHoverRanges[rowIndex].end > rowHoverRanges[rowIndex].start
                          ? ''
                          : 'odd:bg-background/40 hover:bg-secondary/50'
                    }`}
                  >
                    {cells}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (block.type === 'image') {
    const isLargeImage = block.size === 'large';

    return (
      <figure className={`${isLargeImage ? 'max-w-5xl' : 'max-w-3xl'} overflow-hidden rounded-lg border border-border bg-card`}>
        <img
          src={`/${block.src}`}
          alt={block.alt}
          className={`${isLargeImage ? 'max-h-[34rem]' : 'max-h-80'} w-full object-contain bg-background p-4`}
        />
        {block.alt && (
          <figcaption className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
            {renderInline(block.alt)}
          </figcaption>
        )}
      </figure>
    );
  }

  return null;
};

const LessonReader = ({ module, onClose, onFinish }: LessonReaderProps) => {
  const readMinutes = estimateReadMinutes(module);
  const levelLabel = module.sourceLevel === 0 ? 'Level 0 / Tutorial' : `Level ${module.sourceLevel} / 13`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="min-h-full px-4 pb-8 pt-24 md:px-8">
        <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[24rem_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start">
            <div className="flex max-h-[calc(100vh-7rem)] min-h-0 flex-col rounded-lg border border-border bg-card shadow-2xl">
              <div className="shrink-0 flex items-center justify-between border-b border-border p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-display text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                      Mission Academy
                    </p>
                    <p className="text-xs text-muted-foreground">
                      LTO Manual Module
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label="Close learning module"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="shrink-0 space-y-4 p-4">
                {module.sourceLevel !== undefined && (
                  <div className="inline-flex rounded-md border border-primary/30 bg-primary/10 px-3 py-1 font-display text-[10px] font-black uppercase tracking-widest text-primary">
                    {levelLabel}
                  </div>
                )}

                <div>
                  <h2 className="text-xl font-black uppercase leading-tight tracking-tight text-foreground md:text-2xl">
                    {module.title}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Read the module, review the checkpoints, then unlock the driving simulation.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-border bg-secondary/40 p-2.5">
                    <BookOpen className="mb-2 h-4 w-4 text-primary" />
                    <p className="font-display text-lg font-black">{module.lessons.length}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Notes</p>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/40 p-2.5">
                    <ListChecks className="mb-2 h-4 w-4 text-primary" />
                    <p className="font-display text-lg font-black">{module.quiz.length}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Quiz</p>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/40 p-2.5">
                    <CheckCircle2 className="mb-2 h-4 w-4 text-primary" />
                    <p className="font-display text-lg font-black">{readMinutes}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Min</p>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto border-t border-border p-4">
                <p className="mb-4 font-display text-xs font-black uppercase tracking-[0.2em] text-foreground">
                  Module Outline
                </p>
                <div className="space-y-2.5">
                  {module.lessons.map((lesson, index) => (
                    <a
                      key={lesson.id}
                      href={`#${lesson.id}`}
                      title={lesson.title}
                      className="group flex items-start gap-3 rounded-lg border border-border/70 bg-background/50 px-4 py-3.5 text-sm transition-colors hover:border-primary/40 hover:bg-primary/10"
                    >
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/15 font-display text-[10px] font-black text-primary">
                        {index + 1}
                      </span>
                      <span className="leading-5 text-foreground/90 group-hover:text-foreground">
                        {lesson.title}
                      </span>
                    </a>
                  ))}
                </div>
              </div>

              <div className="shrink-0 border-t border-border p-4">
                <button
                  onClick={onFinish}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-4 font-display text-sm font-black uppercase tracking-wider text-primary-foreground shadow-xl transition-all hover:translate-y-[-1px] hover:shadow-primary/30 active:translate-y-0"
                >
                  Proceed to Checkpoint
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </aside>

          <main className="min-w-0 rounded-lg border border-border bg-card">
            <div className="border-b border-border p-6 md:p-10">
              <div className="mb-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <p className="font-display text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                  Learning Module
                </p>
                <div className="h-px flex-1 bg-border" />
              </div>
              <h1 className="text-3xl font-black uppercase leading-tight tracking-tight text-foreground md:text-5xl">
                {module.title}
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
                {module.desc}
              </p>
            </div>

            <div className="space-y-5 p-4 md:p-8">
              {module.lessons.map((lesson, index) => (
                <section
                  id={lesson.id}
                  key={lesson.id}
                  className="scroll-mt-8 rounded-lg border border-border bg-background/60 p-5 transition-colors hover:border-primary/40 md:p-7"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 font-display text-sm font-black text-primary">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-display text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                        Study Note
                      </p>
                      <h3 className="text-lg font-black uppercase leading-snug text-foreground">
                        {lesson.title}
                      </h3>
                    </div>
                  </div>
                  <div className="space-y-5 pl-0 md:pl-12">
                    {lesson.blocks.map((block, blockIndex) => (
                      <LessonBlockView key={blockIndex} block={block} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default LessonReader;

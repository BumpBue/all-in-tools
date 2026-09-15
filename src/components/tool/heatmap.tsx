import { DAYS_PER_WEEK, addDays, dayKeysBack, weekdayOf } from '@/lib/day';

export const HEATMAP_DAYS = 371;
const CELL = 11;
const GAP = 3;
const LEVELS = 4;

const LEVEL_CLASSES = [
  'fill-surface-subtle',
  'fill-accent/30',
  'fill-accent/55',
  'fill-accent/80',
  'fill-accent',
];

export function levelFor(value: number, best: number): number {
  if (value <= 0) return 0;
  if (best <= 0) return 1;

  return Math.min(LEVELS, Math.max(1, Math.ceil((value / best) * LEVELS)));
}

/**
 * A year of days as a GitHub-style grid: one column per week, Sunday at the
 * top. Shared by every tool that records something once a day.
 *
 * Rendered as one SVG rather than 371 elements with their own styles, so a
 * year of history is cheap to draw and scales without blurring.
 */
export function Heatmap({
  values,
  today,
  label,
  formatTitle,
}: {
  values: Record<string, number>;
  today: string;
  label: string;
  formatTitle: (day: string, value: number) => string;
}) {
  // Start on the Sunday on or before the first day, so every column is a week.
  const firstDay = dayKeysBack(today, HEATMAP_DAYS)[0] ?? today;
  const start = addDays(firstDay, -weekdayOf(firstDay));

  const days: string[] = [];
  for (let offset = 0; ; offset += 1) {
    const day = addDays(start, offset);
    days.push(day);
    if (day === today) break;
    if (offset > HEATMAP_DAYS + DAYS_PER_WEEK) break;
  }

  const best = Math.max(0, ...Object.values(values));
  const weeks = Math.ceil(days.length / DAYS_PER_WEEK);

  const width = weeks * (CELL + GAP);
  const height = DAYS_PER_WEEK * (CELL + GAP);

  return (
    <div className="overflow-x-auto">
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${width} ${height}`}
        style={{ width, height, maxWidth: '100%' }}
      >
        {days.map((day, index) => {
          const value = values[day] ?? 0;
          const column = Math.floor(index / DAYS_PER_WEEK);
          const row = index % DAYS_PER_WEEK;

          return (
            <rect
              key={day}
              x={column * (CELL + GAP)}
              y={row * (CELL + GAP)}
              width={CELL}
              height={CELL}
              rx={2}
              className={LEVEL_CLASSES[levelFor(value, best)]}
            >
              <title>{formatTitle(day, value)}</title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}

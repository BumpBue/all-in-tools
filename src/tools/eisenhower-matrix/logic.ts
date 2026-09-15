import { asArray, asBoolean, asNumber, asString, isRecord, storedSchema } from '@/lib/schema';

export const MATRIX_SCHEMA = 1;

export const QUADRANTS = ['do', 'plan', 'delegate', 'drop'] as const;
export type Quadrant = (typeof QUADRANTS)[number];

/** urgent × important, in the order the grid is read. */
export const QUADRANT_AXES: Readonly<
  Record<Quadrant, { urgent: boolean; important: boolean }>
> = {
  do: { urgent: true, important: true },
  plan: { urgent: false, important: true },
  delegate: { urgent: true, important: false },
  drop: { urgent: false, important: false },
};

export const MAX_TASKS = 200;
export const MAX_TITLE_LENGTH = 120;

export interface Task {
  id: string;
  title: string;
  quadrant: Quadrant;
  done: boolean;
  /** Position within its quadrant; lower is higher up. */
  order: number;
}

export interface MatrixData {
  schema: number;
  tasks: Task[];
  nextId: number;
}

export const EMPTY_DATA: MatrixData = { schema: MATRIX_SCHEMA, tasks: [], nextId: 1 };

export function isQuadrant(value: string): value is Quadrant {
  return (QUADRANTS as readonly string[]).includes(value);
}

export function tasksIn(data: MatrixData, quadrant: Quadrant): Task[] {
  return data.tasks
    .filter((task) => task.quadrant === quadrant)
    .sort((left, right) => left.order - right.order);
}

function nextOrder(data: MatrixData, quadrant: Quadrant): number {
  const existing = tasksIn(data, quadrant);
  return (existing[existing.length - 1]?.order ?? -1) + 1;
}

export type MatrixAction =
  | { type: 'add'; title: string; quadrant: Quadrant }
  | { type: 'edit'; id: string; title: string }
  | { type: 'remove'; id: string }
  | { type: 'toggle'; id: string }
  | { type: 'move'; id: string; quadrant: Quadrant }
  | { type: 'reorder'; id: string; direction: -1 | 1 }
  | { type: 'clear-done' };

export function reduce(data: MatrixData, action: MatrixAction): MatrixData {
  switch (action.type) {
    case 'add': {
      const title = action.title.trim().slice(0, MAX_TITLE_LENGTH);
      if (title.length === 0 || data.tasks.length >= MAX_TASKS) return data;

      return {
        ...data,
        nextId: data.nextId + 1,
        tasks: [
          ...data.tasks,
          {
            id: `t${data.nextId}`,
            title,
            quadrant: action.quadrant,
            done: false,
            order: nextOrder(data, action.quadrant),
          },
        ],
      };
    }

    case 'edit': {
      const title = action.title.slice(0, MAX_TITLE_LENGTH);

      return {
        ...data,
        tasks: data.tasks.map((task) =>
          task.id === action.id ? { ...task, title } : task,
        ),
      };
    }

    case 'remove':
      return { ...data, tasks: data.tasks.filter((task) => task.id !== action.id) };

    case 'toggle':
      // Finished work is struck through rather than removed: seeing what was
      // urgent and important last week is the point of the grid.
      return {
        ...data,
        tasks: data.tasks.map((task) =>
          task.id === action.id ? { ...task, done: !task.done } : task,
        ),
      };

    case 'move': {
      const task = data.tasks.find((each) => each.id === action.id);
      if (!task || task.quadrant === action.quadrant) return data;

      return {
        ...data,
        tasks: data.tasks.map((each) =>
          each.id === action.id
            ? { ...each, quadrant: action.quadrant, order: nextOrder(data, action.quadrant) }
            : each,
        ),
      };
    }

    case 'reorder': {
      const task = data.tasks.find((each) => each.id === action.id);
      if (!task) return data;

      const siblings = tasksIn(data, task.quadrant);
      const index = siblings.findIndex((each) => each.id === action.id);
      const target = index + action.direction;
      if (target < 0 || target >= siblings.length) return data;

      const swapped = siblings[target];
      if (!swapped) return data;

      return {
        ...data,
        tasks: data.tasks.map((each) => {
          if (each.id === task.id) return { ...each, order: swapped.order };
          if (each.id === swapped.id) return { ...each, order: task.order };
          return each;
        }),
      };
    }

    default:
      return { ...data, tasks: data.tasks.filter((task) => !task.done) };
  }
}

export function countByQuadrant(data: MatrixData): Record<Quadrant, number> {
  const counts = { do: 0, plan: 0, delegate: 0, drop: 0 };
  for (const task of data.tasks) counts[task.quadrant] += 1;
  return counts;
}

export function countStoredItems(data: unknown): number {
  if (!isRecord(data)) return 0;
  return Array.isArray(data.tasks) ? data.tasks.length : 0;
}

/** The link that hands a task to the timer. One way, and only a title. */
export function timerLink(task: Task): string {
  return `/tools/pomodoro?task=${encodeURIComponent(task.title)}`;
}

export function migrate(raw: unknown): MatrixData {
  const version = storedSchema(raw);
  if (version === null || !isRecord(raw) || version > MATRIX_SCHEMA) return EMPTY_DATA;

  const tasks = asArray(raw.tasks)
    .slice(0, MAX_TASKS)
    .filter(isRecord)
    .map((task, index) => ({
      id: asString(task.id, `t${index}`),
      title: asString(task.title).slice(0, MAX_TITLE_LENGTH),
      quadrant: isQuadrant(asString(task.quadrant)) ? (task.quadrant as Quadrant) : 'do',
      done: asBoolean(task.done),
      order: asNumber(task.order, index),
    }))
    .filter((task) => task.title.length > 0);

  const highest = tasks.reduce((top, task) => {
    const numeric = Number(task.id.replace(/\D/g, ''));
    return Number.isFinite(numeric) ? Math.max(top, numeric) : top;
  }, 0);

  return {
    schema: MATRIX_SCHEMA,
    tasks,
    // Never hand out an id that is already taken, whatever the file said.
    nextId: Math.max(asNumber(raw.nextId, 1), highest + 1),
  };
}

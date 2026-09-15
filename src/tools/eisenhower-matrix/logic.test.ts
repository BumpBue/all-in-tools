import { describe, expect, it } from 'vitest';

import {
  EMPTY_DATA,
  MATRIX_SCHEMA,
  MAX_TASKS,
  MAX_TITLE_LENGTH,
  QUADRANTS,
  QUADRANT_AXES,
  countByQuadrant,
  countStoredItems,
  isQuadrant,
  migrate,
  reduce,
  tasksIn,
  timerLink,
  type MatrixData,
  type Quadrant,
} from '@/tools/eisenhower-matrix/logic';

function withTasks(...titles: Array<[string, Quadrant]>): MatrixData {
  return titles.reduce(
    (data, [title, quadrant]) => reduce(data, { type: 'add', title, quadrant }),
    EMPTY_DATA,
  );
}

function idOf(data: MatrixData, title: string): string {
  const task = data.tasks.find((each) => each.title === title);
  if (!task) throw new Error(`no task called ${title}`);
  return task.id;
}

describe('the grid', () => {
  it('has the four quadrants of the method', () => {
    expect(QUADRANTS).toEqual(['do', 'plan', 'delegate', 'drop']);
  });

  it('places each quadrant on the right axes', () => {
    expect(QUADRANT_AXES.do).toEqual({ urgent: true, important: true });
    expect(QUADRANT_AXES.plan).toEqual({ urgent: false, important: true });
    expect(QUADRANT_AXES.delegate).toEqual({ urgent: true, important: false });
    expect(QUADRANT_AXES.drop).toEqual({ urgent: false, important: false });
  });

  it('recognises a quadrant name', () => {
    expect(isQuadrant('plan')).toBe(true);
    expect(isQuadrant('someday')).toBe(false);
  });
});

describe('adding', () => {
  it('puts a task in the quadrant asked for', () => {
    const data = withTasks(['ส่งรายงาน', 'do']);

    expect(data.tasks).toHaveLength(1);
    expect(data.tasks[0]).toMatchObject({ title: 'ส่งรายงาน', quadrant: 'do', done: false });
  });

  it('gives every task an id of its own', () => {
    const data = withTasks(['a', 'do'], ['b', 'do'], ['c', 'plan']);
    expect(new Set(data.tasks.map((task) => task.id)).size).toBe(3);
  });

  it('ignores an empty title', () => {
    expect(reduce(EMPTY_DATA, { type: 'add', title: '   ', quadrant: 'do' })).toBe(
      EMPTY_DATA,
    );
  });

  it('trims a title and cuts one too long', () => {
    const data = reduce(EMPTY_DATA, {
      type: 'add',
      title: `  ${'ก'.repeat(500)}  `,
      quadrant: 'do',
    });

    expect(data.tasks[0]?.title.length).toBe(MAX_TITLE_LENGTH);
  });

  it('stops at the number of tasks it will hold', () => {
    let data = EMPTY_DATA;
    for (let index = 0; index < MAX_TASKS + 5; index += 1) {
      data = reduce(data, { type: 'add', title: `t${index}`, quadrant: 'do' });
    }

    expect(data.tasks).toHaveLength(MAX_TASKS);
  });

  it('keeps new tasks at the bottom of their quadrant', () => {
    const data = withTasks(['first', 'do'], ['second', 'do']);
    expect(tasksIn(data, 'do').map((task) => task.title)).toEqual(['first', 'second']);
  });
});

describe('moving between quadrants', () => {
  it('moves a task', () => {
    const data = withTasks(['a', 'do']);
    const moved = reduce(data, { type: 'move', id: idOf(data, 'a'), quadrant: 'plan' });

    expect(tasksIn(moved, 'do')).toHaveLength(0);
    expect(tasksIn(moved, 'plan')).toHaveLength(1);
  });

  it('puts a moved task at the bottom of its new quadrant', () => {
    const data = withTasks(['x', 'plan'], ['y', 'plan'], ['moved', 'do']);
    const after = reduce(data, { type: 'move', id: idOf(data, 'moved'), quadrant: 'plan' });

    expect(tasksIn(after, 'plan').map((task) => task.title)).toEqual(['x', 'y', 'moved']);
  });

  it('does nothing when the task is already there', () => {
    const data = withTasks(['a', 'do']);
    expect(reduce(data, { type: 'move', id: idOf(data, 'a'), quadrant: 'do' })).toBe(data);
  });

  it('ignores a task that is not there', () => {
    const data = withTasks(['a', 'do']);
    expect(reduce(data, { type: 'move', id: 'nope', quadrant: 'plan' })).toBe(data);
  });
});

describe('reordering', () => {
  it('moves a task up past its neighbour', () => {
    const data = withTasks(['first', 'do'], ['second', 'do']);
    const after = reduce(data, { type: 'reorder', id: idOf(data, 'second'), direction: -1 });

    expect(tasksIn(after, 'do').map((task) => task.title)).toEqual(['second', 'first']);
  });

  it('moves a task down', () => {
    const data = withTasks(['first', 'do'], ['second', 'do']);
    const after = reduce(data, { type: 'reorder', id: idOf(data, 'first'), direction: 1 });

    expect(tasksIn(after, 'do').map((task) => task.title)).toEqual(['second', 'first']);
  });

  it('will not move the top one up or the last one down', () => {
    const data = withTasks(['only', 'do']);

    expect(reduce(data, { type: 'reorder', id: idOf(data, 'only'), direction: -1 })).toBe(
      data,
    );
    expect(reduce(data, { type: 'reorder', id: idOf(data, 'only'), direction: 1 })).toBe(
      data,
    );
  });

  it('only shuffles inside one quadrant', () => {
    const data = withTasks(['a', 'do'], ['b', 'plan']);
    const after = reduce(data, { type: 'reorder', id: idOf(data, 'b'), direction: -1 });

    expect(after).toBe(data);
  });
});

describe('finishing and clearing', () => {
  it('strikes a task through rather than removing it', () => {
    const data = withTasks(['a', 'do']);
    const after = reduce(data, { type: 'toggle', id: idOf(data, 'a') });

    expect(after.tasks).toHaveLength(1);
    expect(after.tasks[0]?.done).toBe(true);
  });

  it('can be undone', () => {
    const data = withTasks(['a', 'do']);
    const id = idOf(data, 'a');
    const back = reduce(reduce(data, { type: 'toggle', id }), { type: 'toggle', id });

    expect(back.tasks[0]?.done).toBe(false);
  });

  it('clears only the finished ones, when asked', () => {
    const data = withTasks(['done', 'do'], ['todo', 'do']);
    const marked = reduce(data, { type: 'toggle', id: idOf(data, 'done') });
    const cleared = reduce(marked, { type: 'clear-done' });

    expect(cleared.tasks.map((task) => task.title)).toEqual(['todo']);
  });

  it('removes one outright when asked', () => {
    const data = withTasks(['a', 'do'], ['b', 'do']);
    const after = reduce(data, { type: 'remove', id: idOf(data, 'a') });

    expect(after.tasks.map((task) => task.title)).toEqual(['b']);
  });
});

describe('editing', () => {
  it('changes a title', () => {
    const data = withTasks(['old', 'do']);
    const after = reduce(data, { type: 'edit', id: idOf(data, 'old'), title: 'new' });

    expect(after.tasks[0]?.title).toBe('new');
  });

  it('cuts a title too long to show', () => {
    const data = withTasks(['a', 'do']);
    const after = reduce(data, {
      type: 'edit',
      id: idOf(data, 'a'),
      title: 'x'.repeat(500),
    });

    expect(after.tasks[0]?.title.length).toBe(MAX_TITLE_LENGTH);
  });
});

describe('handing a task to the timer', () => {
  it('builds a link carrying only the title', () => {
    const link = timerLink({
      id: 't1',
      title: 'อ่านบทที่ 3',
      quadrant: 'do',
      done: false,
      order: 0,
    });

    expect(link.startsWith('/tools/pomodoro?task=')).toBe(true);
    expect(decodeURIComponent(link.split('=')[1] ?? '')).toBe('อ่านบทที่ 3');
  });

  it('escapes a title that would otherwise break the query string', () => {
    const link = timerLink({
      id: 't1',
      title: 'a&b=c d',
      quadrant: 'do',
      done: false,
      order: 0,
    });

    expect(link).not.toContain('a&b=c d');
    expect(decodeURIComponent(link.split('=')[1] ?? '')).toBe('a&b=c d');
  });
});

describe('countByQuadrant', () => {
  it('counts each one', () => {
    const data = withTasks(['a', 'do'], ['b', 'do'], ['c', 'plan']);
    expect(countByQuadrant(data)).toEqual({ do: 2, plan: 1, delegate: 0, drop: 0 });
  });
});

describe('migrate', () => {
  it('reads data this version wrote', () => {
    const data = withTasks(['a', 'do'], ['b', 'plan']);
    expect(migrate(JSON.parse(JSON.stringify(data)))).toEqual(data);
  });

  it('starts fresh for anything unrecognisable', () => {
    expect(migrate(null)).toEqual(EMPTY_DATA);
    expect(migrate({ tasks: [] })).toEqual(EMPTY_DATA);
    expect(migrate({ schema: MATRIX_SCHEMA + 1, tasks: [] })).toEqual(EMPTY_DATA);
  });

  it('drops a task with no title and repairs a bad quadrant', () => {
    const repaired = migrate({
      schema: MATRIX_SCHEMA,
      tasks: [
        { id: 't1', title: '', quadrant: 'do' },
        { id: 't2', title: 'kept', quadrant: 'somewhere' },
      ],
      nextId: 3,
    });

    expect(repaired.tasks).toHaveLength(1);
    expect(repaired.tasks[0]).toMatchObject({ title: 'kept', quadrant: 'do' });
  });

  it('never hands out an id a stored task already has', () => {
    const repaired = migrate({
      schema: MATRIX_SCHEMA,
      tasks: [{ id: 't9', title: 'kept', quadrant: 'do', order: 0 }],
      nextId: 1,
    });

    const added = reduce(repaired, { type: 'add', title: 'new', quadrant: 'do' });
    expect(new Set(added.tasks.map((task) => task.id)).size).toBe(2);
  });
});

describe('countStoredItems', () => {
  it('counts the tasks', () => {
    expect(countStoredItems({ tasks: [1, 2, 3] })).toBe(3);
    expect(countStoredItems({})).toBe(0);
    expect(countStoredItems(null)).toBe(0);
  });
});

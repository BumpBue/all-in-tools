import { describe, expect, it } from 'vitest';

import { addDays } from '@/lib/day';
import { parseDelimited } from '@/tools/_shared/deck-formats';
import {
  DECKS_SCHEMA,
  EMPTY_DECKS,
  FIRST_INTERVAL,
  GRADES,
  MINIMUM_EASE,
  SECOND_INTERVAL,
  STARTING_EASE,
  countStoredItems,
  deckProgress,
  dueCards,
  isDue,
  migrate,
  newCard,
  reduce,
  reviewCard,
  totalDue,
  upcomingSchedule,
  type Card,
  type DecksData,
  type Grade,
} from '@/tools/_shared/decks';

const TODAY = '2026-09-15';

function card(overrides: Partial<Card> = {}): Card {
  return { ...newCard('c1', 'หน้า', 'หลัง'), ...overrides };
}

function withDeck(name = 'คำศัพท์'): DecksData {
  return reduce(EMPTY_DECKS, { type: 'add-deck', name });
}

function deckId(data: DecksData): string {
  const id = data.decks[0]?.id;
  if (!id) throw new Error('no deck');
  return id;
}

function reviewed(grade: Grade, times: number, start = card()): Card {
  let current = start;
  let day = TODAY;

  for (let round = 0; round < times; round += 1) {
    current = reviewCard(current, grade, day);
    day = current.due ?? day;
  }

  return current;
}

describe('SM-2 scheduling', () => {
  it('shows a new card today', () => {
    expect(isDue(card(), TODAY)).toBe(true);
    expect(card().due).toBeNull();
  });

  it('puts the first pass one day out and the second six', () => {
    const first = reviewCard(card(), 'good', TODAY);
    expect(first.interval).toBe(FIRST_INTERVAL);
    expect(first.due).toBe(addDays(TODAY, FIRST_INTERVAL));

    const second = reviewCard(first, 'good', first.due ?? TODAY);
    expect(second.interval).toBe(SECOND_INTERVAL);
  });

  it('multiplies by the ease from the third pass on', () => {
    const third = reviewed('good', 3);
    expect(third.interval).toBeGreaterThan(SECOND_INTERVAL);
    expect(third.interval).toBe(Math.round(SECOND_INTERVAL * third.ease));
  });

  it('stretches further for an easy card than a hard one', () => {
    expect(reviewed('easy', 4).interval).toBeGreaterThan(reviewed('hard', 4).interval);
  });

  it('raises the ease for easy and lowers it for hard', () => {
    expect(reviewCard(card(), 'easy', TODAY).ease).toBeGreaterThan(STARTING_EASE);
    expect(reviewCard(card(), 'hard', TODAY).ease).toBeLessThan(STARTING_EASE);
  });

  it('never lets the ease fall below the floor', () => {
    const struggled = reviewed('forgot', 20);
    expect(struggled.ease).toBeGreaterThanOrEqual(MINIMUM_EASE);
  });

  it('starts the ladder again after a lapse, without losing the card', () => {
    const known = reviewed('good', 4);
    const forgotten = reviewCard(known, 'forgot', TODAY);

    expect(forgotten.reviews).toBe(0);
    expect(forgotten.interval).toBe(FIRST_INTERVAL);
    expect(forgotten.lapses).toBe(known.lapses + 1);
    expect(forgotten.due).toBe(addDays(TODAY, 1));
  });

  it('counts a review only when it passed', () => {
    expect(reviewCard(card(), 'good', TODAY).reviews).toBe(1);
    expect(reviewCard(card(), 'forgot', TODAY).reviews).toBe(0);
  });

  it('records the day it was reviewed', () => {
    expect(reviewCard(card(), 'good', TODAY).lastReviewed).toBe(TODAY);
  });

  it('offers the four grades a reader can mean', () => {
    expect(GRADES).toEqual(['forgot', 'hard', 'good', 'easy']);
  });

  it('never schedules anything less than a day out', () => {
    for (const grade of GRADES) {
      let current = card();
      for (let round = 0; round < 10; round += 1) {
        current = reviewCard(current, grade, current.due ?? TODAY);
        expect(current.interval).toBeGreaterThanOrEqual(FIRST_INTERVAL);
      }
    }
  });
});

describe('what is due', () => {
  it('counts a card due today and one overdue', () => {
    const deck = {
      id: 'd1',
      name: 'x',
      cards: [
        card({ id: 'a', due: TODAY }),
        card({ id: 'b', due: addDays(TODAY, -3) }),
        card({ id: 'c', due: addDays(TODAY, 5) }),
      ],
    };

    expect(dueCards(deck, TODAY).map((each) => each.id)).toEqual(['a', 'b']);
  });

  it('adds up across decks', () => {
    const data: DecksData = {
      ...EMPTY_DECKS,
      decks: [
        { id: 'd1', name: 'a', cards: [card({ id: 'a' })] },
        { id: 'd2', name: 'b', cards: [card({ id: 'b', due: addDays(TODAY, 9) })] },
      ],
    };

    expect(totalDue(data, TODAY)).toBe(1);
  });

  it('separates cards never seen from cards learned', () => {
    const deck = {
      id: 'd1',
      name: 'x',
      cards: [card({ id: 'a' }), card({ id: 'b', due: addDays(TODAY, 2) })],
    };

    expect(deckProgress(deck)).toEqual({ total: 2, learned: 1, fresh: 1 });
  });
});

describe('upcomingSchedule', () => {
  const data: DecksData = {
    ...EMPTY_DECKS,
    decks: [
      {
        id: 'd1',
        name: 'x',
        cards: [
          card({ id: 'a', due: addDays(TODAY, 1) }),
          card({ id: 'b', due: addDays(TODAY, 1) }),
          card({ id: 'c', due: addDays(TODAY, 4) }),
          card({ id: 'd', due: addDays(TODAY, -2) }),
          card({ id: 'e', due: addDays(TODAY, 90) }),
        ],
      },
    ],
  };

  it('groups cards by the day they fall due', () => {
    const schedule = upcomingSchedule(data, TODAY, 30);

    expect(schedule[addDays(TODAY, 1)]).toBe(2);
    expect(schedule[addDays(TODAY, 4)]).toBe(1);
  });

  it('shows an overdue card today, which is when it will be seen', () => {
    expect(upcomingSchedule(data, TODAY, 30)[TODAY]).toBe(1);
  });

  it('stops at the horizon asked for', () => {
    expect(upcomingSchedule(data, TODAY, 30)[addDays(TODAY, 90)]).toBeUndefined();
  });

  it('ignores cards never reviewed, which have no date yet', () => {
    const fresh: DecksData = {
      ...EMPTY_DECKS,
      decks: [{ id: 'd1', name: 'x', cards: [card({ id: 'a' })] }],
    };

    expect(upcomingSchedule(fresh, TODAY, 30)).toEqual({});
  });
});

describe('deck actions', () => {
  it('adds and renames a deck', () => {
    const data = withDeck();
    expect(data.decks).toHaveLength(1);

    const renamed = reduce(data, {
      type: 'rename-deck',
      deckId: deckId(data),
      name: 'ศัพท์ใหม่',
    });
    expect(renamed.decks[0]?.name).toBe('ศัพท์ใหม่');
  });

  it('ignores a deck with no name', () => {
    expect(reduce(EMPTY_DECKS, { type: 'add-deck', name: '  ' })).toBe(EMPTY_DECKS);
  });

  it('adds a card to the right deck', () => {
    const data = withDeck();
    const withCard = reduce(data, {
      type: 'add-card',
      deckId: deckId(data),
      front: 'cat',
      back: 'แมว',
    });

    expect(withCard.decks[0]?.cards).toHaveLength(1);
    expect(withCard.decks[0]?.cards[0]).toMatchObject({ front: 'cat', back: 'แมว' });
  });

  it('gives every card an id of its own', () => {
    let data = withDeck();
    for (const word of ['a', 'b', 'c']) {
      data = reduce(data, { type: 'add-card', deckId: deckId(data), front: word, back: '' });
    }

    const ids = data.decks[0]?.cards.map((each) => each.id) ?? [];
    expect(new Set(ids).size).toBe(3);
  });

  it('imports a batch at once', () => {
    const data = withDeck();
    const imported = reduce(data, {
      type: 'import',
      deckId: deckId(data),
      cards: [
        { front: 'one', back: '1' },
        { front: '', back: 'skipped' },
        { front: 'two', back: '2' },
      ],
    });

    expect(imported.decks[0]?.cards.map((each) => each.front)).toEqual(['one', 'two']);
    expect(new Set(imported.decks[0]?.cards.map((each) => each.id)).size).toBe(2);
  });

  it('removes a card and a deck', () => {
    const data = reduce(withDeck(), {
      type: 'add-card',
      deckId: 'd1',
      front: 'x',
      back: 'y',
    });
    const cardId = data.decks[0]?.cards[0]?.id ?? '';

    const withoutCard = reduce(data, { type: 'remove-card', deckId: 'd1', cardId });
    expect(withoutCard.decks[0]?.cards).toHaveLength(0);

    const withoutDeck = reduce(data, { type: 'remove-deck', deckId: 'd1' });
    expect(withoutDeck.decks).toHaveLength(0);
  });

  it('puts a deck back to unreviewed when asked', () => {
    const data = reduce(withDeck(), {
      type: 'add-card',
      deckId: 'd1',
      front: 'x',
      back: 'y',
    });
    const cardId = data.decks[0]?.cards[0]?.id ?? '';

    const studied = reduce(data, {
      type: 'review',
      deckId: 'd1',
      cardId,
      grade: 'good',
      today: TODAY,
    });
    expect(studied.decks[0]?.cards[0]?.due).not.toBeNull();

    const reset = reduce(studied, { type: 'reset-progress', deckId: 'd1' });
    expect(reset.decks[0]?.cards[0]?.due).toBeNull();
    expect(reset.decks[0]?.cards[0]?.front).toBe('x');
  });
});

// The whole point of one store behind two pages.
describe('the two tools share one model', () => {
  it('a review made on one page is what the other page reads', () => {
    const built = reduce(
      reduce(EMPTY_DECKS, { type: 'add-deck', name: 'คำศัพท์' }),
      { type: 'add-card', deckId: 'd1', front: 'cat', back: 'แมว' },
    );

    expect(totalDue(built, TODAY)).toBe(1);
    expect(deckProgress(built.decks[0]!)).toMatchObject({ fresh: 1, learned: 0 });

    const cardId = built.decks[0]?.cards[0]?.id ?? '';
    const afterReview = reduce(built, {
      type: 'review',
      deckId: 'd1',
      cardId,
      grade: 'good',
      today: TODAY,
    });

    // The reviewing page moved it; the deck page sees it as learned and no
    // longer due, and the calendar has it on tomorrow.
    expect(totalDue(afterReview, TODAY)).toBe(0);
    expect(deckProgress(afterReview.decks[0]!)).toMatchObject({ fresh: 0, learned: 1 });
    expect(upcomingSchedule(afterReview, TODAY, 30)[addDays(TODAY, 1)]).toBe(1);
  });

  it('survives the round trip through storage both pages use', () => {
    const built = reduce(
      reduce(EMPTY_DECKS, { type: 'add-deck', name: 'deck' }),
      { type: 'add-card', deckId: 'd1', front: 'front', back: 'back' },
    );
    const studied = reduce(built, {
      type: 'review',
      deckId: 'd1',
      cardId: built.decks[0]?.cards[0]?.id ?? '',
      grade: 'hard',
      today: TODAY,
    });

    const reloaded = migrate(JSON.parse(JSON.stringify(studied)));

    expect(reloaded).toEqual(studied);
    expect(reloaded.decks[0]?.cards[0]?.due).toBe(studied.decks[0]?.cards[0]?.due);
  });
});

describe('migrate', () => {
  it('starts fresh for anything unrecognisable', () => {
    expect(migrate(null)).toEqual(EMPTY_DECKS);
    expect(migrate({ decks: [] })).toEqual(EMPTY_DECKS);
    expect(migrate({ schema: DECKS_SCHEMA + 1, decks: [] })).toEqual(EMPTY_DECKS);
  });

  it('repairs review data that is the wrong type', () => {
    const repaired = migrate({
      schema: DECKS_SCHEMA,
      decks: [
        {
          id: 'd1',
          name: 'deck',
          cards: [{ id: 'c1', front: 'a', back: 'b', ease: 'lots', interval: -5 }],
        },
      ],
      nextId: 2,
    });

    expect(repaired.decks[0]?.cards[0]?.ease).toBe(STARTING_EASE);
    expect(repaired.decks[0]?.cards[0]?.interval).toBe(0);
  });

  it('drops a card with no front and a deck with no name', () => {
    const repaired = migrate({
      schema: DECKS_SCHEMA,
      decks: [
        { id: 'd1', name: '', cards: [] },
        { id: 'd2', name: 'kept', cards: [{ id: 'c1', front: '', back: 'x' }] },
      ],
      nextId: 1,
    });

    expect(repaired.decks).toHaveLength(1);
    expect(repaired.decks[0]?.cards).toHaveLength(0);
  });

  it('never hands out an id a stored card already has', () => {
    const repaired = migrate({
      schema: DECKS_SCHEMA,
      decks: [{ id: 'd1', name: 'deck', cards: [{ id: 'c42', front: 'a', back: 'b' }] }],
      nextId: 1,
    });

    const added = reduce(repaired, {
      type: 'add-card',
      deckId: 'd1',
      front: 'new',
      back: '',
    });
    const ids = added.decks[0]?.cards.map((each) => each.id) ?? [];

    expect(new Set(ids).size).toBe(2);
  });
});

describe('countStoredItems', () => {
  it('counts cards across every deck', () => {
    expect(
      countStoredItems({
        decks: [{ cards: [1, 2] }, { cards: [3] }],
      }),
    ).toBe(3);
  });

  it('counts nothing for a shape it does not know', () => {
    expect(countStoredItems(null)).toBe(0);
    expect(countStoredItems({ decks: 'none' })).toBe(0);
  });
});

describe('parseDelimited', () => {
  it('reads front and back per line', () => {
    expect(parseDelimited('cat,แมว\ndog,หมา')).toEqual([
      { front: 'cat', back: 'แมว' },
      { front: 'dog', back: 'หมา' },
    ]);
  });

  it('reads a tab-separated paste from a spreadsheet', () => {
    expect(parseDelimited('cat\tแมว')).toEqual([{ front: 'cat', back: 'แมว' }]);
  });

  it('keeps a comma inside a quoted field', () => {
    expect(parseDelimited('"hello, world",สวัสดี')).toEqual([
      { front: 'hello, world', back: 'สวัสดี' },
    ]);
  });

  it('reads a doubled quote as one quote', () => {
    expect(parseDelimited('"say ""hi""",ทัก')).toEqual([
      { front: 'say "hi"', back: 'ทัก' },
    ]);
  });

  it('keeps a newline inside a quoted field', () => {
    expect(parseDelimited('"line one\nline two",สอง')).toEqual([
      { front: 'line one\nline two', back: 'สอง' },
    ]);
  });

  it('ignores blank lines', () => {
    expect(parseDelimited('a,1\n\n\nb,2')).toHaveLength(2);
  });

  it('copes with a missing back', () => {
    expect(parseDelimited('front only')).toEqual([{ front: 'front only', back: '' }]);
  });

  it('ignores anything past the second column', () => {
    expect(parseDelimited('a,b,c,d')).toEqual([{ front: 'a', back: 'b' }]);
  });

  it('reads nothing from nothing', () => {
    expect(parseDelimited('')).toEqual([]);
    expect(parseDelimited('\n\n')).toEqual([]);
  });

  it('handles CRLF line endings', () => {
    expect(parseDelimited('a,1\r\nb,2')).toHaveLength(2);
  });
});

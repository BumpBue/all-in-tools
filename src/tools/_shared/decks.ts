import { addDays, toDayKey } from '@/lib/day';
import { asArray, asNumber, asString, isRecord, storedSchema } from '@/lib/schema';

/**
 * The deck model, shared by two tools on purpose.
 *
 * `flashcards` is where decks are built and browsed; `spaced-repetition` is
 * where they are reviewed. They are one data model behind two pages, so they
 * read and write the same storage key rather than keeping two copies that
 * would drift apart within a day. This lives outside either tool's folder
 * because neither owns it — the rule against importing across tool folders
 * exists to stop exactly the coupling that copying it would create.
 */
export const DECKS_SCHEMA = 1;

/** Both pages read and write this one key. */
export const DECKS_STORAGE_SLUG = 'flashcards';

export const MAX_DECKS = 50;
export const MAX_CARDS_PER_DECK = 1_000;
export const MAX_TEXT_LENGTH = 500;

export const GRADES = ['forgot', 'hard', 'good', 'easy'] as const;
export type Grade = (typeof GRADES)[number];

/** SM-2 speaks in qualities from 0 to 5; these are the four a reader can mean. */
export const GRADE_QUALITY: Readonly<Record<Grade, number>> = {
  forgot: 0,
  hard: 3,
  good: 4,
  easy: 5,
};

export const STARTING_EASE = 2.5;
export const MINIMUM_EASE = 1.3;
export const FIRST_INTERVAL = 1;
export const SECOND_INTERVAL = 6;
const PASSING_QUALITY = 3;
const EASE_PLACES = 100;

export interface Card {
  id: string;
  front: string;
  back: string;
  /** Days until the next review, once it has been reviewed at all. */
  interval: number;
  ease: number;
  reviews: number;
  lapses: number;
  /** Day key, or null for a card that has never been reviewed. */
  due: string | null;
  lastReviewed: string | null;
}

export interface Deck {
  id: string;
  name: string;
  cards: Card[];
}

export interface DecksData {
  schema: number;
  decks: Deck[];
  nextId: number;
}

export const EMPTY_DECKS: DecksData = { schema: DECKS_SCHEMA, decks: [], nextId: 1 };

export function newCard(id: string, front: string, back: string): Card {
  return {
    id,
    front: front.slice(0, MAX_TEXT_LENGTH),
    back: back.slice(0, MAX_TEXT_LENGTH),
    interval: 0,
    ease: STARTING_EASE,
    reviews: 0,
    lapses: 0,
    due: null,
    lastReviewed: null,
  };
}

/**
 * SM-2, kept to its essentials.
 *
 * A failed card starts its ladder again tomorrow rather than being dropped, so
 * nothing is lost by admitting you forgot. The ease factor moves with every
 * answer and never falls below 1.3, which is the floor the algorithm defines to
 * stop a hard card collapsing to daily forever.
 */
export function reviewCard(card: Card, grade: Grade, today: string): Card {
  const quality = GRADE_QUALITY[grade];
  const passed = quality >= PASSING_QUALITY;

  const easeChange = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  const ease = Math.max(
    MINIMUM_EASE,
    Math.round((card.ease + easeChange) * EASE_PLACES) / EASE_PLACES,
  );

  const reviews = passed ? card.reviews + 1 : 0;

  const interval = !passed
    ? FIRST_INTERVAL
    : reviews === 1
      ? FIRST_INTERVAL
      : reviews === 2
        ? SECOND_INTERVAL
        : Math.max(FIRST_INTERVAL, Math.round(card.interval * ease));

  return {
    ...card,
    ease,
    reviews,
    lapses: passed ? card.lapses : card.lapses + 1,
    interval,
    due: addDays(today, interval),
    lastReviewed: today,
  };
}

export function isDue(card: Card, today: string): boolean {
  return card.due === null || card.due <= today;
}

export function dueCards(deck: Deck, today: string): Card[] {
  return deck.cards.filter((card) => isDue(card, today));
}

export function newCards(deck: Deck): Card[] {
  return deck.cards.filter((card) => card.due === null);
}

export function deckProgress(deck: Deck): {
  total: number;
  learned: number;
  fresh: number;
} {
  const fresh = newCards(deck).length;
  return { total: deck.cards.length, learned: deck.cards.length - fresh, fresh };
}

/** date key → how many cards fall due that day, for the calendar. */
export function upcomingSchedule(
  data: DecksData,
  today: string,
  days: number,
): Record<string, number> {
  const schedule: Record<string, number> = {};

  for (const deck of data.decks) {
    for (const card of deck.cards) {
      if (card.due === null) continue;

      // Anything overdue belongs to today: that is when it will be seen.
      const day = card.due < today ? today : card.due;
      if (day > addDays(today, days)) continue;

      schedule[day] = (schedule[day] ?? 0) + 1;
    }
  }

  return schedule;
}

export function totalDue(data: DecksData, today: string): number {
  return data.decks.reduce((sum, deck) => sum + dueCards(deck, today).length, 0);
}

export type DeckAction =
  | { type: 'add-deck'; name: string }
  | { type: 'rename-deck'; deckId: string; name: string }
  | { type: 'remove-deck'; deckId: string }
  | { type: 'add-card'; deckId: string; front: string; back: string }
  | { type: 'edit-card'; deckId: string; cardId: string; front: string; back: string }
  | { type: 'remove-card'; deckId: string; cardId: string }
  | { type: 'import'; deckId: string; cards: Array<{ front: string; back: string }> }
  | { type: 'review'; deckId: string; cardId: string; grade: Grade; today: string }
  | { type: 'reset-progress'; deckId: string };

function mapDeck(
  data: DecksData,
  deckId: string,
  change: (deck: Deck) => Deck,
): DecksData {
  return {
    ...data,
    decks: data.decks.map((deck) => (deck.id === deckId ? change(deck) : deck)),
  };
}

export function reduce(data: DecksData, action: DeckAction): DecksData {
  switch (action.type) {
    case 'add-deck': {
      const name = action.name.trim().slice(0, MAX_TEXT_LENGTH);
      if (name.length === 0 || data.decks.length >= MAX_DECKS) return data;

      return {
        ...data,
        nextId: data.nextId + 1,
        decks: [...data.decks, { id: `d${data.nextId}`, name, cards: [] }],
      };
    }

    case 'rename-deck':
      return mapDeck(data, action.deckId, (deck) => ({
        ...deck,
        name: action.name.slice(0, MAX_TEXT_LENGTH),
      }));

    case 'remove-deck':
      return { ...data, decks: data.decks.filter((deck) => deck.id !== action.deckId) };

    case 'add-card': {
      if (action.front.trim().length === 0) return data;

      const id = `c${data.nextId}`;
      const withCard = mapDeck(data, action.deckId, (deck) =>
        deck.cards.length >= MAX_CARDS_PER_DECK
          ? deck
          : { ...deck, cards: [...deck.cards, newCard(id, action.front, action.back)] },
      );

      return { ...withCard, nextId: data.nextId + 1 };
    }

    case 'edit-card':
      return mapDeck(data, action.deckId, (deck) => ({
        ...deck,
        cards: deck.cards.map((card) =>
          card.id === action.cardId
            ? {
                ...card,
                front: action.front.slice(0, MAX_TEXT_LENGTH),
                back: action.back.slice(0, MAX_TEXT_LENGTH),
              }
            : card,
        ),
      }));

    case 'remove-card':
      return mapDeck(data, action.deckId, (deck) => ({
        ...deck,
        cards: deck.cards.filter((card) => card.id !== action.cardId),
      }));

    case 'import': {
      let next = data.nextId;
      const added = action.cards
        .filter((card) => card.front.trim().length > 0)
        .map((card) => {
          const card_ = newCard(`c${next}`, card.front, card.back);
          next += 1;
          return card_;
        });

      const withCards = mapDeck(data, action.deckId, (deck) => ({
        ...deck,
        cards: [...deck.cards, ...added].slice(0, MAX_CARDS_PER_DECK),
      }));

      return { ...withCards, nextId: next };
    }

    case 'review':
      return mapDeck(data, action.deckId, (deck) => ({
        ...deck,
        cards: deck.cards.map((card) =>
          card.id === action.cardId ? reviewCard(card, action.grade, action.today) : card,
        ),
      }));

    default:
      return mapDeck(data, action.deckId, (deck) => ({
        ...deck,
        cards: deck.cards.map((card) => newCard(card.id, card.front, card.back)),
      }));
  }
}

export function countStoredItems(data: unknown): number {
  if (!isRecord(data) || !Array.isArray(data.decks)) return 0;

  return data.decks.reduce((sum: number, deck: unknown) => {
    if (!isRecord(deck) || !Array.isArray(deck.cards)) return sum;
    return sum + deck.cards.length;
  }, 0);
}

function migrateCard(raw: unknown, index: number): Card {
  if (!isRecord(raw)) return newCard(`c${index}`, '', '');

  const due = asString(raw.due, '');
  const lastReviewed = asString(raw.lastReviewed, '');

  return {
    id: asString(raw.id, `c${index}`),
    front: asString(raw.front).slice(0, MAX_TEXT_LENGTH),
    back: asString(raw.back).slice(0, MAX_TEXT_LENGTH),
    interval: Math.max(0, asNumber(raw.interval, 0)),
    ease: Math.max(MINIMUM_EASE, asNumber(raw.ease, STARTING_EASE)),
    reviews: Math.max(0, asNumber(raw.reviews, 0)),
    lapses: Math.max(0, asNumber(raw.lapses, 0)),
    due: due.length > 0 ? due : null,
    lastReviewed: lastReviewed.length > 0 ? lastReviewed : null,
  };
}

export function migrate(raw: unknown): DecksData {
  const version = storedSchema(raw);
  if (version === null || !isRecord(raw) || version > DECKS_SCHEMA) return EMPTY_DECKS;

  const decks = asArray(raw.decks)
    .slice(0, MAX_DECKS)
    .filter(isRecord)
    .map((deck, index) => ({
      id: asString(deck.id, `d${index}`),
      name: asString(deck.name, '').slice(0, MAX_TEXT_LENGTH),
      cards: asArray(deck.cards)
        .slice(0, MAX_CARDS_PER_DECK)
        .map(migrateCard)
        .filter((card) => card.front.length > 0),
    }))
    .filter((deck) => deck.name.length > 0);

  const highest = decks
    .flatMap((deck) => [deck.id, ...deck.cards.map((card) => card.id)])
    .reduce((top, id) => {
      const numeric = Number(id.replace(/\D/g, ''));
      return Number.isFinite(numeric) ? Math.max(top, numeric) : top;
    }, 0);

  return {
    schema: DECKS_SCHEMA,
    decks,
    nextId: Math.max(asNumber(raw.nextId, 1), highest + 1),
  };
}

export function todayKey(now: number): string {
  return toDayKey(now);
}

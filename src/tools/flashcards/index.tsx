'use client';

import Link from 'next/link';
import { useId, useState } from 'react';

import { Button, buttonClasses } from '@/components/ui/button';
import { Badge } from '@/components/ui/card';
import { FieldError, FieldHint, Input, Label, Textarea } from '@/components/ui/field';
import { buildToolStorageKey } from '@/config/storage-keys';
import { format } from '@/config/i18n';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { NO_TIME, useNowSeconds } from '@/hooks/use-now';
import { useLocale } from '@/hooks/use-t';
import { toDayKey } from '@/lib/day';
import { parseDelimited } from '@/tools/_shared/deck-formats';
import {
  DECKS_STORAGE_SLUG,
  EMPTY_DECKS,
  MAX_DECKS,
  deckProgress,
  dueCards,
  migrate,
  reduce,
  type DeckAction,
  type DecksData,
} from '@/tools/_shared/decks';
import { messages } from '@/tools/flashcards/i18n';

const STORAGE_KEY = buildToolStorageKey(DECKS_STORAGE_SLUG);
const MILLISECONDS_PER_SECOND = 1000;
const REVIEW_PATH = '/tools/spaced-repetition';

export default function Flashcards() {
  const t = messages(useLocale());

  const [stored, setStored, status] = useLocalStorage<DecksData>(
    STORAGE_KEY,
    EMPTY_DECKS,
  );

  const data = migrate(stored);
  const nowSeconds = useNowSeconds();
  const today = nowSeconds === NO_TIME ? '' : toDayKey(nowSeconds * MILLISECONDS_PER_SECOND);

  const [openDeckId, setOpenDeckId] = useState<string | null>(null);
  const [deckName, setDeckName] = useState('');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [importText, setImportText] = useState('');
  const [browseIndex, setBrowseIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const fieldId = useId();
  const openDeck = data.decks.find((deck) => deck.id === openDeckId) ?? null;
  const parsed = parseDelimited(importText);

  function send(action: DeckAction) {
    setStored((previous) => reduce(migrate(previous), action));
  }

  function addDeck() {
    if (deckName.trim().length === 0) return;
    send({ type: 'add-deck', name: deckName });
    setDeckName('');
  }

  function addCard() {
    if (!openDeck || front.trim().length === 0) return;

    send({ type: 'add-card', deckId: openDeck.id, front, back });
    setFront('');
    setBack('');
  }

  const browseCard = openDeck?.cards[Math.min(browseIndex, openDeck.cards.length - 1)];

  return (
    <div className="flex flex-col gap-6">
      <FieldHint>{t.sharedNote}</FieldHint>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t.decks}</h2>
          <span className="text-sm text-muted">
            {format(t.maxDecks, { count: MAX_DECKS })}
          </span>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <Label htmlFor={`${fieldId}-deck`}>{t.newDeck}</Label>
            <Input
              id={`${fieldId}-deck`}
              value={deckName}
              spellCheck={false}
              onChange={(event) => setDeckName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') addDeck();
              }}
            />
          </div>
          <Button onClick={addDeck}>{t.addDeck}</Button>
        </div>

        {data.decks.length === 0 ? (
          <p className="text-sm text-muted">{t.noDecks}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.decks.map((deck) => {
              const progress = deckProgress(deck);
              const due = today === '' ? 0 : dueCards(deck, today).length;

              return (
                <li
                  key={deck.id}
                  className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface p-3"
                >
                  <Input
                    value={deck.name}
                    aria-label={t.renameDeck}
                    spellCheck={false}
                    onChange={(event) =>
                      send({
                        type: 'rename-deck',
                        deckId: deck.id,
                        name: event.target.value,
                      })
                    }
                    className="min-w-40 flex-1"
                  />

                  <Badge tone="neutral">
                    {format(t.cardCount, { count: progress.total })}
                  </Badge>
                  <Badge tone="muted">
                    {format(t.progress, {
                      learned: progress.learned,
                      total: progress.total,
                    })}
                  </Badge>
                  {due > 0 ? (
                    <Badge tone="accent">{format(t.dueNow, { count: due })}</Badge>
                  ) : null}

                  <div className="ml-auto flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={format(t.openDeck, { name: deck.name })}
                      onClick={() => {
                        setOpenDeckId(deck.id === openDeckId ? null : deck.id);
                        setBrowseIndex(0);
                        setFlipped(false);
                      }}
                    >
                      {deck.id === openDeckId ? '−' : '+'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={format(t.deleteDeck, { name: deck.name })}
                      onClick={() => {
                        send({ type: 'remove-deck', deckId: deck.id });
                        if (deck.id === openDeckId) setOpenDeckId(null);
                      }}
                    >
                      ×
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {data.decks.length > 0 ? (
          <div>
            <Link href={REVIEW_PATH} className={buttonClasses({ variant: 'secondary' })}>
              {t.review}
            </Link>
          </div>
        ) : null}
      </section>

      {openDeck ? (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">{t.cards}</h2>

            <div className="flex flex-wrap items-end gap-2">
              <div className="flex min-w-40 flex-1 flex-col gap-1.5">
                <Label htmlFor={`${fieldId}-front`}>{t.front}</Label>
                <Input
                  id={`${fieldId}-front`}
                  value={front}
                  spellCheck={false}
                  onChange={(event) => setFront(event.target.value)}
                />
              </div>

              <div className="flex min-w-40 flex-1 flex-col gap-1.5">
                <Label htmlFor={`${fieldId}-back`}>{t.back}</Label>
                <Input
                  id={`${fieldId}-back`}
                  value={back}
                  spellCheck={false}
                  onChange={(event) => setBack(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') addCard();
                  }}
                />
              </div>

              <Button onClick={addCard}>{t.addCard}</Button>
            </div>

            {openDeck.cards.length === 0 ? (
              <p className="text-sm text-muted">{t.noCards}</p>
            ) : (
              <div className="overflow-x-auto rounded-card border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-subtle">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t.front}</th>
                      <th className="px-3 py-2 font-medium">{t.back}</th>
                      <th className="w-10 px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {openDeck.cards.map((card) => (
                      <tr key={card.id} className="border-t border-border">
                        <td className="px-3 py-1">
                          <input
                            value={card.front}
                            aria-label={t.front}
                            spellCheck={false}
                            onChange={(event) =>
                              send({
                                type: 'edit-card',
                                deckId: openDeck.id,
                                cardId: card.id,
                                front: event.target.value,
                                back: card.back,
                              })
                            }
                            className="w-full bg-transparent outline-none"
                          />
                        </td>
                        <td className="px-3 py-1">
                          <input
                            value={card.back}
                            aria-label={t.back}
                            spellCheck={false}
                            onChange={(event) =>
                              send({
                                type: 'edit-card',
                                deckId: openDeck.id,
                                cardId: card.id,
                                front: card.front,
                                back: event.target.value,
                              })
                            }
                            className="w-full bg-transparent outline-none"
                          />
                        </td>
                        <td className="px-3 py-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={format(t.deleteCard, { front: card.front })}
                            onClick={() =>
                              send({
                                type: 'remove-card',
                                deckId: openDeck.id,
                                cardId: card.id,
                              })
                            }
                          >
                            ×
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {browseCard ? (
            <section className="flex flex-col items-center gap-3">
              <h2 className="text-base font-semibold">{t.browse}</h2>

              <button
                type="button"
                onClick={() => setFlipped((previous) => !previous)}
                aria-label={t.flip}
                className="flex min-h-40 w-full max-w-md items-center justify-center rounded-card border border-border bg-surface px-6 py-8 text-center text-title"
              >
                {flipped ? browseCard.back : browseCard.front}
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={t.previous}
                  onClick={() => {
                    setBrowseIndex((index) => Math.max(0, index - 1));
                    setFlipped(false);
                  }}
                >
                  ←
                </Button>
                <span className="text-sm text-muted">
                  {format(t.cardPosition, {
                    index: Math.min(browseIndex, openDeck.cards.length - 1) + 1,
                    total: openDeck.cards.length,
                  })}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={t.next}
                  onClick={() => {
                    setBrowseIndex((index) =>
                      Math.min(openDeck.cards.length - 1, index + 1),
                    );
                    setFlipped(false);
                  }}
                >
                  →
                </Button>
              </div>

              <FieldHint>{t.tapToFlip}</FieldHint>
            </section>
          ) : null}

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">{t.importTitle}</h2>
            <Textarea
              value={importText}
              placeholder={t.importPlaceholder}
              spellCheck={false}
              onChange={(event) => setImportText(event.target.value)}
              className="min-h-32 font-mono text-sm"
            />
            <FieldHint>{t.importHint}</FieldHint>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                disabled={parsed.length === 0}
                onClick={() => {
                  send({ type: 'import', deckId: openDeck.id, cards: parsed });
                  setImportText('');
                }}
              >
                {format(t.importButton, { count: parsed.length })}
              </Button>
              <span className="text-sm text-muted">
                {parsed.length === 0
                  ? t.importNothing
                  : format(t.importPreview, { count: parsed.length })}
              </span>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="w-fit"
              onClick={() => send({ type: 'reset-progress', deckId: openDeck.id })}
            >
              {t.resetProgress}
            </Button>
            <FieldHint>{t.resetHint}</FieldHint>
          </section>
        </>
      ) : null}

      {status.error !== null ? (
        <FieldError>
          {format(t.storageError, { message: status.error.message })}
        </FieldError>
      ) : null}

      <FieldHint>{t.storageNote}</FieldHint>
    </div>
  );
}

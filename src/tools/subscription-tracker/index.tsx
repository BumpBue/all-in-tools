'use client';

import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/card';
import { FieldError, FieldHint, Input, Label, Select } from '@/components/ui/field';
import { buildToolStorageKey } from '@/config/storage-keys';
import { format } from '@/config/i18n';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { NO_TIME, useNowSeconds } from '@/hooks/use-now';
import { useLocale } from '@/hooks/use-t';
import { toDayKey } from '@/lib/day';
import { messages } from '@/tools/subscription-tracker/i18n';
import {
  CYCLES,
  EMPTY_DATA,
  MAX_SUBSCRIPTIONS,
  SOON_DAYS,
  byCategory,
  daysSinceUsed,
  daysUntilCharge,
  formatBaht,
  isDueSoon,
  isOverdue,
  isStale,
  migrate,
  monthlySatang,
  paidSoFar,
  reduce,
  toSatang,
  totalMonthly,
  type Cycle,
  type SubscriptionAction,
  type SubscriptionData,
} from '@/tools/subscription-tracker/logic';

const STORAGE_KEY = buildToolStorageKey('subscription-tracker');
const MILLISECONDS_PER_SECOND = 1000;
const MONTHS_PER_YEAR = 12;
const BAR_MAX_PERCENT = 100;

export default function SubscriptionTracker() {
  const t = messages(useLocale());

  const [stored, setStored, status] = useLocalStorage<SubscriptionData>(
    STORAGE_KEY,
    EMPTY_DATA,
  );

  const data = migrate(stored);
  const nowSeconds = useNowSeconds();
  const today =
    nowSeconds === NO_TIME ? '' : toDayKey(nowSeconds * MILLISECONDS_PER_SECOND);

  const [name, setName] = useState('');
  const fieldId = useId();

  function send(action: SubscriptionAction) {
    setStored((previous) => reduce(migrate(previous), action));
  }

  if (nowSeconds === NO_TIME) {
    return <p className="text-sm text-muted">{t.waiting}</p>;
  }

  const cycleLabels: Record<Cycle, string> = {
    monthly: t.cycleMonthly,
    yearly: t.cycleYearly,
    weekly: t.cycleWeekly,
    custom: t.cycleCustom,
  };

  const monthly = totalMonthly(data.subscriptions);
  const soon = data.subscriptions.filter(
    (item) => isDueSoon(item, today) || isOverdue(item, today),
  );
  const stale = data.subscriptions.filter((item) => isStale(item, today));
  const categories = byCategory(data.subscriptions);
  const widest = categories[0]?.monthly ?? 1;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <Label htmlFor={`${fieldId}-name`}>{t.newName}</Label>
            <Input
              id={`${fieldId}-name`}
              value={name}
              placeholder={t.newPlaceholder}
              spellCheck={false}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                send({ type: 'add', name, today });
                setName('');
              }}
            />
          </div>
          <Button
            onClick={() => {
              send({ type: 'add', name, today });
              setName('');
            }}
          >
            {t.add}
          </Button>
        </div>
        <FieldHint>{format(t.maxItems, { count: MAX_SUBSCRIPTIONS })}</FieldHint>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t.summary}</h2>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-0.5 rounded-card border border-border bg-surface px-3 py-2">
            <dt className="text-xs text-muted">{t.totalMonthly}</dt>
            <dd className="font-mono text-display">{formatBaht(monthly)}</dd>
          </div>
          <div className="flex flex-col gap-0.5 rounded-card border border-border bg-surface px-3 py-2">
            <dt className="text-xs text-muted">{t.totalYearly}</dt>
            <dd className="font-mono text-title">
              {formatBaht(monthly * MONTHS_PER_YEAR)}
            </dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
          <h2 className="text-base font-semibold">
            {format(t.soonTitle, { days: SOON_DAYS })}
          </h2>

          {soon.length === 0 ? (
            <p className="text-sm text-muted">{t.soonEmpty}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {soon.map((item) => {
                const days = daysUntilCharge(item, today) ?? 0;

                return (
                  <li key={item.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{item.name}</span>
                    <Badge tone={days < 0 ? 'neutral' : 'accent'}>
                      {days < 0
                        ? format(t.overdue, { days: -days })
                        : days === 0
                          ? t.today
                          : format(t.soon, { days })}
                    </Badge>
                    <span className="font-mono text-muted">{formatBaht(item.price)}</span>
                    {days < 0 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => send({ type: 'advance', id: item.id, today })}
                      >
                        {t.advance}
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
          <h2 className="text-base font-semibold">{t.staleTitle}</h2>

          {stale.length === 0 ? (
            <p className="text-sm text-muted">{t.staleEmpty}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {stale.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{item.name}</span>
                  <Badge tone="neutral">
                    {format(t.stale, { days: daysSinceUsed(item, today) ?? 0 })}
                  </Badge>
                  <span className="font-mono text-muted">
                    {format(t.perMonth, { amount: formatBaht(monthlySatang(item)) })}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <FieldHint>{t.staleNote}</FieldHint>
        </section>
      </div>

      {categories.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">{t.categories}</h2>

          <ul className="flex flex-col gap-2">
            {categories.map((group) => (
              <li key={group.category || 'none'} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">
                    {group.category || t.uncategorised}
                  </span>
                  <span className="text-muted">
                    {format(t.categoryShare, {
                      count: group.count,
                      amount: formatBaht(group.monthly),
                    })}
                  </span>
                </div>
                <div
                  className="h-2 rounded-full bg-accent"
                  style={{
                    width: `${Math.max(2, (group.monthly / widest) * BAR_MAX_PERCENT)}%`,
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.subscriptions.length === 0 ? (
        <p className="text-sm text-muted">{t.noItems}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.subscriptions.map((item) => {
            const paid = paidSoFar(item, today);

            return (
              <li
                key={item.id}
                className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
              >
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex min-w-40 flex-1 flex-col gap-1.5">
                    <Label htmlFor={`${fieldId}-${item.id}-name`}>{t.name}</Label>
                    <Input
                      id={`${fieldId}-${item.id}-name`}
                      value={item.name}
                      spellCheck={false}
                      onChange={(event) =>
                        send({
                          type: 'edit',
                          id: item.id,
                          patch: { name: event.target.value },
                        })
                      }
                    />
                  </div>

                  <div className="flex w-28 flex-col gap-1.5">
                    <Label htmlFor={`${fieldId}-${item.id}-price`}>{t.price}</Label>
                    <Input
                      id={`${fieldId}-${item.id}-price`}
                      value={formatBaht(item.price)}
                      inputMode="decimal"
                      onChange={(event) =>
                        send({
                          type: 'edit',
                          id: item.id,
                          patch: { price: toSatang(Number(event.target.value)) },
                        })
                      }
                      className="text-right font-mono"
                    />
                  </div>

                  <div className="flex w-36 flex-col gap-1.5">
                    <Label htmlFor={`${fieldId}-${item.id}-cycle`}>{t.cycle}</Label>
                    <Select
                      id={`${fieldId}-${item.id}-cycle`}
                      value={item.cycle}
                      onChange={(event) =>
                        send({
                          type: 'edit',
                          id: item.id,
                          patch: { cycle: event.target.value as Cycle },
                        })
                      }
                    >
                      {CYCLES.map((cycle) => (
                        <option key={cycle} value={cycle}>
                          {cycleLabels[cycle]}
                        </option>
                      ))}
                    </Select>
                  </div>

                  {item.cycle === 'custom' ? (
                    <div className="flex w-28 flex-col gap-1.5">
                      <Label htmlFor={`${fieldId}-${item.id}-days`}>{t.customDays}</Label>
                      <Input
                        id={`${fieldId}-${item.id}-days`}
                        value={String(item.customDays)}
                        inputMode="numeric"
                        onChange={(event) =>
                          send({
                            type: 'edit',
                            id: item.id,
                            patch: { customDays: Number(event.target.value) || 1 },
                          })
                        }
                        className="text-right font-mono"
                      />
                    </div>
                  ) : null}

                  <Badge tone="accent">
                    {format(t.perMonth, { amount: formatBaht(monthlySatang(item)) })}
                  </Badge>

                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={format(t.remove, { name: item.name })}
                    onClick={() => send({ type: 'remove', id: item.id })}
                  >
                    ×
                  </Button>
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  {(
                    [
                      ['nextCharge', t.nextCharge],
                      ['startedOn', t.startedOn],
                      ['lastUsedOn', t.lastUsed],
                    ] as Array<['nextCharge' | 'startedOn' | 'lastUsedOn', string]>
                  ).map(([field, label]) => (
                    <div key={field} className="flex flex-col gap-1.5">
                      <Label htmlFor={`${fieldId}-${item.id}-${field}`}>{label}</Label>
                      <Input
                        id={`${fieldId}-${item.id}-${field}`}
                        type="date"
                        value={item[field]}
                        onChange={(event) =>
                          send({
                            type: 'edit',
                            id: item.id,
                            patch: { [field]: event.target.value },
                          })
                        }
                      />
                    </div>
                  ))}

                  <div className="flex min-w-32 flex-col gap-1.5">
                    <Label htmlFor={`${fieldId}-${item.id}-category`}>{t.category}</Label>
                    <Input
                      id={`${fieldId}-${item.id}-category`}
                      value={item.category}
                      placeholder={t.categoryPlaceholder}
                      spellCheck={false}
                      onChange={(event) =>
                        send({
                          type: 'edit',
                          id: item.id,
                          patch: { category: event.target.value },
                        })
                      }
                    />
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => send({ type: 'mark-used', id: item.id, today })}
                  >
                    {t.markUsed}
                  </Button>
                </div>

                {paid !== null ? (
                  <p className="text-sm text-muted">
                    {format(t.paid, { amount: formatBaht(paid) })}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <FieldHint>{t.paidNote}</FieldHint>

      {status.error !== null ? (
        <FieldError>
          {format(t.storageError, { message: status.error.message })}
        </FieldError>
      ) : null}

      <FieldHint>{t.storageNote}</FieldHint>
    </div>
  );
}

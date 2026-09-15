'use client';

import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/card';
import { CopyButton } from '@/components/ui/copy-button';
import { FieldError, FieldHint, Input, Label, Select } from '@/components/ui/field';
import { buildToolStorageKey } from '@/config/storage-keys';
import { format } from '@/config/i18n';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useLocale } from '@/hooks/use-t';
import { useUrlState } from '@/hooks/use-url-state';
import { messages } from '@/tools/bill-splitter/i18n';
import {
  EMPTY_DATA,
  MAX_GROUPS,
  SHARE_MODES,
  balances,
  formatBaht,
  groupTotal,
  migrate,
  personName,
  reduce,
  settle,
  sharesFor,
  toSatang,
  type Group,
  type ShareMode,
  type SplitterAction,
  type SplitterData,
} from '@/tools/bill-splitter/logic';
import { decodeGroup, encodeGroup, withFreshIds } from '@/tools/bill-splitter/share';
import type { ToolComponentProps } from '@/tools/types';

const STORAGE_KEY = buildToolStorageKey('bill-splitter');
const URL_GROUP_KEY = 'g';
const URL_DEBOUNCE_MS = 400;
const URL_MAX_VALUE_LENGTH = 4_000;
const SHARED_ID = 'shared';

export default function BillSplitter({ searchParams }: ToolComponentProps) {
  const t = messages(useLocale());

  const [stored, setStored, status] = useLocalStorage<SplitterData>(
    STORAGE_KEY,
    EMPTY_DATA,
  );

  const data = migrate(stored);

  const [urlState] = useUrlState(
    { [URL_GROUP_KEY]: searchParams[URL_GROUP_KEY] ?? '' },
    { debounceMs: URL_DEBOUNCE_MS, maxValueLength: URL_MAX_VALUE_LENGTH },
  );

  const sharedGroup = decodeGroup(urlState[URL_GROUP_KEY], SHARED_ID);

  const [openId, setOpenId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [personName_, setPersonName] = useState('');
  const [expenseName, setExpenseName] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [saved, setSaved] = useState(false);

  const fieldId = useId();

  const openGroup =
    openId === SHARED_ID ? sharedGroup : data.groups.find((each) => each.id === openId) ?? null;

  function send(action: SplitterAction) {
    setStored((previous) => reduce(migrate(previous), action));
  }

  function saveShared() {
    if (!sharedGroup) return;

    setStored((previous) => {
      const current = migrate(previous);
      const { group, nextId } = withFreshIds(sharedGroup, current.nextId);

      return { ...current, groups: [...current.groups, group], nextId };
    });

    setSaved(true);
  }

  const modeLabels: Record<ShareMode, string> = {
    equal: t.modeEqual,
    weight: t.modeWeight,
    exact: t.modeExact,
  };

  function renderGroup(group: Group, editable: boolean) {
    const net = balances(group);
    const transfers = settle(group);

    return (
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">{t.people}</h2>

          {editable ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex w-56 flex-col gap-1.5">
                <Label htmlFor={`${fieldId}-person`}>{t.newPerson}</Label>
                <Input
                  id={`${fieldId}-person`}
                  value={personName_}
                  spellCheck={false}
                  onChange={(event) => setPersonName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    send({ type: 'add-person', groupId: group.id, name: personName_ });
                    setPersonName('');
                  }}
                />
              </div>
              <Button
                onClick={() => {
                  send({ type: 'add-person', groupId: group.id, name: personName_ });
                  setPersonName('');
                }}
              >
                {t.addPerson}
              </Button>
            </div>
          ) : null}

          {group.people.length === 0 ? (
            <p className="text-sm text-muted">{t.noPeople}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {group.people.map((person) => (
                <li key={person.id} className="flex items-center gap-1">
                  {editable ? (
                    <>
                      <Input
                        value={person.name}
                        aria-label={t.renamePerson}
                        spellCheck={false}
                        onChange={(event) =>
                          send({
                            type: 'rename-person',
                            groupId: group.id,
                            personId: person.id,
                            name: event.target.value,
                          })
                        }
                        className="w-32"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={format(t.removePerson, { name: person.name })}
                        onClick={() =>
                          send({
                            type: 'remove-person',
                            groupId: group.id,
                            personId: person.id,
                          })
                        }
                      >
                        ×
                      </Button>
                    </>
                  ) : (
                    <Badge tone="neutral">{person.name}</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}

          {editable ? <FieldHint>{t.removePersonNote}</FieldHint> : null}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">{t.expenses}</h2>
            <Badge tone="neutral">
              {format(t.total, { amount: formatBaht(groupTotal(group)) })}
            </Badge>
          </div>

          {editable && group.people.length > 0 ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex min-w-40 flex-1 flex-col gap-1.5">
                <Label htmlFor={`${fieldId}-expense`}>{t.description}</Label>
                <Input
                  id={`${fieldId}-expense`}
                  value={expenseName}
                  spellCheck={false}
                  onChange={(event) => setExpenseName(event.target.value)}
                />
              </div>

              <div className="flex w-32 flex-col gap-1.5">
                <Label htmlFor={`${fieldId}-amount`}>{t.amount}</Label>
                <Input
                  id={`${fieldId}-amount`}
                  value={expenseAmount}
                  inputMode="decimal"
                  onChange={(event) => setExpenseAmount(event.target.value)}
                  className="text-right font-mono"
                />
              </div>

              <Button
                onClick={() => {
                  const amount = toSatang(Number(expenseAmount));
                  if (amount <= 0) return;

                  send({
                    type: 'add-expense',
                    groupId: group.id,
                    description: expenseName,
                    amount,
                    paidBy: group.people[0]?.id ?? '',
                  });
                  setExpenseName('');
                  setExpenseAmount('');
                }}
              >
                {t.addExpense}
              </Button>
            </div>
          ) : null}

          {group.expenses.length === 0 ? (
            <p className="text-sm text-muted">{t.noExpenses}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {group.expenses.map((expense) => {
                const owed = sharesFor(expense, group.people);
                const exactTotal = Object.values(expense.shares).reduce(
                  (sum, value) => sum + Math.max(0, value),
                  0,
                );

                return (
                  <li
                    key={expense.id}
                    className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-32 flex-1 font-medium">
                        {expense.description}
                      </span>
                      <Badge tone="accent">{formatBaht(expense.amount)}</Badge>

                      {editable ? (
                        <>
                          <Select
                            value={expense.paidBy}
                            aria-label={t.paidBy}
                            onChange={(event) =>
                              send({
                                type: 'edit-expense',
                                groupId: group.id,
                                expenseId: expense.id,
                                patch: { paidBy: event.target.value },
                              })
                            }
                            className="h-8 w-32 text-sm"
                          >
                            {group.people.map((person) => (
                              <option key={person.id} value={person.id}>
                                {person.name}
                              </option>
                            ))}
                          </Select>

                          <Select
                            value={expense.shareMode}
                            aria-label={t.shareMode}
                            onChange={(event) =>
                              send({
                                type: 'edit-expense',
                                groupId: group.id,
                                expenseId: expense.id,
                                patch: { shareMode: event.target.value as ShareMode },
                              })
                            }
                            className="h-8 w-32 text-sm"
                          >
                            {SHARE_MODES.map((mode) => (
                              <option key={mode} value={mode}>
                                {modeLabels[mode]}
                              </option>
                            ))}
                          </Select>

                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={format(t.removeExpense, {
                              name: expense.description,
                            })}
                            onClick={() =>
                              send({
                                type: 'remove-expense',
                                groupId: group.id,
                                expenseId: expense.id,
                              })
                            }
                          >
                            ×
                          </Button>
                        </>
                      ) : (
                        <Badge tone="muted">{personName(group, expense.paidBy)}</Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {group.people.map((person) => (
                        <label
                          key={person.id}
                          className="flex items-center gap-1 rounded-control border border-border px-2 py-1 text-xs"
                        >
                          {expense.shareMode === 'equal' ? (
                            <input
                              type="checkbox"
                              checked={(expense.shares[person.id] ?? 0) > 0}
                              disabled={!editable}
                              aria-label={format(t.shareFor, { name: person.name })}
                              onChange={(event) =>
                                send({
                                  type: 'edit-expense',
                                  groupId: group.id,
                                  expenseId: expense.id,
                                  patch: {
                                    shares: {
                                      ...expense.shares,
                                      [person.id]: event.target.checked ? 1 : 0,
                                    },
                                  },
                                })
                              }
                            />
                          ) : (
                            <input
                              value={String(
                                expense.shareMode === 'exact'
                                  ? formatBaht(expense.shares[person.id] ?? 0)
                                  : (expense.shares[person.id] ?? 0),
                              )}
                              inputMode="decimal"
                              disabled={!editable}
                              aria-label={format(t.shareFor, { name: person.name })}
                              onChange={(event) =>
                                send({
                                  type: 'edit-expense',
                                  groupId: group.id,
                                  expenseId: expense.id,
                                  patch: {
                                    shares: {
                                      ...expense.shares,
                                      [person.id]:
                                        expense.shareMode === 'exact'
                                          ? toSatang(Number(event.target.value))
                                          : Number(event.target.value) || 0,
                                    },
                                  },
                                })
                              }
                              className="w-14 bg-transparent text-right font-mono outline-none"
                            />
                          )}
                          <span>{person.name}</span>
                          <span className="text-muted">{formatBaht(owed[person.id] ?? 0)}</span>
                        </label>
                      ))}
                    </div>

                    {expense.shareMode === 'exact' && exactTotal !== expense.amount ? (
                      <FieldError>
                        {format(t.exactMismatch, {
                          total: formatBaht(exactTotal),
                          amount: formatBaht(expense.amount),
                        })}
                      </FieldError>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">{t.balances}</h2>
          <ul className="flex flex-wrap gap-2">
            {group.people.map((person) => {
              const amount = net[person.id] ?? 0;

              return (
                <li key={person.id}>
                  <Badge tone={amount > 0 ? 'success' : amount < 0 ? 'neutral' : 'muted'}>
                    {person.name}:{' '}
                    {amount === 0
                      ? t.settled
                      : amount > 0
                        ? format(t.getsBack, { amount: formatBaht(amount) })
                        : format(t.owes, { amount: formatBaht(-amount) })}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">{t.settleUp}</h2>

          {transfers.length === 0 ? (
            <p className="text-sm text-muted">{t.nothingToSettle}</p>
          ) : (
            <ol className="flex flex-col gap-1">
              {transfers.map((transfer, index) => (
                <li key={index} className="text-sm">
                  {format(t.transfer, {
                    from: personName(group, transfer.from),
                    to: personName(group, transfer.to),
                    amount: formatBaht(transfer.amount),
                  })}
                </li>
              ))}
            </ol>
          )}

          <FieldHint>{t.settleNote}</FieldHint>
          <FieldHint>{t.satangNote}</FieldHint>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {sharedGroup ? (
        <section className="flex flex-col gap-3 rounded-card border border-accent bg-accent-subtle p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">{t.sharedTitle}</h2>
            <Badge tone="neutral">{sharedGroup.name}</Badge>

            <div className="ml-auto flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setOpenId(openId === SHARED_ID ? null : SHARED_ID)}
              >
                {format(t.openGroup, { name: sharedGroup.name })}
              </Button>
              <Button size="sm" disabled={saved} onClick={saveShared}>
                {saved ? t.savedShared : t.saveShared}
              </Button>
            </div>
          </div>
          <FieldHint>{t.sharedNote}</FieldHint>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t.groups}</h2>
          <span className="text-sm text-muted">
            {format(t.maxGroups, { count: MAX_GROUPS })}
          </span>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <Label htmlFor={`${fieldId}-group`}>{t.newGroup}</Label>
            <Input
              id={`${fieldId}-group`}
              value={groupName}
              placeholder={t.newGroupPlaceholder}
              spellCheck={false}
              onChange={(event) => setGroupName(event.target.value)}
            />
          </div>
          <Button
            onClick={() => {
              send({ type: 'add-group', name: groupName });
              setGroupName('');
            }}
          >
            {t.addGroup}
          </Button>
        </div>

        {data.groups.length === 0 ? (
          <p className="text-sm text-muted">{t.noGroups}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.groups.map((group) => (
              <li
                key={group.id}
                className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface p-3"
              >
                <Input
                  value={group.name}
                  aria-label={t.renameGroup}
                  spellCheck={false}
                  onChange={(event) =>
                    send({
                      type: 'rename-group',
                      groupId: group.id,
                      name: event.target.value,
                    })
                  }
                  className="min-w-40 flex-1"
                />
                <Badge tone="neutral">{formatBaht(groupTotal(group))}</Badge>

                <CopyButton
                  value={
                    typeof window === 'undefined'
                      ? ''
                      : `${window.location.origin}${window.location.pathname}?${URL_GROUP_KEY}=${encodeURIComponent(encodeGroup(group))}`
                  }
                  label={t.share}
                  variant="ghost"
                  size="icon"
                />

                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={format(t.openGroup, { name: group.name })}
                  onClick={() => setOpenId(openId === group.id ? null : group.id)}
                >
                  {openId === group.id ? '−' : '+'}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={format(t.removeGroup, { name: group.name })}
                  onClick={() => send({ type: 'remove-group', groupId: group.id })}
                >
                  ×
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {openGroup ? renderGroup(openGroup, openId !== SHARED_ID) : null}

      {status.error !== null ? (
        <FieldError>
          {format(t.storageError, { message: status.error.message })}
        </FieldError>
      ) : null}

      <FieldHint>{t.storageNote}</FieldHint>
    </div>
  );
}

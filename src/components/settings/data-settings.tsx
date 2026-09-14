'use client';

import { Download, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';

import { ImportPanel } from '@/components/settings/import-panel';
import { Button } from '@/components/ui/button';
import { Badge, EmptyState } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/field';
import { SITE_NAME } from '@/config/site';
import { buildToolStorageKey } from '@/config/storage-keys';
import { format } from '@/config/i18n';
import { getTool } from '@/config/tools';
import { invalidateStoredData, useStoredData } from '@/hooks/use-stored-data';
import { useLocale, useT } from '@/hooks/use-t';
import { downloadText } from '@/lib/download';
import { clearAll, exportAll, removeItem } from '@/lib/storage';
import { formatBytes } from '@/lib/utils';

const ICON_SIZE = 16;
const EXPORT_MIME = 'application/json';
const DATE_LOCALES = { th: 'th-TH', en: 'en-GB' } as const;

function backupFilename(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `${SITE_NAME.toLowerCase()}-backup-${today}.json`;
}

export function DataSettings() {
  const t = useT().settings;
  const locale = useLocale();
  const { tools, totalBytes } = useStoredData();

  const [confirmation, setConfirmation] = useState('');
  const [cleared, setCleared] = useState(false);
  const confirmId = useId();

  const formatWhen = (timestamp: number) =>
    new Intl.DateTimeFormat(DATE_LOCALES[locale], {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(timestamp);

  function deleteOne(slug: string) {
    removeItem(buildToolStorageKey(slug));
    invalidateStoredData();
  }

  function deleteEverything() {
    clearAll();
    invalidateStoredData();
    setConfirmation('');
    setCleared(true);
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-muted">{t.dataNote}</p>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-medium">{t.stored}</h3>
          {tools.length > 0 ? (
            <span className="text-sm text-muted">
              {format(t.usage, { size: formatBytes(totalBytes) })}
            </span>
          ) : null}
        </div>

        {tools.length === 0 ? (
          <EmptyState title={t.storedEmpty} description={t.storedEmptyHint} />
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
            {tools.map((entry) => (
              <li
                key={entry.slug}
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">
                    {getTool(entry.slug)?.name[locale] ?? entry.slug}
                  </span>
                  <span className="text-xs text-muted">
                    {format(t.updatedAt, { when: formatWhen(entry.updatedAt) })}
                  </span>
                </div>
                <Badge tone="muted">
                  {format(t.itemCount, { count: entry.itemCount })}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t.deleteOne}
                  title={t.deleteOne}
                  onClick={() => deleteOne(entry.slug)}
                >
                  <Trash2 size={ICON_SIZE} aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">{t.export}</h3>
        <div>
          <Button
            variant="secondary"
            size="sm"
            disabled={tools.length === 0}
            onClick={() => downloadText(exportAll(), backupFilename(), EXPORT_MIME)}
          >
            <Download size={ICON_SIZE} aria-hidden />
            {tools.length === 0 ? t.exportEmpty : t.export}
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">{t.import}</h3>
        <ImportPanel />
      </section>

      <section className="flex flex-col gap-3 rounded-card border border-danger/40 p-4">
        <h3 className="text-sm font-medium text-danger">{t.clear}</h3>
        <p className="text-sm text-muted">{t.clearWarning}</p>

        {cleared ? (
          <p role="status" className="text-sm text-success">
            {t.clearDone}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:max-w-sm">
          <Label htmlFor={confirmId}>
            {format(t.clearPrompt, { word: t.clearWord })}
          </Label>
          <Input
            id={confirmId}
            value={confirmation}
            onChange={(event) => {
              setConfirmation(event.target.value);
              setCleared(false);
            }}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div>
          <Button
            variant="danger"
            size="sm"
            disabled={confirmation.trim() !== t.clearWord}
            onClick={deleteEverything}
          >
            <Trash2 size={ICON_SIZE} aria-hidden />
            {t.clearConfirm}
          </Button>
        </div>
      </section>
    </div>
  );
}

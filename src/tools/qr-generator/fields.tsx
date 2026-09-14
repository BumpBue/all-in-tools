'use client';

import { useId } from 'react';

import { FieldHint, Input, Label, Select, Textarea } from '@/components/ui/field';
import { messages } from '@/tools/qr-generator/i18n';
import {
  WIFI_SECURITIES,
  PROMPTPAY_TARGETS,
  type PromptPayInput,
  type PromptPayTarget,
  type VCardInput,
  type WifiInput,
  type WifiSecurity,
} from '@/tools/qr-generator/logic';
import type { Locale } from '@/types/tool';

export function TextFields({
  locale,
  value,
  onChange,
}: {
  locale: Locale;
  value: string;
  onChange: (value: string) => void;
}) {
  const t = messages(locale);
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{t.text}</Label>
      <Textarea
        id={id}
        value={value}
        placeholder={t.textPlaceholder}
        spellCheck={false}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
        className="min-h-24"
      />
    </div>
  );
}

export function WifiFields({
  locale,
  value,
  onChange,
}: {
  locale: Locale;
  value: WifiInput;
  onChange: (next: WifiInput) => void;
}) {
  const t = messages(locale);
  const ssidId = useId();
  const passwordId = useId();
  const securityId = useId();

  const securityLabels: Record<WifiSecurity, string> = {
    WPA: 'WPA / WPA2 / WPA3',
    WEP: 'WEP',
    nopass: t.securityNone,
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={ssidId}>{t.ssid}</Label>
          <Input
            id={ssidId}
            value={value.ssid}
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => onChange({ ...value, ssid: event.target.value })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={securityId}>{t.security}</Label>
          <Select
            id={securityId}
            value={value.security}
            onChange={(event) =>
              onChange({ ...value, security: event.target.value as WifiSecurity })
            }
          >
            {WIFI_SECURITIES.map((security) => (
              <option key={security} value={security}>
                {securityLabels[security]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {value.security === 'nopass' ? null : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={passwordId}>{t.password}</Label>
          <Input
            id={passwordId}
            type="password"
            value={value.password}
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => onChange({ ...value, password: event.target.value })}
          />
        </div>
      )}

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.hidden}
          onChange={(event) => onChange({ ...value, hidden: event.target.checked })}
        />
        <span>{t.hidden}</span>
      </label>
    </div>
  );
}

export function VCardFields({
  locale,
  value,
  onChange,
}: {
  locale: Locale;
  value: VCardInput;
  onChange: (next: VCardInput) => void;
}) {
  const t = messages(locale);
  const id = useId();

  const rows: Array<[keyof VCardInput, string]> = [
    ['firstName', t.firstName],
    ['lastName', t.lastName],
    ['organization', t.organization],
    ['title', t.title],
    ['phone', t.phone],
    ['email', t.email],
    ['url', t.url],
    ['address', t.address],
    ['note', t.note],
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map(([field, label]) => (
        <div key={field} className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-${field}`}>{label}</Label>
          <Input
            id={`${id}-${field}`}
            value={value[field]}
            spellCheck={false}
            autoComplete="off"
            inputMode={field === 'phone' ? 'tel' : undefined}
            onChange={(event) => onChange({ ...value, [field]: event.target.value })}
          />
        </div>
      ))}
    </div>
  );
}

export function PromptPayFields({
  locale,
  value,
  onChange,
}: {
  locale: Locale;
  value: PromptPayInput;
  onChange: (next: PromptPayInput) => void;
}) {
  const t = messages(locale);
  const targetId = useId();
  const idId = useId();
  const amountId = useId();

  const targetLabels: Record<PromptPayTarget, string> = {
    phone: t.targetPhone,
    'national-id': t.targetNationalId,
    ewallet: t.targetEwallet,
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={targetId}>{t.promptpayTarget}</Label>
          <Select
            id={targetId}
            value={value.target}
            onChange={(event) =>
              onChange({ ...value, target: event.target.value as PromptPayTarget })
            }
          >
            {PROMPTPAY_TARGETS.map((target) => (
              <option key={target} value={target}>
                {targetLabels[target]}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={idId}>{t.promptpayId}</Label>
          <Input
            id={idId}
            value={value.id}
            inputMode="numeric"
            autoComplete="off"
            onChange={(event) => onChange({ ...value, id: event.target.value })}
            className="font-mono"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={amountId}>{t.amount}</Label>
          <Input
            id={amountId}
            value={value.amount}
            inputMode="decimal"
            autoComplete="off"
            onChange={(event) => onChange({ ...value, amount: event.target.value })}
            className="text-right font-mono"
          />
        </div>
      </div>

      <FieldHint>{t.amountHint}</FieldHint>
      <FieldHint>{t.promptpayNote}</FieldHint>
    </div>
  );
}

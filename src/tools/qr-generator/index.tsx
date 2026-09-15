'use client';

import { useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/card';
import { CopyButton } from '@/components/ui/copy-button';
import { FieldError, FieldHint, Input, Label, Select } from '@/components/ui/field';
import { Toggle } from '@/components/ui/toggle';
import { format } from '@/config/i18n';
import { useLocale } from '@/hooks/use-t';
import { useUrlState } from '@/hooks/use-url-state';
import { contrastRatio, parseColor } from '@/lib/color';
import { downloadBlob, downloadText } from '@/lib/download';
import {
  PromptPayFields,
  TextFields,
  VCardFields,
  WifiFields,
} from '@/tools/qr-generator/fields';
import { messages } from '@/tools/qr-generator/i18n';
import {
  DEFAULT_DARK,
  DEFAULT_ERROR_LEVEL,
  DEFAULT_LIGHT,
  DEFAULT_LOGO_PERCENT,
  DEFAULT_MARGIN,
  ERROR_LEVELS,
  ERROR_LEVEL_RECOVERY,
  EXPORT_SIZES,
  MAX_CONTENT_LENGTH,
  MAX_LOGO_PERCENT,
  QR_MODES,
  buildMatrix,
  buildPromptPay,
  buildText,
  buildVCard,
  buildWifi,
  logoCoversTooMuch,
  readColor,
  toSvg,
  type ErrorLevel,
  type PayloadResult,
  type PromptPayInput,
  type QrMode,
  type VCardInput,
  type WifiInput,
} from '@/tools/qr-generator/logic';
import type { ToolComponentProps } from '@/tools/types';

const URL_MODE_KEY = 'm';
const URL_TEXT_KEY = 'q';
const URL_LEVEL_KEY = 'e';
const URL_DARK_KEY = 'd';
const URL_LIGHT_KEY = 'l';
const URL_DEBOUNCE_MS = 400;
const URL_MAX_VALUE_LENGTH = 800;

const PREVIEW_SIZE = 320;
const MIN_LOGO_PERCENT = 8;
const MIN_SCAN_CONTRAST = 3;
const MAX_LOGO_BYTES = 512 * 1024;
const SVG_MIME = 'image/svg+xml';
const PNG_MIME = 'image/png';

const EMPTY_WIFI: WifiInput = {
  ssid: '',
  password: '',
  security: 'WPA',
  hidden: false,
};

const EMPTY_CARD: VCardInput = {
  firstName: '',
  lastName: '',
  organization: '',
  title: '',
  phone: '',
  email: '',
  url: '',
  address: '',
  note: '',
};

const EMPTY_PAY: PromptPayInput = { target: 'phone', id: '', amount: '' };

function readMode(raw: string | undefined): QrMode {
  return QR_MODES.includes(raw as QrMode) ? (raw as QrMode) : 'text';
}

function readLevel(raw: string | undefined): ErrorLevel {
  return ERROR_LEVELS.includes(raw as ErrorLevel)
    ? (raw as ErrorLevel)
    : DEFAULT_ERROR_LEVEL;
}

export default function QrGenerator({ searchParams }: ToolComponentProps) {
  const locale = useLocale();
  const t = messages(locale);

  // Only the plain text mode puts its contents in the link. A WiFi password
  // and a contact card are the reader's, and a link is the easiest thing in
  // the world to forward by accident.
  const [urlState, setUrlState] = useUrlState(
    {
      [URL_MODE_KEY]: readMode(searchParams[URL_MODE_KEY]) as string,
      [URL_TEXT_KEY]: searchParams[URL_TEXT_KEY] ?? '',
      [URL_LEVEL_KEY]: readLevel(searchParams[URL_LEVEL_KEY]) as string,
      [URL_DARK_KEY]: readColor(searchParams[URL_DARK_KEY], DEFAULT_DARK),
      [URL_LIGHT_KEY]: readColor(searchParams[URL_LIGHT_KEY], DEFAULT_LIGHT),
    },
    { debounceMs: URL_DEBOUNCE_MS, maxValueLength: URL_MAX_VALUE_LENGTH },
  );

  const mode = readMode(urlState[URL_MODE_KEY]);
  const level = readLevel(urlState[URL_LEVEL_KEY]);
  const dark = readColor(urlState[URL_DARK_KEY], DEFAULT_DARK);
  const light = readColor(urlState[URL_LIGHT_KEY], DEFAULT_LIGHT);
  const text = urlState[URL_TEXT_KEY];

  const [wifi, setWifi] = useState(EMPTY_WIFI);
  const [card, setCard] = useState(EMPTY_CARD);
  const [pay, setPay] = useState(EMPTY_PAY);

  const [logo, setLogo] = useState<string | null>(null);
  const [logoPercent, setLogoPercent] = useState(DEFAULT_LOGO_PERCENT);
  const [logoError, setLogoError] = useState<string | null>(null);

  const levelId = useId();
  const darkId = useId();
  const lightId = useId();
  const logoSizeId = useId();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const payload: PayloadResult =
    mode === 'text'
      ? buildText(text)
      : mode === 'wifi'
        ? buildWifi(wifi)
        : mode === 'vcard'
          ? buildVCard(card)
          : buildPromptPay(pay);

  const matrix = payload.ok ? buildMatrix(payload.payload, level) : null;

  const logoOptions =
    logo === null ? undefined : { href: logo, percent: logoPercent };

  const svg =
    matrix === null
      ? ''
      : toSvg(matrix, {
          dark,
          light,
          margin: DEFAULT_MARGIN,
          size: PREVIEW_SIZE,
          logo: logoOptions,
        });

  const darkRgb = parseColor(dark);
  const lightRgb = parseColor(light);
  const ratio =
    darkRgb && lightRgb ? contrastRatio(darkRgb, lightRgb) : MIN_SCAN_CONTRAST;

  const errorMessages: Record<string, string> = {
    empty: t.errorEmpty,
    'too-long': format(t.errorTooLong, { max: MAX_CONTENT_LENGTH }),
    'no-ssid': t.errorNoSsid,
    'no-name': t.errorNoName,
    'bad-promptpay-id': t.errorPromptpayId,
    'bad-amount': t.errorAmount,
  };

  const modeLabels: Record<QrMode, string> = {
    text: t.modeText,
    wifi: t.modeWifi,
    vcard: t.modeVcard,
    promptpay: t.modePromptpay,
  };

  async function chooseLogo(file: File | undefined) {
    if (!file) return;

    if (file.size > MAX_LOGO_BYTES) {
      setLogoError(format(t.errorTooLong, { max: MAX_LOGO_BYTES }));
      return;
    }

    const reader = new FileReader();
    const loaded = new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('unreadable'));
    });

    reader.readAsDataURL(file);

    try {
      setLogo(await loaded);
      setLogoError(null);
    } catch {
      setLogoError(t.errorEmpty);
    }
  }

  function saveSvg() {
    if (matrix === null) return;

    downloadText(
      toSvg(matrix, {
        dark,
        light,
        margin: DEFAULT_MARGIN,
        size: EXPORT_SIZES[EXPORT_SIZES.length - 1] ?? PREVIEW_SIZE,
        logo: logoOptions,
      }),
      'qr-code.svg',
      SVG_MIME,
    );
  }

  async function savePng(size: number) {
    if (matrix === null) return;

    const source = toSvg(matrix, {
      dark,
      light,
      margin: DEFAULT_MARGIN,
      size,
      logo: logoOptions,
    });

    const url = URL.createObjectURL(new Blob([source], { type: SVG_MIME }));

    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = url;
      });

      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;

      const context = canvas.getContext('2d');
      if (!context) return;

      context.drawImage(image, 0, 0, size, size);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, PNG_MIME),
      );
      if (blob) downloadBlob(blob, `qr-code-${size}.png`);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Toggle
        label={t.mode}
        value={mode}
        onChange={(next) => setUrlState({ [URL_MODE_KEY]: next })}
        options={QR_MODES.map((value) => ({ value, label: modeLabels[value] }))}
      />

      {mode === 'text' ? (
        <TextFields
          locale={locale}
          value={text}
          onChange={(next) => setUrlState({ [URL_TEXT_KEY]: next })}
        />
      ) : null}
      {mode === 'wifi' ? (
        <WifiFields locale={locale} value={wifi} onChange={setWifi} />
      ) : null}
      {mode === 'vcard' ? (
        <VCardFields locale={locale} value={card} onChange={setCard} />
      ) : null}
      {mode === 'promptpay' ? (
        <PromptPayFields locale={locale} value={pay} onChange={setPay} />
      ) : null}

      {mode === 'text' ? null : <FieldHint>{t.wifiPrivacy}</FieldHint>}

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={levelId}>{t.errorLevel}</Label>
          <Select
            id={levelId}
            value={level}
            onChange={(event) => setUrlState({ [URL_LEVEL_KEY]: event.target.value })}
          >
            {ERROR_LEVELS.map((each) => (
              <option key={each} value={each}>
                {each} — {ERROR_LEVEL_RECOVERY[each]}%
              </option>
            ))}
          </Select>
          <FieldHint>
            {format(t.errorLevelHint, { percent: ERROR_LEVEL_RECOVERY[level] })}
          </FieldHint>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={darkId}>{t.darkColor}</Label>
          <Input
            id={darkId}
            type="color"
            value={dark}
            onChange={(event) => setUrlState({ [URL_DARK_KEY]: event.target.value })}
            className="h-10 w-20 p-1"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={lightId}>{t.lightColor}</Label>
          <Input
            id={lightId}
            type="color"
            value={light}
            onChange={(event) => setUrlState({ [URL_LIGHT_KEY]: event.target.value })}
            className="h-10 w-20 p-1"
          />
        </div>
      </div>

      {ratio < MIN_SCAN_CONTRAST ? (
        <p role="status" className="text-sm text-danger">
          {t.contrastWarning}
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t.logo}</h2>

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => void chooseLogo(event.target.files?.[0])}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => logoInputRef.current?.click()}
          >
            {t.logoChoose}
          </Button>

          {logo === null ? null : (
            <>
              <Button variant="ghost" size="sm" onClick={() => setLogo(null)}>
                {t.logoRemove}
              </Button>

              <div className="flex items-center gap-2">
                <Label htmlFor={logoSizeId}>
                  {format(t.logoSize, { percent: logoPercent })}
                </Label>
                <input
                  id={logoSizeId}
                  type="range"
                  min={MIN_LOGO_PERCENT}
                  max={MAX_LOGO_PERCENT}
                  value={logoPercent}
                  onChange={(event) => setLogoPercent(Number(event.target.value))}
                />
              </div>
            </>
          )}
        </div>

        {logoError !== null ? <FieldError>{logoError}</FieldError> : null}

        {logo !== null && logoCoversTooMuch(logoPercent, level) ? (
          <p role="status" className="text-sm text-danger">
            {format(t.logoWarning, {
              level,
              recovery: ERROR_LEVEL_RECOVERY[level],
            })}
          </p>
        ) : null}

        {logo !== null ? <FieldHint>{t.logoAdvice}</FieldHint> : null}
      </section>

      {!payload.ok ? (
        <FieldError>{errorMessages[payload.code] ?? t.errorEmpty}</FieldError>
      ) : null}

      {matrix !== null && payload.ok ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">{t.preview}</h2>
            <Badge tone="neutral">
              {format(t.moduleCount, { count: matrix.size })}
            </Badge>
          </div>

          <div
            className="w-fit rounded-card border border-border p-2"
            // Built here from validated colours and numbers; no reader text
            // reaches the markup.
            dangerouslySetInnerHTML={{ __html: svg }}
          />

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{t.download}</span>
            {EXPORT_SIZES.map((size) => (
              <Button
                key={size}
                variant="secondary"
                size="sm"
                onClick={() => void savePng(size)}
              >
                {format(t.downloadPng, { size })}
              </Button>
            ))}
            <Button variant="secondary" size="sm" onClick={saveSvg}>
              {t.downloadSvg}
            </Button>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label>{t.payload}</Label>
              <CopyButton
                value={payload.payload}
                label={t.copyPayload}
                variant="ghost"
                size="icon"
              />
            </div>
            <pre className="overflow-x-auto rounded-card border border-border bg-surface p-3 font-mono text-xs break-all whitespace-pre-wrap">
              {payload.payload}
            </pre>
          </div>
        </section>
      ) : null}
    </div>
  );
}

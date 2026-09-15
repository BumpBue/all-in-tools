'use client';

import { useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/card';
import { FieldError, FieldHint, Input, Label, Textarea } from '@/components/ui/field';
import { buildToolStorageKey } from '@/config/storage-keys';
import { format } from '@/config/i18n';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { usePrefersReducedMotion } from '@/hooks/use-reduced-motion';
import { useLocale } from '@/hooks/use-t';
import { useUrlState } from '@/hooks/use-url-state';
import { createRandom } from '@/lib/random';
import { messages } from '@/tools/randomizer-wheel/i18n';
import {
  EMPTY_STORAGE,
  MAX_HISTORY,
  MAX_OPTIONS,
  MAX_PRESETS,
  MIN_OPTIONS,
  SPIN_MS,
  activeOptions,
  angleForWinner,
  buildSegments,
  decodeOptions,
  easeOut,
  encodeOptions,
  optionsFromText,
  optionsToText,
  pickWinner,
  type WheelOption,
  type WheelStorage,
} from '@/tools/randomizer-wheel/logic';
import { Wheel } from '@/tools/randomizer-wheel/wheel';
import type { ToolComponentProps } from '@/tools/types';

const STORAGE_KEY = buildToolStorageKey('randomizer-wheel');
const URL_OPTIONS_KEY = 'o';
const URL_DEBOUNCE_MS = 400;
const URL_MAX_VALUE_LENGTH = 1_500;

const TICK_FREQUENCY = 220;
const TICK_SECONDS = 0.06;
const TICK_GAIN = 0.05;

const DEFAULT_OPTIONS = ['ข้าวมันไก่', 'ก๋วยเตี๋ยว', 'ส้มตำ', 'ข้าวผัด'];

function playTick(): void {
  const AudioContextClass =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.frequency.value = TICK_FREQUENCY;
  gain.gain.value = TICK_GAIN;

  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + TICK_SECONDS);

  oscillator.onended = () => void context.close();
}

export default function RandomizerWheel({ searchParams }: ToolComponentProps) {
  const t = messages(useLocale());
  const systemReducedMotion = usePrefersReducedMotion();

  const [urlState, setUrlState] = useUrlState(
    {
      [URL_OPTIONS_KEY]:
        searchParams[URL_OPTIONS_KEY] ??
        encodeOptions(
          DEFAULT_OPTIONS.map((label, index) => ({
            id: `default-${index}`,
            label,
            weight: 1,
            removed: false,
          })),
        ),
    },
    { debounceMs: URL_DEBOUNCE_MS, maxValueLength: URL_MAX_VALUE_LENGTH },
  );

  const [stored, setStored, status] = useLocalStorage<WheelStorage>(
    STORAGE_KEY,
    EMPTY_STORAGE,
  );

  const [drawn, setDrawn] = useState<string[]>([]);
  const [removeMode, setRemoveMode] = useState(false);
  const [sound, setSound] = useState(true);
  const [skipAnimation, setSkipAnimation] = useState(false);
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [presetName, setPresetName] = useState('');

  const frameRef = useRef<number | null>(null);
  const optionsId = useId();
  const presetId = useId();

  const text = optionsToText(decodeOptions(urlState[URL_OPTIONS_KEY]));

  const options: WheelOption[] = optionsFromText(text).map((option) => ({
    ...option,
    removed: drawn.includes(option.label),
  }));

  const segments = buildSegments(options);
  const live = activeOptions(options);
  const reducedMotion = systemReducedMotion || skipAnimation;

  function writeText(next: string) {
    setUrlState({ [URL_OPTIONS_KEY]: encodeOptions(optionsFromText(next)) });
    setDrawn([]);
    setWinner(null);
  }

  function finish(label: string) {
    setWinner(label);
    setSpinning(false);
    if (removeMode) setDrawn((previous) => [...previous, label]);

    setStored((previous) => ({
      presets: previous.presets,
      history: [{ label }, ...previous.history].slice(0, MAX_HISTORY),
    }));
  }

  function spin() {
    if (spinning || live.length < MIN_OPTIONS) return;

    const random = createRandom(null);
    const chosen = pickWinner(options, random);
    if (!chosen) return;

    if (sound) playTick();

    if (reducedMotion) {
      setAngle(angleForWinner(segments, chosen.id, angle, random));
      finish(chosen.label);
      return;
    }

    const from = angle;
    const to = angleForWinner(segments, chosen.id, angle, random);

    setSpinning(true);
    setWinner(null);

    // Timed from the first painted frame, which requestAnimationFrame hands
    // over: reading a clock while rendering is impure and the compiler says so.
    let started: number | null = null;

    const step = (now: number) => {
      started ??= now;
      const progress = Math.min(1, (now - started) / SPIN_MS);
      setAngle(from + (to - from) * easeOut(progress));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
        return;
      }

      frameRef.current = null;
      finish(chosen.label);
    };

    frameRef.current = requestAnimationFrame(step);
  }

  function savePreset() {
    const name = presetName.trim();
    if (name.length === 0 || stored.presets.length >= MAX_PRESETS) return;

    setStored((previous) => ({
      history: previous.history,
      presets: [
        ...previous.presets,
        {
          id: `${name}-${previous.presets.length}`,
          name,
          options: optionsFromText(text).map((option) => ({
            label: option.label,
            weight: option.weight,
          })),
        },
      ],
    }));

    setPresetName('');
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-3">
          <Wheel
            segments={segments}
            angle={angle}
            label={format(t.wheelLabel, { count: live.length })}
          />

          <Button
            size="md"
            disabled={spinning || live.length < MIN_OPTIONS}
            onClick={spin}
          >
            {spinning ? t.spinning : reducedMotion ? t.draw : t.spin}
          </Button>

          <p role="status" aria-live="polite" className="min-h-8 text-title">
            {winner ?? ''}
          </p>

          {live.length < MIN_OPTIONS ? (
            <FieldHint>{format(t.needMore, { count: MIN_OPTIONS })}</FieldHint>
          ) : (
            <Badge tone="muted">{format(t.remaining, { count: live.length })}</Badge>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={optionsId}>{t.options}</Label>
            <Textarea
              id={optionsId}
              value={text}
              placeholder={t.optionsPlaceholder}
              spellCheck={false}
              onChange={(event) => writeText(event.target.value)}
              className="min-h-48"
            />
            <FieldHint>{t.optionsHint}</FieldHint>
            <FieldHint>{format(t.maxOptions, { count: MAX_OPTIONS })}</FieldHint>
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={removeMode}
                onChange={(event) => setRemoveMode(event.target.checked)}
              />
              <span>{t.removeMode}</span>
            </label>
            <FieldHint>{t.removeModeHint}</FieldHint>

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={sound}
                onChange={(event) => setSound(event.target.checked)}
              />
              <span>{t.sound}</span>
            </label>

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={reducedMotion}
                disabled={systemReducedMotion}
                onChange={(event) => setSkipAnimation(event.target.checked)}
              />
              <span>{t.reducedMotionToggle}</span>
            </label>

            {systemReducedMotion ? <FieldHint>{t.reducedMotion}</FieldHint> : null}

            {drawn.length > 0 ? (
              <div>
                <Button variant="secondary" size="sm" onClick={() => setDrawn([])}>
                  {t.reset}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <FieldHint>{t.fairness}</FieldHint>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t.presets}</h2>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex w-56 flex-col gap-1.5">
            <Label htmlFor={presetId}>{t.presetName}</Label>
            <Input
              id={presetId}
              value={presetName}
              spellCheck={false}
              onChange={(event) => setPresetName(event.target.value)}
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={presetName.trim().length === 0 || stored.presets.length >= MAX_PRESETS}
            onClick={savePreset}
          >
            {t.savePreset}
          </Button>
          <FieldHint>{format(t.maxPresets, { count: MAX_PRESETS })}</FieldHint>
        </div>

        {stored.presets.length === 0 ? (
          <p className="text-sm text-muted">{t.noPresets}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {stored.presets.map((preset) => (
              <li key={preset.id} className="flex items-center gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={format(t.loadPreset, { name: preset.name })}
                  onClick={() =>
                    writeText(
                      preset.options
                        .map((option) =>
                          option.weight === 1
                            ? option.label
                            : `${option.label} x${option.weight}`,
                        )
                        .join('\n'),
                    )
                  }
                >
                  {preset.name}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={format(t.deletePreset, { name: preset.name })}
                  onClick={() =>
                    setStored((previous) => ({
                      history: previous.history,
                      presets: previous.presets.filter((each) => each.id !== preset.id),
                    }))
                  }
                >
                  ×
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t.history}</h2>
          {stored.history.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setStored((previous) => ({ presets: previous.presets, history: [] }))
              }
            >
              {t.clearHistory}
            </Button>
          ) : null}
        </div>

        {stored.history.length === 0 ? (
          <p className="text-sm text-muted">{t.noHistory}</p>
        ) : (
          <ol className="flex flex-wrap gap-2">
            {stored.history.map((entry, index) => (
              <li key={`${entry.label}-${index}`}>
                <Badge tone={index === 0 ? 'accent' : 'neutral'}>{entry.label}</Badge>
              </li>
            ))}
          </ol>
        )}

        {status.error !== null ? (
          <FieldError>
            {format(t.storageError, { message: status.error.message })}
          </FieldError>
        ) : null}

        <FieldHint>{t.storageNote}</FieldHint>
      </section>
    </div>
  );
}

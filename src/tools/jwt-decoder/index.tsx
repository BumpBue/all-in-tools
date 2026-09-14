'use client';

import { useId, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Badge, type BadgeTone } from '@/components/ui/card';
import { CopyButton } from '@/components/ui/copy-button';
import { FieldError, FieldHint, Input, Label, Textarea } from '@/components/ui/field';
import { format } from '@/config/i18n';
import { NO_TIME, useNowSeconds } from '@/hooks/use-now';
import { useLocale } from '@/hooks/use-t';
import {
  ICT_TIME_ZONE,
  formatInZone,
  formatRelative,
  gregorianYear,
  toBuddhistYear,
} from '@/lib/datetime';
import { messages } from '@/tools/jwt-decoder/i18n';
import {
  audienceList,
  claimText,
  decodeJwt,
  formatClaims,
  readValidity,
  splitClaims,
  type JwtPart,
  type StandardClaim,
  type ValidityState,
} from '@/tools/jwt-decoder/logic';
import { useVerify } from '@/tools/jwt-decoder/use-verify';

const MILLISECONDS_PER_SECOND = 1000;

const TIME_CLAIMS: readonly StandardClaim[] = ['exp', 'nbf', 'iat'];

const VALIDITY_TONES: Record<ValidityState, BadgeTone> = {
  valid: 'success',
  expired: 'neutral',
  'not-yet-valid': 'neutral',
  'no-expiry': 'muted',
};

export default function JwtDecoder() {
  const locale = useLocale();
  const t = messages(locale);

  // No URL state and no storage on this page: a JWT is a credential, and the
  // secret used to check it is a stronger one.
  const [token, setToken] = useState('');
  const [secret, setSecret] = useState('');

  const tokenId = useId();
  const secretId = useId();

  const decoded = useMemo(() => decodeJwt(token), [token]);
  const nowSeconds = useNowSeconds();
  const nowMs = nowSeconds * MILLISECONDS_PER_SECOND;

  const verification = useVerify(decoded.ok ? decoded : null, secret);

  const claimLabels: Record<StandardClaim, string> = {
    iss: t.claimIss,
    sub: t.claimSub,
    aud: t.claimAud,
    exp: t.claimExp,
    nbf: t.claimNbf,
    iat: t.claimIat,
    jti: t.claimJti,
  };

  const partLabels: Record<JwtPart, string> = {
    header: t.partHeader,
    payload: t.partPayload,
    signature: t.partSignature,
  };

  const validity = decoded.ok ? readValidity(decoded.payload, nowMs) : null;
  const claims = decoded.ok ? splitClaims(decoded.payload) : null;

  const validityLabels: Record<ValidityState, string> = {
    valid: t.stateValid,
    expired: t.stateExpired,
    'not-yet-valid': t.stateNotYet,
    'no-expiry': t.stateNoExpiry,
  };

  // Intl already writes พ.ศ. for a Thai locale, so the year is only spelled out
  // when the page is in English.
  function timeDetail(milliseconds: number): string {
    const shown = formatInZone(milliseconds, ICT_TIME_ZONE, locale);
    if (locale === 'th') return shown;

    const year = toBuddhistYear(gregorianYear(milliseconds, ICT_TIME_ZONE));
    return `${shown} · ${format(t.buddhistYear, { year })}`;
  }

  function claimValue(name: StandardClaim, value: unknown): string {
    if (name === 'aud') return audienceList(decoded.ok ? decoded.payload : {}).join(', ');
    if (!TIME_CLAIMS.includes(name) || typeof value !== 'number') return claimText(value);

    return `${value} · ${timeDetail(value * MILLISECONDS_PER_SECOND)}`;
  }

  function countdown(): string | null {
    if (validity === null || nowSeconds === NO_TIME) return null;

    if (validity.state === 'expired' && validity.expiresAt !== null) {
      return format(t.expiredAgo, {
        relative: formatRelative(validity.expiresAt, nowMs, locale),
      });
    }
    if (validity.state === 'valid' && validity.expiresAt !== null) {
      return format(t.expiresIn, {
        relative: formatRelative(validity.expiresAt, nowMs, locale),
      });
    }
    if (validity.state === 'not-yet-valid' && validity.notBefore !== null) {
      return format(t.startsIn, {
        relative: formatRelative(validity.notBefore, nowMs, locale),
      });
    }

    return null;
  }

  function verifyMessage(): string | null {
    if (!decoded.ok) return null;
    if (secret.length === 0) return t.secretEmpty;
    if (verification.status === 'checking') return t.checking;

    const result = verification.result;
    if (result === null) return null;
    if (result.ok) return result.valid ? t.verifyMatch : t.verifyMismatch;

    if (result.code === 'unsupported-algorithm') {
      return format(t.verifyUnsupported, { algorithm: result.detail });
    }
    if (result.code === 'no-algorithm') return t.verifyNoAlgorithm;
    if (result.code === 'bad-signature-encoding') return t.verifyBadSignature;
    if (result.code === 'crypto-unavailable') return t.verifyUnavailable;
    if (result.code === 'empty-secret') return t.secretEmpty;

    return format(t.verifyFailed, { detail: result.detail });
  }

  function errorMessage(): string {
    if (decoded.ok) return '';

    if (decoded.code === 'empty') return t.errorEmpty;
    if (decoded.code === 'wrong-part-count') {
      return format(t.errorParts, { count: decoded.detail });
    }

    const part = decoded.part === null ? '' : partLabels[decoded.part];
    if (decoded.code === 'bad-base64') return format(t.errorBase64, { part });
    if (decoded.code === 'bad-json') return format(t.errorJson, { part });
    return format(t.errorNotObject, { part });
  }

  function clearAll() {
    setToken('');
    setSecret('');
  }

  const verified = verification.result?.ok === true && verification.result.valid;
  const message = verifyMessage();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5 rounded-card border border-border bg-surface-subtle p-4">
        <p className="text-sm font-medium">{t.privacyTitle}</p>
        <p className="text-sm text-muted">{t.privacyBody}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={tokenId}>{t.token}</Label>
        <Textarea
          id={tokenId}
          value={token}
          placeholder={t.tokenPlaceholder}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          aria-invalid={token.length > 0 && !decoded.ok ? true : undefined}
          onChange={(event) => setToken(event.target.value)}
          className="min-h-32 font-mono text-sm break-all"
        />
      </div>

      {token.length > 0 && !decoded.ok ? <FieldError>{errorMessage()}</FieldError> : null}

      {decoded.ok ? (
        <>
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">{t.header}</h2>
              {decoded.algorithm !== null ? (
                <Badge tone="accent">{decoded.algorithm}</Badge>
              ) : null}
              {decoded.type !== null ? (
                <Badge tone="neutral">{decoded.type}</Badge>
              ) : null}
              <CopyButton
                value={formatClaims(decoded.header)}
                variant="ghost"
                size="icon"
                className="ml-auto"
              />
            </div>
            <pre className="overflow-x-auto rounded-card border border-border bg-surface p-4 font-mono text-sm">
              {formatClaims(decoded.header)}
            </pre>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">{t.payload}</h2>
              {validity !== null ? (
                <Badge tone={VALIDITY_TONES[validity.state]}>
                  {validityLabels[validity.state]}
                </Badge>
              ) : null}
              {countdown() !== null ? (
                <span role="status" className="text-sm text-muted">
                  {countdown()}
                </span>
              ) : null}
              <CopyButton
                value={formatClaims(decoded.payload)}
                variant="ghost"
                size="icon"
                className="ml-auto"
              />
            </div>
            <pre className="overflow-x-auto rounded-card border border-border bg-surface p-4 font-mono text-sm">
              {formatClaims(decoded.payload)}
            </pre>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">{t.claims}</h2>

            {claims !== null && claims.standard.length + claims.extra.length === 0 ? (
              <p className="text-sm text-muted">{t.noClaims}</p>
            ) : null}

            {claims !== null && claims.standard.length > 0 ? (
              <div className="overflow-x-auto rounded-card border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-subtle">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t.claimName}</th>
                      <th className="px-3 py-2 font-medium">{t.claimMeaning}</th>
                      <th className="px-3 py-2 font-medium">{t.claimValue}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {claims.standard.map(([name, value]) => (
                      <tr key={name} className="border-t border-border">
                        <td className="px-3 py-2 font-mono">{name}</td>
                        <td className="px-3 py-2 text-muted">{claimLabels[name]}</td>
                        <td className="px-3 py-2 break-all">{claimValue(name, value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {claims !== null && claims.extra.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <h3 className="text-sm font-medium">{t.otherClaims}</h3>
                <dl className="flex flex-col gap-1 rounded-card border border-border bg-surface p-4 text-sm">
                  {claims.extra.map(([name, value]) => (
                    <div key={name} className="flex flex-wrap gap-2">
                      <dt className="font-mono text-muted">{name}</dt>
                      <dd className="font-mono break-all">{claimText(value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">{t.signature}</h2>
            {decoded.signature.length === 0 ? (
              <p className="text-sm text-muted">{t.signatureEmpty}</p>
            ) : (
              <pre className="overflow-x-auto rounded-card border border-border bg-surface p-4 font-mono text-sm break-all whitespace-pre-wrap">
                {decoded.signature}
              </pre>
            )}
            <FieldHint>{t.signatureNote}</FieldHint>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={secretId}>{t.secret}</Label>
              <Input
                id={secretId}
                type="password"
                value={secret}
                spellCheck={false}
                autoComplete="off"
                onChange={(event) => setSecret(event.target.value)}
                className="font-mono"
              />
              <FieldHint>{t.secretHint}</FieldHint>
            </div>

            {message !== null ? (
              <p
                role="status"
                className={`text-sm ${verified ? 'text-success' : 'text-muted'}`}
              >
                {message}
              </p>
            ) : null}
          </section>
        </>
      ) : null}

      <div className="flex">
        <Button variant="secondary" size="sm" onClick={clearAll}>
          {t.clear}
        </Button>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';

import { verifyHmac, type SignedToken, type VerifyResult } from '@/tools/jwt-decoder/logic';

export type VerifyStatus = 'idle' | 'checking' | 'done';

/**
 * Checks the signature whenever the token or the secret changes.
 *
 * The secret is a parameter and nothing else: it is never put in the URL,
 * never stored, and never sent anywhere. WebCrypto does the work in the page.
 */
export function useVerify(
  token: SignedToken | null,
  secret: string,
): { status: VerifyStatus; result: VerifyResult | null } {
  const [settled, setSettled] = useState<{ key: string; result: VerifyResult } | null>(
    null,
  );

  // Primitives only: the token object is rebuilt on every render, and depending
  // on it would start a fresh check after every one of them.
  const hasToken = token !== null;
  const algorithm = token?.algorithm ?? null;
  const signature = token?.signature ?? '';
  const signingInput = token?.signingInput ?? '';
  const key = JSON.stringify([algorithm, signature, signingInput, secret]);

  useEffect(() => {
    if (!hasToken || secret.length === 0) return;

    let cancelled = false;
    const current = JSON.stringify([algorithm, signature, signingInput, secret]);

    void verifyHmac({ algorithm, signature, signingInput }, secret).then((result) => {
      if (!cancelled) setSettled({ key: current, result });
    });

    return () => {
      cancelled = true;
    };
  }, [algorithm, hasToken, secret, signature, signingInput]);

  if (!hasToken || secret.length === 0) return { status: 'idle', result: null };
  if (settled?.key !== key) return { status: 'checking', result: null };

  return { status: 'done', result: settled.result };
}

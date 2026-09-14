'use client';

import DOMPurify from 'dompurify';

/**
 * Markdown lets a document carry raw HTML, so anything parsed out of it is
 * untrusted until this has run. The preview injects HTML directly, which is
 * exactly the case DOMPurify exists for.
 *
 * DOMPurify needs a real DOM to parse into. Rendered on the server it is not a
 * working sanitizer but an object without a `sanitize` method, which threw and
 * turned the whole page into a 500 — caught by fetching the built page rather
 * than by the build, which was perfectly happy. Nothing is lost by returning
 * nothing there: the draft lives in localStorage, so the server has no
 * document to show in the first place.
 */
export function sanitize(html: string): string {
  if (typeof window === 'undefined') return '';

  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel'],
    // input stays allowed: a GFM task list renders as a disabled checkbox, and
    // with no form, no button and no event handlers left, it cannot do
    // anything but sit there.
    FORBID_TAGS: ['style', 'form', 'button'],
    FORBID_ATTR: ['style'],
  });
}

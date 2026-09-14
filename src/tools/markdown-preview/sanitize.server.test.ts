import { describe, expect, it } from 'vitest';

import { sanitize } from '@/tools/markdown-preview/sanitize';

// Runs in the node environment on purpose: this file is what the server
// renders, and DOMPurify without a DOM is not a sanitizer but a 500.
describe('sanitize without a DOM', () => {
  it('returns nothing rather than throwing', () => {
    expect(() => sanitize('<p>hi</p>')).not.toThrow();
    expect(sanitize('<p>hi</p>')).toBe('');
  });

  it('never returns unsanitized markup there', () => {
    expect(sanitize('<script>alert(1)</script>')).toBe('');
  });
});

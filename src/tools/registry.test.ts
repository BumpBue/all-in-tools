import { describe, expect, it } from 'vitest';

import { TOOLS } from '@/config/tools';
import { IMPLEMENTED_TOOL_SLUGS, hasToolComponent } from '@/tools/registry';

describe('tool component registry', () => {
  it('has a component for every tool marked ready', () => {
    const missing = TOOLS.filter(
      (tool) => tool.status === 'ready' && !hasToolComponent(tool.slug),
    ).map((tool) => tool.slug);

    expect(missing).toEqual([]);
  });

  it('only registers slugs the tool registry knows', () => {
    const known = new Set(TOOLS.map((tool) => tool.slug));
    const unknown = IMPLEMENTED_TOOL_SLUGS.filter((slug) => !known.has(slug));

    expect(unknown).toEqual([]);
  });

  it('rejects a slug that is not registered', () => {
    expect(hasToolComponent('not-a-real-tool')).toBe(false);
  });
});

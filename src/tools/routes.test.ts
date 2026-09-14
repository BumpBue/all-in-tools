import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { TOOLS } from '@/config/tools';
import { TOOLS_WITH_OWN_ROUTE, hasOwnRoute } from '@/tools/routes';

const APP_TOOLS_DIR = join(process.cwd(), 'src', 'app', 'tools');
const DYNAMIC_SEGMENT = '[slug]';
const PRIVATE_PREFIX = '_';

/** Directories under app/tools that are real tool routes. */
function routeDirectories(): string[] {
  return readdirSync(APP_TOOLS_DIR, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name !== DYNAMIC_SEGMENT &&
        !entry.name.startsWith(PRIVATE_PREFIX),
    )
    .map((entry) => entry.name);
}

describe('per-tool routes', () => {
  it('gives every ready tool a route of its own', () => {
    const missing = TOOLS.filter(
      (tool) => tool.status === 'ready' && !hasOwnRoute(tool.slug),
    ).map((tool) => tool.slug);

    expect(missing).toEqual([]);
  });

  it('lists only slugs the tool registry knows', () => {
    const known = new Set(TOOLS.map((tool) => tool.slug));
    expect(TOOLS_WITH_OWN_ROUTE.filter((slug) => !known.has(slug))).toEqual([]);
  });

  it('has a page file for every listed slug', () => {
    const withoutPage = TOOLS_WITH_OWN_ROUTE.filter(
      (slug) => !existsSync(join(APP_TOOLS_DIR, slug, 'page.tsx')),
    );

    expect(withoutPage).toEqual([]);
  });

  it('lists every route directory that exists on disk', () => {
    const unlisted = routeDirectories().filter((name) => !hasOwnRoute(name));
    expect(unlisted).toEqual([]);
  });

  it('never generates a slug through both routes', () => {
    const dynamic = TOOLS.filter((tool) => !hasOwnRoute(tool.slug)).map(
      (tool) => tool.slug,
    );
    const overlap = dynamic.filter((slug) => hasOwnRoute(slug));

    expect(overlap).toEqual([]);
  });

  it('covers every tool across the two routes exactly once', () => {
    const dynamic = TOOLS.filter((tool) => !hasOwnRoute(tool.slug)).map(
      (tool) => tool.slug,
    );
    const all = [...dynamic, ...TOOLS_WITH_OWN_ROUTE].sort();

    expect(all).toEqual(TOOLS.map((tool) => tool.slug).sort());
  });
});

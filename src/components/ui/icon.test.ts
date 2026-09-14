import { describe, expect, it } from 'vitest';

import { hasIcon } from '@/components/ui/icon';
import { CATEGORY_META, CATEGORY_ORDER, TOOLS } from '@/config/tools';

describe('icon map', () => {
  it('covers every icon the tool registry names', () => {
    const missing = TOOLS.filter((tool) => !hasIcon(tool.icon)).map(
      (tool) => `${tool.slug} -> ${tool.icon}`,
    );
    expect(missing).toEqual([]);
  });

  it('covers every icon the categories name', () => {
    const missing = CATEGORY_ORDER.filter(
      (category) => !hasIcon(CATEGORY_META[category].icon),
    );
    expect(missing).toEqual([]);
  });
});

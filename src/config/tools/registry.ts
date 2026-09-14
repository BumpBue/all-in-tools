import { buildToolStorageKey } from '@/config/storage-keys';
import { CATEGORY_ORDER } from '@/config/tools/categories';
import { DESIGN_TOOLS } from '@/config/tools/design';
import { DEVELOPER_TOOLS } from '@/config/tools/developer';
import { FINANCE_TOOLS } from '@/config/tools/finance';
import { PRODUCTIVITY_TOOLS } from '@/config/tools/productivity';
import type { Tool, ToolCategory, ToolDefinition } from '@/types/tool';

const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  ...PRODUCTIVITY_TOOLS,
  ...FINANCE_TOOLS,
  ...DEVELOPER_TOOLS,
  ...DESIGN_TOOLS,
];

// Deriving the key from the slug keeps a mistyped key from orphaning saved data.
export const TOOLS: readonly Tool[] = TOOL_DEFINITIONS.map((definition) =>
  definition.needsStorage
    ? { ...definition, storageKey: buildToolStorageKey(definition.slug) }
    : { ...definition },
);

export const TOOL_COUNT = TOOLS.length;

export const TOOLS_BY_SLUG: Record<string, Tool> = Object.fromEntries(
  TOOLS.map((tool) => [tool.slug, tool]),
);

export const TOOLS_BY_CATEGORY: Record<ToolCategory, Tool[]> =
  CATEGORY_ORDER.reduce(
    (acc, category) => {
      acc[category] = TOOLS.filter((tool) => tool.category === category);
      return acc;
    },
    {} as Record<ToolCategory, Tool[]>,
  );

export function getTool(slug: string): Tool | undefined {
  return TOOLS_BY_SLUG[slug];
}

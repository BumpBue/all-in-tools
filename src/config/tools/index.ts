export { CATEGORY_META, CATEGORY_ORDER, isToolCategory } from '@/config/tools/categories';
export {
  TOOLS,
  TOOLS_BY_CATEGORY,
  TOOLS_BY_SLUG,
  TOOL_COUNT,
  getRelatedTools,
  getTool,
} from '@/config/tools/registry';
export { searchTools } from '@/config/tools/search';

export { DESIGN_TOOLS } from '@/config/tools/design';
export { DEVELOPER_TOOLS } from '@/config/tools/developer';
export { FINANCE_TOOLS } from '@/config/tools/finance';
export { PRODUCTIVITY_TOOLS } from '@/config/tools/productivity';

export type {
  CategoryMeta,
  LocalizedText,
  Tool,
  ToolCategory,
  ToolDefinition,
  ToolStatus,
  ToolTier,
} from '@/types/tool';

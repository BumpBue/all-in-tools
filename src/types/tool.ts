export type ToolCategory = 'productivity' | 'finance' | 'developer' | 'design';

// A = pure function, no persisted state
// B = stateless but depends on a heavy library, must be dynamically imported
// C = owns persistent state, needs a data model and a storage key
export type ToolTier = 'A' | 'B' | 'C';

export type ToolStatus = 'ready' | 'planned';

export type Locale = 'th' | 'en';

export type Theme = 'light' | 'dark' | 'system';

export interface LocalizedText {
  th: string;
  en: string;
}

export interface Tool {
  id: number;
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  keywords: string[];
  category: ToolCategory;
  tier: ToolTier;
  icon: string;
  status: ToolStatus;
  needsStorage: boolean;
  storageKey?: string;
  /**
   * The tool counts its own stored items. The counter itself lives in
   * src/lib/storage-summary.ts, keyed by slug, because the registry ships to
   * the client whole and functions do not belong in it.
   */
  hasItemCounter?: boolean;
}

export type ToolDefinition = Omit<Tool, 'storageKey'>;

export interface CategoryMeta {
  th: string;
  en: string;
  icon: string;
  // A CSS colour value, not a Tailwind class: Tailwind cannot generate classes
  // from runtime strings, so consumers pass this through a custom property.
  color: string;
}

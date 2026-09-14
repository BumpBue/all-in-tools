export type ToolCategory = 'productivity' | 'finance' | 'developer' | 'design';

/**
 * Tier drives how a tool is loaded and how much plumbing it needs:
 * A = pure function, no persisted state
 * B = stateless but depends on a heavy library, must be dynamically imported
 * C = owns persistent state, needs a data model and a storage key
 */
export type ToolTier = 'A' | 'B' | 'C';

export type ToolStatus = 'ready' | 'planned';

export type Locale = 'th' | 'en';

export type Theme = 'light' | 'dark' | 'system';

export interface LocalizedText {
  th: string;
  en: string;
}

export interface Tool {
  /** Stable 1-36 identifier, independent of display order. */
  id: number;
  /** URL segment: /tools/{slug} */
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  /** Thai and English terms for the command palette and SEO. */
  keywords: string[];
  category: ToolCategory;
  tier: ToolTier;
  /** Export name from lucide-react. */
  icon: string;
  status: ToolStatus;
  needsStorage: boolean;
  /** Derived from the slug; present only when needsStorage is true. */
  storageKey?: string;
}

/** A tool as it is written in the registry; the storage key is derived, never typed by hand. */
export type ToolDefinition = Omit<Tool, 'storageKey'>;

export interface CategoryMeta {
  th: string;
  en: string;
  /** Export name from lucide-react. */
  icon: string;
  /**
   * A CSS colour value rather than a Tailwind class, because Tailwind cannot
   * generate classes from runtime strings. Consumers pass it through a custom
   * property instead.
   */
  color: string;
}

import { TOOLS } from '@/config/tools/registry';
import type { Tool } from '@/types/tool';

const SCORE_SLUG_EXACT = 1000;
const SCORE_NAME_EXACT = 900;
const SCORE_NAME_PREFIX = 600;
const SCORE_NAME_SUBSTRING = 400;
const SCORE_KEYWORD_PREFIX = 320;
const SCORE_KEYWORD_SUBSTRING = 220;
const SCORE_DESCRIPTION_SUBSTRING = 90;
const SCORE_FUZZY_SUBSEQUENCE = 45;
const SCORE_READY_BONUS = 25;

// Below this length a subsequence match is noise rather than a typo.
const MIN_FUZZY_QUERY_LENGTH = 3;

interface SearchIndexEntry {
  tool: Tool;
  names: string[];
  keywords: string[];
  descriptions: string[];
  haystack: string;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

const SEARCH_INDEX: readonly SearchIndexEntry[] = TOOLS.map((tool) => {
  const names = [tool.name.th, tool.name.en, tool.slug].map(normalize);
  const keywords = tool.keywords.map(normalize);
  const descriptions = [tool.description.th, tool.description.en].map(normalize);

  return {
    tool,
    names,
    keywords,
    descriptions,
    haystack: [...names, ...keywords].join(' '),
  };
});

function isSubsequence(query: string, text: string): boolean {
  let cursor = 0;
  for (const char of text) {
    if (char === query[cursor]) {
      cursor += 1;
      if (cursor === query.length) return true;
    }
  }
  return false;
}

function scoreEntry(entry: SearchIndexEntry, query: string): number {
  let score = 0;

  if (entry.tool.slug === query) {
    score += SCORE_SLUG_EXACT;
  }

  for (const name of entry.names) {
    if (name === query) score += SCORE_NAME_EXACT;
    else if (name.startsWith(query)) score += SCORE_NAME_PREFIX;
    else if (name.includes(query)) score += SCORE_NAME_SUBSTRING;
  }

  for (const keyword of entry.keywords) {
    if (keyword.startsWith(query)) score += SCORE_KEYWORD_PREFIX;
    else if (keyword.includes(query)) score += SCORE_KEYWORD_SUBSTRING;
  }

  if (score === 0) {
    for (const description of entry.descriptions) {
      if (description.includes(query)) {
        score += SCORE_DESCRIPTION_SUBSTRING;
        break;
      }
    }
  }

  if (
    score === 0 &&
    query.length >= MIN_FUZZY_QUERY_LENGTH &&
    isSubsequence(query, entry.haystack)
  ) {
    score += SCORE_FUZZY_SUBSEQUENCE;
  }

  if (score > 0 && entry.tool.status === 'ready') {
    score += SCORE_READY_BONUS;
  }

  return score;
}

// An empty query returns nothing so callers can show recent tools instead.
export function searchTools(query: string): Tool[] {
  const normalizedQuery = normalize(query);
  if (normalizedQuery.length === 0) return [];

  return SEARCH_INDEX.map((entry) => ({
    tool: entry.tool,
    score: scoreEntry(entry, normalizedQuery),
  }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.tool.id - b.tool.id)
    .map((result) => result.tool);
}

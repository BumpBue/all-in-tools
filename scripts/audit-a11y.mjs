/**
 * Crawls every page of a running build and reports accessibility defects that
 * only show up in assembled HTML: a control with no accessible name, an image
 * with no alt text, a duplicated id, a missing or doubled h1.
 *
 * Run a production server first, then `node scripts/audit-a11y.mjs`.
 */
import { JSDOM } from 'jsdom';

const BASE = process.env.AUDIT_BASE ?? 'http://127.0.0.1:3000';

const EXTRA_PAGES = ['/search', '/settings', '/offline'];
const SITEMAP = '/sitemap.xml';

const NAMEABLE = 'a, button, [role="button"], [role="link"]';
const FIELDS = 'input, select, textarea';
const UNLABELLED_INPUT_TYPES = new Set(['hidden', 'submit', 'reset', 'button', 'image']);

async function text(path) {
  const response = await fetch(`${BASE}${path}`);
  if (!response.ok) throw new Error(`${path} -> ${response.status}`);
  return response.text();
}

async function pagePaths() {
  const xml = await text(SITEMAP);
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const paths = locs.map((loc) => new URL(loc).pathname || '/');

  return [...new Set([...paths, ...EXTRA_PAGES])];
}

/** What a screen reader would announce, near enough for an audit. */
function accessibleName(element) {
  const label = element.getAttribute('aria-label');
  if (label && label.trim()) return label.trim();

  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const named = labelledBy
      .split(/\s+/)
      .map((id) => element.ownerDocument.getElementById(id)?.textContent ?? '')
      .join(' ')
      .trim();
    if (named) return named;
  }

  const title = element.getAttribute('title');
  if (title && title.trim()) return title.trim();

  // An image inside a link speaks through its own alt text.
  const alt = [...element.querySelectorAll('img[alt]')]
    .map((image) => image.getAttribute('alt').trim())
    .join(' ')
    .trim();

  return (element.textContent ?? '').trim() || alt;
}

function fieldName(field, document) {
  const named = accessibleName(field);
  if (named) return named;

  const id = field.getAttribute('id');
  if (id) {
    // Matched by hand rather than with a selector: ids here come from useId
    // and contain characters a selector would have to escape.
    const label = [...document.querySelectorAll('label[for]')].find(
      (candidate) => candidate.getAttribute('for') === id,
    );
    if (label?.textContent?.trim()) return label.textContent.trim();
  }

  return field.closest('label')?.textContent?.trim() ?? '';
}

function auditDocument(document, path) {
  const problems = [];
  const note = (rule, detail) => problems.push({ path, rule, detail });

  for (const image of document.querySelectorAll('img')) {
    if (!image.hasAttribute('alt')) note('img-alt', image.outerHTML.slice(0, 120));
  }

  for (const element of document.querySelectorAll(NAMEABLE)) {
    if (element.hasAttribute('aria-hidden')) continue;
    if (element.tagName === 'A' && !element.hasAttribute('href')) continue;
    if (!accessibleName(element)) note('no-accessible-name', element.outerHTML.slice(0, 160));
  }

  for (const field of document.querySelectorAll(FIELDS)) {
    const type = (field.getAttribute('type') ?? '').toLowerCase();
    if (UNLABELLED_INPUT_TYPES.has(type)) continue;
    // Hidden from the tree and out of the tab order: something visible drives it.
    if (field.getAttribute('aria-hidden') === 'true' && field.getAttribute('tabindex') === '-1') {
      continue;
    }
    if (!fieldName(field, document)) note('no-field-label', field.outerHTML.slice(0, 160));
  }

  // A decorative icon must be hidden; one that carries meaning must be named.
  for (const svg of document.querySelectorAll('svg')) {
    const hidden = svg.getAttribute('aria-hidden') === 'true';
    if (!hidden && !accessibleName(svg) && !svg.querySelector('title')) {
      note('svg-not-hidden-or-named', svg.outerHTML.slice(0, 120));
    }
  }

  const headings = document.querySelectorAll('h1');
  if (headings.length === 0) note('no-h1', '');
  if (headings.length > 1) {
    note('multiple-h1', [...headings].map((h) => h.textContent?.trim()).join(' | '));
  }

  const seen = new Set();
  for (const element of document.querySelectorAll('[id]')) {
    const id = element.getAttribute('id');
    if (seen.has(id)) note('duplicate-id', id);
    seen.add(id);
  }

  const lang = document.documentElement.getAttribute('lang');
  if (!lang) note('no-lang', '');

  return problems;
}

const paths = await pagePaths();
const problems = [];

for (const path of paths) {
  const dom = new JSDOM(await text(path));
  problems.push(...auditDocument(dom.window.document, path));
}

console.log(`audited ${paths.length} pages`);

if (problems.length === 0) {
  console.log('no problems found');
} else {
  const byRule = new Map();
  for (const problem of problems) {
    byRule.set(problem.rule, [...(byRule.get(problem.rule) ?? []), problem]);
  }

  for (const [rule, found] of byRule) {
    console.log(`\n${rule}: ${found.length}`);
    for (const problem of found.slice(0, 8)) {
      console.log(`  ${problem.path}  ${problem.detail}`);
    }
    if (found.length > 8) console.log(`  ... and ${found.length - 8} more`);
  }

  process.exitCode = 1;
}

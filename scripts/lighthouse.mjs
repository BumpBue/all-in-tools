/**
 * Runs Lighthouse over a few representative pages in both form factors and
 * prints a score table. Needs a production server already running.
 *
 * Usage: node scripts/lighthouse.mjs [mobile|desktop]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.AUDIT_BASE ?? 'http://127.0.0.1:3000';

// The home page, the heaviest tool page, a tool that owns stored data, and a
// tool that reads its state out of the URL.
const PAGES = ['/', '/tools/markdown-preview', '/tools/decision-matrix', '/tools/regex-tester'];

const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];
const PASSING_SCORE = 90;
const SCORE_SCALE = 100;

const formFactor = process.argv[2] === 'desktop' ? 'desktop' : 'mobile';
const workDir = mkdtempSync(join(tmpdir(), 'lh-'));

function run(page) {
  const out = join(workDir, `${page.replaceAll('/', '_') || 'home'}.json`);

  try {
    execFileSync(
      'npx',
      [
        '--yes',
        'lighthouse',
        `${BASE}${page}`,
        '--quiet',
        '--output=json',
        `--output-path=${out}`,
        `--only-categories=${CATEGORIES.join(',')}`,
        ...(formFactor === 'desktop' ? ['--preset=desktop'] : []),
        '--chrome-flags=--headless=new --no-sandbox --disable-gpu',
      ],
      // shell:true is required, not incidental: node refuses to spawn npx.cmd
      // without it on Windows. Every argument here is a literal from this file.
      { stdio: ['ignore', 'ignore', 'inherit'], shell: true },
    );
  } catch (error) {
    // On Windows chrome-launcher often cannot delete its own temp profile and
    // exits non-zero after the report is already written. A missing report is
    // the real failure, so that is what is checked.
    if (!existsSync(out)) throw error;
  }

  return JSON.parse(readFileSync(out, 'utf8'));
}

const failures = [];
const rows = [];

for (const page of PAGES) {
  const report = run(page);
  const row = { page };

  for (const category of CATEGORIES) {
    const score = Math.round((report.categories[category].score ?? 0) * SCORE_SCALE);
    row[category] = score;

    if (score < PASSING_SCORE) {
      failures.push({ page, category, score, report });
    }
  }

  rows.push(row);
}

console.log(`\n=== ${formFactor} ===`);
console.table(rows);

for (const { page, category, score, report } of failures) {
  console.log(`\n${page} — ${category} scored ${score}. What it flagged:`);

  const audits = report.categories[category].auditRefs
    .map((ref) => report.audits[ref.id])
    .filter((audit) => audit && audit.score !== null && audit.score < 1)
    .sort((left, right) => (left.score ?? 0) - (right.score ?? 0));

  for (const audit of audits.slice(0, 10)) {
    console.log(`  [${audit.score}] ${audit.id}: ${audit.title}`);
    if (audit.displayValue) console.log(`        ${audit.displayValue}`);
  }
}

rmSync(workDir, { recursive: true, force: true });

if (failures.length > 0) process.exitCode = 1;

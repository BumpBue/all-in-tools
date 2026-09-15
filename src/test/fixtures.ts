/**
 * Slugs and ids for fixtures, shaped so they cannot collide with a real tool.
 *
 * A test once used `habit-tracker` as its made-up slug and deleted that key
 * from the counter map in `afterEach`. It passed for months, and then tore out
 * a real registration the day that tool shipped — silently, because deleting a
 * key that exists throws nothing.
 *
 * The prefix is valid against TOOL_SLUG_PATTERN on purpose, so these work
 * anywhere a real slug does, and `config/tools/index.test.ts` asserts that no
 * tool in the registry ever starts with it.
 */
export const TEST_SLUG_PREFIX = 'zz-test-';

export function testSlug(name: string): string {
  return `${TEST_SLUG_PREFIX}${name}`;
}

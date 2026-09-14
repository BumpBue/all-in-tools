type ClassValue = string | false | null | undefined;

// Deliberately not tailwind-merge: components here compose class lists rather
// than override each other's utilities, so joining is enough.
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}

export function formatBytes(bytes: number): string {
  const UNITS = ['B', 'KB', 'MB'];
  const STEP = 1024;

  let value = bytes;
  let unit = 0;
  while (value >= STEP && unit < UNITS.length - 1) {
    value /= STEP;
    unit += 1;
  }

  return `${value.toFixed(unit === 0 ? 0 : 1)} ${UNITS[unit]}`;
}

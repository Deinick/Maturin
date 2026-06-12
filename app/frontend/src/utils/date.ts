/** Returns the user's local date as YYYY-MM-DD, offset by `days` (e.g. -1 for yesterday). */
export function localDate(days = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

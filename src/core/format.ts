const MS_PER_SECOND = 1000;
const SECONDS_PER_HOUR = 3600;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Game-time display: `m:ss`, or `h:mm:ss` from one hour. */
export function formatGameTime(ms: number): string {
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / MS_PER_SECOND) : 0;
  const hours = Math.floor(total / SECONDS_PER_HOUR);
  const minutes = Math.floor((total % SECONDS_PER_HOUR) / 60);
  const seconds = total % 60;
  return hours > 0 ? `${hours}:${pad2(minutes)}:${pad2(seconds)}` : `${minutes}:${pad2(seconds)}`;
}

/** Money display: `$` + whole number, no K/M notation, no separators. Non-finite or negative → `$0`. */
export function formatMoney(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '$0';
  // toLocaleString avoids exponent notation for huge values (1e21 → "1000000000000000000000").
  return `$${Math.floor(n).toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 0 })}`;
}

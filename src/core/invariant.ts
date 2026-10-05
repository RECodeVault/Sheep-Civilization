import { log } from './log';

// Asserts an impossible state cannot happen: throws in DEV, logs and continues in production.
export function invariant(cond: unknown, msg: string): asserts cond {
  if (cond) return;
  if (import.meta.env.DEV) throw new Error(`Invariant: ${msg}`);
  log.error('sim', `Invariant: ${msg}`);
}

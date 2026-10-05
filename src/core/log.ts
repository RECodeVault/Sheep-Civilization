// Tagged console logging. info/debug are DEV-only and stripped from production builds.
// Never log inside per-tick sim loops or per-frame render code.

export type LogTag = 'boot' | 'save' | 'sim' | 'input' | 'audio' | 'ui' | 'debug';

function write(sink: (...args: unknown[]) => void, tag: LogTag, message: string, data: unknown): void {
  if (data === undefined) sink(`[${tag}] ${message}`);
  else sink(`[${tag}] ${message}`, data);
}

export const log = {
  error(tag: LogTag, message: string, data?: unknown): void {
    write(console.error, tag, message, data);
  },
  warn(tag: LogTag, message: string, data?: unknown): void {
    write(console.warn, tag, message, data);
  },
  info(tag: LogTag, message: string, data?: unknown): void {
    if (import.meta.env.DEV) write(console.info, tag, message, data);
  },
  debug(tag: LogTag, message: string, data?: unknown): void {
    if (import.meta.env.DEV) write(console.debug, tag, message, data);
  },
};

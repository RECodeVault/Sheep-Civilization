// Ends every switch over a discriminated union so a new variant fails to compile until handled.
export function assertNever(x: never): never {
  let shown: string;
  try {
    shown = JSON.stringify(x) ?? String(x);
  } catch {
    shown = String(x);
  }
  throw new Error('Unexpected variant: ' + shown);
}

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SFX } from '../../src/view/assetKeys';

// The built sprite (npm run assets) and the hand-kept SFX map must agree: a renamed or missing source
// would otherwise ship as a silent cue with only a console warning.
describe('SFX markers', () => {
  it('match public/assets/audio/sfx.json exactly', () => {
    const file = path.resolve(__dirname, '../../public/assets/audio/sfx.json');
    const json = JSON.parse(readFileSync(file, 'utf8')) as { spritemap: Record<string, unknown> };
    expect(Object.keys(json.spritemap).sort()).toEqual(Object.values(SFX).sort());
  });
});

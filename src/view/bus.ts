// The shared typed event bus. GameScene publishes drained sim events on 'sim'; later stories add
// UI `noun:verb` events here. Listeners pass their scene as context and are removed on shutdown.
import { EventBus } from '../core/eventBus';
import type { Settings } from '../save/settingsStore';
import type { SimEvent } from '../sim/events';

export type BusEvents = {
  sim: SimEvent;
  // The F key (InputController); HudScene runs the same Farm action as a click.
  'farm:pressed': undefined;
  // The G key (InputController); HudScene runs the same Farm Breeding Food action as a click.
  'farmBreeding:pressed': undefined;
  // The Breed tool was clicked (HudScene); InputController toggles breed mode (UX-DR71).
  'breedTool:pressed': undefined;
  // A right press landed on a HUD control (HudScene), which captures it from GameScene; InputController
  // counts it toward the right-click that cancels breed mode (UX-DR74).
  'hud:rightPressed': undefined;
  // InputController entered or left breed mode, or picked or dropped adult A (0 = none). HudScene
  // shows the tool's active look; GameScene the cursor and the sheep markers.
  'breedMode:changed': { active: boolean; pickedA: number };
  // GameScene opened or closed the shop panel (Story 3.2); HudScene shows the Shop toggle's open look.
  'shop:toggled': { open: boolean };
  // GameScene: a sacrificed sheep's ghost reached the hole (or no ghost could play, so at once).
  // HudScene shows the reveal toast (FR33, Story 4.4).
  'sacrifice:landed': { wasAbomination: boolean };
  // A left press on the Medicine slot (HudScene), which captures it from GameScene; InputController arms
  // a dose drag (Story 4.5).
  'medicine:pressed': undefined;
  // A Button activated (widgets/Button.ts), just before its action runs; AudioDirector pops (Story 5.6).
  'button:activated': undefined;
  // HudScene played the frame's era banner (flushEraBanner): once per frame, however many EraChanged
  // events the ticks made. AudioDirector plays the fanfare, or the descending note on a regress.
  'era:announced': { regress: boolean };
  // AudioDirector raised a caption (captions on only, UX-DR88); HudScene's Captions shows it.
  'caption:requested': { text: string };
  // The live settings changed (view/settings.ts updateSettings): AudioDirector applies volumes and
  // captions at once; Story 5.7's Volume panel sends them.
  'settings:changed': Readonly<Settings>;
};

export const bus = new EventBus<BusEvents>();

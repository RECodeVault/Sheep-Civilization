// The shared typed event bus. GameScene publishes drained sim events on 'sim'; later stories add
// UI `noun:verb` events here. Listeners pass their scene as context and are removed on shutdown.
import { EventBus } from '../core/eventBus';
import type { SimEvent } from '../sim/events';

export type BusEvents = {
  sim: SimEvent;
  // The F key (InputController); HudScene runs the same Farm action as a click.
  'farm:pressed': undefined;
  // The G key (InputController); HudScene runs the same Farm Breeding Food action as a click.
  'farmBreeding:pressed': undefined;
  // The Breed tool was clicked (HudScene); InputController toggles breed mode (UX-DR71).
  'breedTool:pressed': undefined;
  // InputController entered or left breed mode, or picked or dropped adult A (0 = none). HudScene
  // shows the tool's active look; GameScene the cursor and the sheep markers.
  'breedMode:changed': { active: boolean; pickedA: number };
};

export const bus = new EventBus<BusEvents>();

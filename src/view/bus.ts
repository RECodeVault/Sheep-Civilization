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
};

export const bus = new EventBus<BusEvents>();

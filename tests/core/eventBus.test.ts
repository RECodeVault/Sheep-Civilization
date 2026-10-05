import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/core/eventBus';

type Events = {
  'shop:toggled': { open: boolean };
  'pause:opened': undefined;
};

describe('EventBus', () => {
  it('delivers typed payloads to listeners in subscription order', () => {
    const bus = new EventBus<Events>();
    const calls: string[] = [];
    bus.on('shop:toggled', (p) => calls.push(`a:${p.open}`));
    bus.on('shop:toggled', (p) => calls.push(`b:${p.open}`));
    bus.emit('shop:toggled', { open: true });
    expect(calls).toEqual(['a:true', 'b:true']);
  });

  it('calls listeners with the given context', () => {
    const bus = new EventBus<Events>();
    const ctx = { hits: 0 };
    bus.on(
      'pause:opened',
      function (this: typeof ctx) {
        this.hits += 1;
      },
      ctx,
    );
    bus.emit('pause:opened', undefined);
    expect(ctx.hits).toBe(1);
  });

  it('fires once listeners a single time', () => {
    const bus = new EventBus<Events>();
    const fn = vi.fn();
    bus.once('pause:opened', fn);
    bus.emit('pause:opened', undefined);
    bus.emit('pause:opened', undefined);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('removes listeners by function, by function + context, and by context only', () => {
    const bus = new EventBus<Events>();
    const ctxA = {};
    const ctxB = {};
    const fn = vi.fn();
    const other = vi.fn();
    bus.on('pause:opened', fn, ctxA);
    bus.on('pause:opened', fn, ctxB);
    bus.on('pause:opened', other, ctxB);

    bus.off('pause:opened', fn, ctxA);
    bus.emit('pause:opened', undefined);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(other).toHaveBeenCalledTimes(1);

    bus.off('pause:opened', undefined, ctxB);
    bus.emit('pause:opened', undefined);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(other).toHaveBeenCalledTimes(1);
  });

  it('removes all listeners for an event when only the event is given', () => {
    const bus = new EventBus<Events>();
    const fn = vi.fn();
    bus.on('pause:opened', fn);
    bus.on('pause:opened', fn, {});
    bus.off('pause:opened');
    bus.emit('pause:opened', undefined);
    expect(fn).not.toHaveBeenCalled();
  });

  it('skips listeners removed during emit and runs listeners added during emit from the next emit', () => {
    const bus = new EventBus<Events>();
    const calls: string[] = [];
    const late = () => calls.push('late');
    const b = () => calls.push('b');
    bus.on('pause:opened', () => {
      calls.push('a');
      bus.off('pause:opened', b);
      bus.on('pause:opened', late);
    });
    bus.on('pause:opened', b);
    bus.on('pause:opened', () => calls.push('c'));
    bus.emit('pause:opened', undefined);
    expect(calls).toEqual(['a', 'c']);
    calls.length = 0;
    bus.emit('pause:opened', undefined);
    expect(calls).toEqual(['a', 'c', 'late']);
  });

  it('skips listeners cleared by removeAllListeners during emit', () => {
    const bus = new EventBus<Events>();
    const later = vi.fn();
    bus.on('pause:opened', () => bus.removeAllListeners());
    bus.on('pause:opened', later);
    bus.emit('pause:opened', undefined);
    expect(later).not.toHaveBeenCalled();
  });

  it('fires a once listener a single time when emit re-enters for the same event', () => {
    const bus = new EventBus<{ tick: number }>();
    const once = vi.fn();
    bus.on('tick', (n) => {
      if (n === 0) bus.emit('tick', 1);
    });
    bus.once('tick', once);
    bus.emit('tick', 0);
    expect(once).toHaveBeenCalledOnce();
    expect(once).toHaveBeenCalledWith(1);
  });

  it('accepts interface event maps', () => {
    interface UiEvents {
      'settings:changed': { captions: boolean };
    }
    const bus = new EventBus<UiEvents>();
    const fn = vi.fn();
    bus.on('settings:changed', fn);
    bus.emit('settings:changed', { captions: true });
    expect(fn).toHaveBeenCalledWith({ captions: true });
  });

  it('removeAllListeners clears one event or every event', () => {
    const bus = new EventBus<Events>();
    const shop = vi.fn();
    const pause = vi.fn();
    bus.on('shop:toggled', shop);
    bus.on('pause:opened', pause);
    bus.removeAllListeners('shop:toggled');
    bus.emit('shop:toggled', { open: false });
    bus.emit('pause:opened', undefined);
    expect(shop).not.toHaveBeenCalled();
    expect(pause).toHaveBeenCalledOnce();
    bus.removeAllListeners();
    bus.emit('pause:opened', undefined);
    expect(pause).toHaveBeenCalledOnce();
  });

  it('ignores emits with no listeners', () => {
    const bus = new EventBus<Events>();
    expect(() => bus.emit('shop:toggled', { open: true })).not.toThrow();
  });
});

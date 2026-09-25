// events.ts — LOGIC layer. A tiny event emitter.
//
// The game logic "announces" things that happened (a spin started, coins changed)
// without knowing who is listening. The UI, debug panel, or a test can listen.
// This keeps logic and visuals separate.
//
// `Events` maps each event name to what it carries (for the game: GameEvents in
// types.ts), so a listener knows exactly what its payload looks like.

type Listener<P> = (payload: P) => void;

export interface Emitter<Events> {
  on<K extends keyof Events>(name: K, fn: Listener<Events[K]>): () => void;
  off<K extends keyof Events>(name: K, fn: Listener<Events[K]>): void;
  emit<K extends keyof Events>(name: K, payload: Events[K]): void;
}

export function createEmitter<Events>(): Emitter<Events> {
  // event name → array of callback functions
  const listeners: { [K in keyof Events]?: Listener<Events[K]>[] } = {};

  function on<K extends keyof Events>(name: K, fn: Listener<Events[K]>) {
    (listeners[name] ||= []).push(fn);
    return () => off(name, fn); // handy "unsubscribe" function
  }

  function off<K extends keyof Events>(name: K, fn: Listener<Events[K]>) {
    const list = listeners[name];
    if (!list) return;
    const i = list.indexOf(fn);
    if (i !== -1) list.splice(i, 1);
  }

  function emit<K extends keyof Events>(name: K, payload: Events[K]) {
    const list = listeners[name];
    if (!list) return;
    // Copy first so a listener can unsubscribe itself while we loop.
    for (const fn of [...list]) fn(payload);
  }

  return { on, off, emit };
}

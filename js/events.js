// events.js — LOGIC layer. A tiny event emitter.
//
// The game logic "announces" things that happened (a spin started, coins changed)
// without knowing who is listening. The UI, debug panel, or a test can listen.
// This keeps logic and visuals separate. In Godot these become signals:
//   emit("spinResolved", {...})  →  spin_resolved.emit(...)
//   on("spinResolved", fn)       →  Game.spin_resolved.connect(fn)

export function createEmitter() {
  const listeners = {}; // event name → array of callback functions

  function on(name, fn) {
    (listeners[name] ||= []).push(fn);
    return () => off(name, fn); // handy "unsubscribe" function
  }

  function off(name, fn) {
    const list = listeners[name];
    if (!list) return;
    const i = list.indexOf(fn);
    if (i !== -1) list.splice(i, 1);
  }

  function emit(name, payload) {
    const list = listeners[name];
    if (!list) return;
    // Copy first so a listener can unsubscribe itself while we loop.
    for (const fn of [...list]) fn(payload);
  }

  return { on, off, emit };
}

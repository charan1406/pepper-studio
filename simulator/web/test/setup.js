import '@testing-library/jest-dom';

// Node 22+ exposes globalThis.localStorage as an undefined accessor before jsdom
// can populate it. vitest 2.x's populateGlobal() skips keys already in globalThis,
// so the Node undefined stub wins over jsdom's Storage. Wire it explicitly.
// globalThis.jsdom is set by vitest's jsdom environment setup before setupFiles run.
if (typeof globalThis.jsdom !== 'undefined' && globalThis.jsdom.window) {
  const jsDomWin = globalThis.jsdom.window;
  Object.defineProperty(globalThis, 'localStorage', {
    get: () => jsDomWin.localStorage,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    get: () => jsDomWin.sessionStorage,
    configurable: true,
  });
}

// Radix UI primitives need these in jsdom (pointer capture, scroll, resize observer).
if (typeof window !== 'undefined') {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  }
}

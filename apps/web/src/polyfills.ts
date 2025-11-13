/**
 * Runtime polyfills to make browser-oriented libraries (e.g. Chart.js)
 * work in the Node.js environment used during Next.js server builds.
 */
const globalScope = globalThis as typeof globalThis & {
  self?: typeof globalThis;
  window?: typeof globalThis;
  document?: any;
};

if (typeof globalScope.self === 'undefined') {
  globalScope.self = globalScope as any;
}

if (typeof globalScope.window === 'undefined') {
  globalScope.window = globalScope as any;
}

if (typeof globalScope.document === 'undefined') {
  globalScope.document = {
    addEventListener: () => {},
    removeEventListener: () => {},
    createElement: () => ({}),
    body: {},
    head: {},
  };
}


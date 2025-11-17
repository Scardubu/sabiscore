/**
 * Minimal server-side polyfills for Chart.js and browser-only libraries
 * Only runs during server-side rendering to prevent crashes
 */

// Only polyfill on server-side
if (typeof window === 'undefined') {
  const globalScope = globalThis as Record<string, unknown>;

  // Minimal Element mock for Chart.js
  class MockElement {
    style: Record<string, unknown> = {};
    classList = { add() {}, remove() {}, contains() { return false; } };
    children: MockElement[] = [];
    
    addEventListener() {}
    removeEventListener() {}
    appendChild(child: MockElement) {
      this.children.push(child);
      return child;
    }
    removeChild(child: MockElement) {
      this.children = this.children.filter((node) => node !== child);
      return child;
    }
    setAttribute() {}
    getAttribute() { return null; }
    querySelector() { return null; }
    querySelectorAll() { return []; }
    getBoundingClientRect() {
      return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
    }
    
    get cachedShadowRoot() { return null; }
    attachShadow() { return new MockElement(); }
  }

  // Only define if not already present
  if (!globalScope.document) {
    globalScope.document = {
      createElement: () => new MockElement(),
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null,
      addEventListener() {},
      removeEventListener() {},
      body: new MockElement(),
      head: new MockElement(),
    };
  }

  if (!globalScope.window) {
    globalScope.window = globalScope;
  }

  if (!globalScope.navigator) {
    globalScope.navigator = {
      userAgent: 'Node.js',
      platform: 'Node',
    };
  }

  if (!globalScope.getComputedStyle) {
    globalScope.getComputedStyle = () => ({
      getPropertyValue: () => '',
    });
  }
}

export {};


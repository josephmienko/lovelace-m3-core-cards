import { afterEach, beforeAll } from "vitest";

beforeAll(() => {
  window.matchMedia ??= (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  });

  if (!Element.prototype.animate) {
    Element.prototype.animate = function animate() {
      return {
        cancel() {},
        finished: Promise.resolve(),
        onfinish: null,
        oncancel: null,
      };
    };
  }
});

afterEach(() => {
  document.body.innerHTML = "";
  delete window.loadCardHelpers;
});

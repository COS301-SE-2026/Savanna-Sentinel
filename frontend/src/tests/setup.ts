import "@testing-library/jest-dom";
import { beforeAll, afterAll } from "vitest";

const originalError = console.error.bind(console);
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    const msg = typeof args[0] === "string" ? args[0] : "";
    if (
      msg.includes("not wrapped in act") ||
      msg.includes("inside an `act` scope")
    ) return;
    originalError(...args);
  };
});
afterAll(() => {
  console.error = originalError;
});

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

window.HTMLElement.prototype.hasPointerCapture = () => false;
window.HTMLElement.prototype.setPointerCapture = () => {};
window.HTMLElement.prototype.releasePointerCapture = () => {};

window.HTMLElement.prototype.scrollIntoView = () => {};
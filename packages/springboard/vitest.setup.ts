const { info, log, warn, error } = console;
const ignored = ['Lit is in dev mode.'];

const filterIgnored = (callback, ...args) => {
  const msg = args?.[0];
  if (typeof msg !== 'string' || !ignored.some((ignoredMsg) => msg.includes(ignoredMsg))) {
    callback(...args);
  }
};

console.info = (...args) => filterIgnored(info, ...args);
console.log = (...args) => filterIgnored(log, ...args);
console.warn = (...args) => filterIgnored(warn, ...args);
console.error = (...args) => filterIgnored(error, ...args);

// Temporarily comment out jest-dom until we resolve ESM issues
// import '@testing-library/jest-dom';

class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
}

class IntersectionObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
    takeRecords() {
        return [];
    }
}

global.ResizeObserver = ResizeObserver;
global.IntersectionObserver = IntersectionObserver as unknown as typeof global.IntersectionObserver;

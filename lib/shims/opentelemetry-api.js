// No-op shim for @opentelemetry/api, which is not installed.
// better-auth imports `trace` and `SpanStatusCode` for optional instrumentation.
// startActiveSpan must call its callback and return the result — otherwise any
// async operations wrapped by withSpan() would silently return undefined.
const noopSpan = {
  end() {},
  recordException() {},
  setStatus() {},
  setAttribute() {
    return this;
  },
  setAttributes() {
    return this;
  },
};

const noopTracer = {
  startActiveSpan(name, optionsOrFn, fn) {
    const cb = typeof optionsOrFn === 'function' ? optionsOrFn : fn;
    return cb(noopSpan);
  },
};

export const trace = {
  getTracer() {
    return noopTracer;
  },
};

export const SpanStatusCode = { UNSET: 0, OK: 1, ERROR: 2 };

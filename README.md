# Accelerating the adoption of modern web features, and migrating away from outdated approaches

Breakout session at TPAC 2025

**Context:** https://www.w3.org/events/meetings/95b89f3d-1494-4f0e-9968-53fdf15945dc/

**One-line summary:** Proposal to create a dataset that will help developers (and their coding agents!) start using new stuff sooner, and migrate from the old stuff more quickly

**Breakout session goals:** Brainstorming ideas for what info such a dataset should contain, where it could live, and how we can collaborate to build and maintain it

**Breakout session non-goals:** Go-to-market planning to scale adoption of features, altering the Baseline definition (see [#2758](https://github.com/web-platform-dx/web-features/issues/2758))

## Why should developers care to adopt more modern web features?

NOT simply modernization for the sake of it:

1. UX benefits
    - Capabilities: modern features add new capabilities to the web platform, which allow users to do more and experience it in new ways
    - Performance: removing polyfills and unnecessary code can improve performance
    - Accessibility: outdated implementations may not follow all of the same a11y best practices that are built into more modern, native implementations
    - Security: removing 3P JS dependencies eliminates some security risks
2. DX benefits
    - Maintenance: removing unneeded dependencies means fewer things to keep up to date
    - Maintenance: modern implementations are often simpler, more semantic, and require fewer lines of code than their outdated alternatives, making them easier to maintain
    - Maintenance: modern implementations just work in browsers and don't require preprocessing tools, simplifying the development toolchain

UX and DX benefits need to outweigh the costs of migrating old code or supporting fallbacks for cutting edge features.

## Related efforts

- [Baseline](https://web-platform-dx.github.io/web-features/) project in the WebDX CG
    - [web-features-mappings](https://github.com/web-platform-dx/web-features-mappings)

- [Legacy JavaScript](https://developer.chrome.com/docs/performance/insights/legacy-javascript) insight in Lighthouse
  
    <img width="937" height="375" alt="image" src="https://github.com/user-attachments/assets/987a9680-1f80-4fe8-b2da-b2eb27fb65d0" />

- [Ecosystem Performance (e18e)](https://e18e.dev/)

## Examples

### Discouraging outdated fallbacks: [IntersectionObserver polyfill](https://www.npmjs.com/package/intersection-observer)

<img width="792" height="304" alt="image" src="https://github.com/user-attachments/assets/95db068c-7b65-484a-a838-ab68fa223e1b" />

For the majority of websites that don't need to support pre-2019 browsers, there's no reason to continue shipping this polyfill to users. It's a drop-in replacement for the web platform API (v1) which most users' browsers already support.

Having a dataset that links the polyfill to the [intersection-observer](https://web-platform-dx.github.io/web-features-explorer/features/intersection-observer/) web-feature ID can enable developer-facing tools to promote the opportunity to clean it up.

```json
{
  "web_feature": "intersection-observer",
  "use_case": "Monitor the visibility of an element within the viewport or a parent element",
  "breaks_in_unsupported_browsers": true,
  "fallbacks": [{
    "type": "polyfill",
    "npm": "intersection-observer",
    "code_signature": "...",
    "browser_support": "..."
  }]
}
```

Usage:

- Lighthouse scans for `code_signature` (prod)
- e18e scans for `npm` package (dev)
- Coding agents can look at the `use_case` to discover the modern web feature that it might not have otherwise known about

### Encouraging progressive enhancements: [Scheduler API](https://developer.mozilla.org/en-US/docs/Web/API/Scheduler)

<img width="786" height="262" alt="image" src="https://github.com/user-attachments/assets/b7129514-4229-4ce9-8bc1-6c39be5e5a2e" />

- provides more granular control over task scheduling
- not 100% polyfillable but fallbacks get close enough

Chrome [recommends using this API](https://web.dev/articles/optimize-long-tasks#cross-browser_support) to break up long tasks and improve interaction responsiveness (INP, a Core Web Vital metric).

Polyfill: https://www.npmjs.com/package/scheduler-polyfill

Fallback code:

```js
if (globalThis.scheduler?.yield) {
  scheduler.yield();
} else {
  new Promise(resolve => {
    setTimeout(resolve, 0);
  });
}
```

```json
{
  "web_feature": "scheduler",
  "use_case": "Break up long-running tasks",
  "breaks_in_unsupported_browsers": true,
  "fallbacks": [{
    "type": "polyfill",
    "npm": "scheduler-polyfill",
    "code_signature": "...",
    "browser_support": "..."
  }, {
    "type": "code",
    "code": "setTimeout(callback, 0)",
    "browser_support": "..."
  }]
}
```

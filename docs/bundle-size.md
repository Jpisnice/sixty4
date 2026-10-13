# The small bundle, and what makes it possible

Sixty4 is a full server-rendered React app, yet a first visit loads about 114 KB of compressed JavaScript, and the game's own code is only about 6 KB of that. A repeat visit moves about 3.5 KB over the network. This explains the numbers, how they are measured, and the choices behind them.

The short version:

- Almost all of the JavaScript is the **framework floor**: React, react-dom, TanStack Router and Start's hydration runtime. The game adds about 6 KB.
- **Only what the first screen needs loads up front.** Sharing, the offline queue, the service worker, history sync, field vitals and the debug menu are all loaded later, and only if needed.
- **No CSS file, no web fonts, no images**: CSS is inlined, type uses system fonts, icons are inline SVG.
- **Server code never reaches the browser**, and a build check fails if it does.
- **Everything is compressed and cached hard**: Brotli everywhere, scripts cached for a year, and a service worker that serves them on repeat visits.

## Contents

1. [The numbers](#the-numbers)
2. [How they are measured](#how-they-are-measured)
3. [Where the bytes go](#where-the-bytes-go)
4. [What keeps it small](#what-keeps-it-small)
5. [Fast as well as small](#fast-as-well-as-small)
6. [Known risks](#known-risks)
7. [Keeping it small: a checklist](#keeping-it-small-a-checklist)

## The numbers

From `pnpm budgets` on the current build, and the repeat-visit e2e test:

| Measure | Budget | Now |
| --- | --- | --- |
| First-load JS, gzip | ≤ 130 KB | 114.3 KB |
| Game code on top of the framework, gzip | ≤ 15 KB | 6.0 KB |
| Inline CSS, raw | ≤ 6 KB | 5.5 KB |
| HTML, gzip | ≤ 8 KB (soft target 4.5 KB) | 3.5 KB |
| Service worker code, minified | ≤ 2 KB | 1.9 KB |
| Repeat visit, bytes on the wire | ≤ 5 KB | about 3.5 KB |

Lighthouse CI (`lighthouserc.json`) also checks a mobile run (simulated 150 ms round trip, 1.6 Mbit/s, 4× CPU slowdown, best of 3 runs). It requires:

- a performance score of at least 95
- Largest Contentful Paint of 1.8 s or less
- Cumulative Layout Shift of 0.02 or less
- 150 KB or less transferred in total

**Why 130 KB.** A bare TanStack Start app, with no game code at all, is already about 106 KB gzip: react-dom alone is about 64 KB, and the router and Start's hydration runtime make up the rest. 130 KB leaves room for the game on top of that floor, and the separate 15 KB budget for game code keeps the part we control honest.

## How they are measured

`scripts/check-budgets.mjs` measures the real production build the way a browser sees it:

1. Start the built Node server (`.output/server/index.mjs`) on a random port.
2. Fetch `/` and collect every script the HTML loads: `<script src>` and `<link href>` under `/assets/`.
3. Gzip each one at level 9 and add them up. That is **first-load JS**. Everything except the entry chunk is **game code on top**.
4. Measure the inline `<style>` blocks (raw bytes), the HTML (gzip) and the service worker (minified, minus the injected asset list).
5. **Fail** if:
   - any budget is exceeded
   - a `<link rel="stylesheet">` appears (CSS must be inlined)
   - Google Fonts or an `<img>` appears in the HTML
   - server code shows up in a browser chunk (see [Server code stays on the server](#server-code-stays-on-the-server))

The HTML soft target only warns.

The repeat-visit number comes from `e2e/offline.spec.ts`. It reloads a page controlled by the service worker, records every network response over the Chrome DevTools Protocol, and asserts that no script touched the network and that the page plus HTML came to 5 KB or less.

## Where the bytes go

Every JavaScript chunk in the current build, gzip:

| Chunk | Size | When it loads |
| --- | --- | --- |
| `index-*.js`: React, react-dom, router, Start runtime | 108.3 KB | First load |
| `routes-*.js`: the game screen, rules, strings, storage, result panel, streak grid | 6.0 KB | First load |
| `vitals-*.js`: web-vitals with attribution | 5.2 KB | Idle time, on a 25% sample of visits |
| `Debug-*.js`: the hidden debug menu | 1.3 KB | Only after a double tap on the title |
| `how-it-works-*.js` | 0.8 KB | Only on that page |
| `idle-*.js`: service worker registration, install prompt | 355 B | Idle time |
| `queue-*.js`: IndexedDB offline queue | 346 B | Only when an answer can't be sent |
| `me-*.js`: history sync | 315 B | Idle time, only when history is missing |
| `share-*.js`: share or copy | 194 B | Only when Share is tapped |

First load is the first two rows. Everything else is fetched on demand, and none of it is needed to show or play the puzzle.

## What keeps it small

### Load only what the first screen needs

The game's code is split by **when it is needed**, not by feature. Anything not needed to draw and play the puzzle is a dynamic `import()`:

- **`idle.ts`** runs after the `load` event and then `requestIdleCallback`. It registers the service worker, listens for the install prompt, and maybe starts field vitals. None of that may delay first paint.
- **`me.ts`** (history sync) loads only when local history is empty or yesterday's bonus is unknown.
- **`queue.ts`** (IndexedDB) loads only when an answer fails to send.
- **`share.ts`** loads when Share is tapped.
- **`Debug.tsx`** is a `React.lazy` component, mounted inside `<Suspense>` only after a double tap on the title.

The router never preloads other routes (`defaultPreload: false` in `src/router.tsx`). The How it works page is fetched only when visited.

### Field vitals on a sample

Real-user LCP, INP and CLS are worth having, but web-vitals with attribution is 5.2 KB, almost as much as the whole game. So `idle.ts` loads it on only **25% of visits** (`Math.random() < 0.25`). The other 75% never download it, and the 25% that do download it at idle time, after the page is usable.

### No CSS file

Start inlines the stylesheet into the HTML (`tanstackStart({ server: { build: { inlineCss: true } } })` in `vite.config.ts`). There is no render-blocking CSS request, and the budget check fails if a `<link rel="stylesheet">` ever appears. The cost is that CSS rides in every HTML response, so it has its own budget: 6 KB raw. Its design tokens (`--bg`, `--fg`, `--accent` and so on) keep the rules short.

### No web fonts, no images

- **Type uses system fonts.** The heading stack names Fraunces first and uses it if the phone happens to have it installed, but never downloads it. A web font would add tens of kilobytes and either delay text or shift the layout when it arrives. The budget check fails if Google Fonts appears in the HTML.
- **Icons are inline SVG paths** (`src/client/icons.tsx`): eight short `d` strings drawn with `currentColor`. There's no icon font and no sprite request.
- **The app icons** (`public/icon-192.png`, `icon-512.png`, 658 B and 2.8 KB) are drawn by `scripts/make-icons.mjs` using only Node's zlib, and are only used for the home-screen icon and favicon.
- The budget check fails on any `<img>` in the HTML.

### No extra libraries

The browser gets React, react-dom, TanStack Router and Start, and nothing else on first load:

- **State:** one `useReducer` in `Game.tsx`. No state library.
- **Data fetching:** the route loader for the puzzle, and plain `fetch` for the API. No query library.
- **UI:** hand-written components and CSS. No component kit, no CSS framework, no icon package.
- **Dates:** a few lines of arithmetic on `YYYY-MM-DD` strings. No date library.
- **Storage:** small wrappers over `localStorage` and raw IndexedDB. No wrapper library.

The only other runtime dependency the browser can see is `web-vitals`, and only on the sampled 25%.

### Server code stays on the server

The heaviest code in the project (the database driver, the ORM, the puzzle maker and the solver) runs only on the server:

- **`*.server.ts` files** are blocked from browser bundles by Start's import protection.
- **The page gets only what it needs to play:** the puzzle comes from a server function (`getToday`), so the browser holds a tiny RPC stub, not the code behind it. The solver and the solution list never leave the server.
- **The build is checked.** `check-budgets.mjs` scans every browser chunk for `drizzle`, `libsql`, `__SOLVER__` (a marker string inside the solver) and `solutions`, and fails if it finds any. This guards size and also secrecy: the solution list is the answer key.

What the page does share with the server is `src/game/rules.ts`, the pure game rules with no imports, so the page can score instantly without a round trip.

### A tiny, hand-written service worker

A service-worker library would cost more than the whole game. `src/sw/sw.js` is 80 lines that do exactly what the game needs: precache, network-first pages, cache-first assets and the answer queue. `sw-plugin.ts` minifies it with `rolldown/utils` (top-level mangling on) to stay under 2 KB. See [offline.md](offline.md#the-service-worker).

### Compression and caching

| Response | Compression | Cache |
| --- | --- | --- |
| `/assets/*.js` (hashed names) | Brotli or gzip, **compressed once at build time** (`nitro.compressPublicAssets`) | `public, max-age=31536000, immutable`, plus the service worker's own cache |
| HTML | Brotli (quality 5) or gzip, on the fly, by `src/server.ts` on the Node server; the CDN on Vercel | `public, s-maxage=<seconds to India midnight>, stale-while-revalidate=60` |
| `/api/*` JSON | Same as HTML | `no-store`, except `/api/me` (`private, no-cache` with an ETag) |
| `/manifest.webmanifest` | | `public, max-age=86400` |
| `/sw.js` | | `no-cache`, so new deploys are picked up |

Brotli quality 5 for HTML is a deliberate middle ground: almost as small as the maximum setting, at a fraction of the CPU cost per request.

The HTML holds no personal data, so it can be **shared**: one cached copy serves every player until the day changes. On a repeat visit the service worker serves every script from its cache, and only the HTML (about 3.5 KB) crosses the network.

### Modern output

The client build targets `es2020`. That ships native `async`/`await`, optional chaining, classes and the rest without older-browser rewrites, which keeps code smaller. Every phone the game targets supports ES2020.

## Fast as well as small

Size isn't the only thing Lighthouse measures. These choices protect the speed and stability scores:

- **No layout shift.** Every row of the game screen has a fixed height (header 48px, yesterday line 20px, target 100px, tiles 64px…). Personal data is read after hydration into space already reserved for it, and there are no web fonts to swap in. CLS is 0.
- **The largest element is text.** The biggest thing on screen, the target number, is server-rendered text in a system font. It paints with the HTML, with no image or font to wait for.
- **Idle work really is idle.** The service worker, vitals and history sync all start after `load` and `requestIdleCallback`, away from the first paint and the first tap.
- **Fewer re-renders.** The React Compiler (`babel-plugin-react-compiler`) memoizes components automatically. This doesn't shrink the bundle, but it cuts work on every tap.

## Known risks

- **Hydration on slow phones.** The framework floor is about 108 KB, and parsing and hydrating React on a slow CPU is what most threatens the Lighthouse score and the 1.8 s LCP target. Local mobile runs scored 94 to 99, with LCP 1.6 to 2.0 s. Watch the CI numbers and the field p75 from `/api/vitals`.
- **Inline CSS is nearly full,** at 5.5 of 6 KB. The next sizeable styling change will need old rules trimmed first, or a conscious decision to raise the budget.
- **Shared chunks can move.** When two routes start sharing a module, the bundler may move it between the entry chunk and a shared chunk. That changes the "game code on top" figure even though the total hardly moves. Judge a change by first-load JS first.

## Keeping it small: a checklist

Before adding a feature:

1. **Is it needed on the first screen?** If not, put it behind a dynamic `import()` or `React.lazy`, and load it on the user action or at idle time.
2. **Can it be done without a dependency?** Check what the dependency adds to the gzip total before adding it. A few lines of code usually win.
3. **Does it touch the server?** Keep server logic in `*.server.ts` or a server function, and send the browser only the result.
4. **Does it add CSS?** Reuse the existing tokens and classes, and check the 6 KB inline CSS budget.
5. **Does it add a font, an image or a stylesheet link?** The budget check will fail. Use system fonts, inline SVG and inlined CSS instead.
6. **Does it put personal data in the HTML?** Don't: read it after hydration, so the HTML stays shareable and cacheable.
7. **Run `pnpm build && pnpm budgets`** and the e2e suite (which includes the 5 KB repeat-visit test) before merging.

// The page IS a camera. There is nothing to server-render, and an SSR pass would
// only produce a viewfinder-shaped hole before hydration.
//
// Auth is not lost by turning SSR off: the `(auth)` guard lives in
// `hooks.server.ts` (`handleAuthGuard`), precisely because pages like this one
// cannot rely on a layout load. The permission gate is in `+page.server.ts`,
// which still runs.
export const ssr = false;

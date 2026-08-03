import '@testing-library/svelte/vitest';
import '@testing-library/jest-dom/vitest';
import { vi, afterAll } from 'vitest';

// SvelteKit's `$env/dynamic/*` are virtual modules provided by the sveltekit()
// Vite plugin. Under vitest 4's module runner they evaluate to `undefined`
// during collection (the runtime global they read isn't populated in tests),
// so any file importing them crashes with "Cannot read properties of undefined
// (reading 'env')". Provide safe empty defaults globally; individual tests
// (e.g. config/api.test.ts) still override via vi.doMock as needed.
vi.mock('$env/dynamic/public', () => ({ env: {} }));
vi.mock('$env/dynamic/private', () => ({ env: {} }));

// jsdom has no ResizeObserver, but Svelte's bind:clientWidth/clientHeight
// (used by SeatMap to size its home view) requires one. A no-op stub is
// enough: jsdom never lays out, so the dimensions would be 0 anyway and
// components must handle the unmeasured case regardless.
if (typeof globalThis.ResizeObserver === 'undefined') {
	class ResizeObserverStub {
		observe(): void {
			// no-op: jsdom never lays out
		}
		unobserve(): void {
			// no-op
		}
		disconnect(): void {
			// no-op
		}
	}
	globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

// jsdom implements no `matchMedia`, but components query it for user
// preferences — e.g. RotatingNoun asks for `prefers-reduced-motion` on mount,
// so rendering it (or any parent of it) would throw "matchMedia is not a
// function". Default to "query does not match": the animated, non-reduced
// path is the one worth exercising by default, and a test that cares about a
// specific query stubs it explicitly (vi.stubGlobal overrides this, and
// vi.unstubAllGlobals restores it). Installed only when absent, so a real
// implementation always wins.
if (typeof globalThis.matchMedia === 'undefined') {
	const noop = (): void => {
		// no-op: the stub's result never changes, so listeners never fire
	};
	globalThis.matchMedia = function stubMatchMedia(query: string): MediaQueryList {
		return {
			matches: false,
			media: query,
			onchange: null,
			addEventListener: noop,
			removeEventListener: noop,
			// Deprecated aliases, still used by some libraries.
			addListener: noop,
			removeListener: noop,
			dispatchEvent: () => false
		} as unknown as MediaQueryList;
	};
}

// jsdom implements no Web Animations API, but Svelte 5 drives `transition:`
// through `Element.animate` — so rendering any component with a transition
// (e.g. ConfirmDialog's fade/scale) throws "element.animate is not a function".
// The stub reports an already-finished animation: transitions become instant,
// which is what a test wants anyway. Installed only when absent, so a real
// implementation (should jsdom ever ship one) always wins.
if (typeof Element !== 'undefined' && typeof Element.prototype.animate !== 'function') {
	const noop = (): void => {
		// no-op: the stub animation is already finished, so nothing to control
	};
	Element.prototype.animate = function stubAnimate(): Animation {
		const animation = {
			currentTime: 0,
			startTime: 0,
			playbackRate: 1,
			playState: 'finished',
			finished: Promise.resolve(),
			effect: { getComputedTiming: () => ({ delay: 0, duration: 0 }) },
			onfinish: null as null | (() => void),
			oncancel: null as null | (() => void),
			cancel: noop,
			pause: noop,
			play: noop,
			finish: noop,
			reverse: noop,
			addEventListener: noop,
			removeEventListener: noop
		};
		// Let the caller assign `onfinish` before it fires.
		queueMicrotask(() => animation.onfinish?.());
		return animation as unknown as Animation;
	};
}

// bits-ui 2's body scroll-lock schedules a ~24ms setTimeout on dialog unmount
// to restore document.body styles (dist/internal/body-scroll-lock.svelte.js).
// If a file's last test unmounted a dialog, that timer can fire after vitest
// tears down the jsdom environment, crashing the run with an unhandled
// "ReferenceError: document is not defined". Wait it out once per test file
// while jsdom is still alive.
afterAll(async () => {
	// Some files enable fake timers without restoring them (the wait below
	// would then never resolve); the file is done, so restoring is safe.
	vi.useRealTimers();
	await new Promise((resolve) => setTimeout(resolve, 50));
});

// Add custom matchers or global test setup here

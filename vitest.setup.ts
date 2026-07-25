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

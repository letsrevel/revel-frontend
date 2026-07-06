import '@testing-library/svelte/vitest';
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// SvelteKit's `$env/dynamic/*` are virtual modules provided by the sveltekit()
// Vite plugin. Under vitest 4's module runner they evaluate to `undefined`
// during collection (the runtime global they read isn't populated in tests),
// so any file importing them crashes with "Cannot read properties of undefined
// (reading 'env')". Provide safe empty defaults globally; individual tests
// (e.g. config/api.test.ts) still override via vi.doMock as needed.
vi.mock('$env/dynamic/public', () => ({ env: {} }));
vi.mock('$env/dynamic/private', () => ({ env: {} }));

// Add custom matchers or global test setup here

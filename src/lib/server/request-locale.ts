/**
 * Request-scoped Paraglide locale (server only).
 *
 * Paraglide's `setLocale()` on the server writes a module-level variable that
 * is shared by every concurrent request (the cookie strategy is a no-op
 * without `document`). Any `await` in a hook or load lets another request
 * overwrite it, so pages, `m.*` calls and date helpers could render in another
 * visitor's language. Paraglide's `getLocale()` reads
 * `serverAsyncLocalStorage.getStore()?.locale` first, so we register one
 * `AsyncLocalStorage` and run each request inside it.
 *
 * Lives under `$lib/server` so SvelteKit refuses to bundle it client-side.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { overwriteServerAsyncLocalStorage, type Locale } from '$lib/paraglide/runtime.js';

type LocaleStore = { locale?: Locale; origin?: string; messageCalls?: Set<string> };

const storage = new AsyncLocalStorage<LocaleStore>();
let registered = false;

function register(): void {
	if (registered) return;
	// The generated type wants `run(store, cb: any)`, which AsyncLocalStorage satisfies.
	overwriteServerAsyncLocalStorage(storage);
	registered = true;
}

register();

/** Run `fn` (and everything it awaits) with `locale` as this request's locale. */
export function runWithRequestLocale<T>(locale: Locale, origin: string, fn: () => T): T {
	register();
	return storage.run({ locale, origin, messageCalls: new Set<string>() }, fn);
}

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
 * We do not use `paraglideMiddleware`: our detection order (?lang, Paraglide
 * cookie, legacy cookie, Accept-Language) and the embed no-cookie rule are
 * deliberate, and the middleware brings its own strategy and redirects.
 *
 * Lives under `$lib/server` so SvelteKit refuses to bundle it client-side.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { overwriteServerAsyncLocalStorage, type Locale } from '$lib/paraglide/runtime.js';

type LocaleStore = { locale?: Locale; origin?: string };

const storage = new AsyncLocalStorage<LocaleStore>();

overwriteServerAsyncLocalStorage(storage);

/** Run `fn` (and everything it awaits) with `locale` as this request's locale. */
export function runWithRequestLocale<T>(locale: Locale, origin: string, fn: () => T): T {
	return storage.run({ locale, origin }, fn);
}

/** The locale of the request currently being handled, if any. */
export function currentRequestLocale(): Locale | undefined {
	return storage.getStore()?.locale;
}

<script lang="ts" module>
	interface TurnstileRenderOptions {
		sitekey: string;
		theme: 'auto' | 'light' | 'dark';
		language: string;
		callback: (token: string) => void;
		'expired-callback': () => void;
		'error-callback': () => void;
	}

	interface TurnstileApi {
		render: (el: HTMLElement, opts: TurnstileRenderOptions) => string;
		reset: (widgetId: string) => void;
		remove: (widgetId: string) => void;
	}

	declare global {
		interface Window {
			turnstile?: TurnstileApi;
		}
	}

	const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
	const LOAD_TIMEOUT_MS = 15_000;

	/**
	 * Wait for `window.turnstile`, injecting the script at most once per page.
	 * Rejects on a script error (e.g. blocked by an extension) or after
	 * LOAD_TIMEOUT_MS, and drops the failed tag so a later mount retries.
	 * `cancel` clears the timers when the component unmounts first.
	 */
	function loadTurnstile(): { ready: Promise<TurnstileApi>; cancel: () => void } {
		let poll: ReturnType<typeof setInterval> | undefined;
		let timeout: ReturnType<typeof setTimeout> | undefined;
		const cancel = () => {
			clearInterval(poll);
			clearTimeout(timeout);
		};
		const ready = new Promise<TurnstileApi>((resolve, reject) => {
			if (window.turnstile) return resolve(window.turnstile);
			let script = document.head.querySelector<HTMLScriptElement>('script[data-turnstile]');
			if (!script) {
				script = document.createElement('script');
				script.src = SCRIPT_SRC;
				script.async = true;
				script.defer = true;
				script.dataset.turnstile = '';
				document.head.appendChild(script);
			}
			const fail = () => {
				cancel();
				script?.remove();
				reject(new Error('turnstile_unavailable'));
			};
			script.addEventListener('error', fail, { once: true });
			poll = setInterval(() => {
				if (window.turnstile) {
					cancel();
					resolve(window.turnstile);
				}
			}, 50);
			timeout = setTimeout(fail, LOAD_TIMEOUT_MS);
		});
		return { ready, cancel };
	}
</script>

<script lang="ts">
	import { getLocale } from '$lib/paraglide/runtime.js';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		siteKey: string;
		token?: string;
	}

	let { siteKey, token = $bindable('') }: Props = $props();

	let container = $state<HTMLDivElement | null>(null);
	let widgetId: string | null = null;

	let unavailable = $state(false);

	$effect(() => {
		if (!container) return;
		const el = container;
		let cancelled = false;
		const { ready, cancel } = loadTurnstile();
		ready
			.then((api) => {
				if (cancelled) return;
				widgetId = api.render(el, {
					sitekey: siteKey,
					theme: 'auto',
					language: getLocale(),
					callback: (value) => (token = value),
					'expired-callback': () => (token = ''),
					'error-callback': () => (token = '')
				});
			})
			.catch(() => {
				// Script blocked/timed out, or render threw (e.g. invalid site key).
				if (!cancelled) unavailable = true;
			});
		return () => {
			cancelled = true;
			cancel();
			if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
			widgetId = null;
		};
	});

	/** Tokens are single-use: call after any submit that didn't navigate away. */
	export function reset(): void {
		token = '';
		if (widgetId && window.turnstile) window.turnstile.reset(widgetId);
	}
</script>

<div bind:this={container} data-testid="turnstile" class="flex justify-center"></div>
{#if unavailable}
	<p role="alert" class="text-center text-sm text-destructive">
		{m['register.turnstileUnavailable']()}
	</p>
{/if}
<input type="hidden" name="turnstileToken" value={token} />

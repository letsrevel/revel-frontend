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

	/** Resolve once `window.turnstile` exists, injecting the script at most once per page. */
	function loadTurnstile(): Promise<TurnstileApi> {
		return new Promise((resolve) => {
			if (window.turnstile) return resolve(window.turnstile);
			if (!document.head.querySelector('script[data-turnstile]')) {
				const script = document.createElement('script');
				script.src = SCRIPT_SRC;
				script.async = true;
				script.defer = true;
				script.dataset.turnstile = '';
				document.head.appendChild(script);
			}
			const poll = setInterval(() => {
				if (window.turnstile) {
					clearInterval(poll);
					resolve(window.turnstile);
				}
			}, 50);
		});
	}
</script>

<script lang="ts">
	import { getLocale } from '$lib/paraglide/runtime.js';

	interface Props {
		siteKey: string;
		token?: string;
	}

	let { siteKey, token = $bindable('') }: Props = $props();

	let container = $state<HTMLDivElement | null>(null);
	let widgetId: string | null = null;

	$effect(() => {
		if (!container) return;
		const el = container;
		let cancelled = false;
		void loadTurnstile().then((api) => {
			if (cancelled) return;
			widgetId = api.render(el, {
				sitekey: siteKey,
				theme: 'auto',
				language: getLocale(),
				callback: (value) => (token = value),
				'expired-callback': () => (token = ''),
				'error-callback': () => (token = '')
			});
		});
		return () => {
			cancelled = true;
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
<input type="hidden" name="turnstileToken" value={token} />

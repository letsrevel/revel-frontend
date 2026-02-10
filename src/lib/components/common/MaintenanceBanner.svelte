<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { appStore } from '$lib/stores/app.svelte';
	import { format } from 'date-fns';
	import { Bug, Info, AlertTriangle, AlertCircle, AlertOctagon, X } from 'lucide-svelte';

	let banner = $derived(appStore.banner);

	// Compute a hash-like key from the banner message for sessionStorage dismissal
	let dismissKey = $derived(banner ? `maintenance-banner-${hashString(banner.message)}` : '');

	// Track a version counter that changes when we dismiss or when dismissKey changes
	let dismissVersion = $state(0);

	// Check sessionStorage reactively when dismissKey or dismissVersion changes
	let isDismissed = $derived.by(() => {
		// Track dismissVersion to re-evaluate after dismiss()
		void dismissVersion;
		if (dismissKey && typeof sessionStorage !== 'undefined') {
			return sessionStorage.getItem(dismissKey) === '1';
		}
		return false;
	});

	let visible = $derived(banner != null && !isDismissed);

	function dismiss() {
		if (dismissKey && typeof sessionStorage !== 'undefined') {
			sessionStorage.setItem(dismissKey, '1');
		}
		dismissVersion++;
	}

	function hashString(str: string): string {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash |= 0;
		}
		return Math.abs(hash).toString(36);
	}

	function formatTime(iso: string): string {
		return format(new Date(iso), 'MMM d, yyyy HH:mm');
	}

	const severityConfig = {
		debug: {
			icon: Bug,
			classes:
				'border-gray-200 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100',
			iconClasses: 'text-gray-500 dark:text-gray-400'
		},
		info: {
			icon: Info,
			classes:
				'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100',
			iconClasses: 'text-blue-500 dark:text-blue-400'
		},
		warning: {
			icon: AlertTriangle,
			classes:
				'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100',
			iconClasses: 'text-amber-500 dark:text-amber-400'
		},
		error: {
			icon: AlertCircle,
			classes:
				'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100',
			iconClasses: 'text-red-500 dark:text-red-400'
		},
		critical: {
			icon: AlertOctagon,
			classes:
				'border-red-300 bg-red-100 text-red-900 dark:border-red-700 dark:bg-red-900 dark:text-red-100',
			iconClasses: 'animate-pulse text-red-600 dark:text-red-400'
		}
	} as const;

	let config = $derived(banner ? severityConfig[banner.severity] : severityConfig.info);
</script>

{#if visible && banner}
	{@const Icon = config.icon}
	<div
		class="sticky top-0 z-[90] border-b px-4 py-3 {config.classes}"
		role="alert"
		aria-live="assertive"
	>
		<div class="container mx-auto flex items-start gap-3 md:items-center">
			<Icon class="mt-0.5 h-5 w-5 flex-shrink-0 {config.iconClasses} md:mt-0" aria-hidden="true" />
			<div class="flex-1 text-sm">
				<p class="font-semibold">{banner.message}</p>
				{#if banner.scheduled_at || banner.ends_at}
					<p class="mt-1 text-xs opacity-80">
						{#if banner.scheduled_at}
							<span
								>{m['maintenanceBanner.scheduled']({ time: formatTime(banner.scheduled_at) })}</span
							>
						{/if}
						{#if banner.scheduled_at && banner.ends_at}
							<span class="mx-1">&middot;</span>
						{/if}
						{#if banner.ends_at}
							<span>{m['maintenanceBanner.until']({ time: formatTime(banner.ends_at) })}</span>
						{/if}
					</p>
				{/if}
			</div>
			<button
				type="button"
				onclick={dismiss}
				class="flex-shrink-0 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-current focus:ring-offset-2"
				aria-label={m['maintenanceBanner.dismiss']()}
			>
				<X class="h-4 w-4" aria-hidden="true" />
			</button>
		</div>
	</div>
{/if}

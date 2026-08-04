<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { appStore } from '$lib/stores/app.svelte';
	import { format } from 'date-fns';
	import { Bug, Info, AlertTriangle, AlertCircle, AlertOctagon, X } from '@lucide/svelte';

	const banner = $derived(appStore.banner);

	// Compute a hash-like key from the banner message for sessionStorage dismissal
	const dismissKey = $derived(banner ? `maintenance-banner-${hashString(banner.message)}` : '');

	// Track a version counter that changes when we dismiss or when dismissKey changes
	let dismissVersion = $state(0);

	// Check sessionStorage reactively when dismissKey or dismissVersion changes
	const isDismissed = $derived.by(() => {
		// Track dismissVersion to re-evaluate after dismiss()
		void dismissVersion;
		if (dismissKey && typeof sessionStorage !== 'undefined') {
			return sessionStorage.getItem(dismissKey) === '1';
		}
		return false;
	});

	const visible = $derived(banner != null && !isDismissed);

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

	// Severity → tone: debug/neutral, info/info, warning/highlight, error/danger
	// (soft), critical/danger (solid) — critical stays visually distinct from
	// error via weight of fill, not hue alone (guardrail: never encode meaning
	// by color alone). Soft pairs reuse ToneTile's audited token combos
	// (src/lib/components/common/ToneTile.svelte); the solid critical pair is
	// the StatusBadge-style audited destructive-foreground/destructive pair.
	// These classes render on the INNER wrapper below, which sits on the
	// outer sticky element's opaque bg-background — so every ratio computed
	// against --background in this file's history is now literally true, not
	// an assumption (the banner is `sticky top-0` and would otherwise
	// composite over whatever page content has scrolled underneath it).
	const severityConfig = {
		debug: {
			icon: Bug,
			classes: 'border-border bg-muted text-muted-foreground',
			iconClasses: 'text-muted-foreground'
		},
		info: {
			icon: Info,
			classes: 'border-info/30 bg-info/10 text-info',
			iconClasses: 'text-info'
		},
		warning: {
			icon: AlertTriangle,
			classes: 'border-highlight/40 bg-highlight/20 text-highlight-foreground dark:text-highlight',
			iconClasses: 'text-highlight-foreground dark:text-highlight'
		},
		error: {
			icon: AlertCircle,
			classes: 'border-destructive/30 bg-destructive/10 text-destructive dark:bg-destructive/25',
			iconClasses: 'text-destructive'
		},
		critical: {
			icon: AlertOctagon,
			classes: 'border-destructive bg-destructive text-destructive-foreground',
			iconClasses: 'animate-pulse text-destructive-foreground'
		}
	} as const;

	const config = $derived(banner ? severityConfig[banner.severity] : severityConfig.info);
</script>

{#if visible && banner}
	{@const Icon = config.icon}
	<!-- Opaque outer + tinted inner — see the severityConfig comment above. -->
	<div class="sticky top-0 z-[90] bg-background" role="alert" aria-live="assertive">
		<div class="border-b px-4 py-3 {config.classes}">
			<div class="container mx-auto flex items-start gap-3 md:items-center">
				<Icon
					class="mt-0.5 h-5 w-5 flex-shrink-0 {config.iconClasses} md:mt-0"
					aria-hidden="true"
				/>
				<div class="flex-1 text-sm">
					<p class="font-semibold">{banner.message}</p>
					{#if banner.scheduled_at || banner.ends_at}
						<p class="mt-1 text-xs opacity-90">
							{#if banner.scheduled_at}
								<span
									>{m['maintenanceBanner.scheduled']({
										time: formatTime(banner.scheduled_at)
									})}</span
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
	</div>
{/if}

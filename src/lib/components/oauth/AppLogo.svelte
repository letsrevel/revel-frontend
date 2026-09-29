<script lang="ts">
	import { cn } from '$lib/utils';

	interface Props {
		name: string;
		logoUrl: string | null;
		size?: 'sm' | 'lg';
		class?: string;
	}
	const { name, logoUrl, size = 'sm', class: className = '' }: Props = $props();

	// `logo_url` is a signed, expiring URL on the API origin: a 404 after the
	// signature lapses (or a CSP block on a misconfigured instance) must not
	// leave a broken image next to the app's name.
	// Keyed on the URL that failed, not a boolean: `logo_url` is a signed,
	// expiring URL, so a card that outlives a refetch (Connected apps,
	// Developer apps) gets a fresh URL and must try it instead of staying on
	// the initial chip until remount.
	let failedUrl = $state<string | null>(null);
	const showImage = $derived(Boolean(logoUrl) && logoUrl !== failedUrl);
	const initial = $derived((name.trim().charAt(0) || '?').toUpperCase());
	const sizeClasses = $derived(size === 'lg' ? 'h-16 w-16 text-2xl' : 'h-10 w-10 text-base');
</script>

{#if showImage}
	<img
		src={logoUrl}
		alt=""
		loading="lazy"
		onerror={() => (failedUrl = logoUrl)}
		class={cn('shrink-0 rounded-xl bg-muted object-cover', sizeClasses, className)}
	/>
{:else}
	<!-- Same audited pair as ToneTile's brand tone (bg-primary/10 text-primary). -->
	<span
		aria-hidden="true"
		class={cn(
			'flex shrink-0 select-none items-center justify-center rounded-xl bg-primary/10 font-bold text-primary',
			sizeClasses,
			className
		)}
	>
		{initial}
	</span>
{/if}

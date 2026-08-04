<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import type { EventSeriesRetrieveSchema } from '$lib/api/generated/types.gen';
	import { cn } from '$lib/utils/cn';
	import { getImageUrl } from '$lib/utils/url';
	import { Calendar, Tag, Users } from '@lucide/svelte';
	import { getPosterFallbackGradient } from '$lib/utils/fallback-gradient';

	interface Props {
		series: EventSeriesRetrieveSchema;
		variant?: 'compact' | 'standard';
		class?: string;
		/** Lean mode for the `/embed` surface (#689): no in-app preloading. */
		lean?: boolean;
		/** Override the destination with an absolute, UTM-tagged URL. */
		href?: string;
		/** Link target. Embeds use `_blank` so the host page is never replaced. */
		target?: '_blank' | null;
	}

	const {
		series,
		variant = 'standard',
		class: className,
		lean = false,
		href,
		target = null
	}: Props = $props();

	const cardHref = $derived(
		href ??
			resolve('/(public)/events/[org_slug]/series/[series_slug]', {
				org_slug: series.organization.slug,
				series_slug: series.slug
			})
	);

	// Image state
	let imageError = $state(false);

	// Image URLs with backend URL prepended and fallback to organization
	// Prefer social preview for card display (1200x630, matches aspect-video ratio)
	const seriesCoverArtSocialUrl = $derived(getImageUrl(series.cover_art_social_url));
	const seriesCoverArtUrl = $derived(getImageUrl(series.cover_art));
	const orgCoverArtSocialUrl = $derived(getImageUrl(series.organization.cover_art_social_url));
	const orgCoverArtUrl = $derived(getImageUrl(series.organization.cover_art));
	const imageUrl = $derived(
		!imageError
			? seriesCoverArtSocialUrl || seriesCoverArtUrl || orgCoverArtSocialUrl || orgCoverArtUrl
			: null
	);

	const seriesLogoThumbnailUrl = $derived(getImageUrl(series.logo_thumbnail_url));
	const seriesLogoUrl = $derived(getImageUrl(series.logo));
	const orgLogoThumbnailUrl = $derived(getImageUrl(series.organization.logo_thumbnail_url));
	const orgLogoUrl = $derived(getImageUrl(series.organization.logo));
	const logoUrl = $derived(
		seriesLogoThumbnailUrl || seriesLogoUrl || orgLogoThumbnailUrl || orgLogoUrl
	);

	// Fallback gradient based on series ID — shared poster ramp, so a series, its
	// organization and its events fall back to the same visual family.
	const fallbackGradient = $derived(getPosterFallbackGradient(series.id));

	// Accessible card label for screen readers
	const accessibleLabel = $derived.by(() => {
		const parts = [
			series.name,
			m['eventSeriesCard.byOrganization']({ name: series.organization.name })
		];
		if (series.description) {
			parts.push(series.description);
		}
		return parts.join(', ');
	});

	function handleImageError(): void {
		imageError = true;
	}

	// Container classes based on variant
	const containerClasses = $derived(
		cn(
			'group relative overflow-hidden rounded-lg border-2 bg-card shadow-poster transition-transform',
			// Same silhouette and lift on all three discovery cards (event / series /
			// organization) — see EventCard for why it is spelled out by hand.
			// `transition-transform`, not `transition-all`: the ring below is a
			// box-shadow, and transitioning box-shadow would fade it in on focus.
			// Scoping to transform keeps the hover lift and makes the ring instant
			// (the shadow swap snaps, which is imperceptible next to the lift).
			'hover:-translate-y-1 hover:shadow-poster-lg focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
			variant === 'compact' && 'flex flex-row md:flex-col',
			variant === 'standard' && 'flex flex-col',
			className
		)
	);

	// Image container classes based on variant
	const imageContainerClasses = $derived(
		cn(
			'relative overflow-hidden',
			variant === 'compact' && 'w-32 shrink-0 md:w-full md:aspect-video',
			variant === 'standard' && 'aspect-video'
		)
	);
</script>

<article class={containerClasses}>
	<!-- Clickable overlay link for accessibility -->
	<!--
		`cardHref` is resolve()d by default; the optional `href` prop replaces it
		with an absolute, UTM-tagged URL for embeds, which resolve() cannot
		express. Scoped to this element so the rule still guards the rest of the file.
	-->
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	<a
		href={cardHref}
		target={target ?? undefined}
		rel={target === '_blank' ? 'noopener' : undefined}
		data-sveltekit-preload-data={lean ? undefined : 'hover'}
		class="absolute inset-0 z-10"
		aria-label={accessibleLabel}
	>
		<span class="sr-only">{m['eventSeriesCard.viewDetails']()}</span>
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->

	<!-- Cover Image -->
	<div class={imageContainerClasses}>
		{#if imageUrl}
			<img
				src={imageUrl}
				alt=""
				class="h-full w-full object-cover transition-transform group-hover:scale-105"
				loading="lazy"
				onerror={handleImageError}
			/>
		{:else}
			<!-- Fallback gradient with logo -->
			<div class={cn('h-full w-full bg-gradient-to-br', fallbackGradient)}>
				{#if logoUrl}
					<div class="flex h-full w-full items-center justify-center p-8">
						<img
							src={logoUrl}
							alt=""
							class="max-h-full max-w-full object-contain opacity-90"
							loading="lazy"
						/>
					</div>
				{:else}
					<!-- Ultimate fallback: Users icon -->
					<div class="flex h-full w-full items-center justify-center">
						<Users class="h-16 w-16 text-poster-white/60" aria-hidden="true" />
					</div>
				{/if}
			</div>
		{/if}

		<!-- Series indicator badge (top-right) -->
		<div class="absolute right-2 top-2 z-20">
			<div
				class="rounded-full bg-background/90 px-2 py-1 text-xs font-bold backdrop-blur-sm"
				aria-label={m['eventSeriesCard.eventSeries']()}
			>
				<div class="flex items-center gap-1">
					<Calendar class="h-3 w-3" aria-hidden="true" />
					<span>{m['eventSeriesCard.series']()}</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Card Content -->
	<div
		class={cn(
			'flex flex-1 flex-col gap-3 p-4',
			variant === 'compact' && 'justify-center gap-1.5 md:gap-3'
		)}
	>
		<!-- Series Name & Organization -->
		<div class="space-y-1">
			<h3
				class={cn(
					'line-clamp-2 font-bold leading-tight',
					variant === 'compact' ? 'text-base md:text-lg' : 'text-lg'
				)}
			>
				{series.name}
			</h3>
			<p
				class={cn(
					'text-muted-foreground',
					variant === 'compact' ? 'text-xs md:text-sm' : 'text-sm'
				)}
			>
				{series.organization.name}
			</p>
		</div>

		<!-- Series Details -->
		{#if variant === 'standard'}
			<div class="flex flex-col gap-2 border-t pt-3">
				<!-- Description -->
				{#if series.description}
					<p class="line-clamp-2 text-sm text-muted-foreground">
						{series.description}
					</p>
				{/if}

				<!-- Tags (if available) -->
				{#if series.tags && series.tags.length > 0}
					<div class="flex items-start gap-2 text-sm">
						<Tag class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
						<div class="flex flex-wrap gap-1">
							<!-- Tag chips: primary on a 10% primary tint. The tint composites
							     to ~the card colour, so primary-vs-card governs — 5.9:1 light /
							     5.3:1 dark (hand-recomputed; a composited alpha is invisible to
							     scripts/audit-brand-themes.py). -->
							{#each series.tags.slice(0, 3) as tag (tag)}
								<span
									class="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary"
								>
									{tag}
								</span>
							{/each}
							{#if series.tags.length > 3}
								<span class="inline-block px-2 py-0.5 text-xs text-muted-foreground">
									{m['eventSeriesCard.moreTags']({ count: series.tags.length - 3 })}
								</span>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</article>

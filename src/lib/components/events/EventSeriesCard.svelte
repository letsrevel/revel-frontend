<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { EventSeriesRetrieveSchema } from '$lib/api/generated/types.gen';
	import { cn } from '$lib/utils/cn';
	import { getImageUrl } from '$lib/utils/url';
	import { Calendar, Tag, Users } from 'lucide-svelte';

	interface Props {
		series: EventSeriesRetrieveSchema;
		variant?: 'compact' | 'standard';
		class?: string;
	}

	let { series, variant = 'standard', class: className }: Props = $props();

	// Image state
	let imageError = $state(false);

	// Image URLs with backend URL prepended and fallback to organization
	let seriesCoverArtUrl = $derived(getImageUrl(series.cover_art));
	let orgCoverArtUrl = $derived(getImageUrl(series.organization.cover_art));
	let imageUrl = $derived(!imageError ? seriesCoverArtUrl || orgCoverArtUrl : null);
	let seriesLogoUrl = $derived(getImageUrl(series.logo));
	let orgLogoUrl = $derived(getImageUrl(series.organization.logo));
	let logoUrl = $derived(seriesLogoUrl || orgLogoUrl);

	// Fallback gradient based on series ID
	const gradients = [
		'from-blue-500 to-purple-600',
		'from-green-500 to-teal-600',
		'from-orange-500 to-pink-600',
		'from-purple-500 to-indigo-600',
		'from-red-500 to-orange-600'
	];
	let fallbackGradient = $derived(gradients[series.id.charCodeAt(0) % gradients.length]);

	// Accessible card label for screen readers
	let accessibleLabel = $derived.by(() => {
		const parts = [series.name, `by ${series.organization.name}`];
		if (series.description) {
			parts.push(series.description);
		}
		return parts.join(', ');
	});

	function handleImageError(): void {
		imageError = true;
	}

	// Container classes based on variant
	let containerClasses = $derived(
		cn(
			'group relative overflow-hidden rounded-lg border bg-card transition-all',
			'hover:shadow-lg focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
			variant === 'compact' && 'flex flex-row md:flex-col',
			variant === 'standard' && 'flex flex-col',
			className
		)
	);

	// Image container classes based on variant
	let imageContainerClasses = $derived(
		cn(
			'relative overflow-hidden',
			variant === 'compact' && 'w-32 shrink-0 md:w-full md:aspect-video',
			variant === 'standard' && 'aspect-video'
		)
	);
</script>

<article class={containerClasses}>
	<!-- Clickable overlay link for accessibility -->
	<a
		href="/events/{series.organization.slug}/series/{series.slug}"
		data-sveltekit-preload-data="hover"
		class="absolute inset-0 z-10"
		aria-label={accessibleLabel}
	>
		<span class="sr-only">{m['eventSeriesCard.viewDetails']()}</span>
	</a>

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
						<Users class="h-16 w-16 text-white opacity-50" aria-hidden="true" />
					</div>
				{/if}
			</div>
		{/if}

		<!-- Series indicator badge (top-right) -->
		<div class="absolute right-2 top-2 z-20">
			<div
				class="rounded-full bg-background/90 px-2 py-1 text-xs font-medium backdrop-blur-sm"
				aria-label="Event Series"
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
					'line-clamp-2 font-semibold leading-tight',
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
							{#each series.tags.slice(0, 3) as tag}
								<span
									class="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
								>
									{tag}
								</span>
							{/each}
							{#if series.tags.length > 3}
								<span class="inline-block px-2 py-0.5 text-xs text-muted-foreground">
									+{series.tags.length - 3} more
								</span>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</article>

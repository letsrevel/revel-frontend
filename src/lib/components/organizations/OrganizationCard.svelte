<script lang="ts">
	import type { OrganizationRetrieveSchema } from '$lib/api/generated/types.gen';
	import { cn } from '$lib/utils/cn';
	import { getImageUrl } from '$lib/utils/url';
	import { stripHtml } from '$lib/utils/seo';
	import { MapPin, Users, Tag } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		organization: OrganizationRetrieveSchema;
		variant?: 'compact' | 'standard';
		class?: string;
	}

	let { organization, variant = 'standard', class: className }: Props = $props();

	// Image state
	let imageError = $state(false);

	// Computed values
	let locationDisplay = $derived.by(() => {
		if (!organization.city) return m['organizationProfile.location_tbd']();
		return organization.city.country
			? `${organization.city.name}, ${organization.city.country}`
			: organization.city.name;
	});

	// Image URLs with backend URL prepended
	let coverArtUrl = $derived(getImageUrl(organization.cover_art));
	let logoUrl = $derived(getImageUrl(organization.logo));
	let imageUrl = $derived(!imageError ? coverArtUrl : null);

	// Fallback gradient based on organization ID
	const gradients = [
		'from-blue-500 to-purple-600',
		'from-green-500 to-teal-600',
		'from-orange-500 to-pink-600',
		'from-purple-500 to-indigo-600',
		'from-red-500 to-orange-600'
	];
	let fallbackGradient = $derived(gradients[organization.id.charCodeAt(0) % gradients.length]);

	// Get clean description text (strip HTML if description_html exists, otherwise use description)
	let descriptionText = $derived(
		organization.description_html
			? stripHtml(organization.description_html)
			: organization.description || ''
	);

	// Accessible card label for screen readers
	let accessibleLabel = $derived.by(() => {
		const parts = [organization.name, locationDisplay];
		if (descriptionText) {
			parts.push(descriptionText);
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
		href="/org/{organization.slug}"
		data-sveltekit-preload-data="hover"
		class="absolute inset-0 z-10"
		aria-label={accessibleLabel}
	>
		<span class="sr-only">{m['organizationProfile.viewDetails']()}</span>
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
			<!-- Fallback gradient with organization logo -->
			<div class={cn('h-full w-full bg-gradient-to-br', fallbackGradient)}>
				{#if logoUrl}
					<div class="flex h-full w-full items-center justify-center p-4">
						<!-- Square container for logo -->
						<div
							class="aspect-square w-full max-w-[60%] overflow-hidden rounded-lg bg-white/10 p-4 backdrop-blur-sm"
						>
							<img
								src={logoUrl}
								alt=""
								class="h-full w-full object-contain opacity-90"
								loading="lazy"
							/>
						</div>
					</div>
				{:else}
					<!-- Ultimate fallback: Building icon -->
					<div class="flex h-full w-full items-center justify-center">
						<Users class="h-16 w-16 text-white opacity-50" aria-hidden="true" />
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Card Content -->
	<div
		class={cn(
			'flex flex-1 flex-col gap-3 p-4',
			variant === 'compact' && 'justify-center gap-1.5 md:gap-3'
		)}
	>
		<!-- Organization Name -->
		<div class="space-y-1">
			<h3
				class={cn(
					'line-clamp-2 font-semibold leading-tight',
					variant === 'compact' ? 'text-base md:text-lg' : 'text-lg'
				)}
			>
				{organization.name}
			</h3>
			{#if descriptionText && variant === 'standard'}
				<p class="line-clamp-2 text-sm text-muted-foreground">
					{descriptionText}
				</p>
			{/if}
		</div>

		<!-- Organization Details -->
		<div
			class={cn(
				'flex flex-col gap-2 border-t pt-3',
				variant === 'compact' && 'gap-1.5 border-t-0 pt-0 md:border-t md:pt-3'
			)}
		>
			<!-- Location -->
			<div class="flex items-center gap-2 text-sm">
				<MapPin class="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
				<span class="truncate">{locationDisplay}</span>
			</div>

			<!-- Tags (if available) -->
			{#if organization.tags && organization.tags.length > 0 && variant === 'standard'}
				<div class="flex items-start gap-2 text-sm">
					<Tag class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
					<div class="flex flex-wrap gap-1">
						{#each organization.tags.slice(0, 3) as tag}
							<span
								class="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
							>
								{tag}
							</span>
						{/each}
						{#if organization.tags.length > 3}
							<span class="inline-block px-2 py-0.5 text-xs text-muted-foreground">
								+{organization.tags.length - 3}
								{m['common.text_more']()}
							</span>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>
</article>

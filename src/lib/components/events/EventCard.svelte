<script lang="ts">
	import { resolve } from '$app/paths';
	import type { EventInListSchema } from '$lib/api/generated/types.gen';
	import type { UserEventStatus } from './types';
	import { cn } from '$lib/utils/cn';
	import { formatEventDate, formatEventDateForScreenReader, isEventPast } from '$lib/utils/date';
	import { getEventAccessDisplay } from '$lib/utils/event';
	import { formatPrice } from '$lib/utils/format';
	import { Calendar, MapPin, Ticket, Tag } from '@lucide/svelte';
	import BookmarkButton from './BookmarkButton.svelte';
	import EventCoverImage from './EventCoverImage.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { navigating } from '$app/stores';

	interface Props {
		event: EventInListSchema;
		variant?: 'compact' | 'standard';
		userStatus?: UserEventStatus | null;
		class?: string;
		/**
		 * Lean mode (used by the `/embed` surface, #689): drops the bookmark
		 * button and the in-app navigation overlay. Both assume an authenticated,
		 * client-side-routed app, neither of which exists inside a third-party
		 * iframe that renders with `csr = false`.
		 */
		lean?: boolean;
		/**
		 * Override the card's destination. Embeds link out with an absolute,
		 * UTM-tagged URL instead of an in-app route.
		 */
		href?: string;
		/** Link target. Embeds use `_blank` so the host page is never replaced. */
		target?: '_blank' | null;
		/** Optional entry-price hint, rendered as "from €X". */
		priceFrom?: { amount: number; currency: string } | null;
	}

	const {
		event,
		variant = 'standard',
		userStatus = null,
		class: className,
		lean = false,
		href,
		target = null,
		priceFrom = null
	}: Props = $props();

	// Computed values
	const formattedDate = $derived(formatEventDate(event.start, event.timezone));
	const screenReaderDate = $derived(formatEventDateForScreenReader(event.start, event.timezone));
	const locationDisplay = $derived.by(() => {
		// If event has a venue, use venue's name and city
		if (event.venue) {
			const city = event.venue.city || event.city;
			if (city) {
				const cityDisplay = city.country ? `${city.name}, ${city.country}` : city.name;
				return `${event.venue.name}, ${cityDisplay}`;
			}
			return event.venue.name;
		}

		// Fall back to event's city
		if (!event.city) return m['eventCard.location_tbd']();
		return event.city.country ? `${event.city.name}, ${event.city.country}` : event.city.name;
	});
	const accessDisplay = $derived(
		getEventAccessDisplay(event, false, false) // TODO: Pass actual user membership status
	);
	const isPast = $derived(isEventPast(event.end));

	// Accessible card label for screen readers
	const accessibleLabel = $derived.by(() => {
		const parts = [
			event.name,
			`by ${event.organization.name}`,
			screenReaderDate,
			locationDisplay,
			accessDisplay
		];
		return parts.join(', ');
	});

	// Check if we're currently navigating to this card's event. Lean cards never
	// navigate in-app (they open an absolute URL in a new tab), so the overlay —
	// and the store it depends on — is skipped entirely.
	const eventUrl = $derived(`/events/${event.organization.slug}/${event.slug}`);
	const isNavigating = $derived(
		!lean && $navigating !== null && $navigating.to?.url.pathname === eventUrl
	);

	const cardHref = $derived(
		href ??
			resolve('/(public)/events/[org_slug]/[event_slug]', {
				org_slug: event.organization.slug,
				event_slug: event.slug
			})
	);

	// "from €12" / "Free". Formatting stays in the component so it follows the
	// active UI language (see CLAUDE.md "Date & Time Formatting").
	const priceLabel = $derived.by(() => {
		if (!priceFrom) return null;
		if (priceFrom.amount === 0) return m['embed.free']();
		return m['embed.priceFrom']({
			price: formatPrice(priceFrom.amount, priceFrom.currency, m['embed.free']())
		});
	});

	// Container classes based on variant
	const containerClasses = $derived(
		cn(
			'group relative overflow-hidden rounded-lg border-2 bg-card shadow-poster transition-transform',
			// Same silhouette and lift on all three discovery cards (event / series /
			// organization): the thick edge + poster float that `ui/card` took
			// globally in the uplift, applied by hand because these are bare
			// `<article>`s rather than the Card primitive. The float is the point —
			// discovery pages now sit on a tinted panel, so a card has to read as a
			// white sticker ON it, not a rectangle cut out of it.
			// `transition-transform`, not `transition-all`: the ring below is a
			// box-shadow, and transitioning box-shadow would fade it in on focus.
			// Scoping to transform keeps the hover lift and makes the ring instant
			// (the shadow swap snaps, which is imperceptible next to the lift).
			'hover:-translate-y-1 hover:shadow-poster-lg focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
			variant === 'compact' && 'flex flex-row md:flex-col',
			variant === 'standard' && 'flex flex-col',
			isPast && 'opacity-75',
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
		<span class="sr-only">{m['eventCard.viewDetails']()}</span>
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->

	{#if !lean}
		<!-- Bookmarked indicator: shows top-left only when bookmarked (badges live top-right);
		     authenticated-only and clickable to remove the bookmark. -->
		<BookmarkButton
			eventId={event.id}
			isBookmarked={event.is_bookmarked ?? false}
			variant="float"
			onlyWhenBookmarked
			class="absolute left-2 top-2 z-20"
		/>
	{/if}

	<!-- Skeleton loader overlay when navigating -->
	{#if isNavigating}
		<div
			class="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm"
			role="status"
			aria-live="polite"
		>
			<div class="flex flex-col items-center gap-2">
				<div
					class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
					aria-hidden="true"
				></div>
				<span class="text-sm text-muted-foreground">{m['eventCard.loading']()}</span>
			</div>
		</div>
	{/if}

	<!-- Cover Image -->
	<EventCoverImage {event} {userStatus} class={imageContainerClasses} />

	<!-- Card Content -->
	<div
		class={cn(
			'flex flex-1 flex-col gap-3 p-4',
			variant === 'compact' && 'justify-center gap-1.5 md:gap-3'
		)}
	>
		<!-- Event Name & Organization -->
		<div class="space-y-1">
			<h3
				class={cn(
					'line-clamp-2 font-bold leading-tight',
					variant === 'compact' ? 'text-base md:text-lg' : 'text-lg'
				)}
			>
				{event.name}
			</h3>
			<p
				class={cn(
					'text-muted-foreground',
					variant === 'compact' ? 'text-xs md:text-sm' : 'text-sm'
				)}
			>
				{event.organization.name}
			</p>
		</div>

		<!-- Event Details -->
		<div
			class={cn(
				'flex flex-col gap-2 border-t pt-3',
				variant === 'compact' && 'gap-1.5 border-t-0 pt-0 md:border-t md:pt-3'
			)}
		>
			<!-- Date & Time. <time datetime> so the machine-readable instant survives
			     on list surfaces too (crawlers, structured data) — the visible text
			     stays the localized, event-timezone rendering. -->
			<div class="flex items-center gap-2 text-sm">
				<Calendar class="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
				<time datetime={event.start} class="truncate">{formattedDate}</time>
			</div>

			<!-- Location -->
			<div class="flex items-center gap-2 text-sm">
				<MapPin class="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
				<span class="truncate">{locationDisplay}</span>
			</div>

			<!-- Entry price ("from €X"), when the caller supplied one -->
			{#if priceLabel}
				<div class="flex items-center gap-2 text-sm">
					<Ticket class="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
					<span class="truncate font-medium">{priceLabel}</span>
				</div>
			{/if}

			{#if variant === 'standard'}
				<!-- Access Type (only in standard variant; superseded by the price row) -->
				{#if !priceLabel}
					<div class="flex items-center gap-2 text-sm">
						<Ticket class="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
						<span class="truncate">{accessDisplay}</span>
					</div>
				{/if}

				<!-- Tags (if available) -->
				{#if event.tags && event.tags.length > 0}
					<div class="flex items-start gap-2 text-sm">
						<Tag class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
						<div class="flex flex-wrap gap-1">
							<!-- Tag chips: primary on a 10% primary tint. The tint composites
							     to ~the card colour, so primary-vs-card governs — 5.9:1 light /
							     5.3:1 dark (recomputed by hand; a composited alpha is invisible
							     to scripts/audit-brand-themes.py). -->
							{#each event.tags.slice(0, 3) as tag (tag)}
								<span
									class="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary"
								>
									{tag}
								</span>
							{/each}
							{#if event.tags.length > 3}
								<span class="inline-block px-2 py-0.5 text-xs text-muted-foreground">
									+{event.tags.length - 3}
									{m['common.text_more']()}
								</span>
							{/if}
						</div>
					</div>
				{/if}
			{/if}
		</div>
	</div>
</article>

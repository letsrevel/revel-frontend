<script lang="ts">
	import type { EventFilters as FilterState } from '$lib/utils/filters';
	import { countActiveFilters, hasActiveFilters } from '$lib/utils/filters';
	import { cn } from '$lib/utils/cn';
	import { Filter, X } from 'lucide-svelte';
	import SearchInput from './SearchInput.svelte';
	import DateFilter from './DateFilter.svelte';
	import TagsFilter from './TagsFilter.svelte';
	import EventTypeFilter from './EventTypeFilter.svelte';
	import CityFilter from './CityFilter.svelte';
	import OrganizationFilter from './OrganizationFilter.svelte';
	import OrderByFilter from './OrderByFilter.svelte';

	interface Props {
		filters: FilterState;
		totalCount: number;
		isOpen: boolean;
		onUpdateFilters: (updates: Partial<FilterState>) => void;
		onClearFilters: () => void;
		onClose: () => void;
		class?: string;
	}

	let {
		filters,
		totalCount,
		isOpen,
		onUpdateFilters,
		onClearFilters,
		onClose,
		class: className
	}: Props = $props();

	// Computed values
	let activeFilterCount = $derived(countActiveFilters(filters));
	let hasFilters = $derived(hasActiveFilters(filters));

	// Swipe gesture state
	let touchStartY = $state(0);
	let touchCurrentY = $state(0);
	let isDragging = $state(false);
	let translateY = $derived(isDragging ? Math.max(0, touchCurrentY - touchStartY) : 0);

	function handleSearch(value: string): void {
		onUpdateFilters({ search: value || undefined });
	}

	function handleTogglePast(value: boolean): void {
		onUpdateFilters({ includePast: value });
	}

	function handleToggleTag(tag: string): void {
		const currentTags = filters.tags || [];
		const newTags = currentTags.includes(tag)
			? currentTags.filter((t) => t !== tag)
			: [...currentTags, tag];
		onUpdateFilters({ tags: newTags.length > 0 ? newTags : undefined });
	}

	function handleChangeEventType(type: FilterState['eventType']): void {
		onUpdateFilters({ eventType: type });
	}

	function handleChangeCity(city: { id: number; name: string; country: string } | null): void {
		onUpdateFilters({ cityId: city?.id });
	}

	function handleChangeOrganization(org: { id: string; name: string; slug: string } | null): void {
		if (org) {
			onUpdateFilters({
				organizationId: org.id,
				organizationName: org.name,
				organizationSlug: org.slug
			});
		} else {
			onUpdateFilters({
				organizationId: undefined,
				organizationName: undefined,
				organizationSlug: undefined
			});
		}
	}

	function handleChangeOrderBy(orderBy: FilterState['orderBy']): void {
		onUpdateFilters({ orderBy });
	}

	// Derive selected city object from cityId
	let selectedCity = $derived.by(() => {
		if (!filters.cityId) return null;
		return null;
	});

	// Derive selected organization object from filters
	let selectedOrganization = $derived.by(() => {
		if (!filters.organizationId) return null;
		// Use stored name and slug from URL params if available
		return {
			id: filters.organizationId,
			name: filters.organizationName || 'Unknown Organization',
			slug: filters.organizationSlug || 'unknown'
		};
	});

	function handleApply(): void {
		onClose();
	}

	// Swipe gesture handlers
	function handleTouchStart(e: TouchEvent): void {
		if ((e.target as HTMLElement).closest('.overflow-y-auto')) {
			// Only handle swipes on the sheet itself, not on scrollable content at scroll position 0
			const scrollableElement = (e.target as HTMLElement).closest('.overflow-y-auto');
			if (scrollableElement && scrollableElement.scrollTop > 0) {
				return; // Allow normal scrolling
			}
		}

		touchStartY = e.touches[0].clientY;
		touchCurrentY = e.touches[0].clientY;
		isDragging = true;
	}

	function handleTouchMove(e: TouchEvent): void {
		if (!isDragging) return;

		touchCurrentY = e.touches[0].clientY;
		const diff = touchCurrentY - touchStartY;

		// Only prevent default if swiping down
		if (diff > 0) {
			e.preventDefault();
		}
	}

	function handleTouchEnd(): void {
		if (!isDragging) {
			return;
		}

		const swipeDistance = touchCurrentY - touchStartY;
		const SWIPE_THRESHOLD = 100; // 100px swipe to close

		if (swipeDistance > SWIPE_THRESHOLD) {
			onClose();
		}

		// Reset state
		isDragging = false;
		touchStartY = 0;
		touchCurrentY = 0;
	}

	// Trap focus when sheet is open
	$effect(() => {
		if (isOpen) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}

		return () => {
			document.body.style.overflow = '';
		};
	});

	// Close on Escape key
	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape' && isOpen) {
			onClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden"
		onclick={onClose}
		role="presentation"
		aria-hidden="true"
	></div>

	<!-- Sheet -->
	<div
		class={cn(
			'mobile-sheet fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl border-t bg-background shadow-2xl lg:hidden',
			!isDragging && 'transition-transform',
			className
		)}
		style="transform: translateY({translateY}px)"
		role="dialog"
		aria-modal="true"
		aria-labelledby="mobile-filter-title"
		ontouchstart={handleTouchStart}
		ontouchmove={handleTouchMove}
		ontouchend={handleTouchEnd}
	>
		<!-- Handle (swipe indicator) -->
		<div class="flex cursor-grab justify-center py-3 active:cursor-grabbing">
			<div class="h-1.5 w-12 rounded-full bg-muted" aria-hidden="true"></div>
		</div>

		<!-- Header -->
		<div class="flex items-center justify-between border-b px-6 pb-4">
			<div class="flex items-center gap-2">
				<Filter class="h-5 w-5 text-muted-foreground" aria-hidden="true" />
				<h2 id="mobile-filter-title" class="text-lg font-semibold">Filters</h2>
				{#if activeFilterCount > 0}
					<span
						class="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground"
						aria-label="{activeFilterCount} active filters"
					>
						{activeFilterCount}
					</span>
				{/if}
			</div>

			<button
				type="button"
				onclick={onClose}
				class="rounded-sm p-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				aria-label="Close filters"
			>
				<X class="h-5 w-5" aria-hidden="true" />
			</button>
		</div>

		<!-- Scrollable filter content -->
		<div class="flex-1 overflow-y-auto overscroll-contain px-6 py-4">
			<div class="space-y-6">
				<!-- Order By Filter (Top Priority) -->
				<OrderByFilter
					orderBy={filters.orderBy ?? 'distance'}
					onChangeOrderBy={handleChangeOrderBy}
				/>

				<!-- Divider -->
				<div class="border-t" role="separator"></div>

				<!-- Search Input -->
				<div class="space-y-2">
					<label for="mobile-event-search" class="text-sm font-medium">Search</label>
					<SearchInput
						value={filters.search ?? ''}
						onSearch={handleSearch}
						placeholder="Search events..."
					/>
				</div>

				<!-- Divider -->
				<div class="border-t" role="separator"></div>

				<!-- Date Filter -->
				<DateFilter includePast={filters.includePast ?? false} onTogglePast={handleTogglePast} />

				<!-- Divider -->
				<div class="border-t" role="separator"></div>

				<!-- City Filter -->
				<CityFilter {selectedCity} onChangeCity={handleChangeCity} />

				<!-- Divider -->
				<div class="border-t" role="separator"></div>

				<!-- Organization Filter -->
				<OrganizationFilter
					{selectedOrganization}
					onChangeOrganization={handleChangeOrganization}
				/>

				<!-- Divider -->
				<div class="border-t" role="separator"></div>

				<!-- Event Type Filter -->
				<EventTypeFilter eventType={filters.eventType} onChangeEventType={handleChangeEventType} />

				<!-- Divider -->
				<div class="border-t" role="separator"></div>

				<!-- Tags Filter -->
				<TagsFilter selectedTags={filters.tags ?? []} onToggleTag={handleToggleTag} />

				<!-- Future filters: Organization, Visibility -->
			</div>
		</div>

		<!-- Sticky Footer -->
		<div class="mobile-sheet-footer border-t bg-background p-4">
			<div class="flex flex-col gap-3">
				{#if hasFilters}
					<button
						type="button"
						onclick={onClearFilters}
						class="flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						<X class="h-4 w-4" aria-hidden="true" />
						Clear all filters
					</button>
				{/if}

				<button
					type="button"
					onclick={handleApply}
					class="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					Show {totalCount}
					{totalCount === 1 ? 'event' : 'events'}
				</button>
			</div>
		</div>
	</div>
{/if}

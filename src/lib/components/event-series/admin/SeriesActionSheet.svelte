<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Pause, Play, Settings, FileText, Repeat, CalendarX, RefreshCw, X } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		isOpen: boolean;
		/** Shown as a paused resume toggle when true. */
		isPaused: boolean;
		/** True when the series is missing a rule or template — disables destructive actions. */
		actionsDisabled: boolean;
		/** Enables the Pause / Resume toggle independently of `actionsDisabled`. */
		pauseResumeDisabled: boolean;
		onClose: () => void;
		onSeriesSettings?: () => void;
		onEditTemplate?: () => void;
		onEditRecurrence?: () => void;
		onCancelOccurrence?: () => void;
		onGenerateNow?: () => void;
		onPauseResume?: () => void;
	}

	const {
		isOpen,
		isPaused,
		actionsDisabled,
		pauseResumeDisabled,
		onClose,
		onSeriesSettings,
		onEditTemplate,
		onEditRecurrence,
		onCancelOccurrence,
		onGenerateNow,
		onPauseResume
	}: Props = $props();

	// Swipe-to-dismiss gesture state (mirrors MobileFilterSheet).
	let touchStartY = $state(0);
	let touchCurrentY = $state(0);
	let isDragging = $state(false);
	const translateY = $derived(isDragging ? Math.max(0, touchCurrentY - touchStartY) : 0);

	function handleTouchStart(e: TouchEvent): void {
		const scrollable = (e.target as HTMLElement).closest('.overflow-y-auto');
		if (scrollable && scrollable.scrollTop > 0) {
			return;
		}
		touchStartY = e.touches[0].clientY;
		touchCurrentY = e.touches[0].clientY;
		isDragging = true;
	}

	function handleTouchMove(e: TouchEvent): void {
		if (!isDragging) return;
		touchCurrentY = e.touches[0].clientY;
		if (touchCurrentY - touchStartY > 0) {
			e.preventDefault();
		}
	}

	function handleTouchEnd(): void {
		if (!isDragging) return;
		const swipeDistance = touchCurrentY - touchStartY;
		const SWIPE_THRESHOLD = 100;
		if (swipeDistance > SWIPE_THRESHOLD) {
			onClose();
		}
		isDragging = false;
		touchStartY = 0;
		touchCurrentY = 0;
	}

	// Lock body scroll + restore on close.
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

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape' && isOpen) {
			onClose();
		}
	}

	// Wrap each action handler so the sheet closes after the user picks one.
	function runAndClose(handler?: () => void): void {
		handler?.();
		onClose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-40 bg-black/50 transition-opacity md:hidden"
		onclick={onClose}
		role="presentation"
		aria-hidden="true"
	></div>

	<!-- Sheet -->
	<div
		class={cn(
			'fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl border-t bg-background shadow-2xl md:hidden',
			!isDragging && 'transition-transform'
		)}
		style="transform: translateY({translateY}px)"
		role="dialog"
		aria-modal="true"
		aria-labelledby="series-action-sheet-title"
		tabindex="-1"
		data-testid="series-action-sheet"
		ontouchstart={handleTouchStart}
		ontouchmove={handleTouchMove}
		ontouchend={handleTouchEnd}
	>
		<!-- Swipe handle -->
		<div class="flex cursor-grab justify-center py-3 active:cursor-grabbing">
			<div class="h-1.5 w-12 rounded-full bg-muted" aria-hidden="true"></div>
		</div>

		<!-- Header -->
		<div class="flex items-center justify-between border-b px-6 pb-4">
			<h2 id="series-action-sheet-title" class="text-lg font-semibold">
				{m['recurringEvents.dashboard.actions.moreActions']()}
			</h2>
			<button
				type="button"
				onclick={onClose}
				class="rounded-sm p-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				aria-label={m['recurringEvents.dashboard.actions.closeSheet']()}
				data-testid="series-action-sheet-close"
			>
				<X class="h-5 w-5" aria-hidden="true" />
			</button>
		</div>

		<!-- Action list -->
		<div class="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
			<ul class="flex flex-col gap-2">
				<li>
					<button
						type="button"
						onclick={() => runAndClose(onSeriesSettings)}
						class="flex w-full items-center gap-3 rounded-md border border-input bg-background px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						data-testid="action-series-settings"
					>
						<Settings class="h-4 w-4" aria-hidden="true" />
						<span>{m['recurringEvents.dashboard.actions.seriesSettings']()}</span>
					</button>
				</li>
				<li>
					<button
						type="button"
						onclick={() => runAndClose(onEditTemplate)}
						disabled={actionsDisabled}
						class="flex w-full items-center gap-3 rounded-md border border-input bg-background px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						data-testid="action-edit-template"
					>
						<FileText class="h-4 w-4" aria-hidden="true" />
						<span>{m['recurringEvents.dashboard.actions.editTemplate']()}</span>
					</button>
				</li>
				<li>
					<button
						type="button"
						onclick={() => runAndClose(onEditRecurrence)}
						disabled={actionsDisabled}
						class="flex w-full items-center gap-3 rounded-md border border-input bg-background px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						data-testid="action-edit-recurrence"
					>
						<Repeat class="h-4 w-4" aria-hidden="true" />
						<span>{m['recurringEvents.dashboard.actions.editRecurrence']()}</span>
					</button>
				</li>
				<li>
					<button
						type="button"
						onclick={() => runAndClose(onCancelOccurrence)}
						disabled={actionsDisabled}
						class="flex w-full items-center gap-3 rounded-md border border-input bg-background px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						data-testid="action-cancel-occurrence"
					>
						<CalendarX class="h-4 w-4" aria-hidden="true" />
						<span>{m['recurringEvents.dashboard.actions.cancelOccurrence']()}</span>
					</button>
				</li>
				<li>
					<button
						type="button"
						onclick={() => runAndClose(onGenerateNow)}
						disabled={actionsDisabled}
						class="flex w-full items-center gap-3 rounded-md border border-input bg-background px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						data-testid="action-generate-now"
					>
						<RefreshCw class="h-4 w-4" aria-hidden="true" />
						<span>{m['recurringEvents.dashboard.actions.generateNow']()}</span>
					</button>
				</li>
				<li>
					<button
						type="button"
						onclick={() => runAndClose(onPauseResume)}
						disabled={pauseResumeDisabled}
						class={cn(
							'flex w-full items-center gap-3 rounded-md px-4 py-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
							isPaused
								? 'bg-primary text-primary-foreground hover:bg-primary/90'
								: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground'
						)}
						data-testid="action-pause-resume"
					>
						{#if isPaused}
							<Play class="h-4 w-4" aria-hidden="true" />
							<span>{m['recurringEvents.dashboard.actions.resume']()}</span>
						{:else}
							<Pause class="h-4 w-4" aria-hidden="true" />
							<span>{m['recurringEvents.dashboard.actions.pause']()}</span>
						{/if}
					</button>
				</li>
			</ul>
		</div>
	</div>
{/if}

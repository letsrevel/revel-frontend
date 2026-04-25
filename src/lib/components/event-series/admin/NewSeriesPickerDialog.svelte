<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { goto } from '$app/navigation';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Calendar, Repeat, ArrowRight } from 'lucide-svelte';

	interface Props {
		open: boolean;
		organizationSlug: string;
		onClose: () => void;
	}

	/* eslint-disable prefer-const -- `open` is bindable so the whole destructure must use `let`. */
	let { open = $bindable(), organizationSlug, onClose }: Props = $props();
	/* eslint-enable prefer-const */

	function pickRecurring(): void {
		onClose();
		goto(`/org/${organizationSlug}/admin/event-series/new-recurring`);
	}

	function pickEmpty(): void {
		onClose();
		goto(`/org/${organizationSlug}/admin/event-series/new`);
	}
</script>

<Dialog bind:open onOpenChange={(isOpen) => !isOpen && onClose()}>
	<DialogContent class="max-w-2xl" data-testid="new-series-picker-dialog">
		<DialogHeader>
			<DialogTitle>{m['recurringEvents.newSeriesPicker.title']()}</DialogTitle>
		</DialogHeader>

		<p class="mt-2 text-sm text-muted-foreground">
			{m['recurringEvents.newSeriesPicker.description']()}
		</p>

		<!-- Two equal-weight choice cards. Each is a full-button that navigates
		     on click; the inline arrow + hover state make the affordance obvious
		     without a redundant "Choose" button per card. Layout stacks on
		     mobile and goes side-by-side on md+. -->
		<div class="mt-6 grid gap-3 sm:grid-cols-2">
			<button
				type="button"
				onclick={pickRecurring}
				class="group flex h-full flex-col items-start gap-3 rounded-lg border border-input bg-background p-4 text-left transition-colors hover:border-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				data-testid="new-series-picker-recurring"
			>
				<div class="flex w-full items-start justify-between gap-2">
					<span
						class="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
					>
						<Repeat class="h-5 w-5" aria-hidden="true" />
					</span>
					<span
						class="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
					>
						{m['recurringEvents.newSeriesPicker.recurring.badge']()}
					</span>
				</div>
				<div class="flex-1 space-y-1.5">
					<h3 class="text-base font-semibold">
						{m['recurringEvents.newSeriesPicker.recurring.title']()}
					</h3>
					<p class="text-sm text-muted-foreground">
						{m['recurringEvents.newSeriesPicker.recurring.body']()}
					</p>
				</div>
				<span
					class="inline-flex items-center gap-1 text-sm font-medium text-primary transition-transform group-hover:translate-x-0.5"
				>
					{m['recurringEvents.newSeriesPicker.recurring.title']()}
					<ArrowRight class="h-4 w-4" aria-hidden="true" />
				</span>
			</button>

			<button
				type="button"
				onclick={pickEmpty}
				class="group flex h-full flex-col items-start gap-3 rounded-lg border border-input bg-background p-4 text-left transition-colors hover:border-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				data-testid="new-series-picker-empty"
			>
				<div class="flex w-full items-start justify-between gap-2">
					<span
						class="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground"
					>
						<Calendar class="h-5 w-5" aria-hidden="true" />
					</span>
					<span
						class="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground"
					>
						{m['recurringEvents.newSeriesPicker.empty.badge']()}
					</span>
				</div>
				<div class="flex-1 space-y-1.5">
					<h3 class="text-base font-semibold">
						{m['recurringEvents.newSeriesPicker.empty.title']()}
					</h3>
					<p class="text-sm text-muted-foreground">
						{m['recurringEvents.newSeriesPicker.empty.body']()}
					</p>
				</div>
				<span
					class="inline-flex items-center gap-1 text-sm font-medium text-foreground transition-transform group-hover:translate-x-0.5"
				>
					{m['recurringEvents.newSeriesPicker.empty.title']()}
					<ArrowRight class="h-4 w-4" aria-hidden="true" />
				</span>
			</button>
		</div>

		<div class="mt-6 flex justify-end border-t border-border pt-4">
			<Button
				type="button"
				variant="outline"
				onclick={onClose}
				data-testid="new-series-picker-cancel"
			>
				{m['recurringEvents.newSeriesPicker.cancel']()}
			</Button>
		</div>
	</DialogContent>
</Dialog>

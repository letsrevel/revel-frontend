<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Loader2, RefreshCw } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { organizationadminrecurringeventsGenerateEvents } from '$lib/api/generated/sdk.gen';
	import type {
		EventDetailSchema,
		EventSeriesRecurrenceDetailSchema
	} from '$lib/api/generated/types.gen';
	import { invalidateSeries } from '$lib/queries/event-series';
	import { formatEventDate } from '$lib/utils/date';

	interface Props {
		open: boolean;
		series: EventSeriesRecurrenceDetailSchema;
		organizationSlug: string;
		accessToken: string | null;
		onClose: () => void;
	}

	/* eslint-disable prefer-const -- `open` is bindable so the whole destructure must use `let`. */
	let { open = $bindable(), series, organizationSlug, accessToken, onClose }: Props = $props();
	/* eslint-enable prefer-const */

	const queryClient = useQueryClient();

	// `<input type="datetime-local">` stores a naive "YYYY-MM-DDTHH:mm" string.
	// We convert to a full ISO stamp (browser tz → UTC) at submit time; an empty
	// string means "use the series' default generation window" and is sent as
	// no body (the SDK treats `body: null | undefined` as a no-op override).
	let untilLocal = $state<string>('');
	let errorBanner = $state<string | null>(null);

	// Re-seed when the dialog opens so the input is blank on every re-entry;
	// neutral default + open-effect avoids the `state_referenced_locally`
	// Svelte warning (there's no prop to seed from here, but we still clear
	// stale values from a previous open).
	$effect(() => {
		if (!open) return;
		untilLocal = '';
		errorBanner = null;
	});

	// Select the authoritative "through {date}" horizon for the success toast:
	// the latest start among the freshly-generated events. The backend returns
	// them in creation order; we find the max defensively so the toast remains
	// correct even if that guarantee ever changes.
	function latestStartDisplay(events: EventDetailSchema[]): string {
		if (events.length === 0) return '';
		let latest = events[0].start;
		for (const e of events) {
			if (e.start > latest) latest = e.start;
		}
		return formatEventDate(latest);
	}

	const generateMutation = createMutation(() => ({
		mutationFn: async (): Promise<EventDetailSchema[]> => {
			if (!accessToken) throw new Error('Not authenticated');
			const body = untilLocal.trim() ? { until: new Date(untilLocal).toISOString() } : null;
			const response = await organizationadminrecurringeventsGenerateEvents({
				path: { slug: organizationSlug, series_id: series.id },
				body,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) {
				const payload = response.error as Record<string, unknown>;
				throw new Error(extractErrorMessage(payload));
			}
			return response.data ?? [];
		},
		onSuccess: async (events: EventDetailSchema[]) => {
			// Always invalidate — even a zero-event response means the backend
			// touched the horizon cursor or confirmed the series is full, and
			// `last_generated_until` on the detail surface may have moved.
			await invalidateSeries(queryClient, organizationSlug, series.id);
			if (events.length === 0) {
				toast.success(m['recurringEvents.generateNow.upToDateToast']());
			} else if (events.length === 1) {
				toast.success(
					m['recurringEvents.generateNow.successToast.one']({
						date: latestStartDisplay(events)
					})
				);
			} else {
				toast.success(
					m['recurringEvents.generateNow.successToast.other']({
						n: events.length,
						date: latestStartDisplay(events)
					})
				);
			}
			onClose();
		},
		onError: (err: Error) => {
			errorBanner = err.message || m['recurringEvents.generateNow.errorToast']();
			toast.error(errorBanner);
		}
	}));

	function extractErrorMessage(payload: Record<string, unknown>): string {
		if (typeof payload.detail === 'string') return payload.detail;
		if (payload.errors && typeof payload.errors === 'object' && !Array.isArray(payload.errors)) {
			const first = Object.values(payload.errors as Record<string, unknown>)[0];
			if (typeof first === 'string') return first;
			if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
		}
		return m['recurringEvents.generateNow.errorToast']();
	}

	function handleSubmit(): void {
		errorBanner = null;
		generateMutation.mutate();
	}

	function handleClose(): void {
		if (generateMutation.isPending) return;
		onClose();
	}
</script>

<Dialog bind:open onOpenChange={(isOpen) => !isOpen && handleClose()}>
	<DialogContent class="max-w-md" data-testid="generate-now-dialog">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				<RefreshCw class="h-5 w-5" aria-hidden="true" />
				{m['recurringEvents.generateNow.title']()}
			</DialogTitle>
		</DialogHeader>

		<p class="mt-2 text-sm text-muted-foreground">
			{m['recurringEvents.generateNow.description']()}
		</p>

		<div class="mt-4 space-y-2">
			<Label for="generate-now-until">
				{m['recurringEvents.generateNow.untilLabel']()}
			</Label>
			<Input
				id="generate-now-until"
				type="datetime-local"
				bind:value={untilLocal}
				disabled={generateMutation.isPending}
				data-testid="generate-now-until"
			/>
			<p class="text-xs text-muted-foreground">
				{m['recurringEvents.generateNow.untilHelper']({
					weeks: series.generation_window_weeks
				})}
			</p>
		</div>

		{#if errorBanner}
			<div
				class="mt-4 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
				role="alert"
				data-testid="generate-now-error"
			>
				{errorBanner}
			</div>
		{/if}

		<div
			class="mt-6 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end"
		>
			<Button
				type="button"
				variant="outline"
				onclick={handleClose}
				disabled={generateMutation.isPending}
				data-testid="generate-now-cancel"
			>
				{m['recurringEvents.generateNow.cancelButton']()}
			</Button>
			<Button
				type="button"
				onclick={handleSubmit}
				disabled={generateMutation.isPending}
				data-testid="generate-now-submit"
			>
				{#if generateMutation.isPending}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
					{m['recurringEvents.generateNow.submitting']()}
				{:else}
					{m['recurringEvents.generateNow.action']()}
				{/if}
			</Button>
		</div>
	</DialogContent>
</Dialog>

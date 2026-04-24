<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Loader2, Pause } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import {
		organizationadminrecurringeventsPauseSeries,
		organizationadminrecurringeventsResumeSeries
	} from '$lib/api/generated/sdk.gen';
	import type { EventSeriesRecurrenceDetailSchema } from '$lib/api/generated/types.gen';
	import { invalidateSeries } from '$lib/queries/event-series';

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

	// The component handles both flows through a single `open` prop:
	//  - active series + open=true  → render the confirm dialog below
	//  - paused series + open=true  → fire resume immediately (no dialog), close
	// The `resumeFiredForOpen` latch prevents the open effect from firing the
	// resume mutation twice for the same open cycle (it resets on close).
	const isPaused = $derived(series.is_active === false);
	let errorBanner = $state<string | null>(null);
	let resumeFiredForOpen = $state(false);

	$effect(() => {
		if (!open) {
			resumeFiredForOpen = false;
			errorBanner = null;
			return;
		}
		if (isPaused && !resumeFiredForOpen) {
			resumeFiredForOpen = true;
			resumeMutation.mutate();
		}
	});

	const pauseMutation = createMutation(() => ({
		mutationFn: async () => {
			if (!accessToken) throw new Error('Not authenticated');
			const response = await organizationadminrecurringeventsPauseSeries({
				path: { slug: organizationSlug, series_id: series.id },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) {
				const payload = response.error as Record<string, unknown>;
				throw new Error(extractErrorMessage(payload));
			}
			return response.data;
		},
		onSuccess: async () => {
			await invalidateSeries(queryClient, organizationSlug, series.id);
			toast.success(m['recurringEvents.pauseResume.pausedToast']());
			onClose();
		},
		onError: (err: Error) => {
			errorBanner = err.message || m['recurringEvents.pauseResume.errorToast']();
			toast.error(errorBanner);
		}
	}));

	const resumeMutation = createMutation(() => ({
		mutationFn: async () => {
			if (!accessToken) throw new Error('Not authenticated');
			const response = await organizationadminrecurringeventsResumeSeries({
				path: { slug: organizationSlug, series_id: series.id },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) {
				const payload = response.error as Record<string, unknown>;
				throw new Error(extractErrorMessage(payload));
			}
			return response.data;
		},
		onSuccess: async () => {
			await invalidateSeries(queryClient, organizationSlug, series.id);
			toast.success(m['recurringEvents.pauseResume.resumedToast']());
			onClose();
		},
		onError: (err: Error) => {
			// Resume has no dialog surface, so the toast is the only error
			// signal. We still close the (unused) dialog to reset `open`.
			toast.error(err.message || m['recurringEvents.pauseResume.errorToast']());
			onClose();
		}
	}));

	function extractErrorMessage(payload: Record<string, unknown>): string {
		if (typeof payload.detail === 'string') return payload.detail;
		if (payload.errors && typeof payload.errors === 'object' && !Array.isArray(payload.errors)) {
			const first = Object.values(payload.errors as Record<string, unknown>)[0];
			if (typeof first === 'string') return first;
			if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
		}
		return m['recurringEvents.pauseResume.errorToast']();
	}

	function handleConfirm(): void {
		errorBanner = null;
		pauseMutation.mutate();
	}

	function handleClose(): void {
		if (pauseMutation.isPending || resumeMutation.isPending) return;
		onClose();
	}
</script>

{#if !isPaused}
	<Dialog bind:open onOpenChange={(isOpen) => !isOpen && handleClose()}>
		<DialogContent class="max-w-md" data-testid="pause-resume-dialog">
			<DialogHeader>
				<DialogTitle class="flex items-center gap-2">
					<Pause class="h-5 w-5" aria-hidden="true" />
					{m['recurringEvents.pauseResume.pauseConfirm']()}
				</DialogTitle>
			</DialogHeader>

			<p class="mt-2 text-sm text-muted-foreground">
				{m['recurringEvents.pauseResume.pauseConfirmBody']()}
			</p>

			{#if errorBanner}
				<div
					class="mt-4 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
					role="alert"
					data-testid="pause-resume-error"
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
					disabled={pauseMutation.isPending}
					data-testid="pause-resume-keep"
				>
					{m['recurringEvents.pauseResume.keepActiveButton']()}
				</Button>
				<Button
					type="button"
					variant="destructive"
					onclick={handleConfirm}
					disabled={pauseMutation.isPending}
					data-testid="pause-resume-confirm"
				>
					{#if pauseMutation.isPending}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
						{m['recurringEvents.pauseResume.pausingLabel']()}
					{:else}
						{m['recurringEvents.pauseResume.pauseAction']()}
					{/if}
				</Button>
			</div>
		</DialogContent>
	</Dialog>
{/if}

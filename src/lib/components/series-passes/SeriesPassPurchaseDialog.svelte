<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import type {
		SeriesPassSchema,
		SeriesPassQuoteSchema,
		SeriesPassCheckoutResponseSchema
	} from '$lib/api/generated/types.gen';
	import { seriespassCheckoutSeriesPass } from '$lib/api';
	import { createCheckoutSession, CheckoutSessionError } from '$lib/utils/checkout-session';
	import { invalidateAfterPurchase } from '$lib/queries/series-passes';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription,
		DialogFooter
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { formatPrice } from '$lib/utils/format';
	import { toast } from 'svelte-sonner';
	import { extractErrorMessage } from '$lib/utils/errors';

	interface Props {
		pass: SeriesPassSchema;
		quote: SeriesPassQuoteSchema;
		seriesId: string;
		onClose: () => void;
	}

	const { pass, quote, seriesId, onClose }: Props = $props();

	const queryClient = useQueryClient();

	const isFree = $derived(pass.payment_method === 'free' || parseFloat(quote.price) === 0);
	const isOnline = $derived(pass.payment_method === 'online' && !isFree);

	// Two-step online checkout (#464): reserve holds the pass and returns a
	// `reservation_id`; a second idempotent call creates the Stripe session.
	// Kept across a failed session step so retrying skips re-reserving.
	let reservationId: string | null = null;

	const checkoutMutation = createMutation(() => ({
		mutationFn: async (): Promise<SeriesPassCheckoutResponseSchema> => {
			// Retry after a partial failure: only the session step needs to run
			// again. A 404 means the reservation expired — reserve afresh below.
			if (reservationId) {
				try {
					return { checkout_url: await createCheckoutSession('series-pass', reservationId) };
				} catch (error) {
					if (error instanceof CheckoutSessionError && error.expired) {
						reservationId = null;
					} else {
						throw error;
					}
				}
			}
			const response = await seriespassCheckoutSeriesPass({
				path: { pass_id: pass.id ?? '' }
			});
			if (response.error || !response.data) {
				throw new Error(extractErrorMessage(response.error, m['seriesPass.checkoutFailed']()));
			}
			const data = response.data;
			if (data.requires_payment && data.reservation_id) {
				reservationId = data.reservation_id;
				return { ...data, checkout_url: await createCheckoutSession('series-pass', reservationId) };
			}
			return data;
		},
		onSuccess: async (data) => {
			// Stripe branch: hand the browser to the hosted checkout page.
			if (data.checkout_url) {
				window.location.href = data.checkout_url;
				return;
			}
			// Free/offline branch: the pass is already held.
			if (data.held_pass) {
				try {
					await invalidateAfterPurchase(queryClient, seriesId, pass.id ?? '');
				} catch {
					// Non-critical: never block the success feedback on a cache
					// invalidation failure — the purchase already went through.
				}
				const pending = data.held_pass.status === 'pending';
				toast.success(pending ? m['seriesPass.passReserved']() : m['seriesPass.passClaimed'](), {
					description: pending
						? m['seriesPass.passReservedDesc']()
						: m['seriesPass.passClaimedDesc'](),
					duration: 5000
				});
				onClose();
				await goto(resolve('/(auth)/dashboard/passes', {}));
				return;
			}
			// Defensive: the schema allows both fields to be absent — never leave
			// the buyer without feedback on a checkout click.
			toast.error(m['seriesPass.checkoutFailed']());
		},
		onError: (error) => {
			if (error instanceof CheckoutSessionError) {
				// Reserve succeeded but the Stripe session didn't: the pass is still
				// held server-side and the retry button reuses the reservation.
				toast.error(m['seriesPass.paymentStartFailed']());
				return;
			}
			toast.error(error instanceof Error ? error.message : m['seriesPass.checkoutFailed']());
		}
	}));

	const confirmLabel = $derived.by(() => {
		if (isFree) return m['seriesPass.confirmFree']();
		if (isOnline) return m['seriesPass.confirmOnline']();
		return m['seriesPass.confirmOffline']();
	});
</script>

<Dialog open onOpenChange={onClose}>
	<DialogContent class="sm:max-w-[480px]">
		<DialogHeader>
			<DialogTitle>{m['seriesPass.purchaseTitle']({ name: pass.name })}</DialogTitle>
			<DialogDescription>
				{m['seriesPass.purchaseDescription']({
					remaining: quote.remaining_events,
					total: quote.remaining_events + quote.passed_events
				})}
			</DialogDescription>
		</DialogHeader>

		<div class="space-y-3">
			<!-- Price summary -->
			<div class="flex items-center justify-between rounded-md border bg-muted/40 p-3">
				<span class="text-sm font-medium">{m['seriesPass.priceLabel']()}</span>
				<span class="text-lg font-bold">
					{formatPrice(quote.price, quote.currency, m['seriesPass.free']())}
				</span>
			</div>

			{#if quote.passed_events > 0}
				<p class="text-sm text-muted-foreground">
					{m['seriesPass.proRataNote']({ passed: quote.passed_events })}
				</p>
			{/if}

			{#if !isFree && !isOnline}
				<p class="text-sm text-muted-foreground">{m['seriesPass.offlineNote']()}</p>
			{/if}
		</div>

		<DialogFooter class="gap-2 sm:gap-0">
			<Button variant="outline" onclick={onClose} disabled={checkoutMutation.isPending}>
				{m['seriesPass.cancelButton']()}
			</Button>
			<Button onclick={() => checkoutMutation.mutate()} disabled={checkoutMutation.isPending}>
				{checkoutMutation.isPending ? m['seriesPass.processing']() : confirmLabel}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

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
	import { invalidateAfterPurchase, seriesPassQueryKeys } from '$lib/queries/series-passes';
	import { getEligibilityRefusalMessage } from '$lib/utils/eligibility';
	import {
		classifyCheckoutRefusal,
		questionnaireStepsFromQuote,
		type CheckoutRefusal
	} from '$lib/utils/series-pass-questionnaires';
	import { passQuestionnaireReturnPath } from '$lib/utils/pass-questionnaire-return';
	import { passEventLookupOptions } from '$lib/queries/pass-questionnaire-lookups';
	import SeriesPassQuestionnaireSteps from './SeriesPassQuestionnaireSteps.svelte';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
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
	import { readAttributionFromCurrentUrl } from '$lib/utils/attribution';
	import { AlertCircle } from '@lucide/svelte';

	interface Props {
		pass: SeriesPassSchema;
		quote: SeriesPassQuoteSchema;
		seriesId: string;
		onClose: () => void;
	}

	const { pass, quote, seriesId, onClose }: Props = $props();

	const queryClient = useQueryClient();

	// A checkout the country rules refuse (422, #1001), shown inline: the
	// backend's translated reason, or the generic copy if it sent none.
	let refusal = $state<string | null>(null);

	// A checkout the eligibility rules refuse (400): the quote only lists what
	// the buyer can still answer, so a pending review, a closed retake or a
	// stale quote reach us here. Shown inline, never as a raw error.
	let eligibilityRefusal = $state<CheckoutRefusal | null>(null);
	const eligibilityMessage = $derived.by(() => {
		if (eligibilityRefusal?.kind === 'pending_review') return m['seriesPass.reviewPending']();
		if (eligibilityRefusal?.kind === 'other') {
			return (
				getEligibilityRefusalMessage(eligibilityRefusal.eligibility) ??
				m['seriesPass.checkoutFailed']()
			);
		}
		return null;
	});
	const stepsId = $props.id();
	// The questionnaire links come back to THIS pass (`qpass=`), so only this card
	// shows the review notice when the buyer returns.
	const returnPath = $derived(passQuestionnaireReturnPath(pass.id ?? ''));

	// A complete_questionnaire 400 carries `questionnaire_events` (one step per
	// missing questionnaire, routed like the quote): those steps show at once. The
	// quote is refreshed either way. Only when the 400 names none (an older backend)
	// do the steps come from the refreshed `quote` prop.
	let refreshingQuote = $state(false);
	const refusedSteps = $derived(
		eligibilityRefusal?.kind === 'complete_questionnaire' ? eligibilityRefusal.steps : []
	);
	const steps = $derived(
		refusedSteps.length > 0 ? refusedSteps : questionnaireStepsFromQuote(quote)
	);
	const fallbackEventId = $derived(
		eligibilityRefusal?.kind === 'complete_questionnaire' ? eligibilityRefusal.eventId : null
	);
	// Only fetched when no steps are known but the 400 named a closed event.
	const fallbackEvent = createQuery(() => ({
		...passEventLookupOptions(fallbackEventId ?? ''),
		enabled: !!fallbackEventId && !refreshingQuote && steps.length === 0
	}));

	const isFree = $derived(pass.payment_method === 'free' || parseFloat(quote.price) === 0);
	const isOnline = $derived(pass.payment_method === 'online' && !isFree);

	// Two-step online checkout (#464): reserve holds the pass and returns a
	// `reservation_id`; a second idempotent call creates the Stripe session.
	// Kept across a failed session step so retrying skips re-reserving.
	let reservationId: string | null = null;

	const checkoutMutation = createMutation(() => ({
		mutationFn: async (): Promise<SeriesPassCheckoutResponseSchema> => {
			// Retrying is allowed (the organizer may have moved the event); the
			// alert stays until the next answer replaces or clears it.
			refusal = null;
			eligibilityRefusal = null;
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
				path: { pass_id: pass.id ?? '' },
				body: { attribution: readAttributionFromCurrentUrl() }
			});
			if (response.response?.status === 422) {
				refusal = extractErrorMessage(response.error, m['compliance.checkout.passFallback']());
				throw new Error(refusal);
			}
			const eligibility =
				response.response?.status === 400 ? classifyCheckoutRefusal(response.error) : null;
			if (eligibility) {
				eligibilityRefusal = eligibility;
				if (eligibility.kind === 'complete_questionnaire') {
					// The quote that enabled Buy was stale or silent: refresh it so the
					// card's Buy gate catches up. Its steps only show when the 400 named none.
					refreshingQuote = true;
					try {
						await queryClient.invalidateQueries({
							queryKey: seriesPassQueryKeys.quote(seriesId, pass.id ?? '')
						});
					} finally {
						refreshingQuote = false;
					}
				}
				throw new Error(m['seriesPass.checkoutFailed']());
			}
			if (response.error || !response.data) {
				// 403 = the pass is visible but not purchasable by this buyer (blacklisted,
				// members-only, or an active member on a non-members pass): a plain-detail
				// refusal, so surface the backend's own reason. The fallback stays neutral:
				// a 403 alone can't tell which of those it was.
				const fallback =
					response.response?.status === 403
						? m['seriesPass.cannotBuy']()
						: m['seriesPass.checkoutFailed']();
				throw new Error(extractErrorMessage(response.error, fallback));
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
			if (refusal || eligibilityRefusal) return;
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
	<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-[480px]">
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

			{#if refusal}
				<div
					class="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground"
					id="series-pass-refusal"
					role="alert"
					data-testid="series-pass-checkout-refused"
				>
					<AlertCircle class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
					<p>{refusal}</p>
				</div>
			{/if}

			{#if eligibilityRefusal?.kind === 'complete_questionnaire'}
				{#if refreshingQuote && refusedSteps.length === 0}
					<p id={stepsId} class="text-sm text-muted-foreground" role="status">
						{m['seriesPass.questionnaires.refreshing']()}
					</p>
				{:else if steps.length > 0}
					<SeriesPassQuestionnaireSteps {steps} returnUrl={returnPath} id={stepsId} />
				{:else}
					<div
						id={stepsId}
						class="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-foreground"
						role="alert"
						data-testid="series-pass-questionnaires-still-needed"
					>
						<AlertCircle class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
						<p>
							{m['seriesPass.questionnaires.stillNeeded']()}
							{#if fallbackEvent.data}
								<a
									class="font-semibold underline underline-offset-4"
									href={resolve('/(public)/events/[org_slug]/[event_slug]', {
										org_slug: fallbackEvent.data.orgSlug,
										event_slug: fallbackEvent.data.slug
									})}
									data-testid="series-pass-questionnaires-event-link"
								>
									{fallbackEvent.data.name}
								</a>
							{/if}
						</p>
					</div>
				{/if}
			{:else if eligibilityMessage}
				<div
					class="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-foreground"
					id="series-pass-eligibility"
					role="alert"
					data-testid="series-pass-eligibility-refusal"
				>
					<AlertCircle class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
					<p>{eligibilityMessage}</p>
				</div>
			{/if}
		</div>

		<DialogFooter class="gap-2 sm:gap-0">
			<Button variant="outline" onclick={onClose} disabled={checkoutMutation.isPending}>
				{m['seriesPass.cancelButton']()}
			</Button>
			<Button
				onclick={() => checkoutMutation.mutate()}
				disabled={checkoutMutation.isPending}
				aria-describedby={refusal
					? 'series-pass-refusal'
					: eligibilityRefusal?.kind === 'complete_questionnaire'
						? stepsId
						: eligibilityMessage
							? 'series-pass-eligibility'
							: undefined}
			>
				{checkoutMutation.isPending ? m['seriesPass.processing']() : confirmLabel}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

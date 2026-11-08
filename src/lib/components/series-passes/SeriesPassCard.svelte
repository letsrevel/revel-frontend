<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { onMount, tick } from 'svelte';
	import { loginHref } from '$lib/utils/safe-redirect';
	import { currentPageReturnPath } from '$lib/utils/internal-return-url';
	import {
		capturePassReturnSignal,
		passQuestionnaireReturnPath,
		type PassReturnSignal
	} from '$lib/utils/pass-questionnaire-return';
	import type { SeriesPassSchema, SeriesPassQuoteSchema } from '$lib/api/generated/types.gen';
	import { seriespassGetSeriesPassQuote } from '$lib/api';
	import { seriesPassQueryKeys } from '$lib/queries/series-passes';
	import { createQuery } from '@tanstack/svelte-query';
	import PricingCard from '$lib/components/common/PricingCard.svelte';
	import { Button } from '$lib/components/ui/button';
	import { formatPrice } from '$lib/utils/format';
	import { Ticket, CreditCard, HandCoins } from '@lucide/svelte';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import SeriesPassPurchaseDialog from './SeriesPassPurchaseDialog.svelte';
	import SeriesPassQuestionnaireSteps from './SeriesPassQuestionnaireSteps.svelte';
	import { questionnaireStepsFromQuote } from '$lib/utils/series-pass-questionnaires';

	interface Props {
		pass: SeriesPassSchema;
		seriesId: string;
		isAuthenticated: boolean;
	}

	const { pass, seriesId, isAuthenticated }: Props = $props();

	let showPurchaseDialog = $state(false);
	const uid = $props.id();

	// Live pro-rata quote (public endpoint, works for anonymous users too).
	const quoteQuery = createQuery(() => ({
		queryKey: seriesPassQueryKeys.quote(seriesId, pass.id ?? ''),
		queryFn: async () => {
			const response = await seriespassGetSeriesPassQuote({
				path: { pass_id: pass.id ?? '' }
			});
			if (response.error || !response.data) {
				throw new Error('Failed to load pass quote');
			}
			return response.data;
		},
		// Coming back from a questionnaire refreshes this: the questionnaire page
		// invalidates the quote queries when a submission lands.
		enabled: !!pass.id
	}));

	const quote = $derived<SeriesPassQuoteSchema | undefined>(quoteQuery.data);

	// Show the season price struck through when the pro-rata discount kicked in.
	const isDiscounted = $derived(
		!!quote && quote.passed_events > 0 && parseFloat(quote.price) < parseFloat(pass.price)
	);

	const currentPrice = $derived(
		quote
			? formatPrice(quote.price, quote.currency, m['seriesPass.free']())
			: formatPrice(pass.price, pass.currency, m['seriesPass.free']())
	);

	// Country rules (#1005): the checkout gate's decision for this pass. A blocked
	// pass still reports `purchasable: true` by design, so it's read separately.
	const onlineUnavailable = $derived(quote?.compliance?.online_payment === 'blocked');

	// Admission questionnaires the buyer can still answer before the pass can be
	// bought (#1175). Each is routed through its own event. Empty for anonymous
	// buyers, so the checkout 400 fallback in the dialog stays the safety net.
	const questionnaireSteps = $derived(quote ? questionnaireStepsFromQuote(quote) : []);
	const hasMissingQuestionnaires = $derived(questionnaireSteps.length > 0);
	const stepsId = $derived(`${uid}-questionnaires`);
	// Login keeps the plain page path; the questionnaire links are tagged with
	// this pass's id so the return signal reaches this card and no other.
	const returnPath = $derived(currentPageReturnPath());
	const questionnaireReturnPath = $derived(passQuestionnaireReturnPath(pass.id ?? ''));
	const pendingId = $derived(`${uid}-review-pending`);

	// Set when the buyer lands back from a questionnaire page (`?questionnaire=`)
	// aimed at THIS pass (`qpass=`): `pending` shows the review notice, either one
	// moves focus once (below).
	let returnSignal = $state<PassReturnSignal | null>(null);
	onMount(() => {
		returnSignal = capturePassReturnSignal(pass.id ?? '');
	});

	// Once the refreshed quote is in, put focus where the buyer continues: the
	// steps heading while some remain, the Buy button otherwise. Only on a
	// returned-from-questionnaire load aimed at this pass.
	let focusHandled = false;
	$effect(() => {
		// Read every dependency up front (the query adapter only tracks what is read).
		const ready = quoteQuery.isSuccess && !quoteQuery.isFetching;
		const missing = hasMissingQuestionnaires;
		if (!returnSignal || focusHandled || !ready) return;
		focusHandled = true;
		const targetId = missing ? `${stepsId}-heading` : `${uid}-buy`;
		void tick().then(() => document.getElementById(targetId)?.focus());
	});

	const buyDescribedBy = $derived(
		[hasMissingQuestionnaires ? stepsId : null, returnSignal === 'pending' ? pendingId : null]
			.filter(Boolean)
			.join(' ') || undefined
	);

	const isButtonDisabled = $derived.by(() => {
		const loading = quoteQuery.isLoading;
		const error = quoteQuery.error;
		return loading || !!error || hasMissingQuestionnaires;
	});

	function handleBuyClick() {
		if (!isAuthenticated) {
			// The login action reads `returnUrl` (see login/+page.server.ts); include
			// the query string so pagination state survives the round trip.
			window.location.href = loginHref(returnPath);
			return;
		}
		showPurchaseDialog = true;
	}
</script>

{#snippet badges()}
	<!-- The pre-discount season price, struck through beside the name: the big
	     number below is what the buyer would actually pay today. -->
	{#if isDiscounted}
		<s class="text-sm text-muted-foreground line-through">
			{formatPrice(pass.price, pass.currency, m['seriesPass.free']())}
		</s>
	{/if}
{/snippet}

{#snippet meta()}
	<!-- Coverage / pro-rata line -->
	{#if quote}
		<p class="text-sm text-muted-foreground">
			{m['seriesPass.coverageLine']({
				remaining: quote.remaining_events,
				total: quote.remaining_events + quote.passed_events
			})}
		</p>
	{/if}

	{#if pass.purchasable_by === 'non_members'}
		<p class="mt-2 text-xs text-muted-foreground" data-testid="pass-non-members-note">
			{m['seriesPass.nonMembersNote']()}
		</p>
	{/if}

	<!-- Payment method hint -->
	{#if pass.payment_method === 'offline' || pass.payment_method === 'at_the_door'}
		<p class="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
			<HandCoins class="h-3.5 w-3.5" aria-hidden="true" />
			{m['seriesPass.payOffline']()}
		</p>
	{:else if pass.payment_method === 'online' && !onlineUnavailable}
		<p class="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
			<CreditCard class="h-3.5 w-3.5" aria-hidden="true" />
			{m['seriesPass.payOnline']()}
		</p>
	{/if}
{/snippet}

{#snippet actions()}
	{#if quote && !quote.purchasable}
		<Button class="w-full" disabled>
			{m['seriesPass.notAvailable']()}
		</Button>
		{#if quote.reason}
			<p class="mt-2 text-center text-xs text-muted-foreground" role="status">
				{quote.reason}
			</p>
		{/if}
	{:else if onlineUnavailable}
		<!-- Before the sign-in redirect below: signing in can't make a blocked pass
		     purchasable. The dialog's inline 422 stays the fallback (stale quote). -->
		<Button class="w-full" disabled aria-describedby="{uid}-online-unavailable">
			{m['compliance.checkout.notAvailableOnline']()}
		</Button>
		<p
			id="{uid}-online-unavailable"
			class="mt-2 text-center text-xs text-muted-foreground"
			data-testid="pass-online-unavailable"
		>
			{m['compliance.checkout.passFallback']()}
		</p>
	{:else}
		{#if hasMissingQuestionnaires}
			<div class="mb-3">
				<SeriesPassQuestionnaireSteps
					steps={questionnaireSteps}
					returnUrl={questionnaireReturnPath}
					id={stepsId}
				/>
			</div>
		{/if}
		{#if returnSignal === 'pending'}
			<p
				id={pendingId}
				class="mb-3 rounded-md border border-border bg-muted/40 p-3 text-left text-sm text-foreground"
				role="status"
				data-testid="pass-questionnaire-review-pending"
			>
				{m['seriesPass.questionnaires.reviewPendingNotice']()}
			</p>
		{/if}
		<Button
			id="{uid}-buy"
			data-pass-buy
			class="w-full"
			onclick={handleBuyClick}
			disabled={isButtonDisabled}
			aria-describedby={buyDescribedBy}
		>
			{m['seriesPass.buyButton']()}
		</Button>
	{/if}
{/snippet}

<PricingCard
	name={pass.name}
	icon={Ticket}
	price={currentPrice}
	layout="stack"
	class="h-full border-primary/30"
	{badges}
	{meta}
	{actions}
>
	{#if pass.description}
		<div class="text-sm text-muted-foreground">
			<MarkdownContent content={pass.description} />
		</div>
	{/if}
</PricingCard>

{#if showPurchaseDialog && quote && pass.id}
	<SeriesPassPurchaseDialog
		{pass}
		{quote}
		{seriesId}
		onClose={() => (showPurchaseDialog = false)}
	/>
{/if}

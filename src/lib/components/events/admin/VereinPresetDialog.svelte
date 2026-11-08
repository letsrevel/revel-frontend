<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { untrack } from 'svelte';
	import { useQueryClient } from '@tanstack/svelte-query';
	import { Check, CircleAlert, Circle, Loader2 } from '@lucide/svelte';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { RadioGroup, RadioGroupItem } from '$lib/components/ui/radio-group';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { authStore } from '$lib/stores/auth.svelte';
	import { formatMoney } from '$lib/utils/format';
	import { membershipTiersKeys } from '$lib/queries/membership-tiers';
	import { invalidateOrgQuestionnaires } from '$lib/queries/org-questionnaires';
	import type { MembershipTierSchema } from '$lib/api/generated/types.gen';
	import { vatExemptionRequired, type OrgVatContext } from './tier-vat';
	import {
		buildVereinPlan,
		normalizePrice,
		planChargesOnline,
		planIsPaid,
		runVereinPlan,
		validateVereinInput,
		type PublicAudience,
		type StepResult,
		type TicketCurrency,
		type VereinPlanStep,
		type VereinInputIssue,
		type VereinPresetInput,
		type VereinStepId
	} from './verein-preset';
	import { forgetVereinRun, recallVereinRun, rememberVereinRun } from './verein-preset-state';

	interface Props {
		open: boolean;
		eventId: string;
		organizationId: string;
		organizationSlug: string;
		/** Existing TEMPORARY (day-membership) tiers the preset may reuse. */
		dayTiers: MembershipTierSchema[];
		/** The event's currency (taken from its existing tiers, EUR otherwise). */
		currency: TicketCurrency;
		/** Card payment is possible (Stripe connected and not blocked for the event country). */
		canChargeOnline: boolean;
		/** Why card payment is unavailable (already translated); shown with the paid-tickets block. */
		onlineReason?: string | null;
		/** Load state of the day-membership tiers; the confirm waits for `success`. */
		dayTiersStatus?: 'pending' | 'error' | 'success';
		onRetryDayTiers?: () => void;
		orgVat?: OrgVatContext | null;
	}

	let {
		open = $bindable(),
		eventId,
		organizationId,
		organizationSlug,
		dayTiers,
		currency,
		canChargeOnline,
		onlineReason = null,
		dayTiersStatus = 'success',
		onRetryDayTiers,
		orgVat = null
	}: Props = $props();

	const queryClient = useQueryClient();
	const uid = $props.id();

	const NEW_TIER = '__new__';

	// A tier without an id cannot be granted, so it is not offered.
	const reusable = $derived(dayTiers.flatMap((t) => (t.id ? [{ id: t.id, name: t.name }] : [])));

	let phase = $state<'form' | 'run'>('form');
	let dayChoice = $state(NEW_TIER);
	let dayName = $state('');
	let publicName = $state('');
	let publicPrice = $state('25');
	let audience = $state<PublicAudience>('public');
	let membersName = $state('');
	let membersPrice = $state('20');
	let questionnaireName = $state('');
	let question = $state('');
	let option = $state('');

	let results = $state<StepResult[]>([]);
	let running = $state(false);
	let finishedOk = $state(false);
	let planSnapshot = $state<VereinPlanStep[]>([]);

	let confirmingReset = $state(false);
	// The run on screen came from an earlier open of the dialog, not this one.
	let restored = $state(false);
	// Plain flags (never read by a template): the open transition and whether the
	// reuse-vs-create default has been settled against a loaded tier list.
	let wasOpen = false;
	let dayChoiceSeeded = false;

	// Seed the (translated, editable) defaults, or restore this event's earlier run.
	function seed(): void {
		running = false;
		confirmingReset = false;
		const prior = recallVereinRun(eventId);
		if (prior) {
			planSnapshot = prior.plan;
			results = prior.results;
			finishedOk = prior.results.length > 0 && prior.results.every((r) => r.status === 'done');
			phase = 'run';
			restored = true;
		} else {
			restored = false;
			phase = 'form';
			results = [];
			finishedOk = false;
		}
		dayChoiceSeeded = dayTiersStatus === 'success';
		dayChoice = reusable.length === 1 ? reusable[0].id : NEW_TIER;
		dayName = m['verein.preset.default.dayTier']();
		publicName = m['verein.preset.default.publicTier']();
		publicPrice = '25';
		audience = 'public';
		membersName = m['verein.preset.default.membersTier']();
		membersPrice = '20';
		questionnaireName = m['verein.preset.default.questionnaire']();
		question = m['verein.preset.default.question']();
		option = m['verein.preset.default.option']();
	}

	// Seed ONLY on the closed -> open transition. A prop update (the tier lists
	// refetch after a run) must never reset the phase, results or typed fields.
	$effect(() => {
		const isOpen = open;
		if (isOpen && !wasOpen) untrack(seed);
		wasOpen = isOpen;
	});

	// The tier list may arrive after the dialog opened: settle the default once.
	$effect(() => {
		if (!open || phase !== 'form' || dayChoiceSeeded || dayTiersStatus !== 'success') return;
		dayChoiceSeeded = true;
		if (reusable.length === 1) dayChoice = reusable[0].id;
	});

	function startOver(): void {
		forgetVereinRun(eventId);
		seed();
	}

	const reusedTier = $derived(reusable.find((t) => t.id === dayChoice) ?? null);

	const input = $derived<VereinPresetInput>({
		organizationId,
		organizationSlug,
		eventId,
		currency,
		paymentMethod: canChargeOnline ? 'online' : 'free',
		dayTier: reusedTier
			? { mode: 'reuse', id: reusedTier.id, name: reusedTier.name }
			: {
					mode: 'create',
					name: dayName,
					description: m['verein.preset.default.dayTierDescription']()
				},
		publicTier: { name: publicName, price: publicPrice, audience },
		membersTier: { name: membersName, price: membersPrice },
		questionnaire: { name: questionnaireName, question, option }
	});

	const issues = $derived(validateVereinInput(input));
	const plan = $derived(buildVereinPlan(input));

	// Prices above zero need a payment method the org can actually run. With card
	// payment unavailable the plan would create free tiers, silently dropping the
	// price, so refuse instead and say why.
	const onlineBlocked = $derived(planIsPaid(plan) && !canChargeOnline);
	const vatBlocked = $derived(
		planChargesOnline(plan) &&
			vatExemptionRequired(
				{ paymentMethod: 'online', priceType: 'fixed', price: '1', pwycMin: '', pwycMax: '' },
				'',
				orgVat
			)
	);
	const tiersPending = $derived(dayTiersStatus === 'pending');
	const tiersError = $derived(dayTiersStatus === 'error');
	const canConfirm = $derived(
		issues.length === 0 && !onlineBlocked && !vatBlocked && !tiersPending && !tiersError
	);

	const badFields = $derived(new Set<VereinInputIssue>(issues));
	const issueText: Record<VereinInputIssue, () => string> = {
		dayTierName: () => m['verein.preset.issue.dayTierName'](),
		publicName: () => m['verein.preset.issue.publicName'](),
		publicPrice: () => m['verein.preset.issue.publicPrice'](),
		membersName: () => m['verein.preset.issue.membersName'](),
		membersPrice: () => m['verein.preset.issue.membersPrice'](),
		questionnaireName: () => m['verein.preset.issue.questionnaireName'](),
		question: () => m['verein.preset.issue.question'](),
		option: () => m['verein.preset.issue.option']()
	};
	function invalid(key: VereinInputIssue): 'true' | undefined {
		return badFields.has(key) ? 'true' : undefined;
	}
	function describedBy(key: VereinInputIssue): string | undefined {
		return badFields.has(key) ? `${uid}-err-${key}` : undefined;
	}

	const stepLabel: Record<VereinStepId, () => string> = {
		dayTier: () => m['verein.preset.step.dayTier'](),
		questionnaire: () => m['verein.preset.step.questionnaire'](),
		assign: () => m['verein.preset.step.assign'](),
		publicTier: () => m['verein.preset.step.publicTier'](),
		membersTier: () => m['verein.preset.step.membersTier']()
	};

	function money(value: string): string {
		return formatMoney(normalizePrice(value) || '0', currency);
	}

	function describe(step: VereinPlanStep): string {
		switch (step.id) {
			case 'dayTier':
				return m['verein.preset.preview.dayTier']({ name: step.body.name });
			case 'questionnaire':
				return m['verein.preset.preview.questionnaire']({ name: step.body.name });
			case 'assign':
				return m['verein.preset.preview.assign']();
			case 'publicTier':
				return m[
					step.body.purchasable_by === 'non_members'
						? 'verein.preset.preview.publicTierNonMembers'
						: 'verein.preset.preview.publicTier'
				]({
					name: step.body.name,
					price: money(publicPrice),
					dayTier: input.dayTier.name
				});
			case 'membersTier':
				return m['verein.preset.preview.membersTier']({
					name: step.body.name,
					price: money(membersPrice)
				});
		}
	}

	const failed = $derived(results.find((r) => r.status === 'failed') ?? null);
	const doneIds = $derived(
		Object.fromEntries(
			results.filter((r) => r.status === 'done').map((r) => [r.id, r.entityId ?? ''])
		) as Partial<Record<VereinStepId, string>>
	);
	const questionnaireId = $derived(results.find((r) => r.id === 'questionnaire')?.entityId);
	const createdAnyDayTier = $derived(
		results.some((r) => r.id === 'dayTier' && r.status === 'done')
	);
	const hasCreated = $derived(results.some((r) => r.status === 'done'));

	async function refreshCaches(): Promise<void> {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: ['event-admin', eventId, 'ticket-tiers'] }),
			queryClient.invalidateQueries({ queryKey: membershipTiersKeys.all(organizationSlug) }),
			invalidateOrgQuestionnaires(queryClient, organizationSlug),
			invalidateAll()
		]);
	}

	async function execute(): Promise<void> {
		const token = authStore.accessToken;
		if (!token || running) return;
		running = true;
		finishedOk = false;
		confirmingReset = false;
		restored = false;
		// Steps whose earlier attempt may have committed are looked up, not re-created.
		const reconcile = Object.fromEntries(
			results.filter((r) => r.status === 'failed' && r.ambiguous).map((r) => [r.id, true])
		) as Partial<Record<VereinStepId, boolean>>;
		if (phase === 'form') {
			planSnapshot = plan.steps;
			phase = 'run';
		}
		try {
			const outcome = await runVereinPlan(
				{ steps: planSnapshot },
				{
					accessToken: token,
					completed: doneIds,
					reconcile,
					onProgress: (steps) => {
						results = steps;
						rememberVereinRun(eventId, { results: steps, plan: planSnapshot });
					}
				}
			);
			finishedOk = outcome.ok;
		} finally {
			running = false;
			await refreshCaches();
		}
	}

	function statusText(status: StepResult['status']): string {
		return m[`verein.preset.status.${status}` as const]();
	}
</script>

{#snippet fieldError(key: VereinInputIssue)}
	{#if badFields.has(key)}
		<p id="{uid}-err-{key}" class="text-sm text-destructive">{issueText[key]()}</p>
	{/if}
{/snippet}

<Dialog bind:open>
	<DialogContent
		class="max-h-[90vh] max-w-xl overflow-y-auto"
		escapeKeydownBehavior={running ? 'ignore' : 'close'}
		interactOutsideBehavior={running ? 'ignore' : 'close'}
		showCloseButton={!running}
		data-testid="verein-preset-dialog"
	>
		<DialogHeader>
			<DialogTitle>{m['verein.preset.title']()}</DialogTitle>
			<DialogDescription>
				{phase === 'form' ? m['verein.preset.description']() : m['verein.preset.runDescription']()}
			</DialogDescription>
		</DialogHeader>

		{#if phase === 'form'}
			<div class="space-y-5">
				<fieldset class="space-y-2">
					<legend class="text-sm font-semibold">{m['verein.preset.field.dayTier']()}</legend>
					{#if tiersPending}
						<p
							class="text-sm text-muted-foreground"
							role="status"
							data-testid="verein-tiers-loading"
						>
							{m['verein.preset.checkingTiers']()}
						</p>
					{:else if tiersError}
						<Alert variant="destructive" data-testid="verein-tiers-error">
							<AlertDescription class="space-y-2">
								<p>{m['verein.preset.tiersError']()}</p>
								<Button type="button" variant="outline" size="sm" onclick={onRetryDayTiers}>
									{m['verein.preset.tiersRetry']()}
								</Button>
							</AlertDescription>
						</Alert>
					{/if}
					<RadioGroup bind:value={dayChoice} aria-label={m['verein.preset.field.dayTier']()}>
						<div class="flex items-center gap-2">
							<RadioGroupItem value={NEW_TIER} id="{uid}-day-new" />
							<Label for="{uid}-day-new" class="font-normal">
								{m['verein.preset.field.dayTierNew']()}
							</Label>
						</div>
						{#each reusable as tier (tier.id)}
							<div class="flex items-center gap-2">
								<RadioGroupItem value={tier.id} id="{uid}-day-{tier.id}" />
								<Label for="{uid}-day-{tier.id}" class="font-normal">
									{m['verein.preset.field.dayTierReuse']({ name: tier.name })}
								</Label>
							</div>
						{/each}
					</RadioGroup>
					{#if !reusedTier}
						<div class="space-y-1">
							<Label for="{uid}-day-name">{m['verein.preset.field.name']()}</Label>
							<Input
								id="{uid}-day-name"
								bind:value={dayName}
								maxlength={150}
								aria-invalid={invalid('dayTierName')}
								aria-describedby={describedBy('dayTierName')}
							/>
							{@render fieldError('dayTierName')}
						</div>
					{/if}
				</fieldset>

				<fieldset class="space-y-3">
					<legend class="text-sm font-semibold">{m['verein.preset.field.publicTier']()}</legend>
					<div class="grid gap-3 sm:grid-cols-2">
						<div class="space-y-1">
							<Label for="{uid}-pub-name">{m['verein.preset.field.name']()}</Label>
							<Input
								id="{uid}-pub-name"
								bind:value={publicName}
								maxlength={150}
								aria-invalid={invalid('publicName')}
								aria-describedby={describedBy('publicName')}
							/>
							{@render fieldError('publicName')}
						</div>
						<div class="space-y-1">
							<Label for="{uid}-pub-price">
								{m['verein.preset.field.price']({ currency })}
							</Label>
							<Input
								id="{uid}-pub-price"
								bind:value={publicPrice}
								inputmode="decimal"
								aria-invalid={invalid('publicPrice')}
								aria-describedby={describedBy('publicPrice')}
							/>
							{@render fieldError('publicPrice')}
						</div>
					</div>
					<div class="space-y-2">
						<p id="{uid}-aud" class="text-sm font-medium">{m['verein.preset.field.audience']()}</p>
						<RadioGroup bind:value={audience} aria-labelledby="{uid}-aud">
							<div class="flex items-center gap-2">
								<RadioGroupItem value="public" id="{uid}-aud-public" />
								<Label for="{uid}-aud-public" class="font-normal">
									{m['verein.preset.field.audiencePublic']()}
								</Label>
							</div>
							<div class="flex items-center gap-2">
								<RadioGroupItem value="non_members" id="{uid}-aud-non" />
								<Label for="{uid}-aud-non" class="font-normal">
									{m['verein.preset.field.audienceNonMembers']()}
								</Label>
							</div>
						</RadioGroup>
					</div>
				</fieldset>

				<fieldset class="space-y-3">
					<legend class="text-sm font-semibold">{m['verein.preset.field.membersTier']()}</legend>
					<div class="grid gap-3 sm:grid-cols-2">
						<div class="space-y-1">
							<Label for="{uid}-mem-name">{m['verein.preset.field.name']()}</Label>
							<Input
								id="{uid}-mem-name"
								bind:value={membersName}
								maxlength={150}
								aria-invalid={invalid('membersName')}
								aria-describedby={describedBy('membersName')}
							/>
							{@render fieldError('membersName')}
						</div>
						<div class="space-y-1">
							<Label for="{uid}-mem-price">
								{m['verein.preset.field.price']({ currency })}
							</Label>
							<Input
								id="{uid}-mem-price"
								bind:value={membersPrice}
								inputmode="decimal"
								aria-invalid={invalid('membersPrice')}
								aria-describedby={describedBy('membersPrice')}
							/>
							{@render fieldError('membersPrice')}
						</div>
					</div>
				</fieldset>

				<fieldset class="space-y-3">
					<legend class="text-sm font-semibold">{m['verein.preset.field.questionnaire']()}</legend>
					<div class="space-y-1">
						<Label for="{uid}-q-name">{m['verein.preset.field.name']()}</Label>
						<Input
							id="{uid}-q-name"
							bind:value={questionnaireName}
							maxlength={150}
							aria-invalid={invalid('questionnaireName')}
							aria-describedby={describedBy('questionnaireName')}
						/>
						{@render fieldError('questionnaireName')}
					</div>
					<div class="space-y-1">
						<Label for="{uid}-q-text">{m['verein.preset.field.question']()}</Label>
						<Input
							id="{uid}-q-text"
							bind:value={question}
							aria-invalid={invalid('question')}
							aria-describedby={describedBy('question')}
						/>
						{@render fieldError('question')}
					</div>
					<div class="space-y-1">
						<Label for="{uid}-q-opt">{m['verein.preset.field.option']()}</Label>
						<Input
							id="{uid}-q-opt"
							bind:value={option}
							aria-invalid={invalid('option')}
							aria-describedby={describedBy('option')}
						/>
						{@render fieldError('option')}
					</div>
				</fieldset>

				<section
					class="space-y-2 rounded-lg border border-border bg-muted/40 p-3"
					aria-labelledby="{uid}-preview"
					data-testid="verein-preset-preview"
				>
					<h3 id="{uid}-preview" class="text-sm font-semibold">
						{m['verein.preset.preview.heading']()}
					</h3>
					<ol class="list-decimal space-y-1 pl-5 text-sm">
						{#if reusedTier}
							<li>{m['verein.preset.preview.dayTierReuse']({ name: reusedTier.name })}</li>
						{/if}
						{#each plan.steps as step (step.id)}
							<li>{describe(step)}</li>
						{/each}
					</ol>
					<p class="text-xs text-muted-foreground">{m['verein.preset.preview.editable']()}</p>
				</section>

				{#if issues.length > 0}
					<Alert variant="destructive" data-testid="verein-preset-issues">
						<AlertDescription class="space-y-1">
							<p>{m['verein.preset.blocked.fields']()}</p>
							<ul class="list-disc pl-5">
								{#each issues as key (key)}
									<li>{issueText[key]()}</li>
								{/each}
							</ul>
						</AlertDescription>
					</Alert>
				{/if}
				{#if onlineBlocked}
					<Alert variant="destructive" data-testid="verein-preset-online-blocked">
						<AlertDescription class="space-y-1">
							<p>{m['verein.preset.blocked.online']()}</p>
							{#if onlineReason}
								<p data-testid="verein-preset-online-reason">
									{m['verein.preset.blocked.onlineReason']({ reason: onlineReason })}
								</p>
							{/if}
						</AlertDescription>
					</Alert>
				{/if}
				{#if vatBlocked}
					<Alert variant="destructive" data-testid="verein-preset-vat-blocked">
						<AlertDescription>{m['verein.preset.blocked.vat']()}</AlertDescription>
					</Alert>
				{/if}
			</div>

			<DialogFooter class="gap-2 sm:gap-0">
				<Button variant="outline" onclick={() => (open = false)}>
					{m['verein.preset.cancel']()}
				</Button>
				<Button onclick={execute} disabled={!canConfirm} data-testid="verein-preset-confirm">
					{m['verein.preset.confirm']()}
				</Button>
			</DialogFooter>
		{:else}
			<div class="space-y-4">
				{#if restored}
					<p class="text-sm text-muted-foreground" data-testid="verein-preset-restored">
						{m['verein.preset.restored']()}
					</p>
				{/if}
				<ol class="space-y-2" aria-label={m['verein.preset.progressLabel']()}>
					{#each results as r (r.id)}
						<li class="flex items-start gap-2 text-sm" data-testid="verein-step-{r.id}">
							{#if r.status === 'running'}
								<Loader2 class="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
							{:else if r.status === 'done'}
								<Check class="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
							{:else if r.status === 'failed'}
								<CircleAlert class="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
							{:else}
								<Circle class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
							{/if}
							<span>
								<span class="font-medium">{stepLabel[r.id]()}</span>
								<span class="text-muted-foreground"> · {statusText(r.status)}</span>
								{#if r.error}
									<span class="block text-destructive" data-testid="verein-step-error">
										{r.error}
									</span>
								{/if}
							</span>
						</li>
					{/each}
				</ol>

				{#if finishedOk}
					<Alert data-testid="verein-preset-success">
						<AlertDescription>{m['verein.preset.result.success']()}</AlertDescription>
					</Alert>
				{/if}
				{#if failed}
					<Alert variant="destructive" data-testid="verein-preset-failure">
						<AlertDescription class="space-y-1">
							<p>
								{m['verein.preset.result.failed']({ step: stepLabel[failed.id]() })}
							</p>
							<p>
								{hasCreated
									? m['verein.preset.result.partial']()
									: m['verein.preset.result.nothingCreated']()}
							</p>
						</AlertDescription>
					</Alert>
				{/if}

				{#if createdAnyDayTier || questionnaireId}
					<ul class="space-y-1 text-sm" aria-label={m['verein.preset.result.openLabel']()}>
						{#if createdAnyDayTier}
							<li>
								<a
									class="inline-flex min-h-[44px] items-center underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									href="{resolve('/(auth)/org/[slug]/admin/members', {
										slug: organizationSlug
									})}?tab=tiers"
									target="_blank"
									rel="noopener"
								>
									{m['verein.preset.result.openTiers']()}
								</a>
							</li>
						{/if}
						{#if questionnaireId}
							<li>
								<a
									class="inline-flex min-h-[44px] items-center underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									href={resolve('/(auth)/org/[slug]/admin/questionnaires/[id]', {
										slug: organizationSlug,
										id: questionnaireId
									})}
									target="_blank"
									rel="noopener"
								>
									{m['verein.preset.result.openQuestionnaire']()}
								</a>
							</li>
						{/if}
					</ul>
				{/if}
			</div>

			{#if confirmingReset && !running}
				<Alert variant="destructive" data-testid="verein-preset-reset-confirm">
					<AlertDescription class="space-y-2">
						<p>{m['verein.preset.startOverConfirm']()}</p>
						<div class="flex flex-wrap gap-2">
							<Button
								type="button"
								variant="destructive"
								size="sm"
								onclick={startOver}
								data-testid="verein-preset-reset-yes"
							>
								{m['verein.preset.startOverYes']()}
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onclick={() => (confirmingReset = false)}
							>
								{m['verein.preset.startOverNo']()}
							</Button>
						</div>
					</AlertDescription>
				</Alert>
			{/if}

			<DialogFooter class="gap-2 sm:gap-0">
				{#if failed && !running}
					<Button onclick={execute} data-testid="verein-preset-retry">
						{m['verein.preset.retry']()}
					</Button>
				{/if}
				{#if hasCreated && !running && !confirmingReset}
					<Button
						type="button"
						variant="ghost"
						onclick={() => (confirmingReset = true)}
						data-testid="verein-preset-reset"
					>
						{m['verein.preset.startOver']()}
					</Button>
				{/if}
				<Button
					variant={failed ? 'outline' : 'default'}
					disabled={running}
					onclick={() => (open = false)}
				>
					{failed ? m['verein.preset.close']() : m['verein.preset.done']()}
				</Button>
			</DialogFooter>
		{/if}
	</DialogContent>
</Dialog>

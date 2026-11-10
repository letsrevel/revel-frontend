<script lang="ts">
	import { untrack } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import { Loader2 } from '@lucide/svelte';
	import type {
		MembershipRecordSchema,
		MembershipTierSchema,
		OrgUserLookupSchema
	} from '$lib/api/generated/types.gen';
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
	import MemberStatusBadge from '$lib/components/members/MemberStatusBadge.svelte';
	import { addMemberByAccount, RegisterApiError } from '$lib/member-register/api';
	import {
		classifyLookup,
		lookupDisplayName,
		lookupWithSeed,
		resolveSeed,
		seedDeps,
		validateLookupEmail,
		type AccountLookupOutcome
	} from '$lib/member-register/account-lookup';
	import { invalidateAfterMemberWrite } from '$lib/member-register/member-access';
	import { lookupThrottleRemaining, setLookupThrottle } from '$lib/member-register/lookup-throttle';
	import { describeRegisterError, type DescribedError } from '$lib/member-register/errors';
	import { SELECT_CLASS } from '$lib/member-register/ui';
	import RegisterErrorAlert from './RegisterErrorAlert.svelte';

	interface Props {
		open: boolean;
		slug: string;
		accessToken: string | null;
		/** STANDARD tiers only: the backend refuses any other tier on add. */
		tiers: MembershipTierSchema[];
		onClose: () => void;
		/** Open the person sheet on a seed entry (the dialog closes itself first). */
		onOpenPerson: (seed: MembershipRecordSchema) => void;
		onOpenApplications: () => void;
		onCreateInviteLink: () => void;
		/** Switch to the Tiers tab (offered when there is no standard tier to add to). */
		onOpenTiers?: () => void;
	}

	const {
		open,
		slug,
		accessToken,
		tiers,
		onClose,
		onOpenPerson,
		onOpenApplications,
		onCreateInviteLink,
		onOpenTiers
	}: Props = $props();

	const queryClient = useQueryClient();

	let email = $state('');
	let emailError = $state<'required' | 'invalid' | null>(null);
	// The email the shown result belongs to (the input may have moved on).
	let queriedEmail = $state('');
	let outcome = $state<AccountLookupOutcome | null>(null);
	let failure = $state<DescribedError | null>(null);
	// Bumped whenever the lockout starts or ends, so `throttled` re-evaluates.
	let throttleTick = $state(0);
	let tierId = $state('');
	// Set when an add was refused with 400: the re-lookup must explain why, and an
	// answer that still says "addable" means the refusal was something else.
	let refusedAdd = $state<unknown>(null);
	let inputEl = $state<HTMLInputElement | null>(null);

	function reset() {
		email = '';
		emailError = null;
		queriedEmail = '';
		outcome = null;
		failure = null;
		tierId = '';
		refusedAdd = null;
	}

	$effect(() => {
		if (open) untrack(reset);
	});

	// A throttled lookup keeps the submit disabled for the advised wait.
	// The lockout is a per-organization deadline that outlives this dialog's open
	// state, so closing and reopening (or remounting) cannot dodge it.
	const throttled = $derived.by(() => {
		void throttleTick;
		return lookupThrottleRemaining(slug) > 0;
	});
	let throttleTimer: ReturnType<typeof setTimeout> | undefined;
	function armThrottleTimer() {
		clearTimeout(throttleTimer);
		const remaining = lookupThrottleRemaining(slug);
		if (remaining <= 0) return;
		throttleTimer = setTimeout(() => throttleTick++, remaining + 20);
	}
	function startThrottle(seconds: number | null) {
		setLookupThrottle(slug, seconds);
		throttleTick++;
		armThrottleTimer();
	}
	$effect(() => {
		void slug;
		untrack(armThrottleTimer);
		return () => clearTimeout(throttleTimer);
	});

	const selectableTiers = $derived(tiers.filter((t) => !!t.id));
	// The only tier is preselected; with several, the admin must choose.
	$effect(() => {
		if (selectableTiers.length === 1 && !tierId) tierId = selectableTiers[0].id as string;
	});

	function showOutcome(result: AccountLookupOutcome, typed: string) {
		if (email.trim() !== typed) return; // the admin kept typing: this answer is stale
		queriedEmail = typed;
		outcome = result;
		failure = null;
		const refusal = refusedAdd;
		refusedAdd = null;
		if (refusal && result.kind === 'found' && classifyLookup(result.user) === 'addable') {
			failure = describeRegisterError(refusal, 'save');
		}
	}

	function showFailure(error: unknown, typed: string) {
		if (email.trim() !== typed) return;
		outcome = null;
		refusedAdd = null;
		failure = describeRegisterError(error, 'lookup');
		if (failure.throttled) {
			startThrottle(error instanceof RegisterApiError ? error.retryAfterSeconds : null);
		}
	}

	const lookup = createMutation(() => ({
		mutationFn: (typed: string) => lookupWithSeed(slug, accessToken, typed),
		onSuccess: (result: AccountLookupOutcome, typed: string) => showOutcome(result, typed),
		onError: (error: unknown, typed: string) => showFailure(error, typed)
	}));

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (lookup.isPending || throttled) return;
		emailError = validateLookupEmail(email);
		if (emailError) return;
		outcome = null;
		failure = null;
		refusedAdd = null;
		lookup.mutate(email.trim());
	}

	function oninput() {
		// Any edit invalidates what was found for the previous value.
		outcome = null;
		failure = null;
		emailError = null;
		refusedAdd = null;
	}

	const found = $derived(outcome?.kind === 'found' ? outcome : null);
	const kind = $derived(found ? classifyLookup(found.user) : null);
	const name = $derived(found ? lookupDisplayName(found.user, queriedEmail) : '');

	const add = createMutation(() => ({
		mutationFn: async (user: OrgUserLookupSchema) => {
			await addMemberByAccount(slug, accessToken, user.user_id, tierId);
			// The member exists from here on: a failed refresh or seed lookup must not
			// report the add as failed (a retry would be refused), it only skips the sheet.
			// Refresh in the background; the seed lookup does not wait for it.
			invalidateAfterMemberWrite(queryClient, slug).catch(() => undefined);
			try {
				return await resolveSeed(user, seedDeps(slug, accessToken));
			} catch {
				return null;
			}
		},
		onSuccess: (seed: MembershipRecordSchema | null, user: OrgUserLookupSchema) => {
			toast.success(
				m['memberPeople.byAccount.added']({ name: lookupDisplayName(user, queriedEmail) })
			);
			onClose();
			if (seed) onOpenPerson(seed);
		},
		onError: (error: unknown) => {
			// 400 is the backend's "already a member" (a race with another admin or
			// an approval): look again and show what they hold now.
			if (error instanceof RegisterApiError && error.status === 400 && queriedEmail) {
				refusedAdd = error;
				lookup.mutate(queriedEmail);
				return;
			}
			failure = describeRegisterError(error, 'save');
		}
	}));

	function handleOpenChange(next: boolean) {
		if (!next && !add.isPending) onClose();
	}

	function closeThen(action: () => void) {
		onClose();
		action();
	}

	const canAdd = $derived(!!tierId && !add.isPending && !lookup.isPending);
</script>

<Dialog {open} onOpenChange={handleOpenChange}>
	<DialogContent
		class="sm:max-w-md"
		onOpenAutoFocus={(e) => {
			e.preventDefault();
			inputEl?.focus();
		}}
	>
		<DialogHeader>
			<DialogTitle>{m['memberPeople.byAccount.title']()}</DialogTitle>
			<DialogDescription>{m['memberPeople.byAccount.description']()}</DialogDescription>
		</DialogHeader>

		<form onsubmit={submit} class="space-y-3" novalidate>
			<div class="space-y-2">
				<Label for="aba-email">{m['memberPeople.byAccount.emailLabel']()}</Label>
				<Input
					id="aba-email"
					type="email"
					bind:ref={inputEl}
					bind:value={email}
					{oninput}
					autocomplete="off"
					aria-invalid={emailError ? 'true' : undefined}
					aria-describedby={emailError ? 'aba-email-err' : undefined}
				/>
				{#if emailError}
					<p id="aba-email-err" class="text-sm text-destructive">
						{emailError === 'required'
							? m['memberPeople.byAccount.errRequired']()
							: m['memberPeople.byAccount.errInvalid']()}
					</p>
				{/if}
			</div>
			<Button type="submit" disabled={lookup.isPending || throttled} class="w-full sm:w-auto">
				{#if lookup.isPending}
					<Loader2 class="animate-spin" aria-hidden="true" />
					{m['memberPeople.byAccount.finding']()}
				{:else}
					{m['memberPeople.byAccount.find']()}
				{/if}
			</Button>
		</form>

		<div aria-live="polite" class="space-y-3" data-testid="by-account-result">
			{#if failure}
				<RegisterErrorAlert error={failure} />
			{/if}
			{#if outcome?.kind === 'not-found'}
				<div class="space-y-3 rounded-md border bg-muted/40 p-3">
					<p class="text-sm" data-testid="by-account-not-found">
						{m['memberPeople.byAccount.notFound']()}
					</p>
					<Button type="button" variant="outline" onclick={() => closeThen(onCreateInviteLink)}>
						{m['memberPeople.byAccount.createInvite']()}
					</Button>
				</div>
			{:else if found && kind === 'pending-application'}
				<div class="space-y-3 rounded-md border bg-muted/40 p-3">
					<p class="text-sm" data-testid="by-account-pending">
						{m['memberPeople.byAccount.pending']({ name })}
					</p>
					<Button type="button" variant="outline" onclick={() => closeThen(onOpenApplications)}>
						{m['memberPeople.byAccount.reviewApplication']()}
					</Button>
				</div>
			{:else if found && kind === 'has-membership'}
				<div class="space-y-3 rounded-md border bg-muted/40 p-3">
					<p class="text-sm" data-testid="by-account-has-membership">
						{m['memberPeople.byAccount.hasMembership']({ name })}
					</p>
					{#if found.user.membership_status}
						<MemberStatusBadge status={found.user.membership_status} />
					{/if}
					{#if found.seed}
						{@const seed = found.seed}
						<div>
							<Button
								type="button"
								variant="outline"
								onclick={() => closeThen(() => onOpenPerson(seed))}
							>
								{m['memberPeople.byAccount.openPerson']()}
							</Button>
						</div>
					{/if}
				</div>
			{:else if found && kind === 'addable'}
				{@const user = found.user}
				<div class="space-y-3 rounded-md border bg-muted/40 p-3">
					<p class="text-sm font-medium" data-testid="by-account-found">
						{m['memberPeople.byAccount.found']({ name })}
					</p>
					{#if selectableTiers.length === 0}
						<p class="text-sm" data-testid="by-account-no-tiers">
							{m['memberPeople.byAccount.noTiers']()}
						</p>
						{#if onOpenTiers}
							<Button type="button" variant="outline" onclick={() => closeThen(onOpenTiers)}>
								{m['memberPeople.byAccount.goToTiers']()}
							</Button>
						{/if}
					{:else}
						<div class="space-y-2">
							<Label for="aba-tier">{m['memberPeople.byAccount.tierLabel']()}</Label>
							<select
								id="aba-tier"
								class={SELECT_CLASS}
								bind:value={tierId}
								disabled={add.isPending}
							>
								<option value="" disabled>{m['memberRegister.tierPlaceholder']()}</option>
								{#each selectableTiers as tier (tier.id)}
									<option value={tier.id}>{tier.name}</option>
								{/each}
							</select>
						</div>
						<Button type="button" disabled={!canAdd} onclick={() => add.mutate(user)}>
							{#if add.isPending}
								<Loader2 class="animate-spin" aria-hidden="true" />
							{/if}
							{m['memberPeople.byAccount.addMember']()}
						</Button>
					{/if}
				</div>
			{/if}
		</div>

		<DialogFooter class="gap-2 sm:gap-0">
			<Button type="button" variant="outline" onclick={onClose} disabled={add.isPending}>
				{m['memberRegister.cancel']()}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

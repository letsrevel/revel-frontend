<script lang="ts">
	import { untrack } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import { Info, Loader2 } from '@lucide/svelte';
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
	import {
		inviteMemberByAccount,
		invalidateInvitations,
		listMemberInvitations,
		memberRegisterKeys,
		revokeMemberInvitation,
		RegisterApiError
	} from '$lib/member-register/api';
	import { isAlreadyMember } from '$lib/member-register/error-codes';
	import {
		classifyLookup,
		lookupDisplayName,
		lookupWithSeed,
		validateLookupEmail,
		type AccountLookupOutcome
	} from '$lib/member-register/account-lookup';
	import { lookupThrottleRemaining, setLookupThrottle } from '$lib/member-register/lookup-throttle';
	import { describeRegisterError, type DescribedError } from '$lib/member-register/errors';
	import { SELECT_CLASS } from '$lib/member-register/ui';
	import RegisterErrorAlert from './RegisterErrorAlert.svelte';

	interface Props {
		open: boolean;
		slug: string;
		accessToken: string | null;
		/** STANDARD tiers only: the backend refuses any other tier on invite. */
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
	// Set when an invite was refused with 400: the re-lookup must explain why, and an
	// answer that still says "addable" means the refusal was something else.
	let refusedAdd = $state<unknown>(null);
	// Plain-language note to show once the next lookup answer lands (e.g. the
	// invitation we tried to withdraw was already accepted or expired).
	let pendingNotice = $state<string | null>(null);
	// The notice as shown: informational (not an error), so it renders as a status.
	let notice = $state<string | null>(null);
	let inputEl = $state<HTMLInputElement | null>(null);

	function reset() {
		email = '';
		emailError = null;
		queriedEmail = '';
		outcome = null;
		failure = null;
		tierId = '';
		refusedAdd = null;
		pendingNotice = null;
		notice = null;
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
		notice = null;
		const refusal = refusedAdd;
		const pending = pendingNotice;
		refusedAdd = null;
		pendingNotice = null;
		if (pending) notice = pending;
		const resultKind = result.kind === 'found' ? classifyLookup(result.user) : null;
		if (refusal && (resultKind === 'addable' || resultKind === 'invitation-pending')) {
			failure = describeInviteError(refusal);
		}
		if (result.kind === 'found' && result.user.pending_invitation_id) {
			void preselectInvitedTier(result.user.pending_invitation_id, typed);
		}
	}

	// Resending starts from the tier the pending invitation already carries, so a
	// bare Resend cannot silently change it. Reads the invitations list (cached by
	// PendingInvitations, fetched through the query otherwise); anything missing
	// falls back to the plain tier picker.
	async function preselectInvitedTier(invitationId: string, typed: string) {
		try {
			const key = memberRegisterKeys.invitations(slug);
			let results: { id: string; tier_id: string }[] | undefined = queryClient.getQueryData<{
				results: { id: string; tier_id: string }[];
			}>(key)?.results;
			if (!results) {
				const fetched = await queryClient.fetchQuery({
					queryKey: key,
					queryFn: () => listMemberInvitations(slug, accessToken),
					staleTime: 30_000
				});
				results = fetched.results;
			}
			const tier = results.find((i) => i.id === invitationId)?.tier_id;
			if (tier && stillShowing(typed) && selectableTiers.some((t) => t.id === tier)) {
				tierId = tier;
			}
		} catch {
			// no invitation tier to preselect
		}
	}

	// An invite that 404s means the backend could not invite this account (it only
	// invites verified, non-guest, active accounts) or the tier is not standard.
	function describeInviteError(error: unknown): DescribedError {
		if (error instanceof RegisterApiError && error.status === 404) {
			return { stale: false, message: m['memberPeople.byAccount.inviteNotFound'](), detail: null };
		}
		return describeRegisterError(error, 'save');
	}

	// Look the account up again after a race, unless the lockout is on: then there
	// is nothing to look up with, so show `onThrottled` inline and drop the stale card.
	function relookup(forEmail: string, onThrottled: () => void) {
		// Read the live deadline, not the `throttled` snapshot (it ticks on a timer).
		if (lookupThrottleRemaining(slug) > 0) {
			outcome = null;
			refusedAdd = null;
			pendingNotice = null;
			onThrottled();
			return;
		}
		lookup.mutate(forEmail);
	}

	function showFailure(error: unknown, typed: string) {
		const described = describeRegisterError(error, 'lookup');
		// The lockout is per staff user, so a 429 starts it even when the answer is
		// stale (the admin kept typing); only the visible state ignores stale answers.
		if (described.throttled) {
			startThrottle(error instanceof RegisterApiError ? error.retryAfterSeconds : null);
		}
		if (email.trim() !== typed) return;
		outcome = null;
		refusedAdd = null;
		pendingNotice = null;
		notice = null;
		failure = described;
	}

	const lookup = createMutation(() => ({
		mutationFn: (typed: string) => lookupWithSeed(slug, accessToken, typed),
		onSuccess: (result: AccountLookupOutcome, typed: string) => showOutcome(result, typed),
		onError: (error: unknown, typed: string) => showFailure(error, typed)
	}));

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (lookup.isPending || throttled || busy) return;
		emailError = validateLookupEmail(email);
		if (emailError) return;
		outcome = null;
		failure = null;
		notice = null;
		refusedAdd = null;
		pendingNotice = null;
		lookup.mutate(email.trim());
	}

	function oninput() {
		// Any edit invalidates what was found for the previous value.
		outcome = null;
		failure = null;
		notice = null;
		emailError = null;
		refusedAdd = null;
		pendingNotice = null;
	}

	const found = $derived(outcome?.kind === 'found' ? outcome : null);
	const kind = $derived(found ? classifyLookup(found.user) : null);
	const name = $derived(found ? lookupDisplayName(found.user, queriedEmail) : '');

	const tierName = (id: string) => tiers.find((t) => t.id === id)?.name ?? '';

	// True while the dialog still shows the account an invite/withdraw was sent for:
	// the admin may have looked someone else up while the call was in flight.
	function stillShowing(forEmail: string): boolean {
		return queriedEmail === forEmail && email.trim() === forEmail;
	}

	// Inviting and resending are the same call: re-inviting renews the invitation.
	const invite = createMutation(() => ({
		mutationFn: (vars: {
			user: OrgUserLookupSchema;
			renew: boolean;
			email: string;
			tierId: string;
		}) => inviteMemberByAccount(slug, accessToken, vars.user.user_id, vars.tierId),
		onSuccess: (_data, vars) => {
			invalidateInvitations(queryClient, slug).catch(() => undefined);
			const who = lookupDisplayName(vars.user, vars.email);
			toast.success(
				vars.renew
					? m['memberPeople.byAccount.resent']({ name: who })
					: m['memberPeople.byAccount.invited']({ name: who, tier: tierName(vars.tierId) })
			);
			if (stillShowing(vars.email)) onClose();
		},
		onError: (error: unknown, vars) => {
			// The dialog may have moved on to someone else: the outcome still reaches the
			// admin as a toast (success always does), only the inline state is skipped.
			const current = stillShowing(vars.email);
			// `already_member` (backend #1363) means a race with another admin or an
			// approval: look again and show what they hold now. Any other 400 is a
			// plain refusal, shown as is, without spending a throttled lookup.
			if (isAlreadyMember(error)) {
				if (!current) {
					toast.info(m['makeMemberAction.alreadyMember']());
					return;
				}
				refusedAdd = error;
				relookup(vars.email, () => {
					failure = describeInviteError(error);
				});
				return;
			}
			const described = describeInviteError(error);
			if (!current) {
				toast.error(described.message);
				return;
			}
			failure = described;
		}
	}));

	const withdraw = createMutation(() => ({
		mutationFn: (vars: { user: OrgUserLookupSchema; invitationId: string; email: string }) =>
			revokeMemberInvitation(slug, accessToken, vars.invitationId),
		onSuccess: (_data, vars) => {
			invalidateInvitations(queryClient, slug).catch(() => undefined);
			toast.success(
				m['memberPeople.byAccount.withdrawn']({ name: lookupDisplayName(vars.user, vars.email) })
			);
			if (stillShowing(vars.email)) onClose();
		},
		onError: (error: unknown, vars) => {
			invalidateInvitations(queryClient, slug).catch(() => undefined);
			const current = stillShowing(vars.email);
			// 404: accepted or expired meanwhile. Explain, then show what they are now.
			if (error instanceof RegisterApiError && error.status === 404) {
				const gone = m['memberPeople.byAccount.withdrawGone']();
				if (!current) {
					toast.info(gone);
					return;
				}
				pendingNotice = gone;
				relookup(vars.email, () => {
					notice = gone;
				});
				return;
			}
			const described = describeRegisterError(error, 'save');
			if (!current) {
				toast.error(described.message);
				return;
			}
			failure = described;
		}
	}));

	const busy = $derived(invite.isPending || withdraw.isPending);

	function handleOpenChange(next: boolean) {
		if (!next && !busy) onClose();
	}

	function closeThen(action: () => void) {
		onClose();
		action();
	}

	const canInvite = $derived(!!tierId && !busy && !lookup.isPending);
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
			<Button
				type="submit"
				disabled={lookup.isPending || throttled || busy}
				class="w-full sm:w-auto"
			>
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
			{#if notice}
				<!-- Informational, not an error: the withdrawal's goal is already met. -->
				<div
					role="status"
					class="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm"
					data-testid="by-account-notice"
				>
					<Info class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
					<p>{notice}</p>
				</div>
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
			{:else if found && (kind === 'addable' || kind === 'invitation-pending')}
				{@const user = found.user}
				<div class="space-y-3 rounded-md border bg-muted/40 p-3">
					<p class="text-sm font-medium" data-testid="by-account-found">
						{m['memberPeople.byAccount.found']({ name })}
					</p>
					{#if kind === 'invitation-pending'}
						<p class="text-sm" data-testid="by-account-invitation-pending">
							{m['memberPeople.byAccount.invitationPending']({ name })}
						</p>
					{/if}
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
							<select id="aba-tier" class={SELECT_CLASS} bind:value={tierId} disabled={busy}>
								<option value="" disabled>{m['memberRegister.tierPlaceholder']()}</option>
								{#each selectableTiers as tier (tier.id)}
									<option value={tier.id}>{tier.name}</option>
								{/each}
							</select>
						</div>
						<div class="flex flex-wrap gap-2">
							<Button
								type="button"
								disabled={!canInvite}
								onclick={() =>
									invite.mutate({
										user,
										renew: kind === 'invitation-pending',
										email: queriedEmail,
										tierId
									})}
							>
								{#if invite.isPending}
									<Loader2 class="animate-spin" aria-hidden="true" />
								{/if}
								{kind === 'invitation-pending'
									? m['memberPeople.byAccount.resend']()
									: m['memberPeople.byAccount.invite']()}
							</Button>
						</div>
					{/if}
					{#if kind === 'invitation-pending' && user.pending_invitation_id}
						{@const invitationId = user.pending_invitation_id}
						<!-- Withdrawing needs only the invitation, never a tier: keep it outside the tier branch. -->
						<div>
							<Button
								type="button"
								variant="outline"
								disabled={busy || lookup.isPending}
								onclick={() => withdraw.mutate({ user, invitationId, email: queriedEmail })}
							>
								{#if withdraw.isPending}
									<Loader2 class="animate-spin" aria-hidden="true" />
								{/if}
								{m['memberPeople.byAccount.withdraw']()}
							</Button>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<DialogFooter class="gap-2 sm:gap-0">
			<Button type="button" variant="outline" onclick={onClose} disabled={busy}>
				{m['memberRegister.cancel']()}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

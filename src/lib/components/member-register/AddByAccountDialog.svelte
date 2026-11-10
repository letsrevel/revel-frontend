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
	import {
		addMemberByAccount,
		invalidateRegister,
		RegisterApiError
	} from '$lib/member-register/api';
	import {
		classifyLookup,
		lookupDisplayName,
		lookupWithSeed,
		resolveSeed,
		seedDeps,
		validateLookupEmail,
		type AccountLookupOutcome
	} from '$lib/member-register/account-lookup';
	import { memberAccessPrefix } from '$lib/member-register/member-access';
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
	}

	const {
		open,
		slug,
		accessToken,
		tiers,
		onClose,
		onOpenPerson,
		onOpenApplications,
		onCreateInviteLink
	}: Props = $props();

	const queryClient = useQueryClient();

	let email = $state('');
	let emailError = $state<'required' | 'invalid' | null>(null);
	// The email the shown result belongs to (the input may have moved on).
	let queriedEmail = $state('');
	let outcome = $state<AccountLookupOutcome | null>(null);
	let failure = $state<DescribedError | null>(null);
	let throttled = $state(false);
	let tierId = $state('');
	let inputEl = $state<HTMLInputElement | null>(null);

	function reset() {
		email = '';
		emailError = null;
		queriedEmail = '';
		outcome = null;
		failure = null;
		throttled = false;
		tierId = '';
	}

	$effect(() => {
		if (open) untrack(reset);
	});

	// A throttled lookup keeps the submit disabled for the advised wait.
	let throttleTimer: ReturnType<typeof setTimeout> | undefined;
	function startThrottle(seconds: number | null) {
		throttled = true;
		clearTimeout(throttleTimer);
		throttleTimer = setTimeout(() => (throttled = false), (seconds ?? 60) * 1000);
	}
	$effect(() => () => clearTimeout(throttleTimer));

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
	}

	function showFailure(error: unknown, typed: string) {
		if (email.trim() !== typed) return;
		outcome = null;
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
		lookup.mutate(email.trim());
	}

	function oninput() {
		// Any edit invalidates what was found for the previous value.
		outcome = null;
		failure = null;
		emailError = null;
	}

	const found = $derived(outcome?.kind === 'found' ? outcome : null);
	const kind = $derived(found ? classifyLookup(found.user) : null);
	const name = $derived(found ? lookupDisplayName(found.user, queriedEmail) : '');

	function refreshMembers(): Promise<unknown> {
		return Promise.all([
			queryClient.invalidateQueries({ queryKey: ['organization', slug, 'members'] }),
			invalidateRegister(queryClient, slug, true),
			// The person sheet's single-member lookup sits outside the list prefix.
			queryClient.invalidateQueries({ queryKey: memberAccessPrefix(slug) })
		]);
	}

	const add = createMutation(() => ({
		mutationFn: async (user: OrgUserLookupSchema) => {
			await addMemberByAccount(slug, accessToken, user.user_id, tierId);
			await refreshMembers();
			// The new entry exists now: seed the sheet from it (null just skips the sheet).
			return resolveSeed(user, seedDeps(slug, accessToken));
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

	const canAdd = $derived(!!tierId && !add.isPending);
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
					<div class="space-y-2">
						<Label for="aba-tier">{m['memberPeople.byAccount.tierLabel']()}</Label>
						<select id="aba-tier" class={SELECT_CLASS} bind:value={tierId} disabled={add.isPending}>
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

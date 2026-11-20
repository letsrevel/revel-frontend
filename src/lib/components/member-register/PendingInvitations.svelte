<script lang="ts">
	import { tick, untrack } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import { Loader2 } from '@lucide/svelte';
	import type { MemberInvitationSchema } from '$lib/api/generated/types.gen';
	import { Button } from '$lib/components/ui/button';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import RegisterErrorAlert from './RegisterErrorAlert.svelte';
	import {
		invalidateInvitations,
		listMemberInvitations,
		memberRegisterKeys,
		RegisterApiError,
		revokeMemberInvitation
	} from '$lib/member-register/api';
	import { describeRegisterError, type DescribedError } from '$lib/member-register/errors';
	import { formatDate } from '$lib/utils/date';

	interface Props {
		slug: string;
		accessToken: string | null;
		/** Only fetch while the People tab is showing. */
		active?: boolean;
	}

	const { slug, accessToken, active = true }: Props = $props();

	const queryClient = useQueryClient();

	const invitationsQuery = createQuery(() => ({
		queryKey: memberRegisterKeys.invitations(slug),
		queryFn: () => listMemberInvitations(slug, accessToken),
		enabled: active && !!accessToken
	}));
	const invitations = $derived(invitationsQuery.data?.results ?? []);
	// A failed load must not look like "no pending invitations" (which hides the section).
	const loadFailed = $derived(invitationsQuery.isError && !invitationsQuery.data);

	let failure = $state<DescribedError | null>(null);
	// The "accepted or expired" explanation is the one failure that must outlive the
	// refetch it triggers: the row vanishing is exactly what it explains (and the
	// section may be empty by then). Every other failure is cleared by the next
	// successful fetch, so a stale "Failed to withdraw" cannot linger over fresh data.
	let failureIsGone = false;
	let rootEl = $state<HTMLElement | null>(null);
	let fallbackEl = $state<HTMLElement | null>(null);
	// Only filled after a withdrawal empties the list, so it is never stray text.
	let emptyAnnouncement = $state('');

	let lastDataUpdate = 0;
	$effect(() => {
		const updated = invitationsQuery.dataUpdatedAt;
		untrack(() => {
			if (updated === lastDataUpdate) return;
			lastDataUpdate = updated;
			if (failure && !failureIsGone) failure = null;
		});
	});

	// WCAG 2.4.3: the withdrawn row (or the whole section) unmounts, which would drop
	// focus to <body>. Move it to the next row's button, else the previous one, else
	// the heading, else the always-rendered sr-only target.
	async function restoreFocus(neighbourId: string | null) {
		await tick();
		const root = rootEl;
		if (!root) return;
		const button = neighbourId
			? root.querySelector<HTMLElement>(`[data-withdraw-for="${CSS.escape(neighbourId)}"]`)
			: null;
		if (button) return button.focus();
		const heading = root.querySelector<HTMLElement>('#pending-invitations-heading');
		if (heading) {
			heading.setAttribute('tabindex', '-1');
			return heading.focus();
		}
		emptyAnnouncement = m['memberPeople.invitations.none']();
		await tick();
		fallbackEl?.focus();
	}

	// The row being withdrawn is about to unmount: refresh, then move focus to its
	// neighbour (or the fallbacks in `restoreFocus`).
	function refreshThenRestoreFocus(invitation: MemberInvitationSchema) {
		const index = invitations.findIndex((i) => i.id === invitation.id);
		const neighbour = invitations[index + 1] ?? invitations[index - 1] ?? null;
		const neighbourId = neighbour && neighbour.id !== invitation.id ? neighbour.id : null;
		invalidateInvitations(queryClient, slug)
			.catch(() => undefined)
			.then(() => restoreFocus(neighbourId));
	}

	const withdraw = createMutation(() => ({
		mutationFn: (invitation: MemberInvitationSchema) =>
			revokeMemberInvitation(slug, accessToken, invitation.id),
		onMutate: () => {
			failure = null;
			failureIsGone = false;
			emptyAnnouncement = '';
		},
		onSuccess: (_data, invitation) => {
			toast.success(
				m['memberPeople.invitations.withdrawn']({ name: invitation.invitee_display_name })
			);
			refreshThenRestoreFocus(invitation);
		},
		onError: (error: unknown, invitation) => {
			if (error instanceof RegisterApiError && error.status === 404) {
				// Accepted or expired meanwhile: it is gone either way, so refresh the list
				// (its row, and the focused Withdraw button with it, disappears).
				failure = { stale: true, message: m['memberPeople.invitations.gone'](), detail: null };
				failureIsGone = true;
				refreshThenRestoreFocus(invitation);
				return;
			}
			failure = describeRegisterError(error, 'save');
		}
	}));

	const pendingId = $derived(withdraw.isPending ? withdraw.variables?.id : null);
</script>

<!-- `contents`: no box of its own, so it never adds spacing when empty. -->
<div bind:this={rootEl} class="contents">
	<!-- Focus target of last resort once the section is gone; announces the empty state. -->
	<p bind:this={fallbackEl} class="sr-only" tabindex="-1" data-testid="pending-invitations-focus">
		{emptyAnnouncement}
	</p>
	{#if invitations.length > 0 || loadFailed || failure}
		<section
			class="space-y-3"
			aria-labelledby="pending-invitations-heading"
			data-testid="pending-invitations"
		>
			<SectionHeader
				id="pending-invitations-heading"
				volume="studio"
				title={m['memberPeople.invitations.heading']()}
				subtitle={m['memberPeople.invitations.subtitle']()}
			/>
			{#if failure}
				<RegisterErrorAlert error={failure} />
			{/if}
			{#if loadFailed}
				<div class="space-y-2" data-testid="pending-invitations-load-error">
					<RegisterErrorAlert
						error={{
							stale: false,
							message: m['memberPeople.invitations.loadError'](),
							detail: null
						}}
					/>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={invitationsQuery.isFetching}
						onclick={() => invitationsQuery.refetch()}
					>
						{m['memberPeople.invitations.retry']()}
					</Button>
				</div>
			{/if}
			{#if invitations.length > 0}
				<ul class="divide-y rounded-md border bg-card">
					{#each invitations as invitation (invitation.id)}
						<li
							class="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
							data-testid="pending-invitation"
						>
							<div class="min-w-0">
								<p class="truncate font-bold">{invitation.invitee_display_name}</p>
								<p class="text-sm text-muted-foreground">
									{invitation.tier_name} &middot;
									{m['memberPeople.invitations.expires']({
										date: formatDate(invitation.expires_at)
									})}
								</p>
							</div>
							<Button
								type="button"
								variant="outline"
								size="sm"
								class="self-start sm:self-auto"
								disabled={withdraw.isPending}
								data-withdraw-for={invitation.id}
								aria-label={m['memberPeople.invitations.withdrawAria']({
									name: invitation.invitee_display_name
								})}
								onclick={() => withdraw.mutate(invitation)}
							>
								{#if pendingId === invitation.id}
									<Loader2 class="animate-spin" aria-hidden="true" />
								{/if}
								{m['memberPeople.invitations.withdraw']()}
							</Button>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</div>

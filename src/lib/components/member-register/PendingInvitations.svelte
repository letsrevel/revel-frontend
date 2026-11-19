<script lang="ts">
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

	const withdraw = createMutation(() => ({
		mutationFn: (invitation: MemberInvitationSchema) =>
			revokeMemberInvitation(slug, accessToken, invitation.id),
		onMutate: () => {
			failure = null;
		},
		onSuccess: (_data, invitation) => {
			toast.success(
				m['memberPeople.invitations.withdrawn']({ name: invitation.invitee_display_name })
			);
			invalidateInvitations(queryClient, slug).catch(() => undefined);
		},
		onError: (error: unknown) => {
			if (error instanceof RegisterApiError && error.status === 404) {
				// Accepted or expired meanwhile: it is gone either way, so refresh the list.
				failure = { stale: true, message: m['memberPeople.invitations.gone'](), detail: null };
				invalidateInvitations(queryClient, slug).catch(() => undefined);
				return;
			}
			failure = describeRegisterError(error, 'save');
		}
	}));

	const pendingId = $derived(withdraw.isPending ? withdraw.variables?.id : null);
</script>

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
					error={{ stale: false, message: m['memberPeople.invitations.loadError'](), detail: null }}
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
								{m['memberPeople.invitations.expires']({ date: formatDate(invitation.expires_at) })}
							</p>
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							class="self-start sm:self-auto"
							disabled={withdraw.isPending}
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

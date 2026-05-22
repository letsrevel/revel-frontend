<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu';
	import { BarChart3, Edit, ExternalLink, MoreHorizontal, Play, Trash2 } from 'lucide-svelte';
	import PollStatusBadge from './PollStatusBadge.svelte';
	import PollUrlStrip from './PollUrlStrip.svelte';
	import { toast } from 'svelte-sonner';
	import {
		pollOpenPollAction,
		pollClosePollAction,
		pollDeletePollAction
	} from '$lib/api/generated/sdk.gen';
	import { buildPollVoterUrl, isPollDraft, formatVoteCount } from '$lib/utils/polls';
	import type { PollListItemSchema } from '$lib/api/generated/types.gen';

	interface Props {
		poll: PollListItemSchema;
		organizationSlug: string;
		isOwner?: boolean;
		accessToken?: string;
		voteCount?: number;
	}

	const { poll, organizationSlug, isOwner = false, accessToken, voteCount }: Props = $props();

	const origin = $derived($page?.url?.origin ?? '');
	const voterUrl = $derived(buildPollVoterUrl(origin, organizationSlug, poll.id));
	const editHref = $derived(`/org/${organizationSlug}/admin/polls/${poll.id}`);

	let isLifecycleBusy = $state(false);
	let isDeleting = $state(false);

	function authHeaders(): Record<string, string> {
		return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
	}

	async function openPoll() {
		if (isLifecycleBusy) return;
		isLifecycleBusy = true;
		try {
			const res = await pollOpenPollAction({ path: { poll_id: poll.id }, headers: authHeaders() });
			if (res.error) throw new Error('open');
			await invalidateAll();
		} catch (e) {
			console.error(e);
			toast.error(m['pollStatusBar.lifecycleError']());
		} finally {
			isLifecycleBusy = false;
		}
	}

	async function closePoll() {
		if (isLifecycleBusy) return;
		isLifecycleBusy = true;
		try {
			const res = await pollClosePollAction({ path: { poll_id: poll.id }, headers: authHeaders() });
			if (res.error) throw new Error('close');
			await invalidateAll();
		} catch (e) {
			console.error(e);
			toast.error(m['pollStatusBar.lifecycleError']());
		} finally {
			isLifecycleBusy = false;
		}
	}

	async function deletePoll() {
		if (!confirm(m['pollCard.confirmDelete']({ name: poll.questionnaire_name }))) return;
		isDeleting = true;
		try {
			const res = await pollDeletePollAction({
				path: { poll_id: poll.id },
				headers: authHeaders()
			});
			if (res.error) throw new Error('delete');
			await invalidateAll();
		} catch (e) {
			console.error(e);
			toast.error(m['pollStatusBar.lifecycleError']());
		} finally {
			isDeleting = false;
		}
	}

	const voteLabel = $derived(() => {
		if (voteCount === undefined) return null;
		const f = formatVoteCount(voteCount);
		if (f.key === 'votes_zero') return m['pollCard.votes_zero']();
		if (f.key === 'votes_one') return m['pollCard.votes_one']();
		return m['pollCard.votes_other']({ count: String(f.count) });
	});
</script>

<Card class="transition-all hover:shadow-md">
	<CardHeader>
		<div class="flex items-start justify-between gap-2">
			<div class="min-w-0 flex-1">
				<CardTitle class="line-clamp-1">{poll.questionnaire_name}</CardTitle>
				<CardDescription class="mt-1 flex flex-wrap gap-1">
					<PollStatusBadge status={poll.status} />
					<Badge variant="outline" class="text-xs">{poll.vote_visibility}</Badge>
				</CardDescription>
			</div>
			<DropdownMenu>
				<DropdownMenuTrigger
					aria-label={m['pollCard.moreActions']()}
					class="rounded-md p-1 hover:bg-accent"
				>
					<MoreHorizontal class="h-5 w-5" />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onclick={() => window.open(voterUrl, '_blank', 'noopener')}>
						<ExternalLink class="mr-2 h-4 w-4" />
						{m['pollCard.viewAsVoter']()}
					</DropdownMenuItem>
					{#if poll.status === 'open'}
						<DropdownMenuItem onclick={closePoll} disabled={isLifecycleBusy}>
							{m['pollCard.close']()}
						</DropdownMenuItem>
					{/if}
					{#if isOwner}
						<DropdownMenuItem
							onclick={deletePoll}
							disabled={isDeleting}
							class="text-destructive focus:text-destructive"
						>
							<Trash2 class="mr-2 h-4 w-4" />
							{m['pollCard.delete']()}
						</DropdownMenuItem>
					{/if}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	</CardHeader>
	<CardContent>
		<div class="space-y-4">
			{#if voteLabel() || poll.closes_at || poll.closed_at || poll.status === 'draft'}
				<div class="flex flex-wrap gap-4 text-sm text-muted-foreground">
					{#if voteLabel()}
						<span>{voteLabel()}</span>
					{/if}
					{#if poll.status === 'open' && poll.closes_at}
						<span
							>{m['pollCard.closesIn']({
								duration: new Date(poll.closes_at).toLocaleString()
							})}</span
						>
					{:else if poll.status === 'closed' && poll.closed_at}
						<span
							>{m['pollCard.closedAgo']({ ago: new Date(poll.closed_at).toLocaleString() })}</span
						>
					{:else if poll.status === 'draft'}
						<span>{m['pollCard.notOpenedYet']()}</span>
					{/if}
				</div>
			{/if}

			{#if isPollDraft(poll.status)}
				<Button class="w-full gap-2" onclick={openPoll} disabled={isLifecycleBusy}>
					<Play class="h-4 w-4" />
					{m['pollCard.openPoll']()}
				</Button>
			{:else}
				<PollUrlStrip url={voterUrl} />
			{/if}

			<div class="flex gap-2">
				<Button href={editHref} variant="outline" size="sm" class="flex-1 gap-2">
					<Edit class="h-4 w-4" />
					{m['pollCard.edit']()}
				</Button>
				<Button href={`${editHref}#results`} variant="outline" size="sm" class="flex-1 gap-2">
					<BarChart3 class="h-4 w-4" />
					{m['pollCard.results']()}
				</Button>
			</div>
		</div>
	</CardContent>
</Card>

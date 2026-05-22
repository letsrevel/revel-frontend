<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import PollStatusBadge from '$lib/components/polls/PollStatusBadge.svelte';
	import PollResultsView from '$lib/components/polls/PollResultsView.svelte';
	import { pollWithdrawVoteAction } from '$lib/api/generated/sdk.gen';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}
	const { data }: Props = $props();
	const poll = $derived(data.poll);

	let withdrawing = $state(false);

	const requiresAuth = $derived(
		!data.isAuthenticated &&
			poll.vote_visibility !== 'public' &&
			poll.vote_visibility !== 'unlisted'
	);

	async function withdrawVote() {
		if (!confirm(m['pollVoterPage.withdrawConfirm']())) return;
		if (!data.accessToken) return;
		withdrawing = true;
		try {
			const res = await pollWithdrawVoteAction({
				path: { poll_id: poll.id },
				headers: { Authorization: `Bearer ${data.accessToken}` }
			});
			if (res.error) throw new Error('withdraw');
			toast.success(m['pollVoterPage.withdrawSuccess']());
			await invalidateAll();
		} catch (e) {
			console.error(e);
			toast.error(m['pollEditPage.saveError']());
		} finally {
			withdrawing = false;
		}
	}
</script>

<svelte:head>
	<title>{m['pollVoterPage.title']({ name: poll.questionnaire?.name ?? 'Poll' })}</title>
</svelte:head>

<main class="container mx-auto max-w-3xl space-y-6 px-4 py-8">
	<Card>
		<CardHeader>
			<CardTitle class="flex items-center justify-between gap-2">
				<span>{poll.questionnaire?.name ?? 'Poll'}</span>
				<PollStatusBadge status={poll.status} />
			</CardTitle>
		</CardHeader>
		<CardContent>
			{#if poll.questionnaire?.description}
				<p class="text-sm text-muted-foreground">{poll.questionnaire.description}</p>
			{/if}
		</CardContent>
	</Card>

	<!-- State banners -->
	{#if requiresAuth}
		<Card class="border-blue-500/50 bg-blue-50/30 dark:bg-blue-950/20">
			<CardContent class="space-y-2 py-4 text-sm">
				<p>{m['pollVoterPage.signInToVote']()}</p>
				<Button href={`/login?next=${encodeURIComponent($page.url.pathname)}`}>Sign in</Button>
			</CardContent>
		</Card>
	{:else if poll.status === 'draft'}
		<Card class="border-amber-500/50">
			<CardContent class="py-4 text-sm">{m['pollVoterPage.draftBanner']()}</CardContent>
		</Card>
	{:else if poll.status === 'closed' && poll.user_has_voted}
		<Card>
			<CardContent class="py-4 text-sm">{m['pollVoterPage.closedVotedBanner']()}</CardContent>
		</Card>
	{:else if poll.status === 'closed'}
		<Card>
			<CardContent class="py-4 text-sm">{m['pollVoterPage.closedNotVotedBanner']()}</CardContent>
		</Card>
	{:else if poll.status === 'open' && !poll.user_can_vote && !poll.user_has_voted}
		<Card class="border-amber-500/50">
			<CardContent class="py-4 text-sm">{m['pollVoterPage.ineligibleBanner']()}</CardContent>
		</Card>
	{:else if poll.user_has_voted}
		<Card>
			<CardContent class="space-y-2 py-4 text-sm">
				<p>{m['pollVoterPage.votedBanner']()}</p>
				{#if poll.status === 'open' && poll.allow_vote_changes}
					<Button variant="outline" size="sm" onclick={withdrawVote} disabled={withdrawing}>
						{m['pollVoterPage.withdrawVote']()}
					</Button>
				{/if}
			</CardContent>
		</Card>
	{/if}

	<!-- Vote form placeholder (gated on backend exposing PollDetailSchema.questionnaire) -->
	{#if poll.user_can_vote && poll.questionnaire}
		<Card>
			<CardHeader>
				<CardTitle>Cast your vote</CardTitle>
			</CardHeader>
			<CardContent>
				<p class="text-sm italic text-muted-foreground">
					Vote form will render here once the backend populates PollDetailSchema.questionnaire.
				</p>
			</CardContent>
		</Card>
	{/if}

	<!-- Results -->
	{#if poll.user_can_see_results && poll.results}
		<Card>
			<CardHeader>
				<CardTitle>{m['pollVoterPage.resultsTitle']()}</CardTitle>
			</CardHeader>
			<CardContent>
				{#if poll.results.total_voters > 0}
					<PollResultsView results={poll.results} staffAnonymous={poll.staff_anonymous} />
				{:else}
					<p class="text-sm text-muted-foreground">{m['pollVoterPage.resultsEmpty']()}</p>
				{/if}
			</CardContent>
		</Card>
	{/if}
</main>

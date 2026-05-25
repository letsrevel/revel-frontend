<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import PollPrivacySummary from '$lib/components/polls/PollPrivacySummary.svelte';
	import PollResultsView from '$lib/components/polls/PollResultsView.svelte';
	import PollStatusBadge from '$lib/components/polls/PollStatusBadge.svelte';
	import PollVoteForm from '$lib/components/polls/PollVoteForm.svelte';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import { pollWithdrawVoteAction } from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}
	const { data }: Props = $props();
	const poll = $derived(data.poll);

	let withdrawing = $state(false);
	let withdrawConfirmOpen = $state(false);
	// When true, hide the "voted" banner and show the form so the user can change their vote.
	let editing = $state(false);

	// Anonymous viewer on a public/unlisted poll — they're allowed to see it,
	// but voting requires auth. The backend will 401 a vote submission, so we
	// surface a "Sign in to vote" banner up-front rather than the generic
	// "ineligible" message.
	const requiresAuth = $derived(
		!!poll &&
			!data.isAuthenticated &&
			(poll.vote_visibility === 'public' || poll.vote_visibility === 'unlisted')
	);

	// Show the vote form when: user can vote AND questionnaire is present AND (hasn't voted yet OR is actively editing)
	const showForm = $derived(
		!!poll && !!poll.questionnaire && poll.user_can_vote && (!poll.user_has_voted || editing)
	);

	// Show the "voted" banner only when voted AND not currently editing
	const showVotedBanner = $derived(!!poll && poll.user_has_voted && !editing);

	async function withdrawVote() {
		if (!poll) return;
		if (!authStore.accessToken) {
			// Don't fail silently — the user clicked withdraw and deserves feedback
			// (e.g. the in-memory token hasn't rehydrated yet).
			toast.error(m['pollVoterPage.withdrawError']());
			return;
		}
		withdrawing = true;
		try {
			const res = await pollWithdrawVoteAction({
				path: { poll_id: poll.id },
				headers: { Authorization: `Bearer ${authStore.accessToken}` }
			});
			if (res.error) throw new Error('withdraw');
			toast.success(m['pollVoterPage.withdrawSuccess']());
			withdrawConfirmOpen = false;
			await invalidateAll();
		} catch (e) {
			console.error(e);
			toast.error(m['pollVoterPage.withdrawError']());
		} finally {
			withdrawing = false;
		}
	}

	function handleVoteSuccess() {
		editing = false;
	}
</script>

<svelte:head>
	<title>{m['pollVoterPage.title']({ name: poll?.questionnaire?.name ?? 'Poll' })}</title>
</svelte:head>

<main class="container mx-auto max-w-3xl space-y-6 px-4 py-8">
	{#if data.forbidden}
		<!--
			Backend returned 403: the poll exists but the caller is not in any
			audience. We don't have poll data to render the privacy summary, so
			show a self-contained no-access page rather than falling through to
			the global 404.
		-->
		<Card class="border-amber-500/50">
			<CardHeader>
				<CardTitle level={2}>{m['pollVoterPage.forbiddenTitle']()}</CardTitle>
			</CardHeader>
			<CardContent class="space-y-3 py-4 text-sm">
				<p>{m['pollVoterPage.forbiddenBody']()}</p>
				{#if !data.isAuthenticated}
					<Button href={`/login?next=${encodeURIComponent($page.url.pathname)}`}>
						{m['pollVoterPage.signIn']()}
					</Button>
				{/if}
			</CardContent>
		</Card>
	{:else if poll}
		<Card>
			<CardHeader>
				<CardTitle level={2} class="flex items-center justify-between gap-2">
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

		<PollPrivacySummary
			voteVisibility={poll.vote_visibility}
			resultVisibility={poll.result_visibility}
			resultTiming={poll.result_timing}
			staffAnonymous={poll.staff_anonymous}
			publicAnonymous={poll.public_anonymous}
			allowVoteChanges={poll.allow_vote_changes}
		/>

		<!-- State banners — order matters; first match wins -->
		{#if poll.status === 'draft'}
			<Card class="border-amber-500/50">
				<CardContent class="py-4 text-sm">{m['pollVoterPage.draftBanner']()}</CardContent>
			</Card>
		{:else if requiresAuth}
			<!--
				Anonymous viewer on public/unlisted poll: they can see the poll,
				but voting needs auth. Surface a sign-in CTA rather than the
				generic "ineligible" banner (which implies they couldn't vote
				even if signed in).
			-->
			<Card class="border-blue-500/50 bg-blue-50/30 dark:bg-blue-950/20">
				<CardContent class="space-y-2 py-4 text-sm">
					<p>{m['pollVoterPage.signInToVote']()}</p>
					<Button href={`/login?next=${encodeURIComponent($page.url.pathname)}`}
						>{m['pollVoterPage.signIn']()}</Button
					>
				</CardContent>
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
			<!--
				Authenticated viewer who passes the BE audience check
				(otherwise we'd be in the data.forbidden branch above) but
				can't vote — typically a tier mismatch. We deliberately KEEP
				the PollPrivacySummary visible above this banner so the user
				can see WHY they're ineligible ("members in tier X"), unlike
				the forbidden card which strips all poll details from
				non-audience callers.
			-->
			<Card class="border-amber-500/50">
				<CardContent class="py-4 text-sm">{m['pollVoterPage.ineligibleBanner']()}</CardContent>
			</Card>
		{:else if showVotedBanner}
			<Card>
				<CardContent class="space-y-2 py-4 text-sm">
					<p>{m['pollVoterPage.votedBanner']()}</p>
					{#if poll.status === 'open' && poll.allow_vote_changes}
						<div class="flex flex-wrap gap-2">
							<Button variant="outline" size="sm" onclick={() => (editing = true)}>
								{m['pollVoterPage.changeVote']()}
							</Button>
							<Button
								variant="outline"
								size="sm"
								onclick={() => (withdrawConfirmOpen = true)}
								disabled={withdrawing}
							>
								{m['pollVoterPage.withdrawVote']()}
							</Button>
						</div>
					{/if}
				</CardContent>
			</Card>
		{/if}

		<!-- Vote form -->
		{#if showForm && poll.questionnaire}
			<Card>
				<CardHeader>
					<CardTitle level={2}>{m['pollVoterPage.castVoteTitle']()}</CardTitle>
				</CardHeader>
				<CardContent>
					<PollVoteForm
						questionnaire={poll.questionnaire}
						pollId={poll.id}
						initialVote={poll.user_vote}
						onSuccess={handleVoteSuccess}
					/>
				</CardContent>
			</Card>
		{/if}

		<!-- Results -->
		{#if poll.user_can_see_results && poll.results}
			<Card>
				<CardHeader>
					<CardTitle level={2}>{m['pollVoterPage.resultsTitle']()}</CardTitle>
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
	{/if}
</main>

<ConfirmDialog
	isOpen={withdrawConfirmOpen}
	variant="danger"
	title={m['pollVoterPage.withdrawConfirmTitle']()}
	message={m['pollVoterPage.withdrawConfirm']()}
	confirmText={m['pollVoterPage.withdrawVote']()}
	onCancel={() => (withdrawConfirmOpen = false)}
	onConfirm={withdrawVote}
/>

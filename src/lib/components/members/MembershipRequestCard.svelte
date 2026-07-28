<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type {
		MembershipRequestStatus,
		OrganizationMembershipRequestRetrieve
	} from '$lib/api/generated/types.gen';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { CheckCircle, XCircle, MessageSquare } from '@lucide/svelte';
	import { formatRelativeTime } from '$lib/utils/date';
	import UserAvatar from '$lib/components/common/UserAvatar.svelte';

	interface Props {
		request: OrganizationMembershipRequestRetrieve;
		/** Owning organization — needed to build the questionnaire-submission link. */
		orgSlug: string;
		onApprove?: (request: OrganizationMembershipRequestRetrieve) => void;
		onReject?: (request: OrganizationMembershipRequestRetrieve) => void;
		isProcessing?: boolean;
		showActions?: boolean;
	}

	const {
		request,
		orgSlug,
		onApprove,
		onReject,
		isProcessing = false,
		showActions = true
	}: Props = $props();

	// Every state the application state machine can be in. The label carries the
	// meaning; the tint is decoration only (WCAG: never colour alone).
	const STATUS_BADGES: Record<MembershipRequestStatus, { classes: string; label: () => string }> = {
		pending: {
			classes: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
			label: () => m['membershipRequestCard.statusPending']()
		},
		approved: {
			classes: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
			label: () => m['membershipRequestCard.approved']()
		},
		completed: {
			classes: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
			label: () => m['membershipRequestCard.statusCompleted']()
		},
		rejected: {
			classes: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
			label: () => m['membershipRequestCard.rejected']()
		},
		cancelled: {
			classes: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
			label: () => m['membershipRequestCard.statusCancelled']()
		}
	};

	// Dialog state
	let dialogOpen = $state(false);

	// The card and its dialog each render the submission link + review hint, so
	// the hint ids have to be distinct as well as unique across mounted cards.
	const uid = $props.id();
	const cardHintId = `${uid}-review-hint`;
	const dialogHintId = `${uid}-dialog-review-hint`;

	// Format created at date
	const createdAt = $derived(formatRelativeTime(request.created_at));

	// The questionnaire submission that unlocked this application, if any. The
	// `resolve()` call stays inline at each `<a href>` — the lint rule that
	// guards SvelteKit navigation only recognises it in that position.
	const submission = $derived(request.questionnaire_submission);

	// Display name
	const displayName = $derived(
		request.user.preferred_name ||
			(request.user.first_name && request.user.last_name
				? `${request.user.first_name} ${request.user.last_name}`
				: request.user.first_name || request.user.email || m['membershipRequestCard.unknownUser']())
	);

	function handleApprove() {
		if (onApprove) {
			onApprove(request);
			dialogOpen = false;
		}
	}

	function handleReject() {
		if (onReject) {
			onReject(request);
			dialogOpen = false;
		}
	}

	function openDialog() {
		dialogOpen = true;
	}

	// phone_number is not part of MinimalRevelUserSchema but may be present at runtime
	const phoneNumber = $derived((request.user as { phone_number?: string | null }).phone_number);
</script>

<!-- `article` + the requester's display name as the accessible name: specs (and
     assistive tech) can address one card among many instead of relying on a
     one-card-per-view invariant. -->
<article
	aria-label={displayName}
	class="min-w-0 rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
>
	<div class="space-y-3">
		<!-- Request Info -->
		<div class="flex gap-3">
			<!-- Avatar -->
			<UserAvatar
				profilePictureUrl={request.user.profile_picture_url}
				thumbnailUrl={request.user.profile_picture_thumbnail_url}
				{displayName}
				firstName={request.user.first_name}
				lastName={request.user.last_name}
				size="lg"
				class="shrink-0"
			/>

			<div class="min-w-0 flex-1">
				<div class="flex items-start justify-between gap-2">
					<div class="min-w-0 flex-1">
						<div class="flex flex-wrap items-center gap-2">
							<h3 class="truncate font-semibold text-foreground">
								{displayName}
							</h3>
							{#if request.tier}
								<span
									class="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
								>
									<!-- The chip reads as a bare word to a screen reader; the prefix
									     supplies the "what is this" the visual grouping carries. -->
									<span class="sr-only">{m['membershipRequestCard.tierPrefix']()}</span>
									<span>{request.tier.name}</span>
								</span>
							{/if}
						</div>
						{#if request.user.pronouns}
							<p class="text-sm text-muted-foreground">({request.user.pronouns})</p>
						{/if}
					</div>
				</div>

				<!-- Name Details -->
				<div class="mt-2 space-y-1 text-sm text-muted-foreground">
					{#if request.user.first_name || request.user.last_name}
						<p class="truncate">
							{#if request.user.first_name}
								<span class="font-medium">{m['membershipRequestCard.first']()}</span>
								{request.user.first_name}
							{/if}
							{#if request.user.first_name && request.user.last_name}
								<span class="mx-2">•</span>
							{/if}
							{#if request.user.last_name}
								<span class="font-medium">{m['membershipRequestCard.last']()}</span>
								{request.user.last_name}
							{/if}
						</p>
					{/if}
					{#if request.user.preferred_name}
						<p class="truncate">
							<span class="font-medium">{m['membershipRequestCard.preferred']()}</span>
							{request.user.preferred_name}
						</p>
					{/if}
				</div>

				{#if request.user.email}
					<p class="mt-2 truncate text-sm text-muted-foreground">{request.user.email}</p>
				{/if}

				{#if phoneNumber}
					<p class="mt-1 truncate text-sm text-muted-foreground">
						📞 {phoneNumber}
					</p>
				{/if}

				{#if submission}
					<p class="mt-1 text-sm">
						<a
							href={resolve(
								'/(auth)/org/[slug]/admin/questionnaires/[id]/submissions/[submission_id]',
								{
									slug: orgSlug,
									id: submission.org_questionnaire_id,
									submission_id: submission.id
								}
							)}
							class="font-medium text-primary underline underline-offset-2"
							aria-describedby={submission.evaluation_status === 'pending review'
								? cardHintId
								: undefined}
						>
							{m['membershipRequestCard.viewSubmission']()}
						</a>
						{#if submission.evaluation_status === 'pending review'}
							<span id={cardHintId} class="ml-2 text-xs text-muted-foreground">
								{m['membershipRequestCard.submissionPendingReview']()}
							</span>
						{/if}
					</p>
				{/if}

				<!-- Request Date and Status -->
				<div class="mt-2 flex items-center gap-2">
					<p class="text-xs text-muted-foreground">
						{m['membershipRequestCard.requestedAt']({ time: createdAt })}
					</p>
					{#if !showActions && request.status}
						<!-- `??` is not dead code: during a BE-ahead version skew the wire can
						     carry a status this build has never heard of, and an unguarded
						     lookup would TypeError every card in the tab. -->
						{@const badge = STATUS_BADGES[request.status] ?? STATUS_BADGES.pending}
						<span
							class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium {badge.classes}"
						>
							{badge.label()}
						</span>
					{/if}
				</div>
			</div>
		</div>

		<!-- Actions -->
		{#if showActions}
			<div class="flex flex-wrap gap-2">
				<Button
					variant="outline"
					size="sm"
					onclick={openDialog}
					disabled={isProcessing}
					aria-label={m['membershipRequestCard.viewRequestAria']({ name: displayName })}
				>
					<MessageSquare class="h-4 w-4" />
					<span class="ml-2">{m['membershipRequestCard.viewRequest']()}</span>
				</Button>

				<Button
					variant="default"
					size="sm"
					onclick={handleApprove}
					disabled={isProcessing}
					aria-label={m['membershipRequestCard.approveRequestAria']({ name: displayName })}
					class="bg-green-600 hover:bg-green-700"
				>
					<CheckCircle class="h-4 w-4" />
					<span class="ml-2">{m['membershipRequestCard.approve']()}</span>
				</Button>

				<Button
					variant="destructive"
					size="sm"
					onclick={handleReject}
					disabled={isProcessing}
					aria-label={m['membershipRequestCard.rejectRequestAria']({ name: displayName })}
				>
					<XCircle class="h-4 w-4" />
					<span class="ml-2">{m['membershipRequestCard.reject']()}</span>
				</Button>
			</div>
		{:else}
			<div class="flex flex-wrap gap-2">
				<Button
					variant="outline"
					size="sm"
					onclick={openDialog}
					disabled={isProcessing}
					aria-label={m['membershipRequestCard.viewRequestAria']({ name: displayName })}
				>
					<MessageSquare class="h-4 w-4" />
					<span class="ml-2">{m['membershipRequestCard.viewRequest']()}</span>
				</Button>
			</div>
		{/if}
	</div>
</article>

<!-- Request Details Dialog -->
<Dialog open={dialogOpen} onOpenChange={(open) => (dialogOpen = open)}>
	<DialogContent class="max-h-[90vh] max-w-lg overflow-y-auto">
		<DialogHeader>
			<DialogTitle>{m['membershipRequestCard.membershipRequestFrom']()} {displayName}</DialogTitle>
			<DialogDescription>
				{m['membershipRequestCard.dialogDescription']()}
			</DialogDescription>
		</DialogHeader>

		<div class="space-y-4 py-4">
			<!-- User Information -->
			<div class="space-y-2">
				<h4 class="text-sm font-semibold">{m['membershipRequestCard.applicantInformation']()}</h4>
				<dl class="space-y-1 text-sm">
					{#if request.user.first_name}
						<div class="flex gap-2">
							<dt class="font-medium text-muted-foreground">
								{m['membershipRequestCard.firstName']()}
							</dt>
							<dd class="text-foreground">{request.user.first_name}</dd>
						</div>
					{/if}
					{#if request.user.last_name}
						<div class="flex gap-2">
							<dt class="font-medium text-muted-foreground">
								{m['membershipRequestCard.lastName']()}
							</dt>
							<dd class="text-foreground">{request.user.last_name}</dd>
						</div>
					{/if}
					{#if request.user.preferred_name}
						<div class="flex gap-2">
							<dt class="font-medium text-muted-foreground">
								{m['membershipRequestCard.preferredName']()}
							</dt>
							<dd class="text-foreground">{request.user.preferred_name}</dd>
						</div>
					{/if}
					{#if request.user.pronouns}
						<div class="flex gap-2">
							<dt class="font-medium text-muted-foreground">
								{m['membershipRequestCard.pronouns']()}
							</dt>
							<dd class="text-foreground">{request.user.pronouns}</dd>
						</div>
					{/if}
					{#if request.user.email}
						<div class="flex gap-2">
							<dt class="font-medium text-muted-foreground">
								{m['membershipRequestCard.email']()}
							</dt>
							<dd class="truncate text-foreground">{request.user.email}</dd>
						</div>
					{/if}
					{#if phoneNumber}
						<div class="flex gap-2">
							<dt class="font-medium text-muted-foreground">
								{m['membershipRequestCard.phone']()}
							</dt>
							<dd class="text-foreground">{phoneNumber}</dd>
						</div>
					{/if}
				</dl>
			</div>

			<!-- Message -->
			{#if request.message}
				<div class="space-y-2">
					<h4 class="text-sm font-semibold">{m['membershipRequestCard.message']()}</h4>
					<div
						class="rounded-lg border border-border bg-muted/50 p-3 text-sm text-foreground"
						style="white-space: pre-wrap; word-wrap: break-word;"
					>
						{request.message}
					</div>
				</div>
			{:else}
				<div class="space-y-2">
					<h4 class="text-sm font-semibold">{m['membershipRequestCard.message']()}</h4>
					<p class="text-sm italic text-muted-foreground">
						{m['membershipRequestCard.noMessage']()}
					</p>
				</div>
			{/if}

			<!-- Questionnaire submission -->
			{#if submission}
				<div class="space-y-2">
					<h4 class="text-sm font-semibold">{m['membershipRequestCard.questionnaire']()}</h4>
					<p class="text-sm">
						<a
							href={resolve(
								'/(auth)/org/[slug]/admin/questionnaires/[id]/submissions/[submission_id]',
								{
									slug: orgSlug,
									id: submission.org_questionnaire_id,
									submission_id: submission.id
								}
							)}
							class="font-medium text-primary underline underline-offset-2"
							aria-describedby={submission.evaluation_status === 'pending review'
								? dialogHintId
								: undefined}
						>
							{m['membershipRequestCard.viewSubmission']()}
						</a>
						{#if submission.evaluation_status === 'pending review'}
							<span id={dialogHintId} class="ml-2 text-xs text-muted-foreground">
								{m['membershipRequestCard.submissionPendingReview']()}
							</span>
						{/if}
					</p>
				</div>
			{/if}

			<!-- Request Date -->
			<div class="text-xs text-muted-foreground">
				{m['membershipRequestCard.requestedAt']({ time: createdAt })}
			</div>
		</div>

		<DialogFooter>
			<Button variant="outline" onclick={() => (dialogOpen = false)} disabled={isProcessing}>
				{m['membershipRequestCard.close']()}
			</Button>
			<Button variant="destructive" onclick={handleReject} disabled={isProcessing}>
				<XCircle class="mr-2 h-4 w-4" />
				{m['membershipRequestCard.reject']()}
			</Button>
			<Button
				variant="default"
				onclick={handleApprove}
				disabled={isProcessing}
				class="bg-green-600 hover:bg-green-700"
			>
				<CheckCircle class="mr-2 h-4 w-4" />
				{m['membershipRequestCard.approve']()}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

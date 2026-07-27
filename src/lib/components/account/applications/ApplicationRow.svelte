<script lang="ts" module>
	import type { MembershipRequestStatus } from '$lib/api/generated/types.gen';

	/**
	 * Statuses the backend will never move off. A row in one of these must not be
	 * re-read: `GET /me/applications/{id}` advances the state machine as a side
	 * effect, so a request here is pure cost with no possible outcome.
	 */
	const TERMINAL = new Set<MembershipRequestStatus>(['rejected', 'cancelled', 'completed']);

	/**
	 * Chip tones mirror `STATUS_CONFIG` in `$lib/utils/subscriptions`. Separated by
	 * lightness as much as hue, and always paired with the status word — the
	 * colour is decoration, never the message.
	 */
	const REQUEST_STATUS_CLASSES: Record<MembershipRequestStatus, string> = {
		pending: 'bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100',
		approved: 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100',
		completed: 'bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-100',
		rejected: 'bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-100',
		cancelled: 'bg-muted text-muted-foreground'
	};
</script>

<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import {
		memembershipapplicationsCancel,
		memembershipapplicationsGetApplication
	} from '$lib/api/generated/sdk.gen';
	import type { MembershipApplicationSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { getApplicationPendingMessage } from '$lib/utils/membership-eligibility';
	import { Button } from '$lib/components/ui/button';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import ApplyDialog from '$lib/components/organization/membership/ApplyDialog.svelte';
	import { formatDate } from '$lib/utils/date';
	import { getImageUrl } from '$lib/utils/url';
	import { backendMessage } from '$lib/utils/api-error-detail';
	import { resolve } from '$app/paths';
	import { Loader2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	interface Props {
		application: MembershipApplicationSchema;
	}

	const { application }: Props = $props();

	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	/**
	 * Poll-once-per-page-open, deliberately.
	 *
	 * The read is not idempotent: the backend runs `advance_application` on GET,
	 * so an approved application materializes into a membership the moment this
	 * fires. That is the point — it is how an org's "approved" decision becomes a
	 * membership without the member re-applying — but it also means the request
	 * must happen exactly once, on mount, for rows that can still move.
	 * `staleTime: 0` with no refetch triggers and no retry gives precisely that:
	 * one fetch per mount, never repeated on focus, never multiplied by a retry.
	 */
	const advanceQuery = createQuery(() => ({
		queryKey: ['me', 'application', application.id],
		queryFn: async () => {
			// `id` is optional on the schema; `enabled` already gates on it, so this
			// is the type narrowing, not a second guard.
			const applicationId = application.id;
			if (!applicationId) throw new Error('Application has no id');
			const res = await memembershipapplicationsGetApplication({
				path: { application_id: applicationId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			// hey-api resolves rather than throws — a missing payload is a failure
			// even when no error body came back.
			if (res.error || !res.data) throw new Error('Failed to refresh application');
			return res.data;
		},
		enabled: !!accessToken && !!application.id && !TERMINAL.has(application.status),
		staleTime: 0,
		refetchOnWindowFocus: false,
		retry: false
	}));

	/**
	 * Freshest wins — except that a terminal prop is by definition fresher than
	 * anything cached. After a cancel, the invalidated list hands this row a
	 * settled application while `['me','application', id]` still holds the
	 * pre-cancel payload; that query is disabled now, so nothing can correct it —
	 * and nothing should, since the GET behind it advances server state. Without
	 * this the Closed row would keep a Pending chip, the wait copy and a live
	 * Cancel button until a full page reload. Display-side only.
	 */
	const app = $derived(
		TERMINAL.has(application.status) ? application : (advanceQuery.data?.application ?? application)
	);
	const eligibility = $derived(advanceQuery.data?.eligibility ?? null);

	const isOpen = $derived(!TERMINAL.has(app.status));
	const logoUrl = $derived(getImageUrl(app.organization_logo_url));

	const statusLabel = $derived(
		{
			pending: m['applications.status.pending'](),
			approved: m['applications.status.approved'](),
			completed: m['applications.status.completed'](),
			rejected: m['applications.status.rejected'](),
			cancelled: m['applications.status.cancelled']()
		}[app.status]
	);

	/**
	 * `getApplicationPendingMessage`, not `getMembershipStatusMessage`: since BE
	 * #788 a tier-less PENDING application carries an explicit `wait_for_approval`,
	 * which the raw helper already renders correctly — so this wrapper is
	 * defence-in-depth for a signal-less `allowed` verdict the backend no longer
	 * emits, which would otherwise fall through to "you can't join right now".
	 * Only ever consulted for open rows; on a closed one its signal-absence rule
	 * would mislabel a settled verdict.
	 */
	const nextStepLine = $derived(
		eligibility && isOpen ? getApplicationPendingMessage(eligibility) : null
	);

	const questionnaireHref = $derived.by(() => {
		if (!isOpen) return null;
		if (eligibility?.next_step !== 'submit_questionnaire') return null;
		const id = eligibility.questionnaire_id;
		if (!id) return null;
		return resolve('/(public)/org/[slug]/questionnaire/[id]', {
			slug: app.organization_slug,
			id
		});
	});

	/**
	 * The advance just turned an approval into a membership. Every member-facing
	 * list on this page was fetched before that happened, so without this the
	 * member reads "You're now a member" above a memberships section that still
	 * doesn't list the org. Both keys, because the page renders from both.
	 *
	 * Once-guarded: `invalidated` latches, so the refetches this triggers can
	 * never loop back through the effect.
	 */
	const becameMember = $derived(app.status === 'completed' && application.status !== 'completed');
	let invalidated = $state(false);
	$effect(() => {
		if (!becameMember || invalidated) return;
		invalidated = true;
		queryClient.invalidateQueries({ queryKey: ['me', 'memberships'] });
		queryClient.invalidateQueries({ queryKey: ['me', 'subscriptions'] });
	});

	let confirmOpen = $state(false);
	let applyOpen = $state(false);

	// Cancellable exactly while the backend can still move the application; a
	// settled one gets the re-apply route instead, and `completed` neither.
	const canCancel = $derived(isOpen);
	const canReapply = $derived(app.status === 'rejected' || app.status === 'cancelled');

	const cancelMutation = createMutation(() => ({
		mutationFn: async () => {
			const applicationId = app.id;
			if (!applicationId) throw new Error(m['applications.cancelError']());
			const res = await memembershipapplicationsCancel({
				path: { application_id: applicationId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			// hey-api resolves rather than throws — a missing payload is a failure
			// even when no error body came back.
			if (res.error || !res.data) {
				throw new Error(backendMessage(res.error) || m['applications.cancelError']());
			}
			return res.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['me', 'applications'] });
			toast.success(m['applications.cancelSuccess']());
		},
		onError: (err: Error) => {
			toast.error(err.message || m['applications.cancelError']());
		}
	}));

	const isCancelling = $derived(cancelMutation.isPending);

	/**
	 * The confirm dialog carries no busy state, so it closes on confirm and the
	 * row's own button becomes the progress surface — one visible pending state,
	 * where the action was invoked.
	 */
	function confirmCancel(): void {
		confirmOpen = false;
		cancelMutation.mutate();
	}
</script>

<article class="rounded-lg border p-4" aria-label={app.organization_name}>
	<div class="flex items-start justify-between gap-3">
		<div class="flex min-w-0 items-start gap-3">
			{#if logoUrl}
				<img
					src={logoUrl}
					alt=""
					class="h-10 w-10 shrink-0 rounded-md object-contain"
					loading="lazy"
				/>
			{/if}
			<div class="min-w-0">
				<h4 class="font-semibold">
					<a
						class="hover:underline"
						href={resolve('/(public)/org/[slug]', { slug: app.organization_slug })}
					>
						{app.organization_name}
					</a>
				</h4>
				{#if app.tier_name}
					<p class="text-sm text-muted-foreground">
						{m['applications.tierLine']({ tier: app.tier_name })}
					</p>
				{/if}
				<p class="text-sm text-muted-foreground">
					{m['applications.appliedOn']({ date: formatDate(app.created_at) })}
				</p>
			</div>
		</div>
		<span
			class="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium {REQUEST_STATUS_CLASSES[
				app.status
			]}"
			aria-label={m['applications.statusAriaLabel']({ status: statusLabel })}
		>
			{statusLabel}
		</span>
	</div>

	{#if becameMember}
		<p role="status" class="mt-3 text-sm font-medium">
			{m['applications.becameMember']({ org: app.organization_name })}
		</p>
	{/if}

	{#if nextStepLine}
		<p class="mt-2 text-sm">{nextStepLine}</p>
	{/if}

	{#if questionnaireHref || canCancel || canReapply}
		<div class="mt-3 flex flex-wrap gap-2">
			{#if questionnaireHref}
				<Button href={questionnaireHref} size="sm">{m['applications.continueCta']()}</Button>
			{/if}
			{#if canCancel}
				<Button
					variant="outline"
					size="sm"
					onclick={() => (confirmOpen = true)}
					disabled={isCancelling}
				>
					{#if isCancelling}
						<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
					{/if}
					{m['applications.cancelCta']()}
				</Button>
			{/if}
			{#if canReapply}
				<Button size="sm" onclick={() => (applyOpen = true)}>
					{m['membershipEligibility.reapply']()}
				</Button>
			{/if}
		</div>
	{/if}
</article>

<ConfirmDialog
	isOpen={confirmOpen}
	title={m['applications.cancelConfirmTitle']()}
	message={m['applications.cancelConfirmBody']({ org: app.organization_name })}
	variant="warning"
	onConfirm={confirmCancel}
	onCancel={() => (confirmOpen = false)}
/>

<!--
	Outside the action row on purpose, defensively: nothing in this row may gate a
	dialog that can outlive the state it renders. `canReapply` is derived from the
	very application the dialog acts on, and the dialog stays up after its outcome
	— so were it mounted inside that branch, any future change that lets the row
	re-render mid-read (a list refetch resolving differently, an added advance) would
	destroy it under the member: an unannounced context change that drops focus to
	<body> (WCAG 3.2). The same lesson as PR②'s `MembershipCta`, where the flip is
	real. Here only the dialog's own `open` state gates it.
-->
<ApplyDialog
	open={applyOpen}
	onOpenChange={(next) => (applyOpen = next)}
	organizationSlug={app.organization_slug}
	organizationName={app.organization_name}
	mode="reapply"
/>

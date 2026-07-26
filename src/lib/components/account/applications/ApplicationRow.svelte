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
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { memembershipapplicationsGetApplication } from '$lib/api/generated/sdk.gen';
	import type { MembershipApplicationSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { getApplicationPendingMessage } from '$lib/utils/membership-eligibility';
	import { Button } from '$lib/components/ui/button';
	import { formatDate } from '$lib/utils/date';
	import { getImageUrl } from '$lib/utils/url';
	import { resolve } from '$app/paths';

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

	// Freshest wins: the advanced payload supersedes the list row it came from.
	const app = $derived(advanceQuery.data?.application ?? application);
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
	 * `getApplicationPendingMessage`, not `getMembershipStatusMessage`: a tier-less
	 * PENDING application passes every gate, so its verdict comes back `allowed`
	 * with no signals — which the raw helper renders as "you can't join right now".
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

	{#if questionnaireHref}
		<div class="mt-3">
			<Button href={questionnaireHref} size="sm">{m['applications.continueCta']()}</Button>
		</div>
	{/if}
</article>

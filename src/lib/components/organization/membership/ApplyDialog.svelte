<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { memembershipapplicationsApply } from '$lib/api/generated/sdk.gen';
	import type {
		ApplyResponseSchema,
		MembershipEligibilitySchema
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import {
		getApplicationPendingMessage,
		getMembershipStatusMessage
	} from '$lib/utils/membership-eligibility';
	import { backendMessage } from '$lib/utils/api-error-detail';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { CheckCircle2, Loader2 } from '@lucide/svelte';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		organizationSlug: string;
		organizationName: string;
		/** `reapply` only changes the framing — the request is identical. */
		mode: 'join' | 'reapply';
		/**
		 * The tier being applied to. Sent to the backend, which resolves that
		 * tier's questionnaire/approval overrides instead of only the org-wide
		 * defaults — without it the application is tier-less and staff have to
		 * guess the tier at approval time (#720).
		 */
		tierId?: string | null;
		/** Names the tier in the dialog heading. */
		tierName?: string | null;
		/**
		 * The plan this application is for, which is what makes it a PAID
		 * application (BE #831: *"A `plan_id` makes this a paid application"*).
		 *
		 * Not an optimization — on a tier that carries an active plan it is the
		 * only application the backend will accept. `TierAvailabilityGate` (#6)
		 * refuses a plan-less `/apply` there with `tier_requires_subscription` and
		 * never reaches the approval gate below it, so without this the dialog can
		 * only ever mint FREE applications and manual-approval gating on a
		 * monetized tier is unreachable through the UI (#735).
		 *
		 * The row carries the plan through to settlement: it advances to APPROVED
		 * when staff decide, and COMPLETED once the subscription bought with this
		 * plan activates.
		 */
		planId?: string | null;
		/** Names the plan in the dialog, so the applicant sees which one they chose. */
		planName?: string | null;
	}

	const {
		open,
		onOpenChange,
		organizationSlug,
		organizationName,
		mode,
		tierId = null,
		tierName = null,
		planId = null,
		planName = null
	}: Props = $props();

	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	let message = $state('');
	let errorMessage = $state<string | null>(null);
	let result = $state<ApplyResponseSchema | null>(null);
	/**
	 * The backend answers 409 (`Reasons.ALREADY_ACTIVE_MEMBER`) when the caller is
	 * already an ACTIVE member at the target tier — it refuses rather than minting a
	 * junk application row. The eligibility verdict reports that case too and hides
	 * the Join CTA, so a 409 only ever lands on a stale verdict: this is a race
	 * backstop, not something a retry can fix.
	 */
	let alreadyMember = $state(false);

	// Unique per instance: the dialog can sit next to other labelled controls.
	const uid = $props.id();
	const messageId = `${uid}-message`;
	const counterId = `${uid}-counter`;
	const membershipsHref = resolve('/(auth)/account/memberships', {});

	// The 400 body is a union: a full eligibility verdict when a gate refused the
	// application, or a flat `{detail}` for everything else. `allowed` is the only
	// field the verdict has and the flat shape cannot, so it is the discriminator.
	function isEligibilityBody(error: unknown): error is MembershipEligibilitySchema {
		return (
			!!error &&
			typeof error === 'object' &&
			typeof (error as { allowed?: unknown }).allowed === 'boolean'
		);
	}

	const applyMutation = createMutation(() => ({
		mutationFn: async (): Promise<ApplyResponseSchema> => {
			errorMessage = null;
			const notes = message.trim();
			const res = await memembershipapplicationsApply({
				path: { slug: organizationSlug },
				// An empty note is no note: sending `''` would store a blank message
				// on the application. `tier_id` and `plan_id` are likewise omitted
				// rather than sent as null when the caller has neither, so the backend
				// keeps its org-default resolution for the legacy tier-less path.
				body: {
					tier_id: tierId ?? undefined,
					plan_id: planId ?? undefined,
					notes: notes || undefined
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			// hey-api resolves rather than throws — a missing payload is a failure
			// even when no error body came back.
			if (res.error || !res.data) {
				if (res.response?.status === 409) {
					// Terminal, and positive: there is nothing to apply for. Show the
					// outcome panel instead of a form-level error, so the user is not
					// invited to press a button that will keep 409ing.
					alreadyMember = true;
					// Everything that let the Join CTA appear is provably stale: the
					// cached verdict…
					queryClient.invalidateQueries({
						queryKey: ['org', organizationSlug, 'join-eligibility']
					});
					// …and the server-rendered page behind the dialog (`isMember`,
					// member-only sections), same as an instant join.
					invalidateAll();
					throw new Error(backendMessage(res.error) ?? m['membershipApply.alreadyMemberTitle']());
				}
				if (isEligibilityBody(res.error)) {
					// The refusal proves the CTA's cached verdict is stale, so refresh it
					// for the page behind the dialog.
					queryClient.invalidateQueries({
						queryKey: ['org', organizationSlug, 'join-eligibility']
					});
					throw new Error(getMembershipStatusMessage(res.error));
				}
				throw new Error(backendMessage(res.error) ?? m['membershipApply.error']());
			}
			return res.data;
		},
		onSuccess: (data) => {
			result = data;
			// Any outcome moves the verdict on (join → waiting/member).
			queryClient.invalidateQueries({
				queryKey: ['org', organizationSlug, 'join-eligibility']
			});
			// The member's own application list now has a new (or moved) row —
			// refreshes the account page behind a re-apply; a no-op on the org page.
			queryClient.invalidateQueries({ queryKey: ['me', 'applications'] });
			// Only an instant membership changes what the server rendered for this
			// page (`isMember`, member-only sections).
			if (data.application.status === 'completed') {
				invalidateAll();
			}
		},
		onError: (err: Error) => {
			// The already-member outcome replaces the form with its own panel, so a
			// form-level alert would never be reachable.
			if (alreadyMember) return;
			errorMessage = err.message || m['membershipApply.error']();
		}
	}));

	const isBusy = $derived(applyMutation.isPending);
	const completed = $derived(result?.application.status === 'completed');
	/** Both terminal states replace the form with a read-only panel. */
	const showOutcome = $derived(!!result || alreadyMember);
	const showMemberBadge = $derived(alreadyMember || completed);

	const heading = $derived.by(() => {
		if (alreadyMember) {
			return m['membershipApply.alreadyMemberTitle']();
		}
		if (result) {
			return completed
				? m['membershipApply.completedTitle']()
				: m['membershipApply.pendingTitle']();
		}
		if (tierName) {
			// The tier is the thing being joined, so it — not the org — names the
			// dialog. The org still appears in the description line below.
			return mode === 'reapply'
				? m['membershipApply.reapplyTitleTier']({ tier: tierName })
				: m['membershipApply.titleTier']({ tier: tierName });
		}
		return mode === 'reapply'
			? m['membershipApply.reapplyTitle']({ orgName: organizationName })
			: m['membershipApply.title']({ orgName: organizationName });
	});

	// A reopened dialog must start from a blank form — reset on open, so the
	// outgoing content stays intact during the close animation.
	$effect(() => {
		if (!open) return;
		message = '';
		errorMessage = null;
		result = null;
		alreadyMember = false;
	});

	function handleOpenChange(next: boolean): void {
		// The application is in flight; closing now would hide the outcome.
		if (!next && isBusy) return;
		onOpenChange(next);
	}
</script>

<Dialog {open} onOpenChange={handleOpenChange}>
	<DialogContent
		class="max-h-[90vh] overflow-y-auto sm:max-w-md"
		escapeKeydownBehavior={isBusy ? 'ignore' : 'close'}
		interactOutsideBehavior={isBusy ? 'ignore' : 'close'}
		showCloseButton={!isBusy}
	>
		<DialogHeader>
			<DialogTitle>{heading}</DialogTitle>
			<DialogDescription>
				{#if alreadyMember}
					{m['membershipApply.alreadyMemberBody']({ orgName: organizationName })}
				{:else if result}
					{completed
						? m['membershipApply.completedBody']({ orgName: organizationName })
						: m['membershipApply.pendingBody']()}
				{:else if planName}
					<!-- Which plan the application will carry. The applicant pressed Apply
					     on one specific card and the row's `plan` FK is set from it, so the
					     dialog says so rather than leaving them to infer it from whichever
					     button they happened to press. -->
					{m['membershipApply.forPlan']({ orgName: organizationName, plan: planName })}
				{:else}
					{organizationName}
				{/if}
			</DialogDescription>
		</DialogHeader>

		{#if showOutcome}
			<div class="space-y-3">
				{#if showMemberBadge}
					<p class="flex items-center gap-2 text-sm font-bold text-success">
						<CheckCircle2 class="h-5 w-5" aria-hidden="true" />
						{m['membershipEligibility.memberBadge']()}
					</p>
				{:else if result}
					<p class="text-sm text-muted-foreground">
						{getApplicationPendingMessage(result.eligibility)}
					</p>
					<a
						href={membershipsHref}
						class="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
					>
						{m['membershipApply.trackLink']()}
					</a>
				{/if}
			</div>

			<DialogFooter>
				<!-- The outcome is final, so this dismisses rather than cancels. -->
				<Button variant="outline" onclick={() => handleOpenChange(false)}>
					{m['dialogContent.close']()}
				</Button>
			</DialogFooter>
		{:else}
			<form
				class="space-y-4"
				onsubmit={(e) => {
					e.preventDefault();
					applyMutation.mutate();
				}}
			>
				<div>
					<label for={messageId} class="block text-sm font-medium">
						{m['membershipApply.messageOptional']()}
					</label>
					<textarea
						id={messageId}
						bind:value={message}
						placeholder={m['membershipApply.messagePlaceholder']()}
						rows="4"
						maxlength="500"
						aria-describedby={counterId}
						disabled={isBusy}
						class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
					></textarea>
					<p id={counterId} class="mt-1 text-xs text-muted-foreground">
						{m['membershipApply.characters']({ count: message.length })}
					</p>
				</div>

				{#if errorMessage}
					<p role="alert" class="text-sm font-medium text-destructive">{errorMessage}</p>
				{/if}

				<DialogFooter class="gap-2">
					<Button
						type="button"
						variant="outline"
						onclick={() => handleOpenChange(false)}
						disabled={isBusy}
					>
						{m['membershipApply.cancel']()}
					</Button>
					<Button type="submit" disabled={isBusy}>
						{#if isBusy}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
							{m['membershipApply.submitting']()}
						{:else}
							{m['membershipApply.submit']()}
						{/if}
					</Button>
				</DialogFooter>
			</form>
		{/if}
	</DialogContent>
</Dialog>

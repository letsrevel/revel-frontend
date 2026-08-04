<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { memembershipquestionnaireSubmitMembershipQuestionnaire } from '$lib/api';
	import type { QuestionnaireSubmissionSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import { ArrowLeft, Check } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { toast } from 'svelte-sonner';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import LogoChip from '$lib/components/brand/LogoChip.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import QuestionnaireFillForm from '$lib/components/questionnaires/QuestionnaireFillForm.svelte';

	interface Props {
		data: PageData;
	}

	const { data }: Props = $props();

	/**
	 * The 200 payload is an UNDISCRIMINATED union of `QuestionnaireSubmissionResponseSchema`
	 * and `QuestionnaireEvaluationForUserSchema`. Inferred from the SDK function rather than
	 * imported: the generated response alias is name-hashed and rotates on every regen.
	 */
	type SubmitResult = NonNullable<
		Awaited<ReturnType<typeof memembershipquestionnaireSubmitMembershipQuestionnaire>>['data']
	>;

	/**
	 * Whether this submission ALREADY clears the questionnaire gate — i.e. nothing
	 * is owed and nobody will "review" it.
	 *
	 * The load-bearing signal is `requires_evaluation === false`, and it is the
	 * backend's own contract, not a guess: `resolve_requires_evaluation`
	 * (`questionnaires/schema.py`) documents `False` as "the submission grants
	 * access without any evaluation (LLM or human), so consumers must not display
	 * it as pending". `true` is genuinely undecidable here — the controller queues
	 * the grader on commit (`transaction.on_commit(evaluate_….delay)`), so at
	 * response time even an AUTOMATIC questionnaire has no verdict yet, and the
	 * pending copy is the only honest thing to say.
	 *
	 * The `'submission' in result` narrow covers the evaluation side of the
	 * declared union. It is DEFENSIVE: `submit_membership_questionnaire` returns
	 * `QuestionnaireSubmissionResponseSchema.from_orm(...)` on every path today, so
	 * that side is unreachable on this endpoint — but the response model admits it,
	 * and an inline `approved` score would mean the same "gate cleared" outcome.
	 *
	 * Clearing the gate is NOT joining: the org CTA turns back into a plain "Join"
	 * and the application is still owed. Both the panel and the toast below are
	 * worded to promise exactly that much.
	 */
	function isAutoAccepted(result: SubmitResult): boolean {
		if ('submission' in result) {
			return result.status === 'approved';
		}
		return !result.requires_evaluation;
	}

	const queryClient = useQueryClient();
	const accessToken = $derived(authStore.accessToken);

	// Set once the questionnaire is submitted and no review is pending — the user can
	// carry on joining right away, so we confirm inline instead of redirecting.
	let autoAccepted = $state(false);

	const submitMutation = createMutation(() => ({
		mutationFn: async (submission: QuestionnaireSubmissionSchema): Promise<SubmitResult> => {
			const res = await memembershipquestionnaireSubmitMembershipQuestionnaire({
				path: {
					slug: data.organization.slug,
					questionnaire_id: data.questionnaire.id
				},
				body: submission,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			// hey-api resolves rather than throws — a missing payload is a failure
			// even when no error body came back.
			//
			// The 400 channel is `ErrorDetail` since backend #824 (it was declared
			// `ResponseMessage`, but `{message}` was never what the endpoint actually
			// emitted — `.message` read `undefined` at runtime). The retake policy
			// answers on `detail` with actionable, backend-localized copy ("already
			// submitted", "max attempts reached", "cannot be retaken", "retry after
			// …"). Prefer it: the generic fallback would tell the user to try again
			// when they simply cannot.
			if (res.error || !res.data) {
				const detail =
					res.error && typeof res.error === 'object' && 'detail' in res.error
						? res.error.detail
						: null;
				throw new Error(
					typeof detail === 'string' && detail
						? detail
						: m['membershipQuestionnairePage.submitError']()
				);
			}
			return res.data;
		},
		onSuccess: (result) => {
			// Either outcome moves the join verdict on (questionnaire → apply/waiting).
			queryClient.invalidateQueries({
				queryKey: ['org', data.organization.slug, 'join-eligibility']
			});

			if (isAutoAccepted(result)) {
				// Distinct copy, not the generic pendingToast: nothing is queued at
				// all here, so even the neutral "we'll let you know once it's been
				// evaluated" would be false. Says "passed / continue joining" —
				// never "you're a member".
				toast.success(m['membershipQuestionnairePage.acceptedToast']());
				autoAccepted = true;
				return;
			}

			toast.info(m['membershipQuestionnairePage.pendingToast']());
			goto(resolve('/(public)/org/[slug]', { slug: data.organization.slug }));
		},
		onError: (error: Error) => {
			toast.error(error.message || m['membershipQuestionnairePage.submitError']());
		}
	}));

	const submitError = $derived(
		submitMutation.isError
			? (submitMutation.error?.message ?? m['membershipQuestionnairePage.submitError']())
			: null
	);

	function goBackToOrg(): void {
		goto(resolve('/(public)/org/[slug]', { slug: data.organization.slug }));
	}
</script>

<svelte:head>
	<title>{m['membershipQuestionnairePage.title']()} — {data.organization.name}</title>
</svelte:head>

<!-- Color-block header band — see the event-admission twin of this route for
	 why `bg-secondary` at full strength is the theme-aware poster panel. -->
<div class="bg-background">
	<section class="bg-secondary text-secondary-foreground">
		<div class="container relative mx-auto max-w-3xl px-4 pb-20 pt-8">
			<!-- Sticker-chip rule: the org's own logo, or nothing at all. -->
			<LogoChip
				class="absolute right-4 top-6 hidden md:block"
				logo={data.organization.logo}
				logoThumbnail={data.organization.logo_thumbnail_url}
			/>
			<a
				href={resolve('/(public)/org/[slug]', { slug: data.organization.slug })}
				class="mb-5 inline-flex items-center gap-2 text-sm font-bold underline-offset-4 hover:underline"
			>
				<ArrowLeft class="h-4 w-4" aria-hidden="true" />
				{m['membershipQuestionnairePage.backToOrg']({ orgName: data.organization.name })}
			</a>
			<PageHeader
				volume="poster"
				kicker={data.organization.name}
				title={m['membershipQuestionnairePage.title']()}
				subtitle={m['membershipQuestionnairePage.subtitle']({ orgName: data.organization.name })}
				class="[&_h1]:text-secondary-foreground [&_p]:text-secondary-foreground"
			/>
			{#if data.questionnaire.description}
				<div class="mt-6 rounded-[1.25rem] border-2 border-border bg-card p-5 shadow-poster">
					<MarkdownContent content={data.questionnaire.description} />
				</div>
			{/if}
		</div>
	</section>

	<div class="container mx-auto -mt-12 max-w-3xl px-4 pb-16">
		{#if autoAccepted}
			<!-- Nothing left to review: the org page's eligibility CTA now advances to apply/join. -->
			<div role="status">
				<EmptyState
					level={2}
					tone="success"
					icon={Check}
					title={m['membershipQuestionnairePage.acceptedTitle']()}
					body={m['membershipQuestionnairePage.acceptedBody']({ orgName: data.organization.name })}
				>
					{#snippet action()}
						<Button href={resolve('/(public)/org/[slug]', { slug: data.organization.slug })}>
							{m['membershipQuestionnairePage.backToOrg']({ orgName: data.organization.name })}
						</Button>
					{/snippet}
				</EmptyState>
			</div>
		{:else}
			<QuestionnaireFillForm
				questionnaire={data.questionnaire}
				submitting={submitMutation.isPending}
				submitted={submitMutation.isSuccess}
				{submitError}
				onSubmit={(payload) => submitMutation.mutate(payload)}
				onCancel={goBackToOrg}
			/>
		{/if}
	</div>
</div>

<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Clock, Check, X, CheckCheck } from '@lucide/svelte';
	import CommonStatusBadge from '$lib/components/common/StatusBadge.svelte';
	import type { Tone } from '$lib/components/common/tones';
	import type { SubmissionBadgeStatus } from '$lib/utils/questionnaire-types';

	interface Props {
		status: SubmissionBadgeStatus;
		class?: string;
	}

	const { status, class: className }: Props = $props();

	/**
	 * Thin mapper over the shared `StatusBadge` primitive (rebrand). `approved`
	 * and `auto_accepted` share `success` — both are acceptances, just via a
	 * different mechanism — because the tone budget is for lifecycle stage, not
	 * for provenance; the label text ("Approved" vs "Auto-accepted") and the
	 * icon (`Check` vs `CheckCheck`) carry that distinction instead. `pending
	 * review` takes `warning` (needs a human), `rejected` is `danger`, `draft`
	 * is `neutral` (not yet a real submission).
	 */
	const TONE_MAP: Record<SubmissionBadgeStatus, Tone> = {
		draft: 'neutral',
		'pending review': 'warning',
		approved: 'success',
		auto_accepted: 'success',
		rejected: 'danger'
	};

	const ICON_MAP: Record<SubmissionBadgeStatus, typeof Clock> = {
		draft: Clock,
		'pending review': Clock,
		approved: Check,
		auto_accepted: CheckCheck,
		rejected: X
	};

	const LABEL_MAP: Record<SubmissionBadgeStatus, () => string> = {
		draft: () => m['submissionStatusBadge.draft'](),
		'pending review': () => m['submissionStatusBadge.pending'](),
		approved: () => m['submissionStatusBadge.approved'](),
		auto_accepted: () => m['submissionStatusBadge.autoAccepted'](),
		rejected: () => m['submissionStatusBadge.rejected']()
	};

	const tone = $derived(TONE_MAP[status]);
	const icon = $derived(ICON_MAP[status]);
	const label = $derived(LABEL_MAP[status]());
</script>

<!--
	Submission Status Badge Component

	Displays the evaluation status of a questionnaire submission as a thin mapper
	over `common/StatusBadge`. The submissions table/detail page locate this pill
	by its status text, which is also its accessible name (#795).

	@component
	@example
	<SubmissionStatusBadge status="approved" />
	<SubmissionStatusBadge status="pending review" />
	<SubmissionStatusBadge status="auto_accepted" />
-->
<CommonStatusBadge {tone} {label} {icon} size="sm" class={className} />

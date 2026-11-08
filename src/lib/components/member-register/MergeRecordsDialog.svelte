<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { PossibleDuplicateSchema } from '$lib/api/generated/types.gen';
	import { mergeRecords } from '$lib/member-register/api';
	import { planMerge } from '$lib/member-register/reconcile';
	import { formatDate } from '$lib/utils/date';
	import ConfirmRecordDialog from './ConfirmRecordDialog.svelte';

	interface Props {
		open: boolean;
		pair: PossibleDuplicateSchema | null;
		/** False once a refetch shows the pair is gone (merged or linked elsewhere). */
		pairPresent?: boolean;
		slug: string;
		accessToken: string | null;
		onClose: () => void;
	}

	const { open, pair, pairPresent = true, slug, accessToken, onClose }: Props = $props();

	const plan = $derived(pair ? planMerge(pair) : null);

	const preview = $derived.by(() => {
		if (!plan) return '';
		const survivor = plan.survivor.full_name;
		const absorbed = plan.absorbed.full_name;
		return plan.outcome === 'absorb' && plan.earliestStart
			? m['memberRegister.mergePreviewAbsorb']({
					date: formatDate(plan.earliestStart),
					survivor,
					tier: plan.survivor.tier_name || '-',
					absorbed
				})
			: m['memberRegister.mergePreviewAttach']({ survivor, absorbed });
	});
</script>

<!--
	400s (chained merge, "unlink them first", ...) show the backend detail inline; 404/409 mean
	the pair changed since the page loaded, so the list is refetched.
-->
<ConfirmRecordDialog
	{open}
	record={plan?.survivor ?? null}
	recordPresent={pairPresent}
	{slug}
	{onClose}
	action="merge"
	run={(survivorId) => mergeRecords(slug, accessToken, survivorId, plan?.absorbed.id ?? '')}
	title={m['memberRegister.mergeTitle']({
		absorbed: plan?.absorbed.full_name ?? '',
		survivor: plan?.survivor.full_name ?? ''
	})}
	description={preview}
	confirmLabel={m['memberRegister.mergeConfirm']()}
	successMessage={() => m['memberRegister.mergedToast']()}
/>

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

	// Two entries with the same name read as "Merge X into X": name the kinds instead.
	function normalizeName(name: string): string {
		return name.trim().replace(/\s+/g, ' ').toLowerCase();
	}
	const sameName = $derived(
		!!plan && normalizeName(plan.absorbed.full_name) === normalizeName(plan.survivor.full_name)
	);

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
	Every refusal shows the backend detail inline. 404/409 and 400 (chained merge, "unlink them
	first", ...) all mean the pair may have changed since the page loaded, so the duplicates and
	register lists are refetched; if the pair is gone the dialog closes with the "gone" toast.
-->
<ConfirmRecordDialog
	{open}
	record={plan?.survivor ?? null}
	recordPresent={pairPresent}
	{slug}
	{onClose}
	action="merge"
	staleOn400
	run={(survivorId) => mergeRecords(slug, accessToken, survivorId, plan?.absorbed.id ?? '')}
	title={sameName
		? m['memberRegister.mergeTitleSameName']({ survivor: plan?.survivor.full_name ?? '' })
		: m['memberRegister.mergeTitle']({
				absorbed: plan?.absorbed.full_name ?? '',
				survivor: plan?.survivor.full_name ?? ''
			})}
	description={preview}
	confirmLabel={m['memberRegister.mergeConfirm']()}
	successMessage={() => m['memberRegister.mergedToast']()}
/>

<script lang="ts">
	import type { ComplianceNoticeSchema } from '$lib/api/generated/types.gen';
	import ComplianceCallout from './ComplianceCallout.svelte';
	import { noticeTone } from '$lib/utils/compliance';

	/**
	 * Non-blocking organizer notices (#1001); upcoming-block heads-ups use the
	 * warning tone (`noticeTone`). Information only: never disable
	 * anything because of one. `message` is already translated by the backend;
	 * the list is keyed on `key`, never on the text.
	 */
	interface Props {
		notices: ComplianceNoticeSchema[];
		class?: string;
	}

	const { notices, class: className }: Props = $props();
</script>

{#if notices.length > 0}
	<div class={className ?? 'space-y-2'}>
		<!-- Index in the key: a duplicate `key` from the API must not crash the list. -->
		{#each notices as notice, i (`${notice.key}-${i}`)}
			<ComplianceCallout tone={noticeTone(notice)} testId="compliance-notice-{notice.key}">
				<p>{notice.message}</p>
			</ComplianceCallout>
		{/each}
	</div>
{/if}

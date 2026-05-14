<script lang="ts">
	import type { OrganizationAdminDetailSchema } from '$lib/api/generated/types.gen';
	interface Props {
		organization: OrganizationAdminDetailSchema;
		subId: string;
		open: boolean;
		onClose: () => void;
	}
	const { organization: _o, subId: _s, open, onClose }: Props = $props();
</script>

{#if open}
	<button type="button" onclick={onClose}>close</button>
{/if}

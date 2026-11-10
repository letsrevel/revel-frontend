<script lang="ts">
	import type { OrganizationMemberSchema } from '$lib/api/generated/types.gen';

	// Test-only stand-in for the real combobox (which runs its own member query):
	// one button that "selects" a fixed member.
	const { onSelect }: { onSelect: (m: OrganizationMemberSchema | null) => void } = $props();
</script>

<button
	type="button"
	onclick={() => onSelect({ user: { id: 'user-1' } } as unknown as OrganizationMemberSchema)}
>
	pick member
</button>

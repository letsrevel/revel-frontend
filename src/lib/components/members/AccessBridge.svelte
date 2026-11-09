<script lang="ts">
	import type {
		MembershipTierSchema,
		OrganizationAdminDetailSchema,
		OrganizationPermissionsSchema
	} from '$lib/api/generated/types.gen';
	import MembersTab from './MembersTab.svelte';

	interface Props {
		organization: OrganizationAdminDetailSchema;
		isOwner: boolean;
		permissions: OrganizationPermissionsSchema | null;
		tiers: MembershipTierSchema[];
		staffUserIds: Set<string>;
		/** Whether the hidden Access tab is the one showing: nothing mounts (or fetches) otherwise. */
		active: boolean;
		/** Bumped on EVERY "Manage access" click, even for the same person. */
		openCount: number;
		search: string;
		userId: string | null;
	}

	const { active, openCount, search, userId, ...rest }: Props = $props();
</script>

<!-- Temporary bridge (no tab trigger): the member list pre-searched for one person.
     Keyed on the opening, not on the search text: opening "Manage access" on the
     same person again must start from a fresh search and filters, so a search the
     admin edited meanwhile cannot linger. -->
{#if active}
	{#key openCount}
		<MembersTab {...rest} initialSearch={search} focusUserId={userId} />
	{/key}
{/if}

<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		organizationadminmembersListStaff,
		organizationadminmembersRemoveStaff,
		organizationadminmembersUpdateStaffPermissions
	} from '$lib/api/generated/sdk.gen';
	import type {
		OrganizationStaffSchema,
		PermissionMap,
		OrganizationAdminDetailSchema
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Input } from '$lib/components/ui/input';
	import { Search, UserCog, Loader2 } from 'lucide-svelte';
	import StaffCard from '$lib/components/members/StaffCard.svelte';
	import PermissionsEditor from '$lib/components/members/PermissionsEditor.svelte';

	interface Props {
		organization: OrganizationAdminDetailSchema;
		isOwner: boolean;
	}

	let { organization, isOwner }: Props = $props();

	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	// Search state
	let staffSearch = $state('');

	// Permissions editor state
	let selectedStaff = $state<OrganizationStaffSchema | null>(null);
	let permissionsEditorOpen = $state(false);

	// Fetch staff
	const staffQuery = createQuery(() => ({
		queryKey: ['organization', organization.slug, 'staff', staffSearch],
		queryFn: async () => {
			const response = await organizationadminmembersListStaff({
				path: { slug: organization.slug },
				query: { search: staffSearch || undefined, page_size: 100 },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to fetch staff');
			}

			return response.data;
		},
		enabled: !!accessToken
	}));

	// Remove staff mutation
	const removeStaffMutation = createMutation(() => ({
		mutationFn: async (staff: OrganizationStaffSchema) => {
			const userId = staff.user.id;
			if (!userId) {
				throw new Error('User ID not found in staff data');
			}

			const response = await organizationadminmembersRemoveStaff({
				path: { slug: organization.slug, user_id: userId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to remove staff');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'staff']
			});
		},
		onError: (error: Error) => {
			alert(`Failed to remove staff: ${error.message}`);
		}
	}));

	// Update staff permissions mutation
	const updatePermissionsMutation = createMutation(() => ({
		mutationFn: async ({
			staff,
			permissions
		}: {
			staff: OrganizationStaffSchema;
			permissions: PermissionMap;
		}) => {
			const userId = staff.user.id;
			if (!userId) {
				throw new Error('User ID not found in staff data');
			}

			const response = await organizationadminmembersUpdateStaffPermissions({
				path: { slug: organization.slug, user_id: userId },
				body: { default: permissions },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to update permissions');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'staff']
			});
			permissionsEditorOpen = false;
			selectedStaff = null;
		},
		onError: (error: Error) => {
			alert(`Failed to update permissions: ${error.message}`);
		}
	}));

	// Derived data
	let staff = $derived(staffQuery.data?.results || []);

	// Handlers
	function handleEditPermissions(s: OrganizationStaffSchema) {
		selectedStaff = s;
		permissionsEditorOpen = true;
	}

	function handleSavePermissions(permissions: PermissionMap) {
		if (selectedStaff) {
			updatePermissionsMutation.mutate({ staff: selectedStaff, permissions });
		}
	}

	function handleClosePermissionsEditor() {
		permissionsEditorOpen = false;
		selectedStaff = null;
	}
</script>

<!-- Search -->
<div class="relative">
	<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
	<Input
		type="search"
		placeholder={m['orgAdmin.members.search.staff']()}
		bind:value={staffSearch}
		class="pl-10"
		aria-label={m['orgAdmin.members.search.staff']()}
	/>
</div>

<!-- Owner Notice -->
{#if isOwner}
	<div
		class="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950 sm:p-4"
	>
		<p class="text-xs leading-relaxed text-blue-900 dark:text-blue-100 sm:text-sm">
			{m['orgAdmin.members.ownerNotice']()}
		</p>
	</div>
{/if}

<!-- Staff List -->
{#if staffQuery.isLoading}
	<div class="flex items-center justify-center py-12">
		<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
	</div>
{:else if staffQuery.isError}
	<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
		<p class="text-sm text-destructive">{m['orgAdmin.members.errors.loadStaff']()}</p>
	</div>
{:else if staff.length === 0}
	<div class="rounded-lg border border-dashed p-12 text-center">
		<UserCog class="mx-auto h-12 w-12 text-muted-foreground" />
		<h3 class="mt-4 font-semibold">{m['orgAdmin.members.empty.staff.title']()}</h3>
		<p class="mt-2 text-sm text-muted-foreground">
			{staffSearch
				? m['orgAdmin.members.empty.staff.withSearch']()
				: m['orgAdmin.members.empty.staff.noSearch']()}
		</p>
	</div>
{:else}
	<div class="grid gap-4 md:grid-cols-2">
		{#each staff as staffMember (staffMember.user.email)}
			<StaffCard
				staff={staffMember}
				canRemove={isOwner}
				canEditPermissions={isOwner}
				onRemove={(s) => removeStaffMutation.mutate(s)}
				onEditPermissions={handleEditPermissions}
				isRemoving={removeStaffMutation.isPending}
			/>
		{/each}
	</div>
{/if}

<!-- Permissions Editor Dialog -->
<PermissionsEditor
	staff={selectedStaff}
	open={permissionsEditorOpen}
	onClose={handleClosePermissionsEditor}
	onSave={handleSavePermissions}
	isSaving={updatePermissionsMutation.isPending}
/>

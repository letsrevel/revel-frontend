<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { organizationadminmembersListMembers } from '$lib/api/generated/sdk.gen';
	import type {
		OrganizationMemberSchema,
		OrganizationAdminDetailSchema
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Input } from '$lib/components/ui/input';

	interface Props {
		organization: OrganizationAdminDetailSchema;
		value: OrganizationMemberSchema | null;
		onSelect: (member: OrganizationMemberSchema | null) => void;
		placeholder?: string;
	}

	const { organization, value, onSelect, placeholder = '' }: Props = $props();
	const accessToken = $derived(authStore.accessToken);

	let query = $state('');
	let debounced = $state('');
	let open = $state(false);
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		clearTimeout(debounceTimer);
		const q = query;
		debounceTimer = setTimeout(() => {
			debounced = q;
		}, 250);
		return () => clearTimeout(debounceTimer);
	});

	const membersQuery = createQuery(() => ({
		queryKey: ['organization', organization.slug, 'members', 'combobox', debounced],
		queryFn: async () => {
			const res = await organizationadminmembersListMembers({
				path: { slug: organization.slug },
				query: { page_size: 20, search: debounced || undefined },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to search members');
			return res.data;
		},
		enabled: !!accessToken && open
	}));

	const results = $derived(membersQuery.data?.results ?? []);

	function pick(member: OrganizationMemberSchema) {
		onSelect(member);
		query = member.user.display_name;
		open = false;
	}
</script>

<div class="relative">
	<Input
		bind:value={query}
		onfocus={() => (open = true)}
		onblur={() => setTimeout(() => (open = false), 150)}
		{placeholder}
		aria-autocomplete="list"
		aria-expanded={open}
	/>
	{#if open && results.length > 0}
		<ul
			role="listbox"
			class="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover shadow-lg"
		>
			{#each results as r (r.user.id ?? r.user.email ?? r.user.display_name)}
				<li role="option" aria-selected={value?.user.id === r.user.id}>
					<button
						type="button"
						class="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
						onmousedown={(e) => {
							e.preventDefault();
							pick(r);
						}}
					>
						<div class="font-medium">{r.user.display_name}</div>
						{#if r.user.email}
							<div class="text-xs text-muted-foreground">{r.user.email}</div>
						{/if}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

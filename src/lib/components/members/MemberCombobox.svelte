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
		/** Applied to the search input so an external `<label for>` can target it. */
		id?: string;
	}

	const { organization, value, onSelect, placeholder = '', id }: Props = $props();
	const accessToken = $derived(authStore.accessToken);

	const listboxId = $props.id();

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

	let listEl = $state<HTMLUListElement | null>(null);

	/**
	 * Keep the open listbox inside the visible part of whatever is scrolling
	 * around us (#702 mobile pass).
	 *
	 * This listbox is deliberately NOT portalled — it has to stay inside the
	 * hosting dialog's focus trap — so it is an absolutely positioned descendant
	 * of that dialog's `overflow-y-auto` content box. Such a box is CLIPPED to
	 * the scrollport and merely contributes to scrollable overflow: on a phone,
	 * where this combobox is the first field of a `max-h-[90vh]` dialog, the
	 * options below the fold are only reachable by scrolling the dialog — and
	 * scrolling it means touching outside the input, which blurs it and closes
	 * the list. A catch-22 the desktop viewport never shows.
	 *
	 * `block: 'nearest'` performs the MINIMUM scroll that makes the list visible
	 * and does nothing when it already is, so it never yanks the view around.
	 * Programmatic scrolling does not move focus, so the input stays focused and
	 * the list stays open.
	 */
	$effect(() => {
		if (!open || results.length === 0) return;
		// Optional call: `scrollIntoView` is not implemented in jsdom, and this is
		// a pure viewport nicety with nothing to assert in a unit test.
		listEl?.scrollIntoView?.({ block: 'nearest' });
	});

	function pick(member: OrganizationMemberSchema) {
		onSelect(member);
		query = member.user.display_name;
		open = false;
	}
</script>

<div class="relative">
	<Input
		{id}
		bind:value={query}
		onfocus={() => (open = true)}
		onblur={() => setTimeout(() => (open = false), 150)}
		{placeholder}
		role="combobox"
		aria-autocomplete="list"
		aria-expanded={open}
		aria-controls={listboxId}
	/>
	{#if open && results.length > 0}
		<!-- Height: 15rem where there is room, but never more than 40% of a short
		     viewport — on a phone with the software keyboard up, a fixed 15rem list
		     is taller than the space left below the input. -->
		<ul
			bind:this={listEl}
			id={listboxId}
			role="listbox"
			class="absolute z-50 mt-1 max-h-[min(15rem,40vh)] w-full overflow-y-auto rounded-md border bg-popover shadow-lg"
		>
			{#each results as r (r.user.id ?? r.user.email ?? r.user.display_name)}
				<li
					role="option"
					aria-selected={value?.user.id === r.user.id}
					tabindex="-1"
					class="cursor-pointer px-3 py-2 text-sm hover:bg-accent aria-selected:bg-accent"
					onmousedown={(e) => {
						e.preventDefault();
						pick(r);
					}}
				>
					<div class="font-medium">{r.user.display_name}</div>
					{#if r.user.email}
						<div class="text-xs text-muted-foreground">{r.user.email}</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>

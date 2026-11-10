<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { ChevronDown, Link, Plus, UserPlus, UserSearch } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';

	interface Props {
		onAddToRegister: () => void;
		onAddByAccount: () => void;
		onCreateInviteLink: () => void;
	}

	const { onAddToRegister, onAddByAccount, onCreateInviteLink }: Props = $props();
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button {...props} data-testid="add-person">
				<Plus aria-hidden="true" />
				{m['memberPeople.addPerson']()}
				<ChevronDown aria-hidden="true" />
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end">
		<DropdownMenu.Item onclick={onAddToRegister} data-testid="add-to-register">
			<UserPlus aria-hidden="true" />
			{m['memberPeople.addToRegister']()}
		</DropdownMenu.Item>
		<DropdownMenu.Item onclick={onAddByAccount} data-testid="add-by-account">
			<UserSearch aria-hidden="true" />
			{m['memberPeople.addByAccount']()}
		</DropdownMenu.Item>
		<DropdownMenu.Item onclick={onCreateInviteLink} data-testid="create-invite-link">
			<Link aria-hidden="true" />
			{m['memberPeople.createInviteLink']()}
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>

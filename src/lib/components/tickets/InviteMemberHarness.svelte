<script lang="ts">
	// Test-only: the mutation must be created at component init (it reads the
	// QueryClient from context), so the unit tests mount it through this harness.
	import { createInviteMemberMutation } from './ticket-member-admin.svelte';

	const { onDone }: { onDone: () => void } = $props();

	const mutation = createInviteMemberMutation({
		getSlug: () => 'acme',
		getAccessToken: () => 'tok',
		getName: () => 'Ada Lovelace',
		onDone: () => onDone()
	});
</script>

<!-- i18n-ignore (test-only harness, never rendered in the app) -->
<button type="button" onclick={() => mutation.mutate({ userId: 'u1', tierId: 't1' })}>Invite</button
>

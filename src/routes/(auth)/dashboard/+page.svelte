<script lang="ts">
	import { authStore } from '$lib/stores/auth.svelte';

	let user = $derived(authStore.user);
	let permissions = $derived(authStore.permissions);
</script>

<div class="container mx-auto px-4 py-8">
	<h1 class="mb-8 text-3xl font-bold">Dashboard</h1>

	<div class="grid gap-6 md:grid-cols-2">
		<!-- Welcome Card -->
		<div class="rounded-lg border bg-card p-6">
			<h2 class="mb-4 text-xl font-semibold">
				Welcome back, {user?.preferred_name || user?.first_name || 'User'}!
			</h2>
			<p class="text-muted-foreground">Your personalized dashboard is coming soon.</p>
		</div>

		<!-- Quick Stats -->
		<div class="rounded-lg border bg-card p-6">
			<h2 class="mb-4 text-xl font-semibold">Quick Stats</h2>
			<ul class="space-y-2 text-muted-foreground">
				<li>My Events: Coming soon</li>
				<li>My Organizations: Coming soon</li>
				<li>Upcoming RSVPs: Coming soon</li>
			</ul>
		</div>
	</div>

	{#if permissions}
		<div class="mt-6 rounded-lg border bg-muted p-4">
			<p class="text-sm text-muted-foreground">
				Debug: You have permissions for {Object.keys(permissions.organization_permissions || {}).length}
				organizations
			</p>
		</div>
	{/if}
</div>

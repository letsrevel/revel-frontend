<script lang="ts">
	// Placeholder homepage - to be implemented
	let message = $state('Welcome to Revel');
</script>

<svelte:head>
	<title>Revel - Event Management Platform</title>
	<meta name="description" content="Open-source, community-focused event management" />
</svelte:head>

<div class="flex min-h-screen items-center justify-center">
	<div class="text-center">
		<h1 class="text-4xl font-bold">{message}</h1>
		<p class="mt-4 text-muted-foreground">
			An open-source, community-focused event management platform
		</p>
	</div>
</div>

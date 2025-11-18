<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{m['privacyPolicyPage.privacyPolicy']()} - Revel</title>
	<meta name="description" content={m['privacyPolicyPage.privacyPolicy']()} />
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<h1 class="mb-8 text-3xl font-bold">{m['privacyPolicyPage.privacyPolicy']()}</h1>

	<div class="prose prose-slate dark:prose-invert max-w-none">
		{@html data.privacyPolicy}
	</div>
</div>

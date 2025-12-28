<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{m['privacyPolicyPage.privacyPolicy']()} - Revel</title>
	<meta name="description" content={m['privacyPolicyPage.privacyPolicy']()} />
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<h1 class="mb-8 text-3xl font-bold">{m['privacyPolicyPage.privacyPolicy']()}</h1>

	<MarkdownContent content={data.privacyPolicy} class="prose-slate" />
</div>

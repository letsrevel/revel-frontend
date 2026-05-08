<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import { SeoHead } from '$lib/seo';

	const { data }: { data: PageData } = $props();
</script>

<SeoHead config={data.seo} />

<div class="container mx-auto px-4 py-8">
	<h1 class="mb-8 text-3xl font-bold">{m['termsOfServicePage.termsOfService']()}</h1>

	<MarkdownContent content={data.termsAndConditions} class="prose-slate" />
</div>

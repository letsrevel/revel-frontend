<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import { SeoHead } from '$lib/seo';

	const { data }: { data: PageData } = $props();
</script>

<SeoHead config={data.seo} />

<div class="container mx-auto px-4 py-8 md:py-12">
	<PageHeader
		title={m['termsOfServicePage.termsOfService']()}
		volume="celebration"
		class="mb-8 md:mb-10"
	/>

	<MarkdownContent content={data.termsAndConditions} class="prose-slate" />
</div>

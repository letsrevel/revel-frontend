<script lang="ts">
	import Header from './Header.svelte';
	import Footer from './Footer.svelte';

	interface Props {
		children?: import('svelte').Snippet;
	}

	let { children }: Props = $props();
</script>

<div class="flex min-h-screen flex-col">
	<Header />

	<main id="main-content" class="flex-1">
		{@render children?.()}
	</main>

	<Footer />
</div>

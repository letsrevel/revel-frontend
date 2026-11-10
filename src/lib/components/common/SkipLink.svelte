<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
</script>

<!--
	Skip-to-content link. Rendered once, as the FIRST focusable element of the root
	layout (before the impersonation / demo / maintenance banners), so it is the first
	Tab stop on every page. Targets `#main-content`, owned by the page layout's <main>
	(or the admin content column). z-[110] beats the banners (z-[100]) and the sticky
	header (z-50).
-->
<a
	href="#main-content"
	class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[110] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
>
	{m['nav.skipToContent']()}
</a>

<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import AuthBandLayout from '$lib/components/auth/AuthBandLayout.svelte';
	import { brandName } from '$lib/seo/tenant';
	import { postLogout } from '$lib/utils/logout';
	import { Loader2 } from '@lucide/svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	const { data }: Props = $props();

	/**
	 * Logout confirmation. GET /logout never changes auth state (a cross-site
	 * link must not be able to sign anyone out); this page is the deliberate
	 * step. The form is a plain native POST, deliberately NOT `use:enhance`: the
	 * server's 303 then yields a full document load, the only thing that drops
	 * the in-memory auth store. `data.returnUrl` is already validated server-side.
	 */
	const cancelHref = $derived(data.returnUrl || resolve('/', {}));

	let pending = $state(false);

	/**
	 * This page is a fresh document load, so the root layout's auth bootstrap
	 * (a token refresh) may still be in flight. Submitting now would let that
	 * refresh's Set-Cookie land AFTER the logout cleared the cookies, leaving
	 * the user signed in. postLogout waits for auth to settle, then does the
	 * native POST. Without JS the form simply posts as-is.
	 */
	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (pending) return;
		pending = true;
		void postLogout(data.returnUrl);
	}
</script>

<svelte:head>
	<meta name="robots" content="noindex" />
</svelte:head>

<AuthBandLayout
	kicker={m['logoutPage.kicker']()}
	title={m['logoutPage.title']({ brand: brandName(page.data.tenant) })}
	subtitle={m['logoutPage.description']()}
>
	<Card>
		<CardContent class="flex flex-col gap-3 p-6 sm:flex-row-reverse sm:p-8">
			<form method="POST" class="sm:flex-1" onsubmit={handleSubmit}>
				<input type="hidden" name="returnUrl" value={data.returnUrl} />
				<Button type="submit" class="w-full" disabled={pending} aria-busy={pending}>
					{#if pending}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
					{/if}
					{m['auth.logout']()}
				</Button>
			</form>
			<Button variant="outline" href={cancelHref} class="w-full sm:flex-1">
				{m['common.actions_cancel']()}
			</Button>
		</CardContent>
	</Card>
</AuthBandLayout>

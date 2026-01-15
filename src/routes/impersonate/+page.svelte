<script lang="ts">
	import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// If we reach this page, it means the impersonation failed
	// (successful impersonation redirects to dashboard in +page.server.ts)
</script>

<svelte:head>
	<title>{m['impersonatePage.title']()}</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-muted/50 p-4">
	<Card.Root class="w-full max-w-md">
		<Card.Header class="text-center">
			<div
				class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10"
			>
				<AlertTriangle class="h-8 w-8 text-destructive" aria-hidden="true" />
			</div>
			<Card.Title class="text-xl">{m['impersonatePage.errorTitle']()}</Card.Title>
			<Card.Description>
				{data.errorMessage}
			</Card.Description>
		</Card.Header>

		<Card.Content class="space-y-4">
			{#if data.error === 'missing_token'}
				<p class="text-sm text-muted-foreground">
					{m['impersonatePage.missingTokenHelp']()}
				</p>
			{:else if data.error === 'invalid_token'}
				<p class="text-sm text-muted-foreground">
					{m['impersonatePage.invalidTokenHelp']()}
				</p>
			{:else if data.error === 'forbidden'}
				<p class="text-sm text-muted-foreground">
					{m['impersonatePage.forbiddenHelp']()}
				</p>
			{:else}
				<p class="text-sm text-muted-foreground">
					{m['impersonatePage.genericHelp']()}
				</p>
			{/if}
		</Card.Content>

		<Card.Footer class="flex flex-col gap-2">
			<Button href="/login" variant="default" class="w-full">
				<ArrowLeft class="mr-2 h-4 w-4" aria-hidden="true" />
				{m['impersonatePage.goToLogin']()}
			</Button>
			{#if data.error === 'network'}
				<Button onclick={() => window.location.reload()} variant="outline" class="w-full">
					<RefreshCw class="mr-2 h-4 w-4" aria-hidden="true" />
					{m['impersonatePage.retry']()}
				</Button>
			{/if}
		</Card.Footer>
	</Card.Root>
</div>

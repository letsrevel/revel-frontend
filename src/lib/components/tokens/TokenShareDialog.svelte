<script lang="ts">
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Copy, Check, Share2 } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	interface Props {
		open: boolean;
		shareUrl: string;
		tokenName?: string;
		onClose: () => void;
	}

	let { open, shareUrl, tokenName, onClose }: Props = $props();

	let copied = $state(false);

	async function copyToClipboard() {
		try {
			await navigator.clipboard.writeText(shareUrl);
			copied = true;
			toast.success('Link copied to clipboard!');
			setTimeout(() => {
				copied = false;
			}, 2000);
		} catch (err) {
			toast.error('Failed to copy link');
		}
	}

	async function shareNative() {
		if (navigator.share) {
			try {
				await navigator.share({
					title: tokenName || 'Invitation Link',
					url: shareUrl
				});
			} catch (err) {
				// User cancelled or error occurred
				console.error('Share failed:', err);
			}
		}
	}

	const supportsNativeShare = $derived(typeof navigator !== 'undefined' && !!navigator.share);
</script>

<Dialog bind:open>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle>Share Invitation Link</DialogTitle>
			<DialogDescription>
				{#if tokenName}
					Share this link for "{tokenName}"
				{:else}
					Share this invitation link
				{/if}
			</DialogDescription>
		</DialogHeader>

		<div class="space-y-4">
			<!-- Shareable URL -->
			<div class="flex items-center space-x-2">
				<div class="grid flex-1 gap-2">
					<label for="share-url" class="sr-only">Shareable URL</label>
					<input
						id="share-url"
						type="text"
						readonly
						value={shareUrl}
						class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					/>
				</div>
				<Button
					type="button"
					size="sm"
					class="px-3"
					onclick={copyToClipboard}
					aria-label="Copy link to clipboard"
				>
					{#if copied}
						<Check class="h-4 w-4" aria-hidden="true" />
					{:else}
						<Copy class="h-4 w-4" aria-hidden="true" />
					{/if}
				</Button>
			</div>

			<!-- Action buttons -->
			<div class="flex justify-end gap-2">
				{#if supportsNativeShare}
					<Button type="button" variant="outline" onclick={shareNative}>
						<Share2 class="mr-2 h-4 w-4" aria-hidden="true" />
						Share
					</Button>
				{/if}
				<Button type="button" variant="outline" onclick={onClose}>Close</Button>
			</div>
		</div>
	</DialogContent>
</Dialog>

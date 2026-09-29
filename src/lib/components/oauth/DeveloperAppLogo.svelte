<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Loader2 } from '@lucide/svelte';
	import type { OAuthAppSchema } from '$lib/api/generated/types.gen';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import ImageUploader from '$lib/components/forms/ImageUploader.svelte';

	interface Props {
		app: OAuthAppSchema;
		/** Called with the cropped square PNG; a cleared pick is not an upload. */
		onUpload: (file: File) => void;
		uploading?: boolean;
		/** Already-translated upload failure. */
		error?: string | null;
	}
	const { app, onUpload, uploading = false, error = null }: Props = $props();

	const uid = $props.id();
</script>

<section aria-labelledby="{uid}-heading" class="space-y-3">
	<SectionHeader
		id="{uid}-heading"
		title={m['oauth.developer.logo.title']()}
		subtitle={m['oauth.developer.logo.help']()}
	/>
	<!-- Remount on a failure so the uploader drops the un-uploaded local preview
	     and falls back to the logo the server actually holds. -->
	{#key error}
		<!-- The section heading already shows "Logo"; the label stays for the file input's name. -->
		<ImageUploader
			id="{uid}-input"
			label={m['oauth.developer.logo.title']()}
			class="[&>label]:sr-only"
			preview={app.logo_url ?? null}
			accept="image/png,image/jpeg"
			aspectRatio="square"
			crop
			cropAspectRatio={1}
			cropOutputFormat="image/png"
			disabled={uploading}
			error={error ?? undefined}
			onFileSelect={(file) => {
				if (file) onUpload(file);
			}}
		/>
	{/key}
	{#if uploading}
		<p role="status" class="flex items-center gap-2 text-sm text-muted-foreground">
			<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
			{m['oauth.developer.form.saving']()}
		</p>
	{/if}
</section>

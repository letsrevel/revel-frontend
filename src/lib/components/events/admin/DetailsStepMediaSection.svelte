<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { getBackendUrl } from '$lib/config/api';
	import { Image, ChevronDown, ChevronRight } from '@lucide/svelte';
	import ImageUploader from '$lib/components/forms/ImageUploader.svelte';
	import { COVER_ASPECT_RATIO, LOGO_ASPECT_RATIO } from '$lib/utils/image-crop';

	interface Props {
		logo?: string;
		coverArt?: string;
		organizationLogo?: string;
		organizationCoverArt?: string;
		/** Accordion state; ignored when `bare` (the section is always expanded). */
		isOpen?: boolean;
		onToggle?: () => void;
		/** Render only the body, with no accordion chrome (the event editor shows every section expanded). */
		bare?: boolean;
		/** Side-by-side dense layout with small previews (event editor only; the wizards keep the roomy default). */
		compact?: boolean;
		onUpdateImages: (data: {
			logo?: File | null;
			coverArt?: File | null;
			deleteLogo?: boolean;
			deleteCoverArt?: boolean;
		}) => void;
	}

	const {
		logo,
		coverArt,
		organizationLogo,
		organizationCoverArt,
		isOpen = false,
		onToggle = () => {
			/* noop */
		},
		bare = false,
		compact = false,
		onUpdateImages
	}: Props = $props();

	// Image state
	let logoFile = $state<File | null>(null);
	let coverArtFile = $state<File | null>(null);

	// Helper function to get full image URL
	function getImageUrl(path: string | null | undefined): string | null {
		if (!path) return null;
		return getBackendUrl(path);
	}

	// Compute image URLs with fallback to organization
	const logoUrl = $derived(getImageUrl(logo) || getImageUrl(organizationLogo));
	const coverArtUrl = $derived(getImageUrl(coverArt) || getImageUrl(organizationCoverArt));

	/**
	 * Handle logo file select
	 */
	function handleLogoFileSelect(file: File | null): void {
		logoFile = file;
		onUpdateImages({ logo: file, deleteLogo: false });
	}

	/**
	 * Handle cover art file select
	 */
	function handleCoverArtFileSelect(file: File | null): void {
		coverArtFile = file;
		onUpdateImages({ coverArt: file, deleteCoverArt: false });
	}

	/**
	 * Handle logo removal
	 */
	function handleRemoveLogo(): void {
		logoFile = null;
		onUpdateImages({ logo: null, deleteLogo: true });
	}

	/**
	 * Handle cover art removal
	 */
	function handleRemoveCoverArt(): void {
		coverArtFile = null;
		onUpdateImages({ coverArt: null, deleteCoverArt: true });
	}
</script>

{#snippet logoUploader()}
	<ImageUploader
		bind:value={logoFile}
		preview={logoUrl}
		label={m['detailsStep.eventLogo']()}
		aspectRatio="square"
		{compact}
		accept="image/jpeg,image/png,image/webp"
		maxSize={5 * 1024 * 1024}
		crop
		cropAspectRatio={LOGO_ASPECT_RATIO}
		cropShape="rect"
		cropOutputFormat="image/png"
		onFileSelect={(file) => {
			if (file) handleLogoFileSelect(file);
			else handleRemoveLogo();
		}}
	/>
{/snippet}

{#snippet coverUploader()}
	<ImageUploader
		bind:value={coverArtFile}
		preview={coverArtUrl}
		label={m['detailsStep.coverArt']()}
		aspectRatio="wide"
		{compact}
		accept="image/jpeg,image/png,image/webp"
		maxSize={5 * 1024 * 1024}
		crop
		cropAspectRatio={COVER_ASPECT_RATIO}
		cropShape="rect"
		onFileSelect={(file) => {
			if (file) handleCoverArtFileSelect(file);
			else handleRemoveCoverArt();
		}}
	/>
{/snippet}

{#snippet body()}
	{#if compact}
		<!-- Logo and cover side by side. The hints run full width underneath,
		     each led by its uploader's name: inside the 8rem logo column the
		     logo hint wrapped to ~9 lines. -->
		<div class="space-y-3">
			<div class="grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
				{@render logoUploader()}
				{@render coverUploader()}
			</div>
			<div class="space-y-1 text-xs text-muted-foreground">
				<p>
					<span class="font-semibold text-foreground">{m['detailsStep.eventLogo']()}:</span>
					{m['detailsStep.logoHint']()}
				</p>
				<p>
					<span class="font-semibold text-foreground">{m['detailsStep.coverArt']()}:</span>
					{m['detailsStep.coverArtHint']()}
				</p>
			</div>
		</div>
	{:else}
		{@render logoUploader()}
		<p class="-mt-4 text-xs text-muted-foreground">
			{m['detailsStep.logoHint']()}
		</p>

		{@render coverUploader()}
		<p class="-mt-4 text-xs text-muted-foreground">
			{m['detailsStep.coverArtHint']()}
		</p>
	{/if}
{/snippet}

{#if bare}
	<div class="space-y-6">
		{@render body()}
	</div>
{:else}
	<!-- Media Section -->
	<div class="overflow-hidden rounded-lg border border-border">
		<button
			type="button"
			onclick={onToggle}
			class="flex w-full items-center justify-between bg-muted/50 p-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			aria-expanded={isOpen}
		>
			<div class="flex items-center gap-2 font-semibold">
				<Image class="h-5 w-5" aria-hidden="true" />
				{m['detailsStep.media']()}
			</div>
			{#if isOpen}
				<ChevronDown class="h-5 w-5" aria-hidden="true" />
			{:else}
				<ChevronRight class="h-5 w-5" aria-hidden="true" />
			{/if}
		</button>

		{#if isOpen}
			<div class="space-y-6 p-4">
				{@render body()}
			</div>
		{/if}
	</div>
{/if}

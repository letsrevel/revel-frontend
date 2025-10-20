<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/state';
	import { MapPin, Settings } from 'lucide-svelte';

	let { data }: { data: PageData } = $props();

	// Backend URL for images
	const BACKEND_URL = 'http://localhost:8000';

	// Create mutable copy for client-side updates
	let organization = $state(data.organization);

	// Helper function to get full image URL
	function getImageUrl(path: string | null | undefined): string | null {
		if (!path) return null;
		// If path is already a full URL, return it
		if (path.startsWith('http://') || path.startsWith('https://')) {
			return path;
		}
		// Otherwise, prepend backend URL
		return `${BACKEND_URL}${path}`;
	}

	// Compute full image URLs
	const logoUrl = $derived(getImageUrl(organization.logo));
	const coverUrl = $derived(getImageUrl(organization.cover_art));

	// Compute location display
	let locationDisplay = $derived.by(() => {
		if (!organization.city) return organization.address || null;
		const cityCountry = organization.city.country
			? `${organization.city.name}, ${organization.city.country}`
			: organization.city.name;
		return organization.address ? `${organization.address}, ${cityCountry}` : cityCountry;
	});

	// Fallback gradient for cover art
	function getOrgFallbackGradient(orgId: string): string {
		// Use org ID to generate consistent gradient
		const hash = orgId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
		const gradients = [
			'bg-gradient-to-br from-blue-500 to-indigo-600',
			'bg-gradient-to-br from-purple-500 to-pink-600',
			'bg-gradient-to-br from-green-500 to-teal-600',
			'bg-gradient-to-br from-orange-500 to-red-600',
			'bg-gradient-to-br from-cyan-500 to-blue-600'
		];
		return gradients[hash % gradients.length];
	}

	let fallbackGradient = $derived(getOrgFallbackGradient(organization.id));
</script>

<svelte:head>
	<title>{organization.name} | Revel</title>
	<meta
		name="description"
		content={organization.description?.slice(0, 160) || `${organization.name} on Revel`}
	/>

	<!-- Open Graph -->
	<meta property="og:type" content="profile" />
	<meta property="og:title" content={organization.name} />
	<meta
		property="og:description"
		content={organization.description || `${organization.name} on Revel`}
	/>
	{#if coverUrl}
		<meta property="og:image" content={coverUrl} />
	{/if}
	<meta property="og:url" content={page.url.href} />

	<!-- Twitter Card -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={organization.name} />
	<meta
		name="twitter:description"
		content={organization.description?.slice(0, 200) || `${organization.name} on Revel`}
	/>
	{#if coverUrl}
		<meta name="twitter:image" content={coverUrl} />
	{/if}
</svelte:head>

<div class="min-h-screen bg-background">
	<!-- Hero Section with Cover Art -->
	<section class="relative w-full overflow-hidden">
		<!-- Cover Image or Gradient -->
		<div class="relative h-48 w-full md:h-64 lg:h-80">
			{#if coverUrl}
				<img
					src={coverUrl}
					alt="{organization.name} cover"
					class="h-full w-full object-cover"
					loading="eager"
				/>
				<!-- Gradient overlay -->
				<div
					class="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/60"
				></div>
			{:else}
				<!-- Fallback gradient -->
				<div class="h-full w-full {fallbackGradient}"></div>
				<div class="absolute inset-0 bg-gradient-to-b from-black/10 to-black/60"></div>
			{/if}
		</div>
	</section>

	<!-- Main Content -->
	<div class="container mx-auto px-6 py-8 md:px-8 lg:py-12">
		<!-- Header with Logo, Name, and Actions -->
		<div class="mb-8 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
			<div class="flex flex-1 gap-4">
				<!-- Organization Logo -->
				<div class="flex-shrink-0">
					{#if logoUrl}
						<img
							src={logoUrl}
							alt="{organization.name} logo"
							class="h-16 w-16 rounded-lg object-cover shadow-sm md:h-20 md:w-20"
						/>
					{:else}
						<div
							class="flex h-16 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-xl font-bold text-primary-foreground shadow-sm md:h-20 md:w-20 md:text-2xl"
						>
							{organization.name.charAt(0).toUpperCase()}
						</div>
					{/if}
				</div>

				<!-- Organization Info -->
				<div class="min-w-0 flex-1">
					<h1 class="mb-2 text-3xl font-bold md:text-4xl">{organization.name}</h1>

					<!-- Metadata Row -->
					<div class="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
						<!-- Location -->
						{#if locationDisplay}
							<div class="flex items-center gap-1.5">
								<MapPin class="h-4 w-4" aria-hidden="true" />
								<span>{locationDisplay}</span>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Edit Button (if user has permission) -->
			{#if data.canEdit}
				<div class="flex-shrink-0">
					<a
						href="/org/{organization.slug}/admin/settings"
						class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						<Settings class="h-4 w-4" aria-hidden="true" />
						Edit Profile
					</a>
				</div>
			{/if}
		</div>

		<!-- Organization Description -->
		{#if organization.description_html}
			<section
				aria-labelledby="description-heading"
				class="mb-12 rounded-lg border bg-card p-6 md:p-8"
			>
				<h2 id="description-heading" class="sr-only">About {organization.name}</h2>
				<div class="prose prose-slate dark:prose-invert max-w-none">
					{@html organization.description_html}
				</div>
			</section>
		{:else if organization.description}
			<section
				aria-labelledby="description-heading"
				class="mb-12 rounded-lg border bg-card p-6 md:p-8"
			>
				<h2 id="description-heading" class="sr-only">About {organization.name}</h2>
				<div class="prose prose-slate dark:prose-invert max-w-none">
					<p>{organization.description}</p>
				</div>
			</section>
		{/if}

		<!-- Placeholder for Future Features -->
		<div class="rounded-lg border border-dashed bg-muted/20 p-8 text-center">
			<h2 class="mb-2 text-xl font-semibold text-muted-foreground">More coming soon</h2>
			<p class="text-sm text-muted-foreground">
				Event listings and member information will be displayed here.
			</p>
		</div>
	</div>
</div>

<style>
	/* Ensure proper prose styling for description */
	:global(.prose) {
		color: inherit;
	}

	:global(.prose p) {
		margin-top: 0.75rem;
		margin-bottom: 0.75rem;
	}

	:global(.prose p:first-child) {
		margin-top: 0;
	}

	:global(.prose p:last-child) {
		margin-bottom: 0;
	}

	:global(.prose h1, .prose h2, .prose h3, .prose h4, .prose h5, .prose h6) {
		margin-top: 1.5rem;
		margin-bottom: 0.75rem;
		font-weight: 600;
	}

	:global(.prose h1:first-child, .prose h2:first-child, .prose h3:first-child) {
		margin-top: 0;
	}

	:global(.prose ul, .prose ol) {
		margin-top: 0.75rem;
		margin-bottom: 0.75rem;
		padding-left: 1.5rem;
	}

	:global(.prose li) {
		margin-top: 0.25rem;
		margin-bottom: 0.25rem;
	}

	:global(.prose a) {
		color: hsl(var(--primary));
		text-decoration: underline;
	}

	:global(.prose a:hover) {
		color: hsl(var(--primary) / 0.8);
	}

	:global(.prose strong) {
		font-weight: 600;
	}

	:global(.prose em) {
		font-style: italic;
	}

	:global(.prose code) {
		background-color: hsl(var(--muted));
		padding: 0.125rem 0.25rem;
		border-radius: 0.25rem;
		font-size: 0.875em;
	}
</style>

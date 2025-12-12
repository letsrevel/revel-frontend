<script lang="ts">
	import { page } from '$app/state';
	import { generateHomeMeta, generateWebSiteStructuredData, toJsonLd } from '$lib/utils/seo';
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import {
		Mail,
		Calendar,
		Users,
		Shield,
		Ticket,
		ClipboardList,
		UtensilsCrossed,
		Bell,
		Globe,
		Github,
		Eye,
		Building2,
		MapPin,
		Calculator,
		X,
		ArrowRight,
		Heart,
		Server,
		Lock
	} from 'lucide-svelte';

	// Generate comprehensive meta tags for home page
	let metaTags = $derived(generateHomeMeta(page.url.origin));

	// Generate WebSite structured data for SEO
	let websiteStructuredData = $derived(generateWebSiteStructuredData(page.url.origin));
	let websiteJsonLd = $derived(toJsonLd(websiteStructuredData));

	// Animated letter for Italian welcome (client-side only)
	const letters = ['a', 'o', 'ə'] as const;
	let currentLetterIndex = $state(0);
	let currentLetter = $derived(letters[currentLetterIndex]);
	let rotation = $state(0);
	let isItalian = $derived(browser && getLocale() === 'it');

	// Beta access mailto link with pre-populated subject
	const betaAccessEmail = 'contact@letsrevel.io';
	const betaSubject = encodeURIComponent('Beta Access Request - Organization');
	const betaMailto = `mailto:${betaAccessEmail}?subject=${betaSubject}`;

	onMount(() => {
		if (getLocale() === 'it') {
			const interval = setInterval(() => {
				// Always rotate forward by 180° (never backwards)
				rotation += 180;

				// At 90° (halfway point = 300ms), swap to the next letter
				setTimeout(() => {
					currentLetterIndex = (currentLetterIndex + 1) % letters.length;
				}, 300);
			}, 2000);

			return () => clearInterval(interval);
		}
		// No cleanup needed for non-Italian locale
		return undefined;
	});

	// Fee calculator modal state
	let showFeeCalculator = $state(false);
	let ticketPrice = $state(20);

	// Fee calculations
	// Stripe fees: 1.5% + €0.25 for EU cards (higher for UK cards, see Stripe pricing)
	const STRIPE_PERCENTAGE = 0.015; // 1.5%
	const STRIPE_FIXED = 0.25; // €0.25

	// Revel platform fee: 1.5% + €0.25
	const REVEL_PERCENTAGE = 0.015; // 1.5%
	const REVEL_FIXED = 0.25; // €0.25

	let stripeFee = $derived(ticketPrice * STRIPE_PERCENTAGE + STRIPE_FIXED);
	let revelFee = $derived(ticketPrice * REVEL_PERCENTAGE + REVEL_FIXED);
	let totalFees = $derived(stripeFee + revelFee);
	let organizerReceives = $derived(ticketPrice - totalFees);

	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-EU', {
			style: 'currency',
			currency: 'EUR',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(amount);
	}

	// Landing page URLs based on current locale
	// Landing pages are NOT paraglide-translated, they use /de/ and /it/ prefixes
	let landingPagePrefix = $derived(getLocale() === 'en' ? '' : `/${getLocale()}`);
</script>

<svelte:head>
	<title>{metaTags.title}</title>
	<meta name="description" content={metaTags.description} />
	{#if metaTags.canonical}
		<link rel="canonical" href={metaTags.canonical} />
	{/if}

	<!-- Open Graph -->
	<meta property="og:type" content={metaTags.ogType || 'website'} />
	<meta property="og:title" content={metaTags.ogTitle || metaTags.title} />
	<meta property="og:description" content={metaTags.ogDescription || metaTags.description} />
	{#if metaTags.ogImage}
		<meta property="og:image" content={metaTags.ogImage} />
	{/if}
	<meta property="og:url" content={metaTags.ogUrl || page.url.href} />
	<meta property="og:site_name" content="Revel" />
	<meta property="og:locale" content="en_US" />

	<!-- Twitter Card -->
	<meta name="twitter:card" content={metaTags.twitterCard || 'summary_large_image'} />
	<meta name="twitter:title" content={metaTags.twitterTitle || metaTags.title} />
	<meta name="twitter:description" content={metaTags.twitterDescription || metaTags.description} />
	{#if metaTags.twitterImage}
		<meta name="twitter:image" content={metaTags.twitterImage} />
	{/if}

	<!-- Additional SEO meta tags -->
	<meta name="robots" content="index, follow" />
	<meta name="keywords" content={m['home.keywords']()} />

	<!-- Structured Data (JSON-LD) -->
	{@html `<script type="application/ld+json">${websiteJsonLd}<\/script>`}
</svelte:head>

<div class="container mx-auto px-4 py-16">
	<div class="flex flex-col items-center justify-center text-center">
		<h1 class="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
			{#if isItalian}
				<!-- Italian with animated letter flip -->
				Benvenut<span class="flip-container">
					<span class="flip-letter" style="transform: rotateY({rotation}deg)">
						{currentLetter}
					</span>
				</span>
				su <span class="text-primary">Revel</span>
			{:else}
				<!-- Other languages using i18n -->
				{@html m['home.welcomeToRevel']({
					revel: `<span class="text-primary">Revel</span>`
				})}
			{/if}
		</h1>
		<p class="mt-6 max-w-2xl text-lg text-muted-foreground">
			{m['home.tagline']()}
		</p>
		<div class="mt-10 flex flex-wrap items-center justify-center gap-4">
			<a
				href="/events"
				class="rounded-md bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
			>
				{m['nav.browseEvents']()}
			</a>
			<a
				href="/register"
				class="rounded-md border border-primary px-6 py-3 text-base font-semibold text-primary hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
			>
				{m['home.getStarted']()}
			</a>
		</div>
	</div>

	<!-- Features Section -->
	<div class="mt-24 grid gap-8 md:grid-cols-3">
		<div class="rounded-lg border bg-card p-6 text-center">
			<div class="mb-4 flex justify-center">
				<div class="rounded-full bg-primary/10 p-3">
					<svg
						class="h-6 w-6 text-primary"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
						/>
					</svg>
				</div>
			</div>
			<h3 class="mb-2 text-lg font-semibold">{m['home.discoverEventsTitle']()}</h3>
			<p class="text-sm text-muted-foreground">
				{m['home.discoverEventsDescription']()}
			</p>
		</div>

		<div class="rounded-lg border bg-card p-6 text-center">
			<div class="mb-4 flex justify-center">
				<div class="rounded-full bg-secondary/10 p-3">
					<svg
						class="h-6 w-6 text-secondary"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
						/>
					</svg>
				</div>
			</div>
			<h3 class="mb-2 text-lg font-semibold">{m['home.buildCommunityTitle']()}</h3>
			<p class="text-sm text-muted-foreground">
				{m['home.buildCommunityDescription']()}
			</p>
		</div>

		<div class="rounded-lg border bg-card p-6 text-center">
			<div class="mb-4 flex justify-center">
				<div class="rounded-full bg-accent/10 p-3">
					<svg
						class="h-6 w-6 text-accent"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
						/>
					</svg>
				</div>
			</div>
			<h3 class="mb-2 text-lg font-semibold">{m['home.safeSecureTitle']()}</h3>
			<p class="text-sm text-muted-foreground">
				{m['home.safeSecureDescription']()}
			</p>
		</div>
	</div>

	<!-- Everything You Need Section -->
	<div class="mb-16 mt-24 text-center">
		<h2 class="mb-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
			{m['learnMore.heroTitle']()}
		</h2>
		<p class="mx-auto max-w-3xl text-lg text-muted-foreground">
			{m['learnMore.heroSubtitle']()}
		</p>
	</div>

	<!-- Core Features Grid -->
	<div class="mb-16">
		<h2 class="mb-8 text-center text-3xl font-bold">{m['learnMore.coreFeaturesTitle']()}</h2>
		<div class="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
			<!-- Event Management -->
			<div class="rounded-lg border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
				<div class="mb-4 flex items-center gap-3">
					<div class="rounded-full bg-primary/10 p-3">
						<Calendar class="h-6 w-6 text-primary" aria-hidden="true" />
					</div>
					<h3 class="text-xl font-semibold">{m['learnMore.eventManagementTitle']()}</h3>
				</div>
				<p class="mb-4 text-sm text-muted-foreground">
					{m['learnMore.eventManagementDescription']()}
				</p>
				<ul class="space-y-2 text-sm text-muted-foreground">
					<li class="flex items-start gap-2">
						<span class="text-primary">•</span>
						<span>{m['learnMore.eventManagementFeature1']()}</span>
					</li>
					<li class="flex items-start gap-2">
						<span class="text-primary">•</span>
						<span>{m['learnMore.eventManagementFeature2']()}</span>
					</li>
					<li class="flex items-start gap-2">
						<span class="text-primary">•</span>
						<span>{m['learnMore.eventManagementFeature3']()}</span>
					</li>
				</ul>
			</div>

			<!-- Ticketing System -->
			<div class="rounded-lg border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
				<div class="mb-4 flex items-center gap-3">
					<div class="rounded-full bg-secondary/10 p-3">
						<Ticket class="h-6 w-6 text-secondary" aria-hidden="true" />
					</div>
					<h3 class="text-xl font-semibold">{m['learnMore.ticketingTitle']()}</h3>
				</div>
				<p class="mb-4 text-sm text-muted-foreground">
					{m['learnMore.ticketingDescription']()}
				</p>
				<ul class="space-y-2 text-sm text-muted-foreground">
					<li class="flex items-start gap-2">
						<span class="text-secondary">•</span>
						<span>{m['learnMore.ticketingFeature1']()}</span>
					</li>
					<li class="flex items-start gap-2">
						<span class="text-secondary">•</span>
						<span>{m['learnMore.ticketingFeature2']()}</span>
					</li>
					<li class="flex items-start gap-2">
						<span class="text-secondary">•</span>
						<span>{m['learnMore.ticketingFeature3']()}</span>
					</li>
					<li class="flex items-start gap-2">
						<span class="text-secondary">•</span>
						<span>{m['learnMore.ticketingFeature4']()}</span>
					</li>
				</ul>
			</div>

			<!-- Questionnaire Screening -->
			<div class="rounded-lg border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
				<div class="mb-4 flex items-center gap-3">
					<div class="rounded-full bg-accent/10 p-3">
						<ClipboardList class="h-6 w-6 text-accent" aria-hidden="true" />
					</div>
					<h3 class="text-xl font-semibold">{m['learnMore.questionnaireTitle']()}</h3>
				</div>
				<p class="mb-4 text-sm text-muted-foreground">
					{m['learnMore.questionnaireDescription']()}
				</p>
				<ul class="space-y-2 text-sm text-muted-foreground">
					<li class="flex items-start gap-2">
						<span class="text-accent">•</span>
						<span>{m['learnMore.questionnaireFeature1']()}</span>
					</li>
					<li class="flex items-start gap-2">
						<span class="text-accent">•</span>
						<span>{m['learnMore.questionnaireFeature2']()}</span>
					</li>
					<li class="flex items-start gap-2">
						<span class="text-accent">•</span>
						<span>{m['learnMore.questionnaireFeature3']()}</span>
					</li>
				</ul>
			</div>

			<!-- Community Building -->
			<div class="rounded-lg border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
				<div class="mb-4 flex items-center gap-3">
					<div class="rounded-full bg-primary/10 p-3">
						<Users class="h-6 w-6 text-primary" aria-hidden="true" />
					</div>
					<h3 class="text-xl font-semibold">{m['learnMore.communityTitle']()}</h3>
				</div>
				<p class="mb-4 text-sm text-muted-foreground">
					{m['learnMore.communityDescription']()}
				</p>
				<ul class="space-y-2 text-sm text-muted-foreground">
					<li class="flex items-start gap-2">
						<span class="text-primary">•</span>
						<span>{m['learnMore.communityFeature1']()}</span>
					</li>
					<li class="flex items-start gap-2">
						<span class="text-primary">•</span>
						<span>{m['learnMore.communityFeature2']()}</span>
					</li>
					<li class="flex items-start gap-2">
						<span class="text-primary">•</span>
						<span>{m['learnMore.communityFeature3']()}</span>
					</li>
				</ul>
			</div>

			<!-- Potluck Coordination -->
			<div class="rounded-lg border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
				<div class="mb-4 flex items-center gap-3">
					<div class="rounded-full bg-secondary/10 p-3">
						<UtensilsCrossed class="h-6 w-6 text-secondary" aria-hidden="true" />
					</div>
					<h3 class="text-xl font-semibold">{m['learnMore.potluckTitle']()}</h3>
				</div>
				<p class="mb-4 text-sm text-muted-foreground">
					{m['learnMore.potluckDescription']()}
				</p>
				<ul class="space-y-2 text-sm text-muted-foreground">
					<li class="flex items-start gap-2">
						<span class="text-secondary">•</span>
						<span>{m['learnMore.potluckFeature1']()}</span>
					</li>
					<li class="flex items-start gap-2">
						<span class="text-secondary">•</span>
						<span>{m['learnMore.potluckFeature2']()}</span>
					</li>
					<li class="flex items-start gap-2">
						<span class="text-secondary">•</span>
						<span>{m['learnMore.potluckFeature3']()}</span>
					</li>
				</ul>
			</div>

			<!-- Privacy & Security -->
			<div class="rounded-lg border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
				<div class="mb-4 flex items-center gap-3">
					<div class="rounded-full bg-accent/10 p-3">
						<Shield class="h-6 w-6 text-accent" aria-hidden="true" />
					</div>
					<h3 class="text-xl font-semibold">{m['learnMore.privacyTitle']()}</h3>
				</div>
				<p class="mb-4 text-sm text-muted-foreground">
					{m['learnMore.privacyDescription']()}
				</p>
				<ul class="space-y-2 text-sm text-muted-foreground">
					<li class="flex items-start gap-2">
						<span class="text-accent">•</span>
						<span>{m['learnMore.privacyFeature1']()}</span>
					</li>
					<li class="flex items-start gap-2">
						<span class="text-accent">•</span>
						<span>{m['learnMore.privacyFeature2']()}</span>
					</li>
					<li class="flex items-start gap-2">
						<span class="text-accent">•</span>
						<span>{m['learnMore.privacyFeature3']()}</span>
					</li>
				</ul>
			</div>
		</div>
	</div>

	<!-- Additional Features -->
	<div class="mb-16">
		<h2 class="mb-8 text-center text-3xl font-bold">{m['learnMore.additionalFeaturesTitle']()}</h2>
		<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
			<!-- Notifications -->
			<div class="flex gap-4 rounded-lg border bg-card p-6">
				<div class="flex-shrink-0">
					<div class="rounded-full bg-primary/10 p-3">
						<Bell class="h-6 w-6 text-primary" aria-hidden="true" />
					</div>
				</div>
				<div>
					<h3 class="mb-2 text-lg font-semibold">{m['learnMore.notificationsTitle']()}</h3>
					<p class="text-sm text-muted-foreground">
						{m['learnMore.notificationsDescription']()}
					</p>
				</div>
			</div>

			<!-- Multi-language -->
			<div class="flex gap-4 rounded-lg border bg-card p-6">
				<div class="flex-shrink-0">
					<div class="rounded-full bg-secondary/10 p-3">
						<Globe class="h-6 w-6 text-secondary" aria-hidden="true" />
					</div>
				</div>
				<div>
					<h3 class="mb-2 text-lg font-semibold">{m['learnMore.multiLanguageTitle']()}</h3>
					<p class="text-sm text-muted-foreground">
						{m['learnMore.multiLanguageDescription']()}
					</p>
				</div>
			</div>

			<!-- Venue Management -->
			<div class="flex gap-4 rounded-lg border bg-card p-6">
				<div class="flex-shrink-0">
					<div class="rounded-full bg-accent/10 p-3">
						<MapPin class="h-6 w-6 text-accent" aria-hidden="true" />
					</div>
				</div>
				<div>
					<h3 class="mb-2 text-lg font-semibold">{m['learnMore.venueManagementTitle']()}</h3>
					<p class="text-sm text-muted-foreground">
						{m['learnMore.venueManagementDescription']()}
					</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Pricing Section -->
	<div class="mb-16">
		<h2 class="mb-4 text-center text-3xl font-bold">{m['learnMore.pricingTitle']()}</h2>
		<p class="mx-auto mb-8 max-w-2xl text-center text-lg text-muted-foreground">
			{m['learnMore.pricingDescription']()}
		</p>
		<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
			<!-- Free Events -->
			<div class="rounded-lg border bg-card p-6 text-center">
				<h3 class="mb-2 text-lg font-semibold">{m['learnMore.pricingFreeEvents']()}</h3>
				<p class="text-2xl font-bold text-primary">{m['learnMore.pricingFreeEventsPrice']()}</p>
				<p class="mt-2 text-sm text-muted-foreground">
					{m['learnMore.pricingFreeEventsDescription']()}
				</p>
			</div>

			<!-- Self-Managed Payments -->
			<div class="rounded-lg border bg-card p-6 text-center">
				<h3 class="mb-2 text-lg font-semibold">{m['learnMore.pricingSelfManaged']()}</h3>
				<p class="text-2xl font-bold text-primary">{m['learnMore.pricingSelfManagedPrice']()}</p>
				<p class="mt-2 text-sm text-muted-foreground">
					{m['learnMore.pricingSelfManagedDescription']()}
				</p>
			</div>

			<!-- Self-Hosting -->
			<div class="rounded-lg border bg-card p-6 text-center">
				<h3 class="mb-2 text-lg font-semibold">{m['learnMore.pricingSelfHosting']()}</h3>
				<p class="text-2xl font-bold text-primary">{m['learnMore.pricingSelfHostingPrice']()}</p>
				<div class="mt-2 text-sm text-muted-foreground">
					<p class="mb-1">{m['learnMore.pricingSelfHostingDescription']()}</p>
					<a
						href="https://stripe.com/en-at/pricing"
						target="_blank"
						rel="noopener noreferrer"
						class="text-primary hover:underline"
					>
						(excluding Stripe's fees)
					</a>
				</div>
			</div>

			<!-- Hosted Online Payments (last) -->
			<div class="rounded-lg border bg-card p-6 text-center">
				<h3 class="mb-2 text-lg font-semibold">{m['learnMore.pricingOnlinePayments']()}</h3>
				<p class="text-2xl font-bold text-primary">3% + €0.50</p>
				<p class="mt-1 text-xs text-muted-foreground">({m['learnMore.eeaCards']()})</p>
				<div class="mt-3 text-sm text-muted-foreground">
					<p class="mb-2">{m['learnMore.pricingOnlinePaymentsDescription']()}</p>
					<button
						type="button"
						onclick={() => (showFeeCalculator = true)}
						class="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20"
					>
						<Calculator class="h-4 w-4" />
						{m['learnMore.feeCalculator.calculateYourFees']()}
					</button>
					<div class="mt-2">
						<a
							href="mailto:contact@letsrevel.io?subject=Revel%20Fee%20Negotiation"
							class="text-primary hover:underline"
						>
							We're happy to negotiate
						</a>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Open Source Section -->
	<div class="mb-16 rounded-lg border bg-muted/30 p-8 text-center">
		<div class="mx-auto mb-4 flex justify-center">
			<div class="rounded-full bg-foreground/10 p-4">
				<Github class="h-8 w-8" aria-hidden="true" />
			</div>
		</div>
		<h2 class="mb-4 text-2xl font-bold">{m['learnMore.openSourceTitle']()}</h2>
		<p class="mx-auto mb-6 max-w-2xl text-muted-foreground">
			{m['learnMore.openSourceDescription']()}
		</p>
		<div class="flex flex-wrap justify-center gap-4">
			<a
				href="https://github.com/letsrevel"
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex items-center gap-2 rounded-md border border-primary px-6 py-3 text-base font-semibold text-primary hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
			>
				<Github class="h-5 w-5" aria-hidden="true" />
				{m['learnMore.viewOnGithub']()}
			</a>
		</div>
	</div>

	<!-- Use Cases Section -->
	<div class="mb-16 mt-8">
		<div class="text-center">
			<h2 class="mb-4 text-3xl font-bold">{m['home.useCasesTitle']()}</h2>
			<p class="mx-auto mb-8 max-w-2xl text-muted-foreground">
				{m['home.useCasesDescription']()}
			</p>
		</div>
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			<a
				href="{landingPagePrefix}/queer-event-management"
				class="group rounded-lg border bg-card p-6 transition-all hover:border-primary hover:shadow-md"
			>
				<div class="mb-3 flex items-center gap-3">
					<div class="rounded-full bg-pink-100 p-2 dark:bg-pink-900/30">
						<Heart class="h-5 w-5 text-pink-600 dark:text-pink-400" aria-hidden="true" />
					</div>
					<h3 class="font-semibold">{m['footer.solutionQueer']()}</h3>
				</div>
				<p class="mb-3 text-sm text-muted-foreground">
					Safe spaces for LGBTQ+ communities with privacy-first ticketing and screening.
				</p>
				<span
					class="inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:underline"
				>
					Learn more <ArrowRight class="h-4 w-4" aria-hidden="true" />
				</span>
			</a>

			<a
				href="{landingPagePrefix}/kink-event-ticketing"
				class="group rounded-lg border bg-card p-6 transition-all hover:border-primary hover:shadow-md"
			>
				<div class="mb-3 flex items-center gap-3">
					<div class="rounded-full bg-purple-100 p-2 dark:bg-purple-900/30">
						<Shield class="h-5 w-5 text-purple-600 dark:text-purple-400" aria-hidden="true" />
					</div>
					<h3 class="font-semibold">{m['footer.solutionKink']()}</h3>
				</div>
				<p class="mb-3 text-sm text-muted-foreground">
					Discreet ticketing for adult events with questionnaire-based vetting.
				</p>
				<span
					class="inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:underline"
				>
					Learn more <ArrowRight class="h-4 w-4" aria-hidden="true" />
				</span>
			</a>

			<a
				href="{landingPagePrefix}/privacy-focused-events"
				class="group rounded-lg border bg-card p-6 transition-all hover:border-primary hover:shadow-md"
			>
				<div class="mb-3 flex items-center gap-3">
					<div class="rounded-full bg-green-100 p-2 dark:bg-green-900/30">
						<Lock class="h-5 w-5 text-green-600 dark:text-green-400" aria-hidden="true" />
					</div>
					<h3 class="font-semibold">{m['footer.solutionPrivacy']()}</h3>
				</div>
				<p class="mb-3 text-sm text-muted-foreground">
					GDPR-compliant, European-hosted, with full data ownership.
				</p>
				<span
					class="inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:underline"
				>
					Learn more <ArrowRight class="h-4 w-4" aria-hidden="true" />
				</span>
			</a>

			<a
				href="{landingPagePrefix}/self-hosted-event-platform"
				class="group rounded-lg border bg-card p-6 transition-all hover:border-primary hover:shadow-md"
			>
				<div class="mb-3 flex items-center gap-3">
					<div class="rounded-full bg-blue-100 p-2 dark:bg-blue-900/30">
						<Server class="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
					</div>
					<h3 class="font-semibold">{m['footer.solutionSelfHosted']()}</h3>
				</div>
				<p class="mb-3 text-sm text-muted-foreground">
					MIT licensed. Run on your own infrastructure with zero platform fees.
				</p>
				<span
					class="inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:underline"
				>
					Learn more <ArrowRight class="h-4 w-4" aria-hidden="true" />
				</span>
			</a>

			<a
				href="{landingPagePrefix}/eventbrite-alternative"
				class="group rounded-lg border bg-card p-6 transition-all hover:border-primary hover:shadow-md"
			>
				<div class="mb-3 flex items-center gap-3">
					<div class="rounded-full bg-orange-100 p-2 dark:bg-orange-900/30">
						<Ticket class="h-5 w-5 text-orange-600 dark:text-orange-400" aria-hidden="true" />
					</div>
					<h3 class="font-semibold">{m['footer.solutionEventbrite']()}</h3>
				</div>
				<p class="mb-3 text-sm text-muted-foreground">
					Lower fees, more features, and you keep your data.
				</p>
				<span
					class="inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:underline"
				>
					Learn more <ArrowRight class="h-4 w-4" aria-hidden="true" />
				</span>
			</a>
		</div>
	</div>

	<!-- Try the Demo Section -->
	<div class="mb-16 rounded-lg border-2 border-secondary bg-secondary/5 p-8 text-center">
		<div class="mx-auto mb-4 flex justify-center">
			<div class="rounded-full bg-secondary/10 p-4">
				<Eye class="h-8 w-8 text-secondary" aria-hidden="true" />
			</div>
		</div>
		<h2 class="mb-4 text-3xl font-bold">{m['home.tryDemoTitle']()}</h2>
		<p class="mx-auto mb-6 max-w-2xl text-lg text-muted-foreground">
			{m['home.tryDemoDescription']()}
		</p>
		<a
			href="https://demo.letsrevel.io/login"
			target="_blank"
			rel="noopener noreferrer"
			class="inline-flex items-center gap-2 rounded-md bg-secondary px-8 py-4 text-lg font-semibold text-secondary-foreground shadow-sm hover:bg-secondary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
		>
			<Eye class="h-5 w-5" aria-hidden="true" />
			{m['home.tryDemo']()}
		</a>
		<p class="mt-4 text-sm text-muted-foreground">
			{m['home.tryDemoNote']()}
		</p>
	</div>

	<!-- Start Organizing CTA -->
	<div class="rounded-lg border-2 border-primary bg-primary/5 p-8 text-center">
		<h2 class="mb-4 text-3xl font-bold">{m['learnMore.startOrganizingTitle']()}</h2>
		<p class="mx-auto mb-6 max-w-2xl text-lg text-muted-foreground">
			{m['learnMore.startOrganizingDescription']()}
		</p>
		<a
			href="/create-org"
			class="inline-flex items-center gap-2 rounded-md bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
		>
			<Building2 class="h-5 w-5" aria-hidden="true" />
			{m['learnMore.startOrganizing']()}
		</a>
		<p class="mt-4 text-sm text-muted-foreground">
			{m['learnMore.startOrganizingNote']()}
		</p>
	</div>
</div>

<!-- Fee Calculator Modal -->
{#if showFeeCalculator}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={(e) => e.target === e.currentTarget && (showFeeCalculator = false)}
		onkeydown={(e) => e.key === 'Escape' && (showFeeCalculator = false)}
		role="dialog"
		aria-modal="true"
		aria-labelledby="fee-calculator-title"
	>
		<div class="w-full max-w-md rounded-lg border bg-background shadow-xl">
			<!-- Header -->
			<div class="flex items-center justify-between border-b px-6 py-4">
				<h2 id="fee-calculator-title" class="text-xl font-bold">
					{m['learnMore.feeCalculator.title']()}
				</h2>
				<button
					type="button"
					onclick={() => (showFeeCalculator = false)}
					class="rounded-full p-1 hover:bg-accent"
					aria-label={m['learnMore.feeCalculator.close']()}
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<!-- Content -->
			<div class="space-y-6 px-6 py-4">
				<!-- Ticket Price Input -->
				<div>
					<label for="ticket-price" class="mb-2 block text-sm font-medium"
						>{m['learnMore.feeCalculator.ticketPrice']()}</label
					>
					<div class="relative">
						<span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
						<input
							id="ticket-price"
							type="number"
							min="0"
							step="0.01"
							bind:value={ticketPrice}
							class="w-full rounded-md border border-input bg-background py-2 pl-8 pr-4 text-lg focus:outline-none focus:ring-2 focus:ring-primary"
						/>
					</div>
				</div>

				<!-- Fee Breakdown -->
				<div class="space-y-4">
					<!-- Stripe Fees -->
					<div class="rounded-lg border bg-muted/30 p-4">
						<div class="flex items-center justify-between">
							<span class="font-medium">{m['learnMore.feeCalculator.creditCardFees']()}</span>
							<span class="text-lg font-bold text-orange-600 dark:text-orange-400">
								{formatCurrency(stripeFee)}
							</span>
						</div>
						<p class="mt-1 text-xs text-muted-foreground">
							{m['learnMore.feeCalculator.creditCardFeesDescription']()}
							<a
								href="https://stripe.com/en-at/pricing"
								target="_blank"
								rel="noopener noreferrer"
								class="text-primary hover:underline"
							>
								{m['learnMore.feeCalculator.viewStripePricing']()}
							</a>
						</p>
					</div>

					<!-- Revel Platform Fee -->
					<div class="rounded-lg border bg-muted/30 p-4">
						<div class="flex items-center justify-between">
							<span class="font-medium">{m['learnMore.feeCalculator.platformFee']()}</span>
							<span class="text-lg font-bold text-primary">
								{formatCurrency(revelFee)}
							</span>
						</div>
						<p class="mt-1 text-xs text-muted-foreground">
							{m['learnMore.feeCalculator.platformFeeDescription']()}
						</p>
					</div>

					<!-- Divider -->
					<div class="border-t"></div>

					<!-- Organization Receives -->
					<div class="rounded-lg border-2 border-green-500 bg-green-50 p-4 dark:bg-green-950/30">
						<div class="flex items-center justify-between">
							<span class="font-semibold"
								>{m['learnMore.feeCalculator.organizationReceives']()}</span
							>
							<span class="text-2xl font-bold text-green-600 dark:text-green-400">
								{formatCurrency(organizerReceives)}
							</span>
						</div>
						<p class="mt-1 text-xs text-muted-foreground">
							{m['learnMore.feeCalculator.perTicketSoldAt']({ price: formatCurrency(ticketPrice) })}
						</p>
					</div>
				</div>

				<!-- Summary -->
				<p class="text-center text-xs text-muted-foreground">
					{m['learnMore.feeCalculator.totalFees']({
						fees: formatCurrency(totalFees),
						percentage: ((totalFees / ticketPrice) * 100).toFixed(1)
					})}
				</p>
			</div>

			<!-- Footer -->
			<div class="border-t px-6 py-4">
				<p class="text-center text-sm text-muted-foreground">
					{m['learnMore.feeCalculator.questionsAboutFees']()}
					<a
						href="mailto:contact@letsrevel.io?subject=Revel%20Fee%20Question"
						class="text-primary hover:underline"
					>
						{m['learnMore.feeCalculator.contactUs']()}
					</a>
				</p>
			</div>
		</div>
	</div>
{/if}

<style>
	.flip-container {
		perspective: 1000px;
		display: inline-block;
	}

	.flip-letter {
		display: inline-block;
		transition: transform 0.6s ease-in-out;
		transform-style: preserve-3d;
	}
</style>

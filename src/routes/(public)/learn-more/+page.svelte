<script lang="ts">
	import { page } from '$app/state';
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
		Github
	} from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime.js';

	// SEO metadata
	let locale = getLocale();
	let metaTitle = $derived(m['learnMore.metaTitle']());
	let metaDescription = $derived(m['learnMore.metaDescription']());

	// Beta access mailto link with pre-populated subject
	const betaAccessEmail = 'contact@letsrevel.io';
	const betaSubject = encodeURIComponent('Beta Access Request - Organization');
	const betaMailto = `mailto:${betaAccessEmail}?subject=${betaSubject}`;
</script>

<svelte:head>
	<title>{metaTitle}</title>
	<meta name="description" content={metaDescription} />
	<meta property="og:title" content={metaTitle} />
	<meta property="og:description" content={metaDescription} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={page.url.href} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={metaTitle} />
	<meta name="twitter:description" content={metaDescription} />
</svelte:head>

<div class="container mx-auto px-4 py-12 md:py-16">
	<!-- Hero Section -->
	<div class="mb-16 text-center">
		<h1 class="mb-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
			{m['learnMore.heroTitle']()}
		</h1>
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
		<div class="grid gap-6 md:grid-cols-2">
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
				<p class="text-2xl font-bold text-primary">{m['learnMore.pricingOnlinePaymentsPrice']()}</p>
				<div class="mt-2 text-sm text-muted-foreground">
					<p class="mb-1">{m['learnMore.pricingOnlinePaymentsDescription']()}</p>
					<a
						href="https://stripe.com/en-at/pricing"
						target="_blank"
						rel="noopener noreferrer"
						class="text-primary hover:underline"
					>
						View Stripe pricing
					</a>
					<span class="mx-1">·</span>
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

	<!-- Beta Access CTA -->
	<div class="rounded-lg border-2 border-primary bg-primary/5 p-8 text-center">
		<h2 class="mb-4 text-3xl font-bold">{m['learnMore.betaAccessTitle']()}</h2>
		<p class="mx-auto mb-6 max-w-2xl text-lg text-muted-foreground">
			{m['learnMore.betaAccessDescription']()}
		</p>
		<a
			href={betaMailto}
			class="inline-flex items-center gap-2 rounded-md bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
		>
			<Mail class="h-5 w-5" aria-hidden="true" />
			{m['learnMore.requestBetaAccess']()}
		</a>
		<p class="mt-4 text-sm text-muted-foreground">
			{m['learnMore.betaAccessNote']()}
		</p>
	</div>

	<!-- Back to Home -->
	<div class="mt-12 text-center">
		<a href="/" class="text-sm text-muted-foreground hover:text-foreground">
			← {m['learnMore.backToHome']()}
		</a>
	</div>
</div>

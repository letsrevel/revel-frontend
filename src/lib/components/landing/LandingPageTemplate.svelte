<script lang="ts">
	import type { LandingPageContent, LandingPageFeature } from '$lib/data/landing-pages';
	import { landingPages, type LandingPageSlug } from '$lib/data/landing-pages';
	import { Button } from '$lib/components/ui/button';
	import {
		Ticket,
		Shield,
		Users,
		Server,
		Eye,
		Check,
		Euro,
		Lock,
		Heart,
		Globe,
		Code,
		Clipboard,
		ChevronDown,
		ChevronUp
	} from 'lucide-svelte';

	interface Props {
		content: LandingPageContent;
	}

	let { content }: Props = $props();

	// Icon mapping
	const iconMap = {
		ticket: Ticket,
		shield: Shield,
		users: Users,
		server: Server,
		eye: Eye,
		check: Check,
		euro: Euro,
		lock: Lock,
		heart: Heart,
		globe: Globe,
		code: Code,
		clipboard: Clipboard
	};

	function getIcon(iconName: LandingPageFeature['icon']) {
		return iconMap[iconName] || Check;
	}

	// FAQ accordion state
	let openFaqIndex = $state<number | null>(null);

	function toggleFaq(index: number) {
		openFaqIndex = openFaqIndex === index ? null : index;
	}

	// Get related page data
	function getRelatedPageUrl(slug: string): string {
		const locale = content.locale;
		if (locale === 'en') {
			return `/${slug}`;
		}
		return `/${locale}/${slug}`;
	}

	function getRelatedPageTitle(slug: string): string {
		const relatedContent = landingPages[content.locale]?.[slug];
		return relatedContent?.hero.headline || slug;
	}
</script>

<!-- Hero Section -->
<section
	class="relative overflow-hidden bg-gradient-to-br from-violet-600 via-purple-600 to-violet-700 py-16 md:py-24"
>
	<div class="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
	<div class="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
		<div class="text-center">
			<h1 class="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl lg:text-6xl">
				{content.hero.headline}
			</h1>
			<p class="mx-auto mt-4 max-w-3xl text-lg text-violet-100 sm:text-xl md:mt-6">
				{content.hero.subheadline}
			</p>
			<div class="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row md:mt-10">
				{#each content.cta.buttons as button, i (button.text)}
					{@const variant =
						button.variant === 'primary'
							? 'default'
							: button.variant === 'secondary'
								? 'secondary'
								: 'outline'}
					<Button
						href={button.href}
						{variant}
						size="lg"
						class={button.variant === 'primary'
							? 'bg-white text-violet-700 hover:bg-violet-50'
							: button.variant === 'secondary'
								? 'border-white/30 bg-white/10 text-white hover:bg-white/20'
								: 'border-white/30 text-white hover:bg-white/10'}
					>
						{button.text}
					</Button>
				{/each}
			</div>
		</div>
	</div>
</section>

<!-- Intro Section -->
<section class="bg-background py-12 md:py-16">
	<div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
		<div class="prose prose-lg dark:prose-invert mx-auto">
			{#each content.intro.paragraphs as paragraph, i (i)}
				<p class="text-base leading-relaxed text-muted-foreground md:text-lg">
					{paragraph}
				</p>
			{/each}
		</div>
	</div>
</section>

<!-- Features Section -->
<section class="bg-muted/50 py-12 md:py-16">
	<div class="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
		<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each content.features as feature (feature.title)}
				{@const IconComponent = getIcon(feature.icon)}
				<div class="rounded-lg border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
					<div class="mb-4 inline-flex rounded-lg bg-primary/10 p-3">
						<IconComponent class="h-6 w-6 text-primary" />
					</div>
					<h3 class="mb-2 text-lg font-semibold text-foreground">{feature.title}</h3>
					<p class="text-sm text-muted-foreground">{feature.description}</p>
				</div>
			{/each}
		</div>
	</div>
</section>

<!-- Benefits Section -->
<section class="bg-background py-12 md:py-16">
	<div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
		<h2 class="mb-8 text-center text-2xl font-bold text-foreground md:text-3xl">
			{content.benefits.title}
		</h2>
		<ul class="space-y-4">
			{#each content.benefits.items as item, i (i)}
				<li class="flex items-start gap-3">
					<Check class="mt-1 h-5 w-5 flex-shrink-0 text-primary" />
					<span class="text-base text-muted-foreground">{item}</span>
				</li>
			{/each}
		</ul>
	</div>
</section>

<!-- FAQ Section -->
<section class="bg-muted/50 py-12 md:py-16">
	<div class="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
		<h2 class="mb-8 text-center text-2xl font-bold text-foreground md:text-3xl">
			{content.locale === 'de'
				? 'Häufig gestellte Fragen'
				: content.locale === 'it'
					? 'Domande Frequenti'
					: 'Frequently Asked Questions'}
		</h2>
		<div class="space-y-4">
			{#each content.faq as faq, index (faq.question)}
				<div class="overflow-hidden rounded-lg border bg-card">
					<button
						type="button"
						class="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-muted/50"
						onclick={() => toggleFaq(index)}
						aria-expanded={openFaqIndex === index}
						aria-controls={`faq-answer-${index}`}
					>
						<span class="pr-4 font-medium text-foreground">{faq.question}</span>
						{#if openFaqIndex === index}
							<ChevronUp class="h-5 w-5 flex-shrink-0 text-muted-foreground" />
						{:else}
							<ChevronDown class="h-5 w-5 flex-shrink-0 text-muted-foreground" />
						{/if}
					</button>
					{#if openFaqIndex === index}
						<div id={`faq-answer-${index}`} class="border-t px-4 pb-4 pt-3">
							<p class="text-sm text-muted-foreground">{faq.answer}</p>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>
</section>

<!-- CTA Section -->
<section class="bg-gradient-to-br from-violet-600 via-purple-600 to-violet-700 py-12 md:py-16">
	<div class="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
		<h2 class="text-2xl font-bold text-white md:text-3xl">
			{content.cta.title}
		</h2>
		<p class="mx-auto mt-4 max-w-2xl text-violet-100">
			{content.cta.description}
		</p>
		<div class="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
			{#each content.cta.buttons as button (button.text)}
				<Button
					href={button.href}
					variant={button.variant === 'primary'
						? 'default'
						: button.variant === 'secondary'
							? 'secondary'
							: 'outline'}
					size="lg"
					class={button.variant === 'primary'
						? 'bg-white text-violet-700 hover:bg-violet-50'
						: button.variant === 'secondary'
							? 'border-white/30 bg-white/10 text-white hover:bg-white/20'
							: 'border-white/30 text-white hover:bg-white/10'}
				>
					{button.text}
				</Button>
			{/each}
		</div>
	</div>
</section>

<!-- Related Pages Section -->
{#if content.relatedPages.length > 0}
	<section class="bg-background py-12 md:py-16">
		<div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
			<h2 class="mb-6 text-center text-xl font-semibold text-foreground">
				{content.locale === 'de'
					? 'Verwandte Themen'
					: content.locale === 'it'
						? 'Argomenti Correlati'
						: 'Related Topics'}
			</h2>
			<div class="flex flex-wrap justify-center gap-4">
				{#each content.relatedPages as relatedSlug (relatedSlug)}
					<a
						href={getRelatedPageUrl(relatedSlug)}
						class="rounded-lg border px-4 py-2 text-sm text-primary transition-colors hover:bg-muted hover:text-primary/80"
					>
						{getRelatedPageTitle(relatedSlug)}
					</a>
				{/each}
			</div>
		</div>
	</section>
{/if}

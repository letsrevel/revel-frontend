<script lang="ts">
	import type { LandingPageContent, LandingPageFeature } from '$lib/data/landing-pages';
	import { landingPages } from '$lib/data/landing-pages';
	import { Button } from '$lib/components/ui/button';
	import * as m from '$lib/paraglide/messages.js';
	import ToneTile from '$lib/components/common/ToneTile.svelte';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import Sticker from '$lib/components/brand/Sticker.svelte';
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
	} from '@lucide/svelte';

	interface Props {
		content: LandingPageContent;
	}

	const { content }: Props = $props();

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

<!-- Hero Section. Fixed poster-purple background (imagery rule: decorative
     brand panel, identical in both themes, like the landing's own panels).
     text-poster-white on bg-poster-purple measures 5.52:1 (same pair
     ClosePanel documents for this exact color). Button variants below avoid
     any translucent-over-gradient wash so every pair stays a plain
     opaque-or-bordered combination on this single audited number.

     TRAP (guardrail 6, hit here in its INVERSE form): a Button with a custom
     bg-* class keeps the variant's default text unless you also set text-*
     — but a custom text-* class ALSO keeps the variant's default bg-* unless
     you explicitly set bg-* too. The "outline" branch below previously set
     only text-poster-white, so shadcn's `outline` variant's own
     `bg-background` (rest) and `hover:text-accent-foreground` (hover)
     survived cn()'s merge untouched → white text on a light bg-background at
     rest (1.13:1). Fixed by adding bg-transparent + hover:text-poster-white
     so every state has an explicit bg AND text pair. Border also bumped to
     /65 (was /60 = 2.96:1, under the 3:1 non-text floor) → 3.22:1. -->
<section class="relative overflow-hidden bg-poster-purple py-16 md:py-24">
	<div class="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
	<div class="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
		<div class="text-center">
			<h1
				class="text-3xl font-black leading-[1.12] text-poster-white sm:text-4xl md:text-5xl lg:text-6xl"
			>
				{content.hero.headline}
			</h1>
			<p class="mx-auto mt-4 max-w-3xl text-lg text-poster-white sm:text-xl md:mt-6">
				{content.hero.subheadline}
			</p>
			<div class="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row md:mt-10">
				{#each content.cta.buttons as button (button.text)}
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
							? 'bg-poster-white text-poster-purple hover:bg-poster-paper'
							: button.variant === 'secondary'
								? 'border-2 border-poster-white bg-transparent text-poster-white hover:bg-poster-white/10'
								: 'border-poster-white/65 bg-transparent text-poster-white hover:bg-poster-white/10 hover:text-poster-white'}
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
		<div class="prose prose-lg mx-auto dark:prose-invert">
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
		<SectionHeader
			title={m['landingTemplate.featuresHeading']({}, { locale: content.locale })}
			volume="celebration"
			class="mb-8 justify-center text-center"
		/>
		<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each content.features as feature (feature.title)}
				{@const IconComponent = getIcon(feature.icon)}
				<div class="rounded-lg border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
					<!-- Uniform brand tone: ToneTile's tone axis is semantic, and these
					     marketing bullets carry no per-feature meaning to encode — the
					     identity/tint axis for "same tone, different accent color per
					     destination" lands with PR 7's poster-tint prop. -->
					<ToneTile tone="brand" icon={IconComponent} size="lg" class="mb-4" />
					<h3 class="mb-2 text-lg font-bold text-foreground">{feature.title}</h3>
					<p class="text-sm text-muted-foreground">{feature.description}</p>
				</div>
			{/each}
		</div>
	</div>
</section>

<!-- Benefits Section -->
<section class="bg-background py-12 md:py-16">
	<div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
		<SectionHeader
			title={content.benefits.title}
			kicker={m['landingTemplate.benefitsKicker']({}, { locale: content.locale })}
			volume="celebration"
			class="mb-8 justify-center text-center"
		/>
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
		<SectionHeader
			title={m['landingTemplate.faqHeading']({}, { locale: content.locale })}
			kicker={m['landingTemplate.faqKicker']({}, { locale: content.locale })}
			volume="celebration"
			class="mb-8 justify-center text-center"
		/>
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

<!-- CTA Section: same fixed poster-purple treatment as the hero, plus a
     Sticker accent (the "optionally one Sticker" flagship touch). The
     Sticker is real, meaningful content (not decoration), so it's rendered
     normally — not aria-hidden — same as the poster's own sticker usage. -->
<section class="bg-poster-purple py-12 md:py-16">
	<div class="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
		<p class="text-sm font-extrabold uppercase tracking-[0.12em] text-poster-white">
			{m['landingTemplate.ctaKicker']({}, { locale: content.locale })}
		</p>
		<p class="mb-3 mt-2">
			<Sticker tint="crimson" rotate={-2}
				>{m['landingTemplate.ctaSticker']({}, { locale: content.locale })}</Sticker
			>
		</p>
		<h2 class="text-2xl font-extrabold text-poster-white md:text-3xl">
			{content.cta.title}
		</h2>
		<p class="mx-auto mt-4 max-w-2xl text-poster-white">
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
						? 'bg-poster-white text-poster-purple hover:bg-poster-paper'
						: button.variant === 'secondary'
							? 'border-2 border-poster-white bg-transparent text-poster-white hover:bg-poster-white/10'
							: 'border-poster-white/65 bg-transparent text-poster-white hover:bg-poster-white/10 hover:text-poster-white'}
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
			<SectionHeader
				title={m['landingTemplate.relatedHeading']({}, { locale: content.locale })}
				kicker={m['landingTemplate.relatedKicker']({}, { locale: content.locale })}
				volume="celebration"
				class="mb-6 justify-center text-center"
			/>
			<div class="flex flex-wrap justify-center gap-4">
				{#each content.relatedPages as relatedSlug (relatedSlug)}
					<!-- eslint-disable svelte/no-navigation-without-resolve -- locale-prefixed landing-page path built from a runtime slug; not a static route id -->
					<a
						href={getRelatedPageUrl(relatedSlug)}
						class="rounded-lg border px-4 py-2 text-sm text-primary transition-colors hover:bg-muted hover:text-primary/80"
					>
						{getRelatedPageTitle(relatedSlug)}
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{/each}
			</div>
		</div>
	</section>
{/if}

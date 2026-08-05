<script lang="ts">
	import type {
		LandingPageCTA,
		LandingPageContent,
		LandingPageFeature
	} from '$lib/data/landing-pages';
	import { landingPages } from '$lib/data/landing-pages';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
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
		ChevronUp,
		ArrowRight
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

	/**
	 * Tilt discipline (spec §3): rotation is an ACCENT, never a pattern — at most
	 * two tilted cards per grid, and only the outer ones, so the grid still reads
	 * as a grid. Content files ship 3–6 features, so this is always first + last.
	 */
	function featureTilt(index: number, total: number): string {
		if (total < 2) return '';
		if (index === 0) return '-rotate-1';
		if (index === total - 1) return 'rotate-1';
		return '';
	}

	// FAQ accordion state
	let openFaqIndex = $state<number | null>(null);

	function toggleFaq(index: number) {
		openFaqIndex = openFaqIndex === index ? null : index;
	}

	/**
	 * FAQ rows follow the uplift's option-row language (`QuestionnaireFillForm`
	 * is the family reference): chunky 2px edge, sticker radius, a real hover
	 * lift via shadow, and an expanded state that is carried by the border AND
	 * the chevron AND `aria-expanded` — never by colour alone.
	 *
	 * `border-primary` measures 6.99:1 light / 6.28:1 dark against `--card`, well
	 * over the 3:1 non-text floor, so the open row is distinguishable without
	 * relying on the (deliberately soft) `--border` resting edge. That floor
	 * applies to the OPEN state only: the hover half-tone border (~2.5:1) is a
	 * courtesy affordance, not a state indicator — hover is carried by the
	 * shadow lift.
	 */
	function faqRowClass(open: boolean): string {
		return cn(
			'overflow-hidden rounded-2xl border-2 bg-card transition-shadow',
			open
				? 'border-primary shadow-poster'
				: 'border-border hover:border-primary/50 hover:shadow-poster'
		);
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

	/**
	 * Shared CTA Button recipe for the poster-purple bands (hero + closing CTA).
	 *
	 * Focus (#796): the Button base pairs a `--ring` ring with a
	 * `ring-offset-background` gap — a theme-colored halo on a mode-inert
	 * poster panel (`--ring` measures 1.27:1 light / 2.07:1 dark against
	 * poster-purple; only the offset band kept the composite legal). Recolor
	 * both halves to the band instead: a poster-white ring (5.52:1 on
	 * poster-purple — the band's audited pair, identical in both modes) over an
	 * offset gap painted the band's own purple, so the indicator is on-brand
	 * and independent of the theme axis. Any future poster-band Button adopter
	 * needs the same treatment with its own band color.
	 */
	function ctaButtonClass(variant: LandingPageCTA['variant']): string {
		const posterFocus = 'focus-visible:ring-offset-poster-purple focus-visible:ring-poster-white';
		switch (variant) {
			case 'primary':
				return `${posterFocus} bg-poster-white text-poster-purple hover:bg-poster-paper`;
			case 'secondary':
				return `${posterFocus} border-2 border-poster-white bg-transparent text-poster-white hover:bg-poster-white/10`;
			case 'outline':
				return `${posterFocus} border-poster-white/65 bg-transparent text-poster-white hover:bg-poster-white/10 hover:text-poster-white`;
		}
	}
</script>

<!-- Hero Section. Fixed poster-purple background (imagery rule: decorative
     brand panel, identical in both themes, like the landing's own panels).
     text-poster-white on bg-poster-purple measures 5.52:1 (same pair
     ClosePanel documents for this exact color). The Button variants
     (ctaButtonClass in the script, shared with the closing CTA band — focus
     recipe documented there) avoid any translucent-over-gradient wash so
     every pair stays a plain opaque-or-bordered combination on this single
     audited number.

     TRAP (guardrail 6, hit here in its INVERSE form): a Button with a custom
     bg-* class keeps the variant's default text unless you also set text-*
     — but a custom text-* class ALSO keeps the variant's default bg-* unless
     you explicitly set bg-* too. The "outline" branch previously set
     only text-poster-white, so shadcn's `outline` variant's own
     `bg-background` (rest) and `hover:text-accent-foreground` (hover)
     survived cn()'s merge untouched → white text on a light bg-background at
     rest (1.13:1). Fixed by adding bg-transparent + hover:text-poster-white
     so every state has an explicit bg AND text pair. Border also bumped to
     /65 (was /60 = 2.96:1, under the 3:1 non-text floor) → 3.22:1.

     Uplift (spec §9): the headline moves to the celebration display scale
     (`text-4xl font-black leading-[1.08]`) and the band's bottom edge is a
     real poster CUT (`.poster-band-cut`, see the <style> block). `z-10` is
     load-bearing: the tinted panel below is pulled up UNDER this band so the
     clipped corner reveals the wash rather than the page background. -->
<section class="poster-band-cut relative z-10 overflow-hidden bg-poster-purple py-16 md:py-24">
	<div class="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
	<div class="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
		<div class="text-center">
			<h1 class="text-4xl font-black leading-[1.08] text-poster-white sm:text-5xl lg:text-6xl">
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
					<Button href={button.href} {variant} size="lg" class={ctaButtonClass(button.variant)}>
						{button.text}
					</Button>
				{/each}
			</div>
		</div>
	</div>
</section>

<!--
	Intro + Features on ONE tinted content panel (uplift, spec §9). Band/wash
	pairing: the hero is a mode-INERT poster-solid ribbon, so per the CLAUDE.md
	rule it takes a theme-aware tinted wash below it — the same composite the
	org-profile and event-detail pages use, so an SEO page and the product it
	sells read as one surface. The recipe IS registered in COMPOSITED_PAIRS
	("public page secondary wash"); numbers pasted from
	scripts/audit-brand-themes.py:
	  light — secondary@55 over background ⇒ foreground 12.36:1 ·
	          muted-foreground 6.43:1 · primary 4.97:1
	  dark  — secondary@28 over background ⇒ foreground 15.68:1 ·
	          muted-foreground 7.44:1 · primary 6.30:1
	Everything landing directly on the wash is covered: the SectionHeader
	kickers (`primary`) and headings (`foreground`).

	`-mt-14` slides this panel up UNDER the hero by exactly the cut depth, so the
	band's clipped corner reveals the wash (a section is not positioned, so its
	background paints below the hero's `z-10`; the content wrapper takes `z-20`
	to come back out on top). The intro card is then pulled up across the cut —
	pull-up opacity rule: the first block landing on a band's edge is opaque
	`bg-card`, never an alpha surface.
-->
<section class="-mt-14 bg-secondary/55 pb-12 pt-16 dark:bg-secondary/[0.28] md:pb-16">
	<div class="relative z-20 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
		<!-- Intro Section -->
		<div
			class="mx-auto -mt-8 max-w-4xl rounded-[1.5rem] border-2 border-border bg-card p-6 shadow-poster sm:p-8"
		>
			<div class="prose prose-lg mx-auto dark:prose-invert">
				{#each content.intro.paragraphs as paragraph, i (i)}
					<p class="text-base leading-relaxed text-muted-foreground md:text-lg">
						{paragraph}
					</p>
				{/each}
			</div>
		</div>

		<!-- Features Section -->
		<div class="mt-14 md:mt-20">
			<SectionHeader
				title={m['landingTemplate.featuresHeading']({}, { locale: content.locale })}
				volume="celebration"
				class="mb-8 justify-center text-center"
			/>
			<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{#each content.features as feature, i (feature.title)}
					{@const IconComponent = getIcon(feature.icon)}
					<div
						class="rounded-2xl border-2 border-border bg-card p-6 shadow-poster {featureTilt(
							i,
							content.features.length
						)}"
					>
						<!-- Uniform brand tone: ToneTile's tone axis is semantic, and these
						     marketing bullets carry no per-feature meaning to encode — the
						     identity `tint` axis is for destinations, and these cards go
						     nowhere. -->
						<ToneTile tone="brand" icon={IconComponent} size="lg" class="mb-4" />
						<h3 class="mb-2 text-lg font-bold text-foreground">{feature.title}</h3>
						<p class="text-sm text-muted-foreground">{feature.description}</p>
					</div>
				{/each}
			</div>
		</div>
	</div>
</section>

<!--
	Benefits + FAQ share one plain `--background` region: both are floating
	`shadow-poster` blocks, so the rhythm comes from the FLOAT, not from a
	second tint stacked under the one above. The generous bottom padding is
	load-bearing — the CTA band's cut strip reaches 3.5rem up into it.
-->
<section class="bg-background py-12 pb-24 md:py-16 md:pb-28">
	<div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
		<!-- Benefits -->
		<SectionHeader
			title={content.benefits.title}
			kicker={m['landingTemplate.benefitsKicker']({}, { locale: content.locale })}
			volume="celebration"
			class="mb-8 justify-center text-center"
		/>
		<ul
			class="divide-y-2 divide-border overflow-hidden rounded-[1.5rem] border-2 border-border bg-card shadow-poster"
		>
			{#each content.benefits.items as item, i (i)}
				<li class="flex items-start gap-4 p-5 sm:p-6">
					<!-- Solid `bg-primary`/`text-primary-foreground` chip: an audited token
					     pair, and it lifts the row marker off the muted-grey it used to be. -->
					<span
						class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
					>
						<Check class="h-4 w-4" aria-hidden="true" />
					</span>
					<span class="text-base font-medium text-foreground">{item}</span>
				</li>
			{/each}
		</ul>

		<!-- FAQ -->
		<div class="mt-14 md:mt-20">
			<SectionHeader
				title={m['landingTemplate.faqHeading']({}, { locale: content.locale })}
				kicker={m['landingTemplate.faqKicker']({}, { locale: content.locale })}
				volume="celebration"
				class="mb-8 justify-center text-center"
			/>
			<div class="space-y-4">
				{#each content.faq as faq, index (faq.question)}
					<div class={faqRowClass(openFaqIndex === index)}>
						<!-- `transition-colors`, never `transition-all`, on the focusable
						     element: `transition-all` fades the focus ring in. The row's
						     shadow/border transition lives on the wrapper above, which is
						     not focusable.

						     The focus ring is drawn INSIDE the button (negative
						     outline-offset) because the wrapper clips (`overflow-hidden`,
						     needed so the answer panel respects the row's radius) — the
						     UA's default outward ring loses its left and right edges there.
						     `--ring` is `--primary`: 6.99:1 light / 6.28:1 dark on `--card`,
						     over the 3:1 non-text floor. -->
						<button
							type="button"
							class="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl px-4 py-4 text-left transition-colors hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:px-5"
							onclick={() => toggleFaq(index)}
							aria-expanded={openFaqIndex === index}
							aria-controls={`faq-answer-${index}`}
						>
							<span class="font-bold text-foreground">{faq.question}</span>
							<!-- The chevron chip inverts when open (primary fill), a second
							     non-colour cue on top of the arrow direction itself. -->
							<span
								class={cn(
									'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
									openFaqIndex === index
										? 'bg-primary text-primary-foreground'
										: 'bg-muted text-muted-foreground'
								)}
							>
								{#if openFaqIndex === index}
									<ChevronUp class="h-4 w-4" aria-hidden="true" />
								{:else}
									<ChevronDown class="h-4 w-4" aria-hidden="true" />
								{/if}
							</span>
						</button>
						{#if openFaqIndex === index}
							<div
								id={`faq-answer-${index}`}
								class="border-t-2 border-border px-4 pb-5 pt-4 sm:px-5"
							>
								<p class="text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</div>
</section>

<!-- CTA Section: same fixed poster-purple treatment as the hero, plus a
     Sticker accent (the "optionally one Sticker" flagship touch). The
     Sticker is real, meaningful content (not decoration), so it's rendered
     normally — not aria-hidden — same as the poster's own sticker usage.

     Uplift: this is the page's CLOSING band, so it gets a diagonal cut on its
     top edge (painted from below, over the section above) and the display
     type scale on the h2. -->
<section class="relative bg-poster-purple py-12 md:py-16">
	<div
		class="cut-from-below cut-purple pointer-events-none absolute inset-x-0 bottom-full h-14"
		style="--cut-angle: 176deg"
		aria-hidden="true"
	></div>
	<div class="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
		<p class="text-sm font-extrabold uppercase tracking-[0.12em] text-poster-white">
			{m['landingTemplate.ctaKicker']({}, { locale: content.locale })}
		</p>
		<p class="mb-3 mt-2">
			<Sticker tint="crimson" rotate={-2}
				>{m['landingTemplate.ctaSticker']({}, { locale: content.locale })}</Sticker
			>
		</p>
		<h2 class="text-3xl font-black leading-[1.12] text-poster-white sm:text-4xl">
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
					class={ctaButtonClass(button.variant)}
				>
					{button.text}
				</Button>
			{/each}
		</div>
	</div>
</section>

<!-- Related Pages Section. Same chip language as the poster landing's
     use-case list (FeaturesPanel): a bold pill with a trailing arrow, so the
     links READ as links — they used to be washed-out `text-primary` text.
     `text-foreground` on `bg-card` is 17.40:1 light / 15.64:1 dark; the hover
     `text-primary` on the same card is 6.99:1 / 6.28:1. -->
{#if content.relatedPages.length > 0}
	<section class="bg-background py-12 md:py-16">
		<div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
			<SectionHeader
				title={m['landingTemplate.relatedHeading']({}, { locale: content.locale })}
				kicker={m['landingTemplate.relatedKicker']({}, { locale: content.locale })}
				volume="celebration"
				class="mb-6 justify-center text-center"
			/>
			<div class="flex flex-wrap justify-center gap-3">
				{#each content.relatedPages as relatedSlug (relatedSlug)}
					<!-- eslint-disable svelte/no-navigation-without-resolve -- locale-prefixed landing-page path built from a runtime slug; not a static route id -->
					<a
						href={getRelatedPageUrl(relatedSlug)}
						class="group inline-flex items-center gap-1.5 rounded-full border-2 border-border bg-card px-4 py-2 text-sm font-bold text-foreground shadow-poster transition-colors hover:border-primary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
					>
						{getRelatedPageTitle(relatedSlug)}
						<!-- Decorative: the link's accessible name stays the page title. The
						     nudge is scoped to the arrow, never `transition-all` on the
						     focusable <a> (that fades the focus ring). -->
						<ArrowRight
							class="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5"
							aria-hidden="true"
						/>
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{/each}
			</div>
		</div>
	</section>
{/if}

<style>
	/*
	 * Poster diagonal cuts. Both sides of every boundary on this page can't be
	 * expressed the poster's way: landing/poster/PosterPanel paints the NEXT
	 * panel's fixed colour into a gradient strip, but here the "other side" is
	 * always a theme token (the tinted wash, `--background`) with no `.cut-*`
	 * helper — and freezing one in would break the light/dark axis. Hence two
	 * different devices:
	 *
	 * `.poster-band-cut` — clips the BAND itself, so the reveal is whatever sits
	 * behind it (the wash, pulled up under the band). Used at the hero, whose
	 * cut spans the full page width: a gradient strip cannot do this job at
	 * arbitrary widths, because once the diagonal runs past the strip's height
	 * the fill ends in a hard horizontal step (measured: at 1280px the 176deg
	 * line drops ~90px, well past a 56px strip). A clip-path is width-agnostic.
	 *
	 * `.cut-from-below` — PosterPanel's gradient strip, mirrored: transparent
	 * above the diagonal, poster colour below, sitting just ABOVE a band
	 * (`bottom-full`). This form has no step failure mode — the coloured half
	 * always meets the band it extends, and the transparent half always meets
	 * the strip's top edge. `--cut-color` comes from the global `.cut-purple`
	 * helper in app.css.
	 */
	.poster-band-cut {
		clip-path: polygon(0 0, 100% 0, 100% 100%, 0 calc(100% - 3.5rem));
	}
	.cut-from-below {
		background: linear-gradient(var(--cut-angle), transparent 49%, var(--cut-color) 49.5%);
	}
</style>

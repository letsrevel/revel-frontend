<script lang="ts">
	import { untrack } from 'svelte';
	import { createMutation } from '@tanstack/svelte-query';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Heart, Loader2, Palette } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import { cn } from '$lib/utils';
	import { hexToHslTriplet, type BrandThemeInput } from '$lib/utils/brand-theme';
	import { BrandColorsApiError, previewBrandTheme, saveBrandColors } from './brand-colors-api';

	/**
	 * Brand colors for an organization (#1054): primary + accent pickers with a
	 * live, server-resolved preview in light AND dark mode side by side.
	 *
	 * The server owns every contrast decision; this component only forwards the
	 * hexes and paints whatever per-mode theme comes back.
	 */
	interface Props {
		organization: {
			slug: string;
			brand_primary_color?: string | null;
			brand_accent_color?: string | null;
			brand_theme?: BrandThemeInput | null;
		};
	}

	const { organization }: Props = $props();

	const PREVIEW_DEBOUNCE_MS = 250;
	const FALLBACK_PICKER_HEX = '#8c3cdd';

	type Field = 'primary' | 'accent';
	type FieldError = { field: Field; detail: string };

	/** `#RRGGBB` (the `#` optional, any case) -> `#RRGGBB` upper-case, else null. */
	function normalizeHex(raw: string): string | null {
		const match = /^#?([0-9a-f]{6})$/i.exec(raw.trim());
		return match ? `#${match[1].toUpperCase()}` : null;
	}

	const isBlank = (raw: string): boolean => raw.trim() === '';

	// Deliberate one-time capture: the drafts seed from the saved values and then
	// belong to the user; `invalidateAll()` after a save must not clobber them.
	const { slug, initialPrimary, initialAccent, initialTheme } = untrack(() => ({
		slug: organization.slug,
		initialPrimary: normalizeHex(organization.brand_primary_color ?? ''),
		initialAccent: normalizeHex(organization.brand_accent_color ?? ''),
		initialTheme: organization.brand_theme ?? null
	}));

	// Saved baseline (what the server holds) and the editable drafts.
	let savedPrimary = $state<string | null>(initialPrimary);
	let savedAccent = $state<string | null>(initialAccent);
	let primaryDraft = $state(initialPrimary ?? '');
	let accentDraft = $state(initialAccent ?? '');
	let primaryTouched = $state(false);
	let accentTouched = $state(false);

	// The theme on screen: the last GOOD server answer, kept while a request is in flight.
	let theme = $state<BrandThemeInput | null>(initialTheme);
	let previewPending = $state(false);
	let previewError = $state<FieldError | null>(null);
	let saveErrors = $state<Partial<Record<Field, string>>>({});
	// The entered colors the on-screen theme was resolved for (the swatches' "Entered" side).
	let themeFor = $state<{ primary: string | null; accent: string | null }>({
		primary: initialPrimary,
		accent: initialAccent
	});

	const primaryHex = $derived(normalizeHex(primaryDraft));
	const accentHex = $derived(normalizeHex(accentDraft));
	const primaryInvalid = $derived(!isBlank(primaryDraft) && primaryHex === null);
	const accentInvalid = $derived(!isBlank(accentDraft) && accentHex === null);
	const accentWithoutPrimary = $derived(!isBlank(accentDraft) && !accentInvalid && !primaryHex);

	const hasLocalError = $derived(primaryInvalid || accentInvalid || accentWithoutPrimary);
	const dirty = $derived(
		(primaryHex ?? null) !== savedPrimary || (accentHex ?? null) !== savedAccent
	);
	const hasAnyColor = $derived(
		savedPrimary !== null || savedAccent !== null || !isBlank(primaryDraft) || !isBlank(accentDraft)
	);

	const primaryError = $derived(
		primaryInvalid && primaryTouched
			? m['orgAdmin.settings.brandColors.invalidHex']()
			: (serverErrorFor('primary') ?? null)
	);
	const accentError = $derived(
		accentInvalid && accentTouched
			? m['orgAdmin.settings.brandColors.invalidHex']()
			: accentWithoutPrimary
				? m['orgAdmin.settings.brandColors.accentNeedsPrimary']()
				: (serverErrorFor('accent') ?? null)
	);

	function serverErrorFor(field: Field): string | undefined {
		if (saveErrors[field]) return saveErrors[field];
		if (previewError?.field === field) return previewError.detail;
		return undefined;
	}

	/** The API's `detail` is one string; attribute it to the field it names. */
	function toFieldError(error: unknown): FieldError | null {
		if (!(error instanceof BrandColorsApiError) || !error.detail) return null;
		return { field: /accent/i.test(error.detail) ? 'accent' : 'primary', detail: error.detail };
	}

	/** Save 400s name their field (`errors`); a bare `detail` is attributed by text. */
	function toSaveErrors(error: unknown): Partial<Record<Field, string>> | null {
		if (!(error instanceof BrandColorsApiError)) return null;
		if (Object.keys(error.fieldErrors).length > 0) return error.fieldErrors;
		const single = toFieldError(error);
		return single ? { [single.field]: single.detail } : null;
	}

	// ---- live preview (debounced, stale requests aborted) ----------------------

	let controller: AbortController | null = null;
	let lastKey = `${initialPrimary ?? ''}|${initialAccent ?? ''}`;

	async function runPreview(primary: string | null, accent: string | null, key: string) {
		controller?.abort();
		const current = new AbortController();
		controller = current;
		lastKey = key;
		previewError = null;
		if (!primary) {
			theme = null;
			themeFor = { primary: null, accent: null };
			previewPending = false;
			return;
		}
		previewPending = true;
		try {
			const next = await previewBrandTheme(slug, primary, accent, current.signal);
			if (current.signal.aborted) return;
			theme = next;
			themeFor = { primary, accent };
		} catch (error) {
			if (current.signal.aborted) return;
			// Keep the last good theme on screen; surface the detail next to the field.
			previewError = toFieldError(error);
		} finally {
			if (controller === current) previewPending = false;
		}
	}

	$effect(() => {
		const primary = primaryHex;
		const accent = accentHex;
		if (hasLocalError) return;
		const key = `${primary ?? ''}|${accent ?? ''}`;
		if (key === lastKey) return;
		const timer = setTimeout(() => void runPreview(primary, accent, key), PREVIEW_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	});

	$effect(() => () => controller?.abort());

	// ---- save / reset ------------------------------------------------------------

	const saveMutation = createMutation(() => ({
		// Must throw on failure so TanStack routes it to onError.
		mutationFn: ({ primary, accent }: { primary: string | null; accent: string | null }) =>
			saveBrandColors(slug, primary, accent),
		onSuccess: async (_data, { primary, accent }) => {
			savedPrimary = primary;
			savedAccent = accent;
			saveErrors = {};
			toast.success(
				primary === null
					? m['orgAdmin.settings.brandColors.resetDone']()
					: m['orgAdmin.settings.brandColors.saved']()
			);
			await invalidateAll();
		},
		// A local onError REPLACES the global "Action failed" toast: field-level
		// 400 details render inline; anything else gets one toast.
		onError: (error: unknown) => {
			const fieldErrors = toSaveErrors(error);
			if (fieldErrors) saveErrors = fieldErrors;
			else toast.error(m['orgAdmin.settings.brandColors.saveError']());
		}
	}));

	const saving = $derived(saveMutation.isPending);
	const canSave = $derived(dirty && !hasLocalError && !saving);

	function onPrimaryInput(value: string) {
		primaryDraft = value;
		saveErrors = {};
	}

	function onAccentInput(value: string) {
		accentDraft = value;
		saveErrors = {};
	}

	function handleSave(event: SubmitEvent) {
		event.preventDefault();
		if (!canSave) return;
		saveMutation.mutate({ primary: primaryHex, accent: primaryHex ? accentHex : null });
	}

	function handleReset() {
		if (saving) return;
		primaryDraft = '';
		accentDraft = '';
		primaryTouched = false;
		accentTouched = false;
		saveErrors = {};
		saveMutation.mutate({ primary: null, accent: null });
	}

	const pickerValue = (hex: string | null): string =>
		hex ? hex.toLowerCase() : FALLBACK_PICKER_HEX;
</script>

<section class="space-y-5 rounded-lg border border-border bg-card p-6 shadow-sm">
	<div class="flex items-center gap-2">
		<Palette class="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
		<SectionHeader
			title={m['orgAdmin.settings.brandColors.heading']()}
			subtitle={m['orgAdmin.settings.brandColors.description']()}
			volume="studio"
			class="flex-1"
		/>
	</div>

	<form onsubmit={handleSave} class="space-y-5" novalidate>
		<div class="grid gap-5 sm:grid-cols-2">
			<!-- Primary -->
			<div>
				<Label for="brand-primary-hex">{m['orgAdmin.settings.brandColors.primaryLabel']()}</Label>
				<div class="mt-1 flex items-center gap-2">
					<input
						type="color"
						class="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						aria-label={m['orgAdmin.settings.brandColors.primaryPicker']()}
						value={pickerValue(primaryHex)}
						oninput={(e) => onPrimaryInput(e.currentTarget.value.toUpperCase())}
					/>
					<Input
						id="brand-primary-hex"
						type="text"
						class="font-mono uppercase"
						placeholder="#8C3CDD"
						maxlength={7}
						autocomplete="off"
						spellcheck={false}
						value={primaryDraft}
						oninput={(e) => onPrimaryInput(e.currentTarget.value)}
						onblur={() => (primaryTouched = true)}
						aria-invalid={primaryError ? 'true' : undefined}
						aria-describedby={primaryError
							? 'brand-primary-help brand-primary-error'
							: 'brand-primary-help'}
					/>
				</div>
				<p id="brand-primary-help" class="mt-1 text-xs text-muted-foreground">
					{m['orgAdmin.settings.brandColors.primaryHelp']()}
				</p>
				{#if primaryError}
					<p id="brand-primary-error" role="alert" class="mt-1 text-sm text-destructive">
						{primaryError}
					</p>
				{/if}
			</div>

			<!-- Accent -->
			<div>
				<Label for="brand-accent-hex">{m['orgAdmin.settings.brandColors.accentLabel']()}</Label>
				<div class="mt-1 flex items-center gap-2">
					<input
						type="color"
						class="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						aria-label={m['orgAdmin.settings.brandColors.accentPicker']()}
						value={pickerValue(accentHex)}
						oninput={(e) => onAccentInput(e.currentTarget.value.toUpperCase())}
					/>
					<Input
						id="brand-accent-hex"
						type="text"
						class="font-mono uppercase"
						placeholder="#E6332A"
						maxlength={7}
						autocomplete="off"
						spellcheck={false}
						value={accentDraft}
						oninput={(e) => onAccentInput(e.currentTarget.value)}
						onblur={() => (accentTouched = true)}
						aria-invalid={accentError ? 'true' : undefined}
						aria-describedby={accentError
							? 'brand-accent-help brand-accent-error'
							: 'brand-accent-help'}
					/>
				</div>
				<p id="brand-accent-help" class="mt-1 text-xs text-muted-foreground">
					{m['orgAdmin.settings.brandColors.accentHelp']()}
				</p>
				{#if accentError}
					<p id="brand-accent-error" role="alert" class="mt-1 text-sm text-destructive">
						{accentError}
					</p>
				{/if}
			</div>
		</div>

		<!-- Live preview: both modes at once, whatever mode the admin is in -->
		<div class="space-y-3" aria-busy={previewPending}>
			<div class="flex flex-wrap items-center justify-between gap-2">
				<h3 class="text-sm font-bold">{m['orgAdmin.settings.brandColors.previewHeading']()}</h3>
				{#if previewPending}
					<p class="flex items-center gap-1.5 text-xs text-muted-foreground">
						<Loader2 class="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
						{m['orgAdmin.settings.brandColors.previewUpdating']()}
					</p>
				{:else if !theme}
					<p class="text-xs text-muted-foreground">
						{m['orgAdmin.settings.brandColors.previewDefaults']()}
					</p>
				{/if}
			</div>

			<div class="grid gap-4 md:grid-cols-2">
				{#each ['light', 'dark'] as const as mode (mode)}
					{@const colors = theme?.[mode]}
					<div
						data-testid="brand-preview-{mode}"
						class={cn(
							'space-y-3 rounded-lg border border-border bg-background p-4 text-foreground',
							mode === 'dark' ? 'dark' : 'theme-light'
						)}
						style:--primary={colors ? hexToHslTriplet(colors.primary) : undefined}
						style:--primary-foreground={colors
							? hexToHslTriplet(colors.primary_foreground)
							: undefined}
						style:--ring={colors ? hexToHslTriplet(colors.primary) : undefined}
						style:--accent={colors?.accent && colors.accent_foreground
							? hexToHslTriplet(colors.accent)
							: undefined}
						style:--accent-foreground={colors?.accent && colors.accent_foreground
							? hexToHslTriplet(colors.accent_foreground)
							: undefined}
					>
						<h4 class="text-sm font-bold">
							{mode === 'dark'
								? m['orgAdmin.settings.brandColors.previewDark']()
								: m['orgAdmin.settings.brandColors.previewLight']()}
						</h4>
						<!-- Entered vs. server-adjusted swatches; the text states the difference. -->
						{#if colors}
							{@const adjustedNote =
								mode === 'dark'
									? m['orgAdmin.settings.brandColors.adjustedDark']()
									: m['orgAdmin.settings.brandColors.adjustedLight']()}
							<ul class="space-y-2 text-xs" data-testid="brand-swatches-{mode}">
								{#each [{ key: 'primary', name: m['orgAdmin.settings.brandColors.swatchPrimary'](), entered: themeFor.primary, result: colors.primary }, { key: 'accent', name: m['orgAdmin.settings.brandColors.swatchAccent'](), entered: themeFor.accent, result: colors.accent ?? null }] as row (row.key)}
									{#if row.entered && row.result}
										<li class="space-y-1">
											<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
												<span class="font-semibold">{row.name}</span>
												<span class="flex items-center gap-1.5">
													<span
														class="inline-block h-4 w-4 rounded border border-border"
														style:background-color={row.entered}
														aria-hidden="true"
													></span>
													{m['orgAdmin.settings.brandColors.swatchEntered']()}
													<span class="font-mono">{row.entered}</span>
												</span>
												<span class="flex items-center gap-1.5">
													<span
														class="inline-block h-4 w-4 rounded border border-border"
														style:background-color={row.result}
														aria-hidden="true"
													></span>
													{m['orgAdmin.settings.brandColors.swatchResult']()}
													<span class="font-mono">{row.result.toUpperCase()}</span>
												</span>
											</div>
											<p
												class={row.entered.toUpperCase() === row.result.toUpperCase()
													? 'text-muted-foreground'
													: 'font-medium'}
											>
												{row.entered.toUpperCase() === row.result.toUpperCase()
													? m['orgAdmin.settings.brandColors.asEntered']()
													: adjustedNote}
											</p>
										</li>
									{/if}
								{/each}
							</ul>
						{/if}
						<!-- Decorative sample: real components, not focusable, not announced. -->
						<div inert aria-hidden="true" class="space-y-3">
							<div class="flex flex-wrap items-center gap-2">
								<Button type="button" size="sm" tabindex={-1}>
									{m['orgAdmin.settings.brandColors.previewPrimaryButton']()}
								</Button>
								<Button type="button" size="sm" variant="outline" tabindex={-1}>
									<Heart class="mr-1.5 h-4 w-4 fill-current text-accent" aria-hidden="true" />
									{m['orgAdmin.settings.brandColors.previewFollow']()}
								</Button>
							</div>
							<div class="flex flex-wrap items-center gap-3 text-sm">
								<span class="font-medium text-primary underline underline-offset-2">
									{m['orgAdmin.settings.brandColors.previewLink']()}
								</span>
								<Badge>{m['orgAdmin.settings.brandColors.previewBadge']()}</Badge>
								<span
									class="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground"
								>
									{m['orgAdmin.settings.brandColors.previewAccentButton']()}
								</span>
							</div>
						</div>
					</div>
				{/each}
			</div>

			<p class="text-xs text-muted-foreground">{m['orgAdmin.settings.brandColors.adjustNote']()}</p>
		</div>

		<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
			<Button
				type="submit"
				class="aria-disabled:pointer-events-none aria-disabled:opacity-50"
				aria-disabled={!canSave}
			>
				{#if saving}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
					{m['orgAdmin.settings.brandColors.saving']()}
				{:else}
					{m['orgAdmin.settings.brandColors.save']()}
				{/if}
			</Button>
			<Button
				type="button"
				variant="outline"
				class="aria-disabled:pointer-events-none aria-disabled:opacity-50"
				aria-disabled={saving || !hasAnyColor}
				onclick={() => hasAnyColor && handleReset()}
			>
				{m['orgAdmin.settings.brandColors.reset']()}
			</Button>
		</div>
	</form>
</section>

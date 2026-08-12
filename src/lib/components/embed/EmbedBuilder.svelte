<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { RadioGroup, RadioGroupItem } from '$lib/components/ui/radio-group';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import * as Tabs from '$lib/components/ui/tabs';
	import { Check, Copy, ExternalLink } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import {
		EMBED_DEFAULT_DIMENSIONS,
		EMBED_MAX_PAGE_SIZE,
		type EmbedTheme
	} from '$lib/embed/constants';
	import {
		EMBED_MAX_HEIGHT,
		EMBED_MIN_HEIGHT,
		defaultEmbedConfig,
		embedIframeSnippet,
		embedIframeUrl,
		embedScriptSnippet,
		parseTagsInput,
		supportsListFilters,
		type EmbedBuilderConfig,
		type EmbedTargetKind
	} from '$lib/embed/snippet';

	/** A pickable event or series. Only what the picker and the snippet need. */
	interface EmbedResourceOption {
		slug: string;
		name: string;
	}

	interface Props {
		/** Origin the embed is served from — where the snippet points. */
		origin: string;
		orgSlug: string;
		orgName: string;
		/** Events that an anonymous visitor could actually load. */
		events: EmbedResourceOption[];
		series: EmbedResourceOption[];
		/** Pre-select an event, for the "Embed" action on an event card. */
		initialEventSlug?: string | null;
	}

	const { origin, orgSlug, orgName, events, series, initialEventSlug = null }: Props = $props();

	// Read once, on purpose: `?event=` seeds the form, it does not own it. A later
	// prop change must not clobber edits the organizer has already made.
	const preselected =
		initialEventSlug && events.some((event) => event.slug === initialEventSlug)
			? initialEventSlug
			: null;

	// `tags` lives outside the settings object: the field is free text that only
	// becomes a list once parsed, and a $derived config keeps the two in step
	// without an effect writing state back into the form.
	const settings = $state<Omit<EmbedBuilderConfig, 'tags'>>({
		...defaultEmbedConfig(orgSlug),
		...(preselected ? { kind: 'event' as const, resourceSlug: preselected } : {})
	});
	let tagsInput = $state('');
	let snippetKind = $state<'script' | 'iframe'>('script');
	let copied = $state(false);
	let frameEl = $state<HTMLIFrameElement>();
	let measuredHeight = $state<number | null>(null);

	const config: EmbedBuilderConfig = $derived({ ...settings, tags: parseTagsInput(tagsInput) });
	const previewUrl = $derived(embedIframeUrl(origin, config));
	const scriptSnippet = $derived(embedScriptSnippet(origin, config));
	const iframeSnippet = $derived(embedIframeSnippet(origin, config));
	const showListFilters = $derived(supportsListFilters(settings.kind));

	const resourceOptions = $derived(
		settings.kind === 'event' ? events : settings.kind === 'series' ? series : []
	);
	const resourceLabel = $derived(
		resourceOptions.find((option) => option.slug === settings.resourceSlug)?.name ?? ''
	);

	const themeOptions: { value: EmbedTheme; label: string }[] = [
		{ value: 'auto', label: m['embedBuilder.themeAuto']() },
		{ value: 'light', label: m['embedBuilder.themeLight']() },
		{ value: 'dark', label: m['embedBuilder.themeDark']() }
	];

	// `auto` is the absence of `data-revel-lang`: the embed then resolves the
	// visitor's own language, exactly like the rest of the app.
	const languageOptions = [
		{ value: 'auto', label: m['embedBuilder.languageAuto']() },
		{ value: 'en', label: 'English' },
		{ value: 'de', label: 'Deutsch' },
		{ value: 'it', label: 'Italiano' },
		{ value: 'fr', label: 'Français' },
		{ value: 'es', label: 'Español' },
		{ value: 'pt', label: 'Português' }
	];

	const orderOptions = [
		{ value: 'start', label: m['embedBuilder.orderSoonestFirst']() },
		{ value: '-start', label: m['embedBuilder.orderLatestFirst']() }
	];

	/**
	 * Switching target also picks a resource, so the preview never sits on an
	 * "event embed with no event" state that renders the organization instead.
	 */
	function selectKind(kind: EmbedTargetKind): void {
		settings.kind = kind;
		const options = kind === 'event' ? events : kind === 'series' ? series : [];
		settings.resourceSlug = kind === 'list' ? null : (options[0]?.slug ?? null);
	}

	async function copySnippet(snippet: string): Promise<void> {
		try {
			await navigator.clipboard.writeText(snippet);
			copied = true;
			toast.success(m['embedBuilder.copySuccess']());
			setTimeout(() => (copied = false), 2000);
		} catch (err) {
			console.error('clipboard write failed', err);
			toast.error(m['embedBuilder.copyError']());
		}
	}

	// A new document in the frame invalidates the last measurement — without this
	// a tall list embed would leave a gap under a short single-event one.
	$effect(() => {
		if (previewUrl) measuredHeight = null;
	});

	// Same-origin here, but validated exactly like the public loader does: trust
	// only this iframe's own window, so nothing else on the page can resize it.
	$effect(() => {
		function onMessage(event: MessageEvent<unknown>): void {
			if (event.origin !== window.location.origin) return;
			if (!frameEl || event.source !== frameEl.contentWindow) return;

			const payload = event.data;
			if (typeof payload !== 'object' || payload === null) return;
			const message = payload as { type?: unknown; height?: unknown };
			if (message.type !== 'revel:embed:height') return;

			const height = Number(message.height);
			if (!Number.isFinite(height) || height <= 0 || height > 20000) return;
			measuredHeight = Math.ceil(height);
		}

		window.addEventListener('message', onMessage);
		return () => window.removeEventListener('message', onMessage);
	});

	const previewHeight = $derived(
		settings.autoResize
			? (measuredHeight ?? EMBED_DEFAULT_DIMENSIONS[settings.kind][1])
			: Math.min(Math.max(settings.height, EMBED_MIN_HEIGHT), EMBED_MAX_HEIGHT)
	);
</script>

<!--
	`min-w-0` on both columns: a grid item defaults to `min-width: auto`, so the
	snippet `<pre>` sized this column by its longest line and pushed the whole
	page past the viewport on a phone — its own `overflow-x-auto` never engaged
	because nothing upstream constrained it.
-->
<div class="grid gap-6 lg:grid-cols-2">
	<!-- ── Configuration ─────────────────────────────────────────────── -->
	<div class="min-w-0 space-y-6">
		<Card>
			<CardHeader>
				<CardTitle>{m['embedBuilder.whatTitle']()}</CardTitle>
				<CardDescription>{m['embedBuilder.whatDescription']()}</CardDescription>
			</CardHeader>
			<CardContent class="space-y-4">
				<fieldset class="space-y-3">
					<legend class="sr-only">{m['embedBuilder.whatTitle']()}</legend>
					<RadioGroup
						value={settings.kind}
						onValueChange={(value) => selectKind(value as EmbedTargetKind)}
						class="space-y-2"
					>
						<div class="flex items-center gap-2">
							<RadioGroupItem value="list" id="embed-kind-list" />
							<Label for="embed-kind-list">{m['embedBuilder.kindList']({ org: orgName })}</Label>
						</div>
						<div class="flex items-center gap-2">
							<RadioGroupItem value="event" id="embed-kind-event" disabled={events.length === 0} />
							<Label
								for="embed-kind-event"
								class={events.length === 0 ? 'text-muted-foreground' : undefined}
							>
								{m['embedBuilder.kindEvent']()}
							</Label>
						</div>
						<div class="flex items-center gap-2">
							<RadioGroupItem
								value="series"
								id="embed-kind-series"
								disabled={series.length === 0}
							/>
							<Label
								for="embed-kind-series"
								class={series.length === 0 ? 'text-muted-foreground' : undefined}
							>
								{m['embedBuilder.kindSeries']()}
							</Label>
						</div>
					</RadioGroup>
				</fieldset>

				{#if settings.kind !== 'list'}
					<div class="space-y-2">
						<Label for="embed-resource">
							{settings.kind === 'event'
								? m['embedBuilder.pickEvent']()
								: m['embedBuilder.pickSeries']()}
						</Label>
						<Select
							type="single"
							value={settings.resourceSlug ?? ''}
							onValueChange={(value) => {
								if (value) settings.resourceSlug = value;
							}}
						>
							<SelectTrigger id="embed-resource">
								{resourceLabel}
							</SelectTrigger>
							<SelectContent>
								{#each resourceOptions as option (option.slug)}
									<SelectItem value={option.slug} label={option.name}>{option.name}</SelectItem>
								{/each}
							</SelectContent>
						</Select>
						{#if settings.kind === 'event'}
							<p class="text-xs text-muted-foreground">{m['embedBuilder.eventPickerHint']()}</p>
						{/if}
					</div>
				{/if}
			</CardContent>
		</Card>

		<Card>
			<CardHeader>
				<CardTitle>{m['embedBuilder.appearanceTitle']()}</CardTitle>
				<CardDescription>{m['embedBuilder.appearanceDescription']()}</CardDescription>
			</CardHeader>
			<CardContent class="space-y-4">
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="space-y-2">
						<Label for="embed-theme">{m['embedBuilder.themeLabel']()}</Label>
						<Select
							type="single"
							value={settings.theme}
							onValueChange={(value) => {
								if (value) settings.theme = value as EmbedTheme;
							}}
						>
							<SelectTrigger id="embed-theme">
								{themeOptions.find((option) => option.value === settings.theme)?.label}
							</SelectTrigger>
							<SelectContent>
								{#each themeOptions as option (option.value)}
									<SelectItem value={option.value} label={option.label}>{option.label}</SelectItem>
								{/each}
							</SelectContent>
						</Select>
					</div>

					<div class="space-y-2">
						<Label for="embed-lang">{m['embedBuilder.languageLabel']()}</Label>
						<Select
							type="single"
							value={settings.lang ?? 'auto'}
							onValueChange={(value) => {
								if (value) settings.lang = value === 'auto' ? null : value;
							}}
						>
							<SelectTrigger id="embed-lang">
								{languageOptions.find((option) => option.value === (settings.lang ?? 'auto'))
									?.label}
							</SelectTrigger>
							<SelectContent>
								{#each languageOptions as option (option.value)}
									<SelectItem value={option.value} label={option.label}>{option.label}</SelectItem>
								{/each}
							</SelectContent>
						</Select>
					</div>
				</div>

				<div class="space-y-2">
					<Label for="embed-title">{m['embedBuilder.frameTitleLabel']()}</Label>
					<Input
						id="embed-title"
						type="text"
						value={settings.title ?? ''}
						placeholder={m['embedBuilder.frameTitlePlaceholder']()}
						oninput={(e) => {
							const value = e.currentTarget.value.trim();
							settings.title = value === '' ? null : value;
						}}
					/>
					<p class="text-xs text-muted-foreground">{m['embedBuilder.frameTitleHint']()}</p>
				</div>

				<div class="space-y-3 rounded-md border p-3">
					<div class="flex items-start gap-2">
						<Checkbox
							id="embed-auto-resize"
							checked={settings.autoResize}
							onCheckedChange={(checked) => (settings.autoResize = checked === true)}
						/>
						<div class="space-y-1">
							<Label for="embed-auto-resize">{m['embedBuilder.autoResizeLabel']()}</Label>
							<p class="text-xs text-muted-foreground">{m['embedBuilder.autoResizeHint']()}</p>
						</div>
					</div>

					{#if !settings.autoResize}
						<div class="space-y-2">
							<Label for="embed-height">{m['embedBuilder.heightLabel']()}</Label>
							<Input
								id="embed-height"
								type="number"
								min={EMBED_MIN_HEIGHT}
								max={EMBED_MAX_HEIGHT}
								value={settings.height}
								oninput={(e) => {
									const value = Number(e.currentTarget.value);
									if (Number.isFinite(value) && value > 0) settings.height = value;
								}}
								class="max-w-40"
							/>
						</div>
					{/if}
				</div>
			</CardContent>
		</Card>

		{#if showListFilters}
			<Card>
				<CardHeader>
					<CardTitle>{m['embedBuilder.filtersTitle']()}</CardTitle>
					<CardDescription>{m['embedBuilder.filtersDescription']()}</CardDescription>
				</CardHeader>
				<CardContent class="space-y-4">
					<div class="grid gap-4 sm:grid-cols-2">
						<div class="space-y-2">
							<Label for="embed-page-size">{m['embedBuilder.pageSizeLabel']()}</Label>
							<Input
								id="embed-page-size"
								type="number"
								min={1}
								max={EMBED_MAX_PAGE_SIZE}
								value={settings.pageSize}
								oninput={(e) => {
									const value = Number(e.currentTarget.value);
									if (Number.isFinite(value) && value > 0) settings.pageSize = value;
								}}
							/>
							<p class="text-xs text-muted-foreground">
								{m['embedBuilder.pageSizeHint']({ max: EMBED_MAX_PAGE_SIZE })}
							</p>
						</div>

						<div class="space-y-2">
							<Label for="embed-order">{m['embedBuilder.orderLabel']()}</Label>
							<Select
								type="single"
								value={settings.orderBy}
								onValueChange={(value) => {
									if (value === 'start' || value === '-start') settings.orderBy = value;
								}}
							>
								<SelectTrigger id="embed-order">
									{orderOptions.find((option) => option.value === settings.orderBy)?.label}
								</SelectTrigger>
								<SelectContent>
									{#each orderOptions as option (option.value)}
										<SelectItem value={option.value} label={option.label}>{option.label}</SelectItem
										>
									{/each}
								</SelectContent>
							</Select>
						</div>
					</div>

					<div class="space-y-2">
						<Label for="embed-tags">{m['embedBuilder.tagsLabel']()}</Label>
						<Input
							id="embed-tags"
							type="text"
							bind:value={tagsInput}
							placeholder={m['embedBuilder.tagsPlaceholder']()}
						/>
						<p class="text-xs text-muted-foreground">{m['embedBuilder.tagsHint']()}</p>
					</div>

					<div class="flex items-start gap-2">
						<Checkbox
							id="embed-include-past"
							checked={settings.includePast}
							onCheckedChange={(checked) => (settings.includePast = checked === true)}
						/>
						<Label for="embed-include-past">{m['embedBuilder.includePastLabel']()}</Label>
					</div>
				</CardContent>
			</Card>
		{/if}
	</div>

	<!-- ── Snippet, then preview ─────────────────────────────────────────
	     The snippet comes first: it is what the organizer came for, and a list
	     preview is tall enough to push anything below it off the screen. -->
	<div class="min-w-0 space-y-6">
		<Card>
			<CardHeader>
				<CardTitle>{m['embedBuilder.snippetTitle']()}</CardTitle>
				<CardDescription>{m['embedBuilder.snippetDescription']()}</CardDescription>
			</CardHeader>
			<CardContent class="space-y-3">
				<Tabs.Root
					value={snippetKind}
					onValueChange={(value) => (snippetKind = value === 'iframe' ? 'iframe' : 'script')}
				>
					<Tabs.List class="grid w-full grid-cols-2">
						<Tabs.Trigger value="script">{m['embedBuilder.tabScript']()}</Tabs.Trigger>
						<Tabs.Trigger value="iframe">{m['embedBuilder.tabIframe']()}</Tabs.Trigger>
					</Tabs.List>
					<Tabs.Content value="script" class="space-y-3">
						{@render snippetPanel(scriptSnippet, m['embedBuilder.tabScriptHint']())}
					</Tabs.Content>
					<Tabs.Content value="iframe" class="space-y-3">
						{@render snippetPanel(iframeSnippet, m['embedBuilder.tabIframeHint']())}
					</Tabs.Content>
				</Tabs.Root>
			</CardContent>
		</Card>

		<Card>
			<CardHeader>
				<CardTitle>{m['embedBuilder.previewTitle']()}</CardTitle>
				<CardDescription>{m['embedBuilder.previewDescription']()}</CardDescription>
			</CardHeader>
			<CardContent class="space-y-3">
				<div class="overflow-hidden rounded-md border bg-muted/30">
					<iframe
						bind:this={frameEl}
						src={previewUrl}
						title={m['embedBuilder.previewFrameTitle']()}
						class="block w-full border-0"
						style="height: {previewHeight}px"
					></iframe>
				</div>
				<Button
					variant="outline"
					size="sm"
					href={previewUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="gap-2"
				>
					<ExternalLink class="h-4 w-4" aria-hidden="true" />
					{m['embedBuilder.openPreview']()}
					<span class="sr-only">({m['embed.openInNewTab']()})</span>
				</Button>
			</CardContent>
		</Card>
	</div>
</div>

{#snippet snippetPanel(code: string, hint: string)}
	<p class="text-sm text-muted-foreground">{hint}</p>
	<pre class="overflow-x-auto rounded-md border bg-muted p-3 text-xs leading-relaxed"><code
			>{code}</code
		></pre>
	<Button type="button" onclick={() => copySnippet(code)} class="w-full gap-2 sm:w-auto">
		{#if copied}
			<Check class="h-4 w-4" aria-hidden="true" />
			{m['embedBuilder.copied']()}
		{:else}
			<Copy class="h-4 w-4" aria-hidden="true" />
			{m['embedBuilder.copySnippet']()}
		{/if}
	</Button>
{/snippet}

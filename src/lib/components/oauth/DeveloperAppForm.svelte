<script lang="ts">
	import { tick, untrack } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { Loader2 } from '@lucide/svelte';
	import type { AuthorizeScopeSchema } from '$lib/api/generated/types.gen';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Button } from '$lib/components/ui/button';
	import { RadioGroup, RadioGroupItem } from '$lib/components/ui/radio-group';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import {
		appFormSchema,
		DESCRIPTION_MAX,
		NAME_MAX,
		type AppFormValues
	} from '$lib/utils/oauth-app-form';
	import RedirectUriList from './RedirectUriList.svelte';
	import ScopeCheckboxes from './ScopeCheckboxes.svelte';

	interface Props {
		mode: 'create' | 'edit';
		initial?: AppFormValues;
		vocabulary: AuthorizeScopeSchema[];
		submitting?: boolean;
		formError?: string | null;
		fieldErrors?: Record<string, string>;
		onSubmit: (values: AppFormValues) => void;
	}
	const {
		mode,
		initial,
		vocabulary,
		submitting = false,
		formError = null,
		fieldErrors = {},
		onSubmit
	}: Props = $props();

	const uid = $props.id();
	// `initial` seeds the form once (a later prop change must not wipe the user's edits),
	// and is copied so editing never mutates the caller's object, which the edit page
	// diffs against for its PATCH body.
	const seed = untrack(() => initial);
	const values = $state<AppFormValues>(
		seed
			? {
					...seed,
					redirect_uris: [...seed.redirect_uris],
					allowed_scopes: [...seed.allowed_scopes]
				}
			: {
					name: '',
					description: '',
					client_type: 'public',
					redirect_uris: [''],
					allowed_scopes: ['org:read'],
					homepage_url: '',
					privacy_policy_url: ''
				}
	);
	// Client-side Zod issues, keyed like the server's field errors ('redirect_uris.0', 'allowed_scopes', …).
	let clientErrors = $state<Record<string, string>>({});
	// Server keys that match no slot below are not rendered here: `fieldErrorsFrom` already
	// routes unknown keys to its `form` message, which the page passes in as `formError`.
	const errors = $derived({ ...clientErrors, ...fieldErrors });
	let formEl = $state<HTMLFormElement | null>(null);
	const uriErrors = $derived(
		Object.fromEntries(
			Object.entries(errors)
				.filter(([k]) => k.startsWith('redirect_uris.'))
				.map(([k, v]) => [Number(k.split('.')[1]), v])
		) as Record<number, string>
	);

	function validate(clientType: AppFormValues['client_type']) {
		const parsed = appFormSchema(clientType).safeParse(values);
		const next: Record<string, string> = {};
		if (!parsed.success) {
			for (const issue of parsed.error.issues) next[issue.path.join('.')] ??= issue.message;
		}
		clientErrors = next;
		return parsed;
	}

	/** Moves focus to the first invalid control so a failed submit is never silent. */
	async function focusFirstError() {
		await tick();
		const target =
			formEl?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
			// The scope error lives on the group, not a control: land on its first checkbox,
			// whose fieldset is described by the error.
			(errors.allowed_scopes ? formEl?.querySelector<HTMLElement>('[role="checkbox"]') : null);
		target?.focus();
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const parsed = validate(values.client_type);
		if (!parsed.success) {
			await focusFirstError();
			return;
		}
		onSubmit(parsed.data);
	}

	function setClientType(next: string) {
		if (next !== 'public' && next !== 'confidential') return;
		values.client_type = next;
		// URI rules depend on the client type: never leave errors that contradict the new one.
		if (Object.keys(clientErrors).length > 0) validate(next);
	}
</script>

<form bind:this={formEl} class="space-y-6" onsubmit={submit} novalidate>
	{#if formError}
		<Alert variant="destructive">
			<AlertDescription>{formError}</AlertDescription>
		</Alert>
	{/if}

	<div class="space-y-2">
		<Label for="{uid}-name">{m['oauth.developer.form.name']()}</Label>
		<Input
			id="{uid}-name"
			bind:value={values.name}
			maxlength={NAME_MAX}
			required
			aria-invalid={errors.name ? 'true' : undefined}
			aria-describedby={errors.name ? `${uid}-name-error` : undefined}
		/>
		{#if errors.name}<p id="{uid}-name-error" class="text-sm text-destructive">
				{errors.name}
			</p>{/if}
	</div>

	<div class="space-y-2">
		<Label for="{uid}-description">{m['oauth.developer.form.description']()}</Label>
		<Textarea
			id="{uid}-description"
			bind:value={values.description}
			maxlength={DESCRIPTION_MAX}
			rows={4}
			aria-invalid={errors.description ? 'true' : undefined}
			aria-describedby="{uid}-description-count{errors.description
				? ` ${uid}-description-error`
				: ''}"
		/>
		<p id="{uid}-description-count" class="text-xs text-muted-foreground">
			{m['oauth.developer.form.descriptionCount']({
				count: values.description.length,
				max: DESCRIPTION_MAX
			})}
		</p>
		{#if errors.description}<p id="{uid}-description-error" class="text-sm text-destructive">
				{errors.description}
			</p>{/if}
	</div>

	{#if mode === 'create'}
		<fieldset class="space-y-3">
			<legend id="{uid}-type-legend" class="text-sm font-bold">
				{m['oauth.developer.form.clientType']()}
			</legend>
			<RadioGroup
				value={values.client_type}
				onValueChange={setClientType}
				aria-labelledby="{uid}-type-legend"
				disabled={submitting}
			>
				<div class="flex items-start gap-2">
					<RadioGroupItem
						value="public"
						id="{uid}-type-public"
						aria-describedby="{uid}-type-public-help"
					/>
					<div>
						<Label for="{uid}-type-public">{m['oauth.developer.form.public']()}</Label>
						<p id="{uid}-type-public-help" class="text-sm text-muted-foreground">
							{m['oauth.developer.form.publicHelp']()}
						</p>
					</div>
				</div>
				<div class="flex items-start gap-2">
					<RadioGroupItem
						value="confidential"
						id="{uid}-type-confidential"
						aria-describedby="{uid}-type-confidential-help"
					/>
					<div>
						<Label for="{uid}-type-confidential">{m['oauth.developer.form.confidential']()}</Label>
						<p id="{uid}-type-confidential-help" class="text-sm text-muted-foreground">
							{m['oauth.developer.form.confidentialHelp']()}
						</p>
					</div>
				</div>
			</RadioGroup>
		</fieldset>
	{/if}

	<RedirectUriList
		value={values.redirect_uris}
		onChange={(next) => (values.redirect_uris = next)}
		errors={uriErrors}
		clientType={values.client_type}
		disabled={submitting}
	/>
	{#if errors.redirect_uris}<p class="text-sm text-destructive" role="alert">
			{errors.redirect_uris}
		</p>{/if}

	<ScopeCheckboxes
		value={values.allowed_scopes}
		onChange={(next) => (values.allowed_scopes = next)}
		{vocabulary}
		error={errors.allowed_scopes}
		disabled={submitting}
	/>

	<div class="grid gap-4 sm:grid-cols-2">
		<div class="space-y-2">
			<Label for="{uid}-homepage">{m['oauth.developer.form.homepage']()}</Label>
			<Input
				id="{uid}-homepage"
				type="url"
				bind:value={values.homepage_url}
				aria-invalid={errors.homepage_url ? 'true' : undefined}
				aria-describedby={errors.homepage_url ? `${uid}-homepage-error` : undefined}
			/>
			{#if errors.homepage_url}<p id="{uid}-homepage-error" class="text-sm text-destructive">
					{errors.homepage_url}
				</p>{/if}
		</div>
		<div class="space-y-2">
			<Label for="{uid}-privacy">{m['oauth.developer.form.privacy']()}</Label>
			<Input
				id="{uid}-privacy"
				type="url"
				bind:value={values.privacy_policy_url}
				aria-invalid={errors.privacy_policy_url ? 'true' : undefined}
				aria-describedby={errors.privacy_policy_url ? `${uid}-privacy-error` : undefined}
			/>
			{#if errors.privacy_policy_url}<p id="{uid}-privacy-error" class="text-sm text-destructive">
					{errors.privacy_policy_url}
				</p>{/if}
		</div>
	</div>

	<Button type="submit" disabled={submitting} class="gap-2">
		{#if submitting}
			<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
			{m['oauth.developer.form.saving']()}
		{:else}
			{mode === 'create' ? m['oauth.developer.form.create']() : m['oauth.developer.form.save']()}
		{/if}
	</Button>
</form>

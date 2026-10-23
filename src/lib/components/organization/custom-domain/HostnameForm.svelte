<script lang="ts">
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { AlertCircle, Loader2 } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import {
		CustomDomainApiError,
		normalizeHostname,
		requestCustomDomain,
		type CustomDomain
	} from './custom-domain-api';
	import { customDomainQueryKey } from './query-key';

	interface Props {
		slug: string;
		/** Called once the domain is requested (e.g. to close the "different hostname" form). */
		onRequested?: (domain: CustomDomain) => void;
		/** Shown on the submit button; defaults to "Connect domain". */
		submitLabel?: string;
	}
	const { slug, onRequested, submitLabel }: Props = $props();

	const queryClient = useQueryClient();

	let hostname = $state('');
	let fieldErrors = $state<string[]>([]);
	/** 409 / 502 / unexpected: shown in an alert, not against the field. */
	let alertMessage = $state<string | null>(null);

	const mutation = createMutation(() => ({
		// Must throw on failure so TanStack routes it to onError.
		mutationFn: (value: string) => requestCustomDomain(slug, value),
		onSuccess: (domain: CustomDomain) => {
			queryClient.setQueryData(customDomainQueryKey(slug), domain);
			hostname = '';
			fieldErrors = [];
			alertMessage = null;
			onRequested?.(domain);
		},
		// A local onError REPLACES the global "Action failed" toast: everything
		// the server said is rendered inline here.
		onError: (error: unknown) => {
			fieldErrors = [];
			alertMessage = null;
			if (error instanceof CustomDomainApiError) {
				if (error.status === 400 && error.fieldErrors.length > 0) {
					fieldErrors = error.fieldErrors;
					return;
				}
				if (error.detail) {
					alertMessage = error.detail;
					return;
				}
			}
			alertMessage = m['customDomain.form.genericError']();
		}
	}));

	const pending = $derived(mutation.isPending);
	const hasFieldErrors = $derived(fieldErrors.length > 0);

	function onSubmit(event: SubmitEvent) {
		event.preventDefault();
		const value = normalizeHostname(hostname);
		if (!value) {
			fieldErrors = [m['customDomain.form.required']()];
			alertMessage = null;
			return;
		}
		hostname = value;
		mutation.mutate(value);
	}
</script>

<form class="space-y-4" onsubmit={onSubmit} novalidate>
	<div class="space-y-2">
		<Label for="custom-domain-hostname">{m['customDomain.form.label']()}</Label>
		<Input
			id="custom-domain-hostname"
			type="text"
			inputmode="url"
			autocomplete="off"
			autocapitalize="none"
			spellcheck={false}
			placeholder="events.example.com"
			bind:value={hostname}
			aria-invalid={hasFieldErrors ? 'true' : undefined}
			aria-describedby={hasFieldErrors
				? 'custom-domain-hostname-help custom-domain-hostname-errors'
				: 'custom-domain-hostname-help'}
			aria-required="true"
			disabled={pending}
			oninput={() => {
				if (hasFieldErrors) fieldErrors = [];
			}}
		/>
		<p id="custom-domain-hostname-help" class="text-sm text-muted-foreground">
			{m['customDomain.form.help']()}
		</p>
		{#if hasFieldErrors}
			<ul id="custom-domain-hostname-errors" class="space-y-1 text-sm text-destructive">
				{#each fieldErrors as message, i (i)}
					<li>{message}</li>
				{/each}
			</ul>
		{/if}
	</div>

	{#if alertMessage}
		<Alert variant="destructive">
			<AlertCircle class="h-4 w-4" aria-hidden="true" />
			<AlertDescription>{alertMessage}</AlertDescription>
		</Alert>
	{/if}

	<Button type="submit" disabled={pending} class="gap-2">
		{#if pending}
			<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
		{/if}
		{pending
			? m['customDomain.form.submitting']()
			: (submitLabel ?? m['customDomain.form.submit']())}
	</Button>
</form>

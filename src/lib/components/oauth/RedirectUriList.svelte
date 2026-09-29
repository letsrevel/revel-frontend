<script lang="ts">
	import { Plus, Trash2 } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';
	import { REDIRECT_URIS_MAX, type ClientType } from '$lib/utils/oauth-app-form';

	interface Props {
		value: string[];
		onChange: (next: string[]) => void;
		errors?: Record<number, string>;
		clientType: ClientType;
		disabled?: boolean;
	}
	const { value, onChange, errors = {}, clientType, disabled = false }: Props = $props();

	// Row ids survive edits so a keyed {#each} keeps focus on the row being typed in.
	// The pool is deliberately NOT reactive: a $derived may mutate plain values, and
	// deriving (rather than syncing in an $effect) means the ids are right on the very
	// render that adds a row, so a new row can never borrow a live row's key.
	let idPool: number[] = [];
	let nextId = 1;
	const ids = $derived.by(() => {
		while (idPool.length < value.length) idPool.push(nextId++);
		idPool = idPool.slice(0, value.length);
		return [...idPool];
	});
	const uid = $props.id();
	const canAdd = $derived(!disabled && value.length < REDIRECT_URIS_MAX);
	const canRemove = $derived(!disabled && value.length > 1);
	const hint = $derived(
		clientType === 'public'
			? m['oauth.developer.form.redirectUriHint']()
			: m['oauth.developer.validation.uriSchemeConfidential']()
	);

	function update(index: number, next: string) {
		onChange(value.map((v, i) => (i === index ? next : v)));
	}
	function add() {
		if (canAdd) onChange([...value, '']);
	}
	function remove(index: number) {
		if (!canRemove) return;
		// Drop the removed row's own id so the rows below keep theirs.
		idPool = idPool.filter((_, i) => i !== index);
		onChange(value.filter((_, i) => i !== index));
	}
</script>

<fieldset class="space-y-3" {disabled}>
	<legend class="text-sm font-bold">{m['oauth.developer.form.redirectUris']()}</legend>
	<p id="{uid}-hint" class="text-sm text-muted-foreground">{hint}</p>
	{#each value as uri, index (ids[index])}
		{@const errorId = `${uid}-error-${index}`}
		<div class="flex items-start gap-2">
			<div class="min-w-0 flex-1">
				<Label for="{uid}-uri-{index}" class="sr-only"
					>{m['oauth.developer.form.uriLabel']({ n: index + 1 })}</Label
				>
				<Input
					id="{uid}-uri-{index}"
					type="url"
					inputmode="url"
					autocomplete="off"
					spellcheck={false}
					value={uri}
					oninput={(e) => update(index, (e.currentTarget as HTMLInputElement).value)}
					aria-invalid={errors[index] ? 'true' : undefined}
					aria-describedby={errors[index] ? errorId : `${uid}-hint`}
					class="font-mono text-sm"
				/>
				{#if errors[index]}
					<p id={errorId} class="mt-1 text-sm text-destructive">{errors[index]}</p>
				{/if}
			</div>
			{#if canRemove}
				<Button
					type="button"
					variant="ghost"
					size="icon"
					onclick={() => remove(index)}
					class="shrink-0"
				>
					<Trash2 class="h-4 w-4" aria-hidden="true" />
					<span class="sr-only">{m['oauth.developer.form.removeUri']({ n: index + 1 })}</span>
				</Button>
			{/if}
		</div>
	{/each}
	<Button type="button" variant="outline" size="sm" onclick={add} disabled={!canAdd} class="gap-2">
		<Plus class="h-4 w-4" aria-hidden="true" />
		{m['oauth.developer.form.addUri']()}
	</Button>
</fieldset>

<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { AuthorizeScopeSchema } from '$lib/api/generated/types.gen';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import { groupHeading, groupScopes } from '$lib/utils/oauth-scopes';

	interface Props {
		value: string[];
		onChange: (next: string[]) => void;
		vocabulary: AuthorizeScopeSchema[];
		error?: string;
		disabled?: boolean;
	}
	const { value, onChange, vocabulary, error, disabled = false }: Props = $props();

	const uid = $props.id();
	const groups = $derived(groupScopes(vocabulary));
	const selected = $derived(new Set(value));

	function toggle(name: string, checked: boolean) {
		// Keep vocabulary order in the emitted list so PATCH diffs stay stable.
		const next = checked ? [...value, name] : value.filter((n) => n !== name);
		onChange(vocabulary.map((s) => s.name).filter((n) => next.includes(n)));
	}
</script>

<fieldset class="space-y-4" {disabled} aria-describedby={error ? `${uid}-error` : undefined}>
	<legend class="text-sm font-bold">{m['oauth.developer.form.scopes']()}</legend>
	{#if error}
		<p id="{uid}-error" role="alert" class="text-sm text-destructive">{error}</p>
	{/if}
	{#each groups as group (group.group)}
		<div role="group" aria-labelledby="{uid}-{group.group}" class="space-y-2">
			<p
				id="{uid}-{group.group}"
				class="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground"
			>
				{groupHeading(group.group)}
			</p>
			{#if group.group === 'org'}
				<p class="text-sm text-muted-foreground">{m['oauth.developer.form.orgReadNote']()}</p>
			{/if}
			{#each group.rows as scope (scope.name)}
				{@const rowId = `${uid}-scope-${scope.name.replace(/[^a-z0-9_-]/gi, '-')}`}
				<div class="flex items-start gap-2">
					<!-- Controlled via a function binding: the parent's `value` is the only source of truth. -->
					<Checkbox
						id={rowId}
						bind:checked={() => selected.has(scope.name), (checked) => toggle(scope.name, checked)}
						aria-describedby="{rowId}-code"
						{disabled}
					/>
					<div class="min-w-0 text-sm leading-tight">
						<Label for={rowId} class="text-sm font-normal leading-tight">{scope.label}</Label>
						<span id="{rowId}-code" class="ml-1 break-all font-mono text-xs text-muted-foreground"
							>{scope.name}</span
						>
					</div>
				</div>
			{/each}
		</div>
	{/each}
</fieldset>

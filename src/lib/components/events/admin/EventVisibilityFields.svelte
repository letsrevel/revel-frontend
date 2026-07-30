<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { EventVisibilitySettings } from '$lib/api/generated/types.gen';
	import {
		VISIBILITY_PRESETS,
		VISIBILITY_PRESET_IDS,
		matchVisibilityPreset,
		resolveVisibilitySettings,
		type ResolvedVisibilityToggles,
		type VisibilityPresetId,
		type VisibilityToggleKey
	} from '$lib/utils/event-visibility';

	interface Props {
		/** Current settings; the three toggles this component reads resolve absent values to the backend default (`true`). */
		settings?: EventVisibilitySettings | null;
		disabled?: boolean;
		/** Prefix for the generated input ids, so two instances never collide. */
		idPrefix?: string;
		/**
		 * Emits the three preset toggles only — a PARTIAL of `visibility_settings`
		 * (see `ResolvedVisibilityToggles` vs `ResolvedVisibilitySettings` in
		 * `event-visibility.ts`). Callers MUST merge into their existing settings
		 * (`{ ...current, ...next }`), never assign directly, or the two keys this
		 * component doesn't touch (`show_pronoun_distribution`, `address_visibility`)
		 * get silently dropped.
		 */
		onChange: (next: ResolvedVisibilityToggles) => void;
	}

	const {
		settings = null,
		disabled = false,
		idPrefix = 'event-visibility',
		onChange
	}: Props = $props();

	const resolved = $derived(resolveVisibilitySettings(settings));
	const activePreset = $derived(matchVisibilityPreset(settings));

	const presetLabels: Record<VisibilityPresetId, { label: string; hint: string }> = $derived({
		open: {
			label: m['eventVisibility.presetOpen'](),
			hint: m['eventVisibility.presetOpenHint']()
		},
		discreet: {
			label: m['eventVisibility.presetDiscreet'](),
			hint: m['eventVisibility.presetDiscreetHint']()
		}
	});

	const currentSelectionText = $derived(
		m['eventVisibility.currentSelection']({
			preset: activePreset ? presetLabels[activePreset].label : m['eventVisibility.presetCustom']()
		})
	);

	const toggles: { key: VisibilityToggleKey; label: string; hint: string; testid: string }[] =
		$derived([
			{
				key: 'show_attendee_count',
				label: m['eventVisibility.showAttendeeCount'](),
				hint: m['eventVisibility.showAttendeeCountHint'](),
				testid: 'visibility-show-attendee-count'
			},
			{
				key: 'show_capacity',
				label: m['eventVisibility.showCapacity'](),
				hint: m['eventVisibility.showCapacityHint'](),
				testid: 'visibility-show-capacity'
			},
			{
				key: 'show_attendee_list',
				label: m['eventVisibility.showAttendeeList'](),
				hint: m['eventVisibility.showAttendeeListHint'](),
				testid: 'visibility-show-attendee-list'
			}
		]);

	/**
	 * Presets are a frontend-only shortcut: they set the three granular toggles
	 * and nothing else. A preset name is never sent to the backend, which rejects
	 * unknown keys with a 422 (`extra="forbid"`).
	 */
	function applyPreset(id: VisibilityPresetId): void {
		onChange({ ...VISIBILITY_PRESETS[id] });
	}

	function setToggle(key: VisibilityToggleKey, value: boolean): void {
		const nextToggles: ResolvedVisibilityToggles = {
			show_attendee_count: resolved.show_attendee_count,
			show_capacity: resolved.show_capacity,
			show_attendee_list: resolved.show_attendee_list,
			[key]: value
		};
		onChange(nextToggles);
	}
</script>

<div class="space-y-4">
	<p class="text-sm text-muted-foreground">{m['eventVisibility.hint']()}</p>

	<!-- Preset shortcuts. Toggle buttons rather than a radio group: the current
	     combination may match no preset ("Custom"), which a radio group cannot
	     represent without a phantom option. -->
	<div class="space-y-2">
		<div
			class="flex flex-wrap items-center gap-2"
			role="group"
			aria-label={m['eventVisibility.presetsLabel']()}
		>
			<span class="text-sm font-medium">{m['eventVisibility.presetsLabel']()}</span>
			{#each VISIBILITY_PRESET_IDS as presetId (presetId)}
				<button
					type="button"
					{disabled}
					aria-pressed={activePreset === presetId}
					onclick={() => applyPreset(presetId)}
					class="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {activePreset ===
					presetId
						? 'border-primary bg-primary text-primary-foreground'
						: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'}"
					data-testid="visibility-preset-{presetId}"
				>
					{presetLabels[presetId].label}
					<span class="sr-only">— {presetLabels[presetId].hint}</span>
				</button>
			{/each}
		</div>
		<p
			class="text-xs text-muted-foreground"
			aria-live="polite"
			data-testid="visibility-current-preset"
		>
			{currentSelectionText}
		</p>
	</div>

	<!-- Granular toggles. These are the only values ever written; a preset simply
	     sets all three at once. -->
	{#each toggles as toggle (toggle.key)}
		<label
			class="flex cursor-pointer items-center gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent"
		>
			<input
				id="{idPrefix}-{toggle.key}"
				type="checkbox"
				checked={resolved[toggle.key]}
				{disabled}
				onchange={(e) => setToggle(toggle.key, e.currentTarget.checked)}
				class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-ring"
				data-testid={toggle.testid}
			/>
			<div class="flex-1">
				<div class="font-medium">{toggle.label}</div>
				<div class="text-sm text-muted-foreground">{toggle.hint}</div>
			</div>
		</label>
	{/each}

	<p class="text-xs text-muted-foreground">{m['eventVisibility.staffNote']()}</p>
</div>

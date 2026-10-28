<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import EventVisibilitySection from '../../EventVisibilitySection.svelte';
	import EditorSection from './EditorSection.svelte';
	import EditorSubGroup from './EditorSubGroup.svelte';
	import type { EditorFormData, EditorUpdate } from '../types';

	interface Props {
		formData: EditorFormData;
		onUpdate: EditorUpdate;
	}

	const { formData, onUpdate }: Props = $props();
</script>

<EditorSection
	id="section-page"
	title={m['eventEditor.sectionPage']()}
	subtitle={m['eventEditor.subtitlePage']()}
>
	<!-- Attendance visibility (what the public page discloses) -->
	<EditorSubGroup divider={false} title={m['eventVisibility.title']()}>
		<EventVisibilitySection
			bare
			settings={formData.visibility_settings}
			onChange={(next) =>
				onUpdate({ visibility_settings: { ...formData.visibility_settings, ...next } })}
		/>
	</EditorSubGroup>

	<EditorSubGroup>
		<!-- Public Pronoun Distribution -->
		<label
			class="flex cursor-pointer items-center gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent"
		>
			<input
				type="checkbox"
				checked={formData.visibility_settings?.show_pronoun_distribution || false}
				onchange={(e) =>
					onUpdate({
						visibility_settings: {
							...formData.visibility_settings,
							show_pronoun_distribution: e.currentTarget.checked
						}
					})}
				class="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
			/>
			<div class="flex-1">
				<div class="font-medium">{m['detailsStep.publicPronounDistribution']()}</div>
				<div class="text-sm text-muted-foreground">
					{m['detailsStep.publicPronounDistributionHint']()}
				</div>
			</div>
		</label>

		<!-- Potluck Open -->
		<label
			class="flex cursor-pointer items-center gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent"
		>
			<input
				type="checkbox"
				checked={formData.potluck_open || false}
				onchange={(e) => onUpdate({ potluck_open: e.currentTarget.checked })}
				class="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
			/>
			<div class="flex-1">
				<div class="font-medium">{m['detailsStep.enablePotluck']()}</div>
				<div class="text-sm text-muted-foreground">{m['detailsStep.potluckHint']()}</div>
			</div>
		</label>
	</EditorSubGroup>
</EditorSection>

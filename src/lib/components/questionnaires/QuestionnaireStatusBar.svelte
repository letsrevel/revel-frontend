<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { AlertTriangle, FileCheck, FileEdit, Send } from '@lucide/svelte';
	import QuestionnaireStatusBadge from './QuestionnaireStatusBadge.svelte';
	import type { QuestionnaireStatus } from '$lib/api/generated/types.gen';

	interface Props {
		currentStatus: QuestionnaireStatus;
		isChangingStatus: boolean;
		onChangeStatus: (newStatus: QuestionnaireStatus) => void;
	}

	const { currentStatus, isChangingStatus, onChangeStatus }: Props = $props();

	// Status labels and descriptions (tone now comes from `QuestionnaireStatusBadge`)
	const statusInfo: Record<QuestionnaireStatus, { label: string; description: string }> = {
		draft: {
			label: m['questionnaireEditPage.status.draft_label'](),
			description: m['questionnaireEditPage.status.draft_description']()
		},
		ready: {
			label: m['questionnaireEditPage.status.ready_label'](),
			description: m['questionnaireEditPage.status.ready_description']()
		},
		published: {
			label: m['questionnaireEditPage.status.published_label'](),
			description: m['questionnaireEditPage.status.published_description']()
		}
	};

	const currentStatusInfo = $derived(statusInfo[currentStatus]);
</script>

<!--
	Card tint mirrors the badge tone (rebrand): `draft` = warning (no
	`--warning` token, so `border-highlight bg-highlight/10`), `ready` = info
	(`border-info/50 bg-info/10`), `published` keeps the plain card surface.
	Only default `text-foreground`/`text-muted-foreground` sit on these tints
	(never `text-highlight`), per the dark-mode `--highlight` text-contrast trap.
-->
<Card
	class="mb-6 {currentStatus === 'draft'
		? 'border-highlight bg-highlight/10'
		: currentStatus === 'ready'
			? 'border-info/50 bg-info/10'
			: ''}"
>
	<CardHeader>
		<div class="flex items-center justify-between">
			<div>
				<CardTitle>{m['questionnaireEditPage.status.title']()}</CardTitle>
				<CardDescription>{m['questionnaireEditPage.status.description']()}</CardDescription>
			</div>
			<QuestionnaireStatusBadge status={currentStatus} label={currentStatusInfo.label} size="md" />
		</div>
	</CardHeader>
	<CardContent>
		<div class="space-y-4">
			<p class="text-sm text-foreground">
				{currentStatusInfo.description}
			</p>

			{#if currentStatus === 'ready'}
				<!-- Warning for "ready" but not published status -->
				<div class="flex items-start gap-3 rounded-lg border border-highlight bg-highlight/10 p-4">
					<AlertTriangle
						class="h-5 w-5 flex-shrink-0 text-highlight-foreground dark:text-highlight"
						aria-hidden="true"
					/>
					<p class="text-sm font-medium text-foreground">
						{m['questionnaireEditPage.status.ready_warning']()}
					</p>
				</div>
			{/if}

			<div class="flex flex-wrap gap-2">
				{#if currentStatus !== 'draft'}
					<Button
						variant="outline"
						size="sm"
						onclick={() => onChangeStatus('draft')}
						disabled={isChangingStatus}
						class="gap-2"
					>
						<FileEdit class="h-4 w-4" />
						{m['questionnaireEditPage.status.markAsDraftButton']()}
					</Button>
				{/if}

				{#if currentStatus !== 'ready' && currentStatus !== 'published'}
					<Button
						variant="outline"
						size="sm"
						onclick={() => onChangeStatus('ready')}
						disabled={isChangingStatus}
						class="gap-2"
					>
						<FileCheck class="h-4 w-4" />
						{m['questionnaireEditPage.status.markAsReadyButton']()}
					</Button>
				{/if}

				{#if currentStatus === 'published'}
					<Button
						variant="outline"
						size="sm"
						onclick={() => onChangeStatus('ready')}
						disabled={isChangingStatus}
						class="gap-2"
					>
						<FileCheck class="h-4 w-4" />
						{m['questionnaireEditPage.status.unpublishButton']()}
					</Button>
				{/if}

				{#if currentStatus !== 'published'}
					<Button
						variant="default"
						size="sm"
						onclick={() => onChangeStatus('published')}
						disabled={isChangingStatus}
						class="gap-2"
					>
						<Send class="h-4 w-4" />
						{m['questionnaireEditPage.status.publishButton']()}
					</Button>
				{/if}
			</div>
		</div>
	</CardContent>
</Card>

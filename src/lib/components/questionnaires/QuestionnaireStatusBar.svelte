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
	import { AlertTriangle, FileCheck, FileEdit, Send } from 'lucide-svelte';
	import { Badge } from '$lib/components/ui/badge';
	import type { QuestionnaireStatus } from '$lib/api/generated/types.gen';

	interface Props {
		currentStatus: QuestionnaireStatus;
		isChangingStatus: boolean;
		onChangeStatus: (newStatus: QuestionnaireStatus) => void;
	}

	let { currentStatus, isChangingStatus, onChangeStatus }: Props = $props();

	// Status labels, variants, and descriptions
	const statusInfo: Record<
		QuestionnaireStatus,
		{ label: string; variant: 'outline' | 'secondary' | 'default'; description: string }
	> = {
		draft: {
			label: m['questionnaireEditPage.status.draft_label'](),
			variant: 'outline',
			description: m['questionnaireEditPage.status.draft_description']()
		},
		ready: {
			label: m['questionnaireEditPage.status.ready_label'](),
			variant: 'secondary',
			description: m['questionnaireEditPage.status.ready_description']()
		},
		published: {
			label: m['questionnaireEditPage.status.published_label'](),
			variant: 'default',
			description: m['questionnaireEditPage.status.published_description']()
		}
	};

	const currentStatusInfo = $derived(statusInfo[currentStatus]);
</script>

<Card
	class="mb-6 {currentStatus === 'draft'
		? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30'
		: currentStatus === 'ready'
			? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30'
			: ''}"
>
	<CardHeader>
		<div class="flex items-center justify-between">
			<div>
				<CardTitle>{m['questionnaireEditPage.status.title']()}</CardTitle>
				<CardDescription
					class={currentStatus === 'draft'
						? 'text-amber-700 dark:text-amber-300'
						: currentStatus === 'ready'
							? 'text-blue-700 dark:text-blue-300'
							: ''}>{m['questionnaireEditPage.status.description']()}</CardDescription
				>
			</div>
			{#if currentStatus === 'draft'}
				<Badge class="bg-amber-500 text-sm text-white hover:bg-amber-600">
					{currentStatusInfo.label}
				</Badge>
			{:else if currentStatus === 'ready'}
				<Badge class="bg-blue-500 text-sm text-white hover:bg-blue-600">
					{currentStatusInfo.label}
				</Badge>
			{:else}
				<Badge variant={currentStatusInfo.variant} class="text-sm">
					{currentStatusInfo.label}
				</Badge>
			{/if}
		</div>
	</CardHeader>
	<CardContent>
		<div class="space-y-4">
			<p
				class="text-sm {currentStatus === 'draft'
					? 'text-amber-700 dark:text-amber-300'
					: currentStatus === 'ready'
						? 'text-blue-700 dark:text-blue-300'
						: 'text-muted-foreground'}"
			>
				{currentStatusInfo.description}
			</p>

			{#if currentStatus === 'ready'}
				<!-- Warning for "ready" but not published status -->
				<div
					class="flex items-start gap-3 rounded-lg border border-orange-300 bg-orange-50 p-4 dark:border-orange-700 dark:bg-orange-950/50"
				>
					<AlertTriangle
						class="h-5 w-5 flex-shrink-0 text-orange-600 dark:text-orange-400"
						aria-hidden="true"
					/>
					<p class="text-sm font-medium text-orange-800 dark:text-orange-200">
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

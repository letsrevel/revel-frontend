<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { CalendarCheck, Calendar } from '@lucide/svelte';
	import { formatDate } from '$lib/utils/date';
	import type {
		MinimalEventSchema,
		MinimalEventSeriesSchema,
		OrganizationQuestionnaireSchema
	} from '$lib/api/generated/types.gen';

	interface Props {
		questionnaire: OrganizationQuestionnaireSchema | undefined;
		onManageAssignments: () => void;
	}

	let { questionnaire, onManageAssignments }: Props = $props();

	// `event_type` / `event_count` are not part of the generated
	// MinimalEventSchema / MinimalEventSeriesSchema, so the API never sends
	// them here and these have always rendered empty / 0 (see report). Read
	// them defensively so they light up if the backend ever adds the fields.
	function getEventTypeLabel(event: MinimalEventSchema): string {
		return 'event_type' in event && typeof event.event_type === 'string' ? event.event_type : '';
	}

	function getSeriesEventCount(series: MinimalEventSeriesSchema): number | undefined {
		return 'event_count' in series && typeof series.event_count === 'number'
			? series.event_count
			: undefined;
	}
</script>

<!-- Event Assignments -->
<Card>
	<CardHeader>
		<div class="flex items-center justify-between">
			<div>
				<CardTitle>{m['questionnaireEditPage.assignments.title']()}</CardTitle>
				<CardDescription>{m['questionnaireEditPage.assignments.description']()}</CardDescription>
			</div>
			<Button variant="outline" size="sm" onclick={onManageAssignments} class="gap-2">
				<CalendarCheck class="h-4 w-4" />
				{m['questionnaireEditPage.manageAssignments']()}
			</Button>
		</div>
	</CardHeader>
	<CardContent>
		{#if (questionnaire?.events?.length || 0) === 0 && (questionnaire?.event_series?.length || 0) === 0}
			<div class="rounded-lg border border-dashed p-8 text-center">
				<Calendar class="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
				<p class="text-sm font-medium">
					{m['questionnaireEditPage.assignments.noAssignments']()}
				</p>
				<p class="mt-1 text-xs text-muted-foreground">
					{m['questionnaireEditPage.assignments.noAssignmentsDescription']()}
				</p>
			</div>
		{:else}
			<div class="space-y-4">
				{#if questionnaire?.events && questionnaire.events.length > 0}
					<div>
						<h4 class="mb-2 text-sm font-medium">
							{m['questionnaireEditPage.assignments.individualEventsTitle']()}
						</h4>
						<div class="space-y-2">
							{#each questionnaire.events as event (event.id)}
								<div class="flex items-center justify-between rounded-lg border p-3">
									<div>
										<p class="font-medium">{event.name}</p>
										{#if event.start}
											<p class="text-sm text-muted-foreground">
												{formatDate(event.start)}
											</p>
										{/if}
									</div>
									<Badge variant="outline">{getEventTypeLabel(event)}</Badge>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				{#if questionnaire?.event_series && questionnaire.event_series.length > 0}
					<div>
						<h4 class="mb-2 text-sm font-medium">
							{m['questionnaireEditPage.assignments.eventSeriesTitle']()}
						</h4>
						<div class="space-y-2">
							{#each questionnaire.event_series as series (series.id)}
								<div class="flex items-center justify-between rounded-lg border p-3">
									<div>
										<p class="font-medium">{series.name}</p>
										<p class="text-sm text-muted-foreground">
											{getSeriesEventCount(series) === 1
												? m['questionnaireEditPage.eventCount']({
														count: getSeriesEventCount(series) || 0
													})
												: m['questionnaireEditPage.eventCountPlural']({
														count: getSeriesEventCount(series) || 0
													})}
										</p>
									</div>
									<Badge variant="secondary">{m['questionnaireEditPage.seriesBadge']()}</Badge>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</CardContent>
</Card>

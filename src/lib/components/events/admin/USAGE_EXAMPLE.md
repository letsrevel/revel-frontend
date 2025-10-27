# EventWizard Usage Example

This guide shows how to integrate the EventWizard component into a SvelteKit route.

## Route Structure

Create these files for the event creation route:

```
routes/
└── (auth)/
    └── org/
        └── [slug]/
            └── admin/
                └── events/
                    └── new/
                        ├── +page.svelte
                        └── +page.server.ts
```

## +page.server.ts

```typescript
import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
	organizationRetrieveOrganization21Bc4Ddf,
	eventseriesListEventSeriesA2C209Ed,
	questionnaireListOrgQuestionnaires764A5Af8
} from '$lib/api/generated/sdk.gen';

export const load: PageServerLoad = async ({ params, locals }) => {
	const user = locals.user;

	if (!user) {
		throw error(401, 'Unauthorized');
	}

	try {
		// Fetch organization
		const orgResponse = await organizationRetrieveOrganization21Bc4Ddf({
			path: { slug: params.slug }
		});

		if (!orgResponse.data) {
			throw error(404, 'Organization not found');
		}

		const organization = orgResponse.data;

		// Check if user is admin/staff (implement your permission check)
		// For example, check if user is in organization.staff or organization.admins
		// This is just a placeholder - implement based on your auth logic
		const isAuthorized = true; // Replace with actual permission check

		if (!isAuthorized) {
			throw error(403, 'You do not have permission to create events for this organization');
		}

		// Fetch event series for dropdown
		const seriesResponse = await eventseriesListEventSeriesA2C209Ed({
			query: {
				organization_id: organization.id,
				page_size: 100
			}
		});

		const eventSeries = seriesResponse.data?.results || [];

		// Fetch questionnaires for dropdown
		const questionnairesResponse = await questionnaireListOrgQuestionnaires764A5Af8({
			query: {
				organization_id: organization.id,
				page_size: 100
			}
		});

		const questionnaires = questionnairesResponse.data?.results || [];

		// Get user's preferred city (if stored in user profile)
		const userCity = user.preferred_city || null;

		return {
			organization,
			eventSeries,
			questionnaires: questionnaires.map((q) => q.questionnaire),
			userCity,
			orgCity: organization.city
		};
	} catch (err) {
		console.error('Failed to load event creation page:', err);
		throw error(500, 'Failed to load page');
	}
};
```

## +page.svelte

```svelte
<script lang="ts">
	import EventWizard from '$lib/components/events/admin/EventWizard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Create Event | {data.organization.name}</title>
	<meta name="description" content="Create a new event for {data.organization.name}" />
</svelte:head>

<EventWizard
	organization={data.organization}
	eventSeries={data.eventSeries}
	questionnaires={data.questionnaires}
	userCity={data.userCity}
	orgCity={data.orgCity}
/>
```

## Edit Event Route

For editing an existing event, create:

```
routes/
└── (auth)/
    └── org/
        └── [slug]/
            └── admin/
                └── events/
                    └── [eventId]/
                        └── edit/
                            ├── +page.svelte
                            └── +page.server.ts
```

### +page.server.ts (Edit)

```typescript
import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
	organizationRetrieveOrganization21Bc4Ddf,
	eventRetrieveEvent9558Ad78,
	eventseriesListEventSeriesA2C209Ed,
	questionnaireListOrgQuestionnaires764A5Af8
} from '$lib/api/generated/sdk.gen';

export const load: PageServerLoad = async ({ params, locals }) => {
	const user = locals.user;

	if (!user) {
		throw error(401, 'Unauthorized');
	}

	try {
		// Fetch organization
		const orgResponse = await organizationRetrieveOrganization21Bc4Ddf({
			path: { slug: params.slug }
		});

		if (!orgResponse.data) {
			throw error(404, 'Organization not found');
		}

		const organization = orgResponse.data;

		// Fetch existing event
		const eventResponse = await eventRetrieveEvent9558Ad78({
			path: { event_id: params.eventId }
		});

		if (!eventResponse.data) {
			throw error(404, 'Event not found');
		}

		const existingEvent = eventResponse.data;

		// Verify event belongs to organization
		if (existingEvent.organization.id !== organization.id) {
			throw error(403, 'This event does not belong to this organization');
		}

		// Check permissions
		const isAuthorized = true; // Replace with actual permission check

		if (!isAuthorized) {
			throw error(403, 'You do not have permission to edit this event');
		}

		// Fetch event series and questionnaires
		const seriesResponse = await eventseriesListEventSeriesA2C209Ed({
			query: {
				organization_id: organization.id,
				page_size: 100
			}
		});

		const eventSeries = seriesResponse.data?.results || [];

		const questionnairesResponse = await questionnaireListOrgQuestionnaires764A5Af8({
			query: {
				organization_id: organization.id,
				page_size: 100
			}
		});

		const questionnaires = questionnairesResponse.data?.results || [];

		const userCity = user.preferred_city || null;

		return {
			organization,
			existingEvent,
			eventSeries,
			questionnaires: questionnaires.map((q) => q.questionnaire),
			userCity,
			orgCity: organization.city
		};
	} catch (err) {
		console.error('Failed to load event edit page:', err);
		throw error(500, 'Failed to load page');
	}
};
```

### +page.svelte (Edit)

```svelte
<script lang="ts">
	import EventWizard from '$lib/components/events/admin/EventWizard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Edit {data.existingEvent.name} | {data.organization.name}</title>
	<meta name="description" content="Edit event details" />
</svelte:head>

<EventWizard
	organization={data.organization}
	existingEvent={data.existingEvent}
	eventSeries={data.eventSeries}
	questionnaires={data.questionnaires}
	userCity={data.userCity}
	orgCity={data.orgCity}
/>
```

## Permission Checking

Replace the placeholder permission checks with your actual authorization logic:

```typescript
// Example permission check
function canCreateEvent(user: User, organization: Organization): boolean {
	// Check if user is admin
	if (organization.admins?.some((admin) => admin.id === user.id)) {
		return true;
	}

	// Check if user is staff with event creation permission
	if (
		organization.staff?.some(
			(staff) => staff.id === user.id && staff.permissions?.includes('create_events')
		)
	) {
		return true;
	}

	return false;
}
```

## Navigation

Add a link to create events in your organization admin dashboard:

```svelte
<a
	href="/org/{organization.slug}/admin/events/new"
	class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
>
	<PlusCircle class="h-5 w-5" />
	Create Event
</a>
```

## Success Redirect

After successful creation/update, the wizard redirects to:

```
/org/{slug}/admin/events
```

Make sure you have this route set up to display the organization's events list.

## Error Handling

The wizard handles errors internally and displays them to the user. However, you can add global error handling in your layout:

```svelte
<!-- +layout.svelte -->
{#if $page.error}
	<div class="rounded-md bg-destructive/10 p-4 text-destructive">
		<p class="font-semibold">Error</p>
		<p class="text-sm">{$page.error.message}</p>
	</div>
{/if}
```

## Testing the Integration

1. **Create Event Flow:**
   - Navigate to `/org/test-org/admin/events/new`
   - Fill in Step 1 (essentials)
   - Click "Create Event"
   - Verify API call to create endpoint
   - Fill in Step 2 (details)
   - Click "Save & Exit"
   - Verify redirect to events list

2. **Edit Event Flow:**
   - Navigate to `/org/test-org/admin/events/{eventId}/edit`
   - Verify form is pre-populated
   - Make changes
   - Click "Update & Continue" or "Save & Exit"
   - Verify changes are saved

3. **Validation:**
   - Try submitting Step 1 without required fields
   - Verify error messages appear
   - Verify focus is moved to first error

4. **Mobile:**
   - Test on mobile viewport
   - Verify all controls are touch-friendly
   - Verify accordion sections work
   - Verify file uploads work on mobile

## Notes

- The wizard automatically saves the event as `status: "pending review"` on Step 1 completion
- Images are uploaded separately after the event is created/updated
- All API calls use TanStack Query for automatic caching and error handling
- The wizard invalidates relevant queries after successful save

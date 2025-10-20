# Technical Design: Organization Settings Page

## Overview

This document outlines the technical implementation for the organization settings page feature, which allows organization administrators to manage their organization's profile and settings through a rich text editor interface.

## Components

### 1. HTMLDescription.svelte

**Purpose:** Safely render HTML content from backend `description_html` fields

**Location:** `src/lib/components/common/HTMLDescription.svelte`

**Props:**

- `html: string | null | undefined` - HTML content to render
- `class?: string` - Additional CSS classes
- `emptyMessage?: string` - Message when content is empty (default: "No description available")
- `prose?: boolean` - Apply prose typography classes (default: true)

**Implementation Notes:**

- Use `{@html}` directive for rendering (content is pre-sanitized by backend)
- Apply Tailwind prose classes for consistent typography
- Handle dark mode with `dark:prose-invert`
- Include proper semantic HTML structure

### 2. Enhanced MarkdownEditor.svelte

**Purpose:** Rich text editor that converts markdown to HTML for backend storage

**Location:** `src/lib/components/forms/MarkdownEditor.svelte` (existing, to be enhanced)

**New Props:**

- `outputFormat?: 'markdown' | 'html'` - Control output format (default: 'markdown')
- `onHtmlChange?: (html: string) => void` - Callback for HTML output
- `enhancedToolbar?: boolean` - Show additional formatting options

**Enhancements:**

- Add support for tables, code blocks, horizontal rules
- Improve markdown to HTML conversion using `marked` library
- Better preview that matches actual rendered output
- Add toolbar buttons for additional formatting options
- Maintain backward compatibility with existing usage

**Dependencies:**

```json
{
	"marked": "^14.0.0"
}
```

### 3. Organization Settings Form

**Purpose:** Form component for editing organization details

**Location:** Inline in settings page (could be extracted if reused)

**Fields:**

- Organization name (text input, required)
- Organization slug (text input, required, validated)
- Description (MarkdownEditor with HTML output)
- City (select/autocomplete, optional)
- Visibility settings (select: public/private/members-only)

## Routes

### `/org/[slug]/admin/settings`

**Rendering Strategy:** SSR with form actions

**File Structure:**

```
src/routes/(auth)/org/[slug]/admin/settings/
├── +page.server.ts    # Load function and form actions
└── +page.svelte       # Settings form UI
```

### +page.server.ts

```typescript
import type { PageServerLoad, Actions } from './$types';
import { organizationadminUpdateOrganizationB598Bf4D } from '$lib/api/generated/sdk.gen';
import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

const updateSchema = z.object({
	name: z.string().min(1, 'Name is required').max(100),
	slug: z
		.string()
		.min(1, 'Slug is required')
		.max(50)
		.regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
	description: z.string().optional(),
	city_id: z.number().nullable().optional(),
	visibility: z.enum(['public', 'private', 'members-only']).optional()
});

export const load: PageServerLoad = async ({ params, locals, parent }) => {
	const { organization, isOwner, isStaff } = await parent();

	// Permission check
	if (!isOwner && !isStaff) {
		throw error(403, 'You do not have permission to edit this organization');
	}

	// Initialize form with current values
	const form = await superValidate(
		{
			name: organization.name,
			slug: organization.slug,
			description: organization.description || '',
			city_id: organization.city?.id || null,
			visibility: organization.visibility
		},
		zod(updateSchema)
	);

	return { form };
};

export const actions: Actions = {
	default: async ({ request, params, locals }) => {
		const form = await superValidate(request, zod(updateSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			const response = await organizationadminUpdateOrganizationB598Bf4D({
				path: { slug: params.slug },
				body: form.data,
				headers: {
					Authorization: `Bearer ${locals.user?.accessToken}`
				}
			});

			if (response.data) {
				// Redirect to new slug if it changed
				if (form.data.slug !== params.slug) {
					throw redirect(303, `/org/${form.data.slug}/admin/settings`);
				}
				return { form, success: true };
			}
		} catch (error) {
			return fail(500, { form, error: 'Failed to update organization' });
		}
	}
};
```

## API Integration

### Endpoints Used

1. **Update Organization**
   - Method: `organizationadminUpdateOrganizationB598Bf4D`
   - Path: `PATCH /api/organization-admin/{slug}`
   - Body: `OrganizationEditSchema`
   - Response: `OrganizationRetrieveSchema`

### Request Schema

```typescript
interface OrganizationEditSchema {
	name?: string;
	slug?: string;
	description?: string; // Markdown text
	description_html?: string; // Generated HTML
	city_id?: number | null;
	address?: string | null;
	visibility?: 'public' | 'private' | 'members-only';
}
```

## State Management

### Form State

- Use Superforms for form validation and state management
- TanStack Query for optimistic updates and cache invalidation

### Authentication

- Access token from `locals.user.accessToken`
- Permission checks in load function

## Accessibility

### WCAG 2.1 AA Requirements

1. **Form Labels**
   - All inputs have associated labels
   - Required fields marked with asterisk and aria-required

2. **Keyboard Navigation**
   - All form controls keyboard accessible
   - Tab order follows visual layout
   - Markdown editor toolbar buttons accessible

3. **Screen Reader Support**
   - Form validation errors announced
   - Success messages announced with aria-live
   - Toolbar buttons have aria-labels

4. **Color Contrast**
   - Maintain 4.5:1 ratio for text
   - Error states not rely on color alone

## Mobile Considerations

### Responsive Layout

- Single column on mobile
- Full width inputs
- Touch-friendly button sizes (min 44x44px)

### Markdown Editor

- Toolbar wraps on small screens
- Preview toggle prominent on mobile
- Larger text area on mobile

## Error Handling

### Validation Errors

- Client-side validation with Zod
- Server-side validation as fallback
- Clear error messages per field

### API Errors

- Handle 403 Forbidden (no permission)
- Handle 404 Not Found (organization doesn't exist)
- Handle 409 Conflict (slug already taken)
- Generic error fallback with user-friendly message

## Testing Strategy

### Unit Tests

- Form validation logic
- Markdown to HTML conversion
- Permission check logic

### Component Tests

- HTMLDescription rendering
- MarkdownEditor functionality
- Form submission flow

### E2E Tests

- Complete settings update flow
- Permission denial for non-admin users
- Slug change and redirect

## Security Considerations

1. **XSS Prevention**
   - Backend sanitizes HTML before storage
   - Frontend trusts backend-sanitized HTML
   - No user HTML input rendered without processing

2. **Authorization**
   - Server-side permission checks
   - Token validation on every request
   - Role-based access control

3. **CSRF Protection**
   - SvelteKit's built-in CSRF protection
   - Form actions use POST method

## Performance

### Optimizations

- Lazy load markdown library
- Debounce preview updates
- Cache organization data with TanStack Query

### Bundle Size

- Marked library: ~40KB (consider dynamic import)
- Only load on settings page

## Migration Path

### Phase 1: Basic Implementation

1. Create HTMLDescription component
2. Enhance MarkdownEditor for HTML output
3. Create settings page with basic form

### Phase 2: Enhanced Features

1. Add city autocomplete
2. Add image upload for logo/cover
3. Add social media links

### Phase 3: Advanced Settings

1. Add member management
2. Add invitation settings
3. Add notification preferences

## Rollback Plan

If issues arise:

1. Remove settings link from navigation
2. Settings page returns 404
3. No data corruption (updates are atomic)
4. Existing organization data unaffected

## Monitoring

Track:

- Settings update success/failure rate
- Form validation error frequency
- Average time to complete form
- Which fields are most edited

## Documentation

### User Documentation

- Help text in form fields
- Markdown formatting guide
- Slug requirements explanation

### Developer Documentation

- Component API documentation
- Form validation rules
- API integration examples

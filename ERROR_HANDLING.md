# Error Handling Guide

This document describes the comprehensive error handling system implemented in the Revel frontend application.

## Overview

All API errors (4xx and 5xx) are now handled globally with user-facing toast notifications. The system automatically extracts error messages from various API response formats and displays them to users in a consistent, user-friendly way.

## Architecture

### 1. Global Error Handler Utility

**Location:** `src/lib/utils/errors.ts`

The `extractErrorMessage()` function is the core of our error handling system. It handles:

- **API response errors** with `detail`, `message`, or `error` fields
- **Network errors** (offline, timeout, connection failures)
- **Generic JavaScript errors**
- **HTTP status codes** with user-friendly messages

#### Supported Backend Error Formats

The backend can return errors in various formats, all of which are handled:

```typescript
// Format 1: detail as string (most common)
{ detail: "User with this email already exists" }

// Format 2: detail as validation error array
{ detail: [{ msg: "Email is required", type: "value_error" }] }

// Format 3: message field
{ message: "Authentication failed" }

// Format 4: error field
{ error: "Invalid token" }

// Format 5: errors object (form validation)
{ errors: { email: ["Invalid email format"], password: ["Too short"] } }
```

#### Usage Example

```typescript
import { extractErrorMessage } from '$lib/utils/errors';

try {
	await api.someEndpoint();
} catch (error) {
	const message = extractErrorMessage(error);
	toast.error(message);
}
```

### 2. Global TanStack Query Error Handling

**Location:** `src/routes/+layout.svelte`

All TanStack Query operations (queries and mutations) have global error handlers configured:

```typescript
const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			onError: (error: unknown) => {
				if (isAuthError(error)) return; // Skip 401/403 (handled by auth interceptor)

				const message = extractErrorMessage(error);
				toast.error('Error loading data', { description: message });
			}
		},
		mutations: {
			onError: (error: unknown) => {
				if (isAuthError(error)) return; // Skip 401/403 (handled by auth interceptor)

				const message = extractErrorMessage(error);
				toast.error('Action failed', { description: message });
			}
		}
	}
});
```

#### What This Means

- **Every query failure** automatically shows a toast notification
- **Every mutation failure** automatically shows a toast notification
- **No need to add error handling** to individual queries/mutations (unless you want custom behavior)
- **Auth errors (401/403)** are handled separately by the auth interceptor (automatic token refresh)

### 3. Toast Notification System

**Library:** `svelte-sonner`
**Location:** `src/routes/+layout.svelte` (Toaster component)
**Position:** Top-right corner
**Features:** Rich colors, auto-dismiss, action buttons

## Usage Patterns

### Pattern 1: Relying on Global Error Handler (Recommended)

For most queries and mutations, you don't need to add any error handling:

```typescript
// ✅ GOOD: Let global handler take care of errors
const eventsQuery = createQuery({
	queryKey: ['events'],
	queryFn: () => api.events.listEvents()
	// No onError needed!
});

const mutation = createMutation({
	mutationFn: async (data) => api.events.createEvent({ body: data }),
	onSuccess: () => {
		toast.success('Event created!');
		queryClient.invalidateQueries({ queryKey: ['events'] });
	}
	// No onError needed!
});
```

**When to use:**

- Standard CRUD operations
- List queries
- Detail queries
- Simple mutations

### Pattern 2: Custom Error Handling (Override Global)

If you need custom error behavior, you can override the global handler:

```typescript
// ✅ GOOD: Custom error handling for specific needs
const mutation = createMutation({
	mutationFn: async (data) => api.auth.login({ body: data }),
	onSuccess: () => {
		toast.success('Welcome back!');
	},
	onError: (error: unknown) => {
		// Custom error handling
		const message = extractErrorMessage(error);

		// Show custom toast
		toast.error('Login failed', {
			description: message,
			action: {
				label: 'Forgot password?',
				onClick: () => goto('/reset-password')
			}
		});

		// Track analytics
		analytics.track('login_failed', { error: message });
	}
});
```

**When to use:**

- Auth operations (custom error messages)
- Operations with specific error handling logic
- Operations that need analytics tracking
- Operations with custom retry logic

### Pattern 3: Inline Error State (For Form Validation)

For forms that need to show inline validation errors:

```typescript
let errorMessage = $state<string | null>(null);

const mutation = createMutation({
	mutationFn: async (data) => api.events.createEvent({ body: data }),
	onMutate: () => {
		errorMessage = null; // Clear previous errors
	},
	onSuccess: () => {
		toast.success('Event created!');
	},
	onError: (error: unknown) => {
		// Set inline error (global toast will also show)
		errorMessage = extractErrorMessage(error);
	}
});

// In template:
{
	#if errorMessage;
}
<div role="alert" class="text-destructive">{errorMessage}</div>;
{
	/if;
}
```

**When to use:**

- Form submissions
- Inline validation feedback
- Multi-step forms with error recovery

### Pattern 4: Disabling Global Error Handler

If you want to handle errors entirely yourself (rare):

```typescript
const mutation = createMutation({
	mutationFn: async (data) => api.events.createEvent({ body: data }),
	onError: () => {
		// Do nothing - suppress global handler
	}
	// Or provide your own complete error handling
});
```

**When to use:**

- Silent background operations
- Optimistic updates that you want to silently rollback
- Operations where errors are expected and not exceptional

## Server-Side Error Handling

Server-side API calls (in `+page.server.ts` files) follow a different pattern:

### Load Functions

```typescript
export const load = async ({ locals, params }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	try {
		const response = await api.events.getEvent({
			path: { event_id: params.id },
			headers: { Authorization: `Bearer ${locals.user.accessToken}` }
		});

		return {
			event: response.data
		};
	} catch (err) {
		console.error('Error loading event:', err);
		// Return error in load data (not thrown)
		return {
			error: extractErrorMessage(err, 'Failed to load event')
		};
	}
};
```

Then in the page component:

```typescript
<script lang="ts">
	import { page } from '$app/stores';

	const { data } = $props();

	// Show error if load failed
	$effect(() => {
		if (data.error) {
			toast.error('Error', { description: data.error });
		}
	});
</script>

{#if data.error}
	<ErrorAlert message={data.error} />
{:else if data.event}
	<EventDetail event={data.event} />
{/if}
```

### Form Actions

```typescript
export const actions = {
	create: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { errors: { form: 'Unauthorized' } });
		}

		try {
			const formData = await request.formData();
			const title = formData.get('title');

			const response = await api.events.createEvent({
				body: { title },
				headers: { Authorization: `Bearer ${locals.user.accessToken}` }
			});

			if (response.error) {
				return fail(400, {
					errors: { form: extractErrorMessage(response.error) }
				});
			}

			throw redirect(303, `/events/${response.data.slug}`);
		} catch (error) {
			if (isRedirect(error)) throw error;

			return fail(500, {
				errors: { form: extractErrorMessage(error) }
			});
		}
	}
};
```

## Error Types

### 1. API Response Errors (4xx, 5xx)

**Examples:**

- `400 Bad Request` - "Bad request. Please check your input and try again."
- `401 Unauthorized` - Handled by auth interceptor (automatic token refresh)
- `403 Forbidden` - "Forbidden. You do not have permission to perform this action."
- `404 Not Found` - "Resource not found."
- `422 Validation Error` - "Validation error. Please check your input."
- `500 Internal Server Error` - "Server error. Please try again later."

**Backend message takes precedence:**

If the backend provides a `detail` or `message` field, that will be shown instead of the generic status message.

### 2. Network Errors

**Examples:**

- "Network error. Please check your internet connection and try again."
- "Request timed out. Please try again."

**When they occur:**

- User is offline
- Backend is unreachable
- Request takes too long (timeout)
- DNS resolution fails

### 3. Validation Errors

**Backend format:**

```json
{
	"detail": [
		{ "msg": "Email is required", "type": "value_error.missing" },
		{ "msg": "Password must be at least 8 characters", "type": "value_error.str.min_length" }
	]
}
```

**Displayed as:**

"Email is required, Password must be at least 8 characters"

## Testing Error Handling

### Manual Testing Scenarios

1. **Simulate offline mode:**

   - Open DevTools → Network tab → Set to "Offline"
   - Try to load data or submit a form
   - Verify: "Network error. Please check your internet connection" toast appears

2. **Simulate 500 error:**

   - Modify backend to return 500 for an endpoint
   - Trigger that endpoint
   - Verify: "Server error. Please try again later." toast appears

3. **Simulate validation error:**

   - Submit a form with invalid data
   - Verify: Specific validation error messages appear

4. **Simulate 401 error:**

   - Manually expire your access token
   - Make an API call
   - Verify: Token refresh happens automatically, no error toast

5. **Simulate backend error message:**
   - Backend returns `{ detail: "Custom error message" }`
   - Verify: "Custom error message" appears in toast

### Automated Testing

```typescript
import { describe, it, expect, vi } from 'vitest';
import { extractErrorMessage } from '$lib/utils/errors';

describe('extractErrorMessage', () => {
	it('extracts detail string', () => {
		const error = { detail: 'User already exists' };
		expect(extractErrorMessage(error)).toBe('User already exists');
	});

	it('extracts detail array', () => {
		const error = {
			detail: [
				{ msg: 'Field required' },
				{ msg: 'Invalid format' }
			]
		};
		expect(extractErrorMessage(error)).toBe('Field required, Invalid format');
	});

	it('handles network errors', () => {
		const error = new Error('Failed to fetch');
		expect(extractErrorMessage(error)).toContain('Network error');
	});

	it('returns fallback for unknown errors', () => {
		const error = {};
		expect(extractErrorMessage(error)).toBe('An unexpected error occurred. Please try again.');
	});
});
```

## Migration Guide

### Before (Old Code)

```typescript
// ❌ OLD: No error handling
const mutation = createMutation({
	mutationFn: async (data) => api.events.createEvent({ body: data }),
	onSuccess: () => {
		toast.success('Created!');
	}
	// Error fails silently - BAD!
});
```

### After (New Code)

```typescript
// ✅ NEW: Automatic error handling via global config
const mutation = createMutation({
	mutationFn: async (data) => api.events.createEvent({ body: data }),
	onSuccess: () => {
		toast.success('Created!');
	}
	// Global error handler shows toast automatically - GOOD!
});
```

### If You Had Custom Error Handling

```typescript
// ⚠️ BEFORE: Manual error handling
const mutation = createMutation({
	mutationFn: async (data) => api.events.createEvent({ body: data }),
	onSuccess: () => {
		toast.success('Created!');
	},
	onError: (error: any) => {
		// Custom extraction logic
		const message = error?.detail || error?.message || 'Failed';
		toast.error(message);
	}
});

// ✅ AFTER: Use extractErrorMessage utility
import { extractErrorMessage } from '$lib/utils/errors';

const mutation = createMutation({
	mutationFn: async (data) => api.events.createEvent({ body: data }),
	onSuccess: () => {
		toast.success('Created!');
	},
	onError: (error: unknown) => {
		const message = extractErrorMessage(error);
		toast.error('Failed to create event', { description: message });
	}
});
```

## Best Practices

### ✅ DO

- **Rely on global error handler** for most operations
- **Use custom error handlers** for auth flows and special cases
- **Import and use `extractErrorMessage`** when you need custom error handling
- **Show success toasts** for mutations (errors are automatic)
- **Test error scenarios** manually and in automated tests
- **Keep error messages user-friendly** (no stack traces, no jargon)

### ❌ DON'T

- **Don't** suppress errors silently (unless intentional)
- **Don't** show generic "Error occurred" without details
- **Don't** add `onError` unless you need custom behavior
- **Don't** manually parse `error.detail` or `error.message` (use `extractErrorMessage`)
- **Don't** show technical error messages to users
- **Don't** forget to handle errors in server-side code (`+page.server.ts`)

## Future Enhancements

Potential improvements to consider:

1. **Error tracking integration** - Send errors to Sentry or similar service
2. **Retry UI** - Add "Retry" button to error toasts for transient failures
3. **Offline detection** - Show persistent banner when offline
4. **Error boundaries** - Catch React-style rendering errors in Svelte 5
5. **Structured logging** - Log errors with context for debugging

## Summary

With this error handling system:

- ✅ **All API errors** now show user-facing messages
- ✅ **Consistent error extraction** across the entire app
- ✅ **Global error handling** via TanStack Query config
- ✅ **Minimal boilerplate** for most operations
- ✅ **Customizable** when needed for specific use cases
- ✅ **Network errors** are handled gracefully
- ✅ **Auth errors** trigger automatic token refresh

**No more silent failures!** Users will always see meaningful error messages.

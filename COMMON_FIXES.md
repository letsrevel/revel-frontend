# Common Fixes and Patterns

This document tracks common issues encountered during development and their solutions to prevent recurring mistakes.

## TanStack Query with Svelte 5 Runes

### Issue: `store_invalid_shape` Error with createMutation/createQuery

**Error Message:**

```
Svelte error: store_invalid_shape
`confirmPaymentMutation` is not a store with a `subscribe` method
```

**Root Cause:**
In Svelte 5 with TanStack Query, `createMutation()` and `createQuery()` return **reactive objects**, not Svelte stores. They are already reactive and don't need the `$` prefix for auto-subscription.

**Incorrect Code:**

```svelte
<script lang="ts">
	import { createMutation } from '@tanstack/svelte-query';

	const myMutation = createMutation(() => ({
		mutationFn: async (data) => {
			// mutation logic
		}
	}));

	function handleSubmit() {
		// ❌ WRONG: Using $ prefix
		$myMutation.mutate(data);
	}
</script>

<button disabled={$myMutation.isPending}> Submit </button>
```

**Correct Code:**

```svelte
<script lang="ts">
	import { createMutation } from '@tanstack/svelte-query';

	const myMutation = createMutation(() => ({
		mutationFn: async (data) => {
			// mutation logic
		}
	}));

	function handleSubmit() {
		// ✅ CORRECT: No $ prefix
		myMutation.mutate(data);
	}
</script>

<button disabled={myMutation.isPending}> Submit </button>
```

**Key Points:**

- `createMutation()` returns a reactive object, not a store
- Access properties directly without `$` prefix: `mutation.isPending`, `mutation.error`, `mutation.data`
- Call methods directly: `mutation.mutate(data)`, `mutation.reset()`
- Same applies to `createQuery()`: use `query.data`, `query.isLoading`, etc.

**When to Use `$` Prefix:**

- **DO use** `$` for Svelte stores: `$page`, custom writable/readable stores
- **DO NOT use** `$` for TanStack Query objects: `createQuery`, `createMutation`, `useQueryClient`

**Related Files:**

- Fixed in: `/src/routes/(auth)/org/[slug]/admin/events/[event_id]/tickets/+page.svelte`
- Date: 2025-10-25

---

## Backend Status and Enum Values

### Issue: Case Sensitivity in Status Comparisons

**Root Cause:**
The backend uses **lowercase** values with **underscores** for enums (status, payment methods), but it's easy to mistakenly use uppercase values.

**Backend Values:**

**Ticket Status:**

- `'pending'` (not `'PENDING'`)
- `'active'` (not `'ACTIVE'`)
- `'checked_in'` (not `'CHECKED_IN'`)
- `'cancelled'` (not `'CANCELLED'`)

**Payment Methods:**

- `'online'` (not `'ONLINE'`)
- `'offline'` (not `'OFFLINE'`)
- `'at_the_door'` (not `'AT_THE_DOOR'`)
- `'free'` (not `'FREE'`)

**Correct Pattern:**

```typescript
// ✅ CORRECT: lowercase with underscores
if (ticket.status === 'pending') {
	/* ... */
}
if (ticket.status === 'checked_in') {
	/* ... */
}
if (tier.payment_method === 'at_the_door') {
	/* ... */
}

// ❌ WRONG: uppercase
if (ticket.status === 'PENDING') {
	/* ... */
}
if (ticket.status === 'CHECKED_IN') {
	/* ... */
}
if (tier.payment_method === 'AT_THE_DOOR') {
	/* ... */
}
```

**Best Practice:**
Always check the backend Django model `TextChoices` to confirm the exact string values being used.

**Related Files:**

- Backend model: `revel-backend/src/events/models/event.py` (Ticket.Status, TicketTier.PaymentMethod)
- Fixed in: `/src/routes/(auth)/org/[slug]/admin/events/[event_id]/tickets/+page.svelte`
- Date: 2025-10-25

---

## Future Common Issues

Add new common issues and their fixes here as they are discovered.

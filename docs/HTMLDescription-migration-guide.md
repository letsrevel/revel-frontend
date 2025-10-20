# HTMLDescription Component Migration Guide

This guide shows how to replace inline `{@html}` usage with the reusable `HTMLDescription` component across the codebase.

## Why Migrate?

- **Consistency:** Same typography and styling everywhere
- **Accessibility:** Built-in ARIA support and semantic HTML
- **Maintainability:** Update styles in one place
- **Type Safety:** TypeScript props validation
- **Null Handling:** Graceful handling of missing content

## Migration Pattern

### Before (Inline)

```svelte
<div class="prose prose-sm dark:prose-invert max-w-none">
	{@html event.description_html}
</div>
```

### After (Component)

```svelte
<script lang="ts">
	import HTMLDescription from '$lib/components/common/HTMLDescription.svelte';
</script>

<HTMLDescription html={event.description_html} />
```

## Files to Update

### 1. EventDetails.svelte

**Location:** `/src/lib/components/events/EventDetails.svelte`

**Lines 43-49 (Event Description):**

```svelte
<!-- BEFORE -->
{#if event.description_html}
	<section aria-labelledby="description-heading">
		<h2 id="description-heading" class="mb-3 text-xl font-semibold">About this event</h2>
		<div class="prose prose-sm dark:prose-invert max-w-none">
			{@html event.description_html}
		</div>
	</section>
{/if}

<!-- AFTER -->
<section aria-labelledby="description-heading">
	<h2 id="description-heading" class="mb-3 text-xl font-semibold">About this event</h2>
	<HTMLDescription html={event.description_html} ariaLabel="Event description" />
</section>
```

**Lines 169-179 (Invitation Message):**

```svelte
<!-- BEFORE -->
{#if event.event_type === 'private' && event.invitation_message_html}
	<section
		aria-labelledby="invitation-heading"
		class="rounded-lg border-2 border-primary/20 bg-primary/5 p-4"
	>
		<h2 id="invitation-heading" class="mb-2 text-lg font-semibold">Invitation Details</h2>
		<div class="prose prose-sm dark:prose-invert max-w-none">
			{@html event.invitation_message_html}
		</div>
	</section>
{/if}

<!-- AFTER -->
{#if event.event_type === 'private' && event.invitation_message_html}
	<section
		aria-labelledby="invitation-heading"
		class="rounded-lg border-2 border-primary/20 bg-primary/5 p-4"
	>
		<h2 id="invitation-heading" class="mb-2 text-lg font-semibold">Invitation Details</h2>
		<HTMLDescription html={event.invitation_message_html} ariaLabel="Invitation details" />
	</section>
{/if}
```

### 2. Organization Pages

Search for organization description rendering and replace with:

```svelte
<HTMLDescription html={organization.description_html} ariaLabel="Organization description" />
```

### 3. Other Event Components

Look for any other places using `{@html}` with description fields:

```bash
# Search for {@html} usage
grep -r "{@html" src/
```

Common patterns to replace:

- Event descriptions
- Organization descriptions
- Invitation messages
- Custom HTML fields

## Custom Styling Examples

### With Custom Typography Size

```svelte
<!-- Smaller text -->
<HTMLDescription html={content} class="prose-xs" />

<!-- Larger text on desktop -->
<HTMLDescription html={content} class="md:prose-base lg:prose-lg" />
```

### With Custom Spacing

```svelte
<HTMLDescription html={content} class="my-6" />
```

### With Borders/Highlighting

```svelte
<HTMLDescription
	html={event.special_notes_html}
	class="border-warning bg-warning/5 border-l-4 pl-4"
/>
```

## Testing After Migration

1. **Visual Test:** Verify all HTML content still renders correctly
2. **Dark Mode:** Check dark mode styling with `dark:prose-invert`
3. **Mobile:** Test on mobile viewports (prose is responsive)
4. **Accessibility:** Test with screen reader to verify ARIA labels work
5. **Null Handling:** Verify empty/null content doesn't render

## Checklist

- [ ] Add import to component: `import HTMLDescription from '$lib/components/common/HTMLDescription.svelte';`
- [ ] Replace inline `{@html}` with `<HTMLDescription html={...} />`
- [ ] Add `ariaLabel` prop for accessibility context
- [ ] Remove now-unused `{#if}` checks (component handles null internally)
- [ ] Test rendering, styling, and accessibility
- [ ] Update component tests if needed

## Notes

- The component automatically handles null/undefined/empty content
- No need for `{#if html}` checks anymore
- ARIA labels improve screen reader experience
- All prose styling is preserved
- Custom classes can override or extend defaults

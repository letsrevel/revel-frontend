# HTMLDescription Component

A reusable Svelte 5 component for safely displaying HTML content with proper typography and accessibility.

## Features

- ✅ Svelte 5 Runes syntax (`$state`, `$derived`)
- ✅ TypeScript strict mode types
- ✅ WCAG 2.1 AA accessibility (semantic HTML, ARIA labels)
- ✅ Mobile-first responsive design
- ✅ Tailwind prose typography classes
- ✅ Dark mode support
- ✅ Handles null/undefined/empty content gracefully
- ✅ Comprehensive test coverage

## Props

| Prop        | Type                          | Required | Default     | Description                            |
| ----------- | ----------------------------- | -------- | ----------- | -------------------------------------- |
| `html`      | `string \| null \| undefined` | Yes      | -           | HTML content to display safely         |
| `class`     | `string`                      | No       | `undefined` | Optional CSS classes for customization |
| `ariaLabel` | `string`                      | No       | `undefined` | ARIA label for screen readers          |

## Basic Usage

```svelte
<script lang="ts">
	import HTMLDescription from '$lib/components/common/HTMLDescription.svelte';

	let event = $state({
		description_html: '<p>Join us for an <strong>amazing</strong> event!</p>'
	});
</script>

<HTMLDescription html={event.description_html} />
```

## With Custom Classes

```svelte
<HTMLDescription
	html={organization.description_html}
	class="border-l-4 border-primary pl-4 text-sm"
/>
```

## With ARIA Label

```svelte
<HTMLDescription html={event.invitation_message_html} ariaLabel="Invitation details" />
```

## Usage in Event Details

Replace the inline prose div with the reusable component:

**Before:**

```svelte
{#if event.description_html}
	<section aria-labelledby="description-heading">
		<h2 id="description-heading" class="mb-3 text-xl font-semibold">About this event</h2>
		<div class="prose prose-sm dark:prose-invert max-w-none">
			{@html event.description_html}
		</div>
	</section>
{/if}
```

**After:**

```svelte
{#if event.description_html}
	<section aria-labelledby="description-heading">
		<h2 id="description-heading" class="mb-3 text-xl font-semibold">About this event</h2>
		<HTMLDescription html={event.description_html} ariaLabel="Event description" />
	</section>
{/if}
```

## Null/Empty Handling

The component gracefully handles missing or empty content:

```svelte
<!-- Nothing renders if html is null, undefined, or empty -->
<HTMLDescription html={null} />
<HTMLDescription html={undefined} />
<HTMLDescription html="" />
<HTMLDescription html="   " />
```

## Styling

The component uses Tailwind's prose classes for beautiful typography:

- `prose` - Base typography styles
- `prose-sm` - Smaller text size (mobile-first)
- `dark:prose-invert` - Dark mode support
- `max-w-none` - Allow full width (no max-width constraint)

You can override or extend these with the `class` prop:

```svelte
<!-- Larger text -->
<HTMLDescription html={content} class="prose-base md:prose-lg" />

<!-- Custom spacing -->
<HTMLDescription html={content} class="my-8" />

<!-- Custom borders -->
<HTMLDescription html={content} class="border-l-4 border-accent pl-6" />
```

## Accessibility

- Uses semantic `<div>` with `role="region"` for screen readers
- Optional `ariaLabel` prop for descriptive region labels
- All HTML content is properly exposed to assistive technologies
- Focus management handled by browser for links/interactive elements within HTML

## Testing

The component includes comprehensive tests:

```bash
pnpm test HTMLDescription
```

Tests cover:

- HTML rendering
- Custom class application
- ARIA label handling
- Null/undefined/empty handling
- Complex HTML structures
- Link handling
- Semantic structure

## Security Note

This component uses Svelte's `{@html}` directive, which should only be used with **trusted HTML content**.

In this project, HTML content comes from:

- Backend API (sanitized on server)
- Rich text editors (sanitized before saving)

Never use this component with user-provided HTML that hasn't been sanitized!

# MarkdownContent Component

A reusable Svelte 5 component for rendering markdown content with proper typography and accessibility.

## Features

- ✅ Svelte 5 Runes syntax (`$state`, `$derived`)
- ✅ TypeScript strict mode types
- ✅ WCAG 2.1 AA accessibility (semantic HTML, ARIA labels)
- ✅ Mobile-first responsive design
- ✅ Tailwind prose typography classes
- ✅ Dark mode support
- ✅ Handles null/undefined/empty content gracefully
- ✅ Uses `marked` library for GFM (GitHub Flavored Markdown)
- ✅ Supports both block and inline markdown rendering

## Props

| Prop        | Type                          | Required | Default     | Description                                   |
| ----------- | ----------------------------- | -------- | ----------- | --------------------------------------------- |
| `content`   | `string \| null \| undefined` | Yes      | -           | Markdown content to render                    |
| `class`     | `string`                      | No       | `undefined` | Optional CSS classes for customization        |
| `ariaLabel` | `string`                      | No       | `undefined` | ARIA label for screen readers                 |
| `inline`    | `boolean`                     | No       | `false`     | Render inline markdown (no block elements)    |

## Basic Usage

```svelte
<script lang="ts">
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';

	let event = $state({
		description: 'Join us for an **amazing** event!\n\nWe will have:\n- Great food\n- Live music\n- Fun activities'
	});
</script>

<MarkdownContent content={event.description} />
```

## With Custom Classes

```svelte
<MarkdownContent
	content={organization.description}
	class="border-l-4 border-primary pl-4 text-sm"
/>
```

## With ARIA Label

```svelte
<MarkdownContent content={event.invitation_message} ariaLabel="Invitation details" />
```

## Inline Rendering

For content that should not contain block elements (like paragraphs):

```svelte
<!-- Inline mode - renders without wrapping <p> tags -->
<MarkdownContent content="**Bold** and *italic* text" inline={true} />
```

## Usage in Event Details

```svelte
{#if event.description}
	<section aria-labelledby="description-heading">
		<h2 id="description-heading" class="mb-3 text-xl font-semibold">About this event</h2>
		<MarkdownContent content={event.description} ariaLabel="Event description" />
	</section>
{/if}
```

## Null/Empty Handling

The component gracefully handles missing or empty content:

```svelte
<!-- Nothing renders if content is null, undefined, or empty -->
<MarkdownContent content={null} />
<MarkdownContent content={undefined} />
<MarkdownContent content="" />
<MarkdownContent content="   " />
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
<MarkdownContent content={content} class="prose-base md:prose-lg" />

<!-- Custom spacing -->
<MarkdownContent content={content} class="my-8" />

<!-- Custom borders -->
<MarkdownContent content={content} class="border-l-4 border-accent pl-6" />
```

## Markdown Features

The component supports GitHub Flavored Markdown (GFM):

- **Bold** and *italic* text
- [Links](https://example.com)
- `inline code` and code blocks
- Lists (ordered and unordered)
- Blockquotes
- Line breaks (double newline for paragraphs)

## Accessibility

- Uses semantic `<div>` with `role="region"` for screen readers
- Optional `ariaLabel` prop for descriptive region labels
- All rendered content is properly exposed to assistive technologies
- Focus management handled by browser for links/interactive elements

## Stripping Markdown for Plain Text

When you need plain text (e.g., for SEO meta tags or card previews), use the `stripMarkdown` utility:

```typescript
import { stripMarkdown } from '$lib/utils/seo';

const plainText = stripMarkdown(event.description);
// "Join us for an amazing event! We will have: Great food Live music Fun activities"
```

## Testing

The component includes comprehensive tests:

```bash
pnpm test MarkdownContent
```

## Migration from HTMLDescription

This component replaces the old `HTMLDescription` component. The backend now returns sanitized markdown instead of pre-rendered HTML:

**Before (deprecated):**

```svelte
<HTMLDescription html={event.description_html} />
```

**After:**

```svelte
<MarkdownContent content={event.description} />
```

## Security Note

This component uses Svelte's `{@html}` directive to render the parsed markdown. The content is safe because:

1. The backend sanitizes all markdown content before storing
2. The `marked` library converts markdown to HTML without executing scripts
3. Potentially dangerous HTML in the source markdown is escaped

The markdown content comes from trusted sources (backend API) that sanitize input before saving.

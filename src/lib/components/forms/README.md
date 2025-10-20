# Form Components

Reusable form components for the Revel Frontend project. All components are built with Svelte 5 Runes, TypeScript, and WCAG 2.1 AA accessibility standards.

## Components

### DateTimePicker

A mobile-friendly datetime picker using native HTML5 input with validation and constraints.

**Usage:**

```svelte
<script lang="ts">
	import { DateTimePicker } from '$lib/components/forms';

	let eventStartTime = $state('');
</script>

<DateTimePicker
	bind:value={eventStartTime}
	label="Event Start Time"
	required
	min={new Date().toISOString()}
	error={errors?.startTime}
/>
```

**Props:**

- `value` - ISO 8601 datetime string (bindable)
- `label` - Label text
- `required` - Whether field is required
- `disabled` - Whether field is disabled
- `min` - Minimum allowed datetime (ISO 8601)
- `max` - Maximum allowed datetime (ISO 8601)
- `error` - Error message to display
- `placeholder` - Placeholder text
- `onValueChange` - Callback when value changes

### MarkdownEditor

A textarea with markdown preview and formatting toolbar.

**Usage:**

```svelte
<script lang="ts">
	import { MarkdownEditor } from '$lib/components/forms';

	let description = $state('');
</script>

<MarkdownEditor
	bind:value={description}
	label="Event Description"
	placeholder="Describe your event..."
	rows={8}
	error={errors?.description}
/>
```

**Props:**

- `value` - Markdown content (bindable)
- `label` - Label text
- `required` - Whether field is required
- `disabled` - Whether field is disabled
- `rows` - Number of textarea rows (default: 6)
- `error` - Error message to display
- `placeholder` - Placeholder text
- `onValueChange` - Callback when value changes

**Features:**

- Live preview toggle
- Formatting toolbar (bold, italic, links, lists)
- Safe HTML rendering (XSS prevention)
- Markdown syntax support

### ImageUploader

Drag-and-drop image uploader with preview and validation.

**Usage:**

```svelte
<script lang="ts">
	import { ImageUploader } from '$lib/components/forms';

	let eventImage = $state<File | null>(null);
</script>

<ImageUploader
	bind:value={eventImage}
	preview={existingImageUrl}
	label="Event Banner"
	maxSize={5 * 1024 * 1024}
	error={errors?.image}
/>
```

**Props:**

- `value` - Selected file (bindable)
- `preview` - URL for preview (existing image)
- `label` - Label text
- `required` - Whether field is required
- `disabled` - Whether field is disabled
- `accept` - Accepted file types (default: 'image/jpeg,image/png,image/webp')
- `maxSize` - Maximum file size in bytes (default: 5MB)
- `error` - Error message to display
- `onFileSelect` - Callback when file is selected

**Features:**

- Drag-and-drop support
- Click to browse
- Mobile camera access
- File type validation
- File size validation
- Image preview with remove button

### TagInput

Input field with autocomplete for managing tags.

**Usage:**

```svelte
<script lang="ts">
	import { TagInput } from '$lib/components/forms';

	let eventTags = $state<string[]>([]);
	const tagSuggestions = ['Music', 'Food', 'Sports', 'Art', 'Technology'];
</script>

<TagInput
	bind:value={eventTags}
	suggestions={tagSuggestions}
	label="Event Tags"
	placeholder="Add tags..."
	maxTags={5}
	error={errors?.tags}
/>
```

**Props:**

- `value` - Array of selected tag strings (bindable)
- `suggestions` - Autocomplete suggestions
- `label` - Label text
- `required` - Whether field is required
- `disabled` - Whether field is disabled
- `maxTags` - Maximum number of tags allowed
- `error` - Error message to display
- `placeholder` - Placeholder text
- `onTagsChange` - Callback when tags change

**Features:**

- Enter or comma to add tag
- Backspace to remove last tag
- Delete key to remove tag from chip
- Autocomplete with keyboard navigation
- Prevents duplicate tags
- Max tags limit

## Accessibility

All components meet WCAG 2.1 AA standards:

- ✅ Semantic HTML
- ✅ Keyboard navigation
- ✅ ARIA labels and roles
- ✅ Focus indicators
- ✅ Error announcements
- ✅ Screen reader support

## Mobile Support

All components are mobile-friendly:

- ✅ Touch-friendly hit areas
- ✅ Native mobile inputs where applicable
- ✅ Responsive design
- ✅ Camera access (ImageUploader)

## Testing

Each component has comprehensive tests covering:

- Rendering with props
- User interactions
- Keyboard navigation
- Accessibility
- Error states
- Edge cases

Run tests with:

```bash
pnpm test src/lib/components/forms
```

## Examples

See individual test files for usage examples and edge cases.

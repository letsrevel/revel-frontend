import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import MarkdownContent from './MarkdownContent.svelte';

describe('MarkdownContent', () => {
	it('demotes markdown headings one level so pages keep a single h1', () => {
		const { container } = render(MarkdownContent, {
			props: { content: '# Top\n\n## Section\n\ntext' }
		});

		expect(container.querySelector('h1')).toBeNull();
		expect(container.querySelector('h2')?.textContent).toBe('Top');
		expect(container.querySelector('h3')?.textContent).toBe('Section');
	});

	it('caps demotion at h6', () => {
		const { container } = render(MarkdownContent, {
			props: { content: '###### Deep' }
		});

		expect(container.querySelector('h6')?.textContent).toBe('Deep');
	});

	it('still renders plain markdown content', () => {
		const { container } = render(MarkdownContent, {
			props: { content: 'Hello **world**' }
		});

		expect(container.querySelector('strong')?.textContent).toBe('world');
	});
});

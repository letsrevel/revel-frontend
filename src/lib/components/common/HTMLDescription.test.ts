import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import HTMLDescription from './HTMLDescription.svelte';

describe('HTMLDescription', () => {
	it('renders HTML content correctly', () => {
		const html = '<p>This is a <strong>test</strong> description.</p>';
		render(HTMLDescription, {
			props: { html }
		});

		// Check that the HTML is rendered
		expect(screen.getByText(/This is a/)).toBeInTheDocument();
		expect(screen.getByText('test')).toBeInTheDocument();
	});

	it('applies prose classes for typography', () => {
		const html = '<p>Test content</p>';
		const { container } = render(HTMLDescription, {
			props: { html }
		});

		const wrapper = container.querySelector('.prose');
		expect(wrapper).toBeInTheDocument();
		expect(wrapper).toHaveClass('prose-sm', 'dark:prose-invert', 'max-w-none');
	});

	it('accepts custom classes via class prop', () => {
		const html = '<p>Test content</p>';
		const { container } = render(HTMLDescription, {
			props: {
				html,
				class: 'text-lg custom-class'
			}
		});

		const wrapper = container.querySelector('.prose');
		expect(wrapper).toHaveClass('text-lg', 'custom-class');
	});

	it('applies ARIA label when provided', () => {
		const html = '<p>Test content</p>';
		render(HTMLDescription, {
			props: {
				html,
				ariaLabel: 'Event description'
			}
		});

		const region = screen.getByRole('region', { name: 'Event description' });
		expect(region).toBeInTheDocument();
	});

	it('does not render when html is null', () => {
		const { container } = render(HTMLDescription, {
			props: { html: null }
		});

		expect(container.querySelector('.prose')).not.toBeInTheDocument();
	});

	it('does not render when html is undefined', () => {
		const { container } = render(HTMLDescription, {
			props: { html: undefined }
		});

		expect(container.querySelector('.prose')).not.toBeInTheDocument();
	});

	it('does not render when html is empty string', () => {
		const { container } = render(HTMLDescription, {
			props: { html: '' }
		});

		expect(container.querySelector('.prose')).not.toBeInTheDocument();
	});

	it('does not render when html is only whitespace', () => {
		const { container } = render(HTMLDescription, {
			props: { html: '   \n\t   ' }
		});

		expect(container.querySelector('.prose')).not.toBeInTheDocument();
	});

	it('renders complex HTML with multiple elements', () => {
		const html = `
			<h2>Event Details</h2>
			<p>Join us for an amazing event!</p>
			<ul>
				<li>Great food</li>
				<li>Amazing music</li>
				<li>Fun activities</li>
			</ul>
		`;

		render(HTMLDescription, {
			props: { html }
		});

		expect(screen.getByText('Event Details')).toBeInTheDocument();
		expect(screen.getByText('Join us for an amazing event!')).toBeInTheDocument();
		expect(screen.getByText('Great food')).toBeInTheDocument();
		expect(screen.getByText('Amazing music')).toBeInTheDocument();
		expect(screen.getByText('Fun activities')).toBeInTheDocument();
	});

	it('handles HTML with links', () => {
		const html = '<p>Visit <a href="https://example.com">our website</a> for more info.</p>';
		render(HTMLDescription, {
			props: { html }
		});

		const link = screen.getByRole('link', { name: 'our website' });
		expect(link).toBeInTheDocument();
		expect(link).toHaveAttribute('href', 'https://example.com');
	});

	it('has proper semantic structure', () => {
		const html = '<p>Test content</p>';
		render(HTMLDescription, {
			props: { html }
		});

		// Should have region role for accessibility
		const region = screen.getByRole('region');
		expect(region).toBeInTheDocument();
	});

	it('renders without ARIA label when not provided', () => {
		const html = '<p>Test content</p>';
		const { container } = render(HTMLDescription, {
			props: { html }
		});

		const region = container.querySelector('[role="region"]');
		expect(region).toBeInTheDocument();
		expect(region).not.toHaveAttribute('aria-label');
	});
});

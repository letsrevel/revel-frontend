import { render, screen, within } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import TicketComplianceLines from './TicketComplianceLines.svelte';

describe('TicketComplianceLines', () => {
	it('renders every line as a term/definition pair, unknown keys included', () => {
		render(TicketComplianceLines, {
			props: {
				lines: [
					{ key: 'organizer', label: 'Organizer', value: 'Compliance IT Legal Entity' },
					{ key: 'price', label: 'Price', value: 'Free' },
					{ key: 'xx_future', label: 'Future line', value: 'Something new' }
				]
			}
		});
		const list = screen.getByTestId('ticket-compliance-lines');
		expect(
			within(list)
				.getAllByRole('term')
				.map((t) => t.textContent)
		).toEqual(['Organizer', 'Price', 'Future line']);
		expect(within(list).getByText('Something new')).toBeInTheDocument();
	});

	it('gives sentence lines the full row', () => {
		render(TicketComplianceLines, {
			props: {
				lines: [
					{ key: 'price', label: 'Price', value: 'EUR 10.00' },
					{ key: 'notice', label: 'Notice', value: 'This ticket is not a tax invoice or receipt.' }
				]
			}
		});
		const list = screen.getByTestId('ticket-compliance-lines');
		expect(list.querySelector('[data-key="notice"]')?.className).toContain('sm:col-span-2');
		expect(list.querySelector('[data-key="price"]')?.className).not.toContain('sm:col-span-2');
	});

	it('renders nothing without lines', () => {
		const { container } = render(TicketComplianceLines, { props: { lines: [] } });
		expect(container.querySelector('section')).toBeNull();
	});
});

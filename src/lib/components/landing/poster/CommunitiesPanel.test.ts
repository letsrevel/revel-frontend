import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import CommunitiesPanel from './CommunitiesPanel.svelte';
import * as m from '$lib/paraglide/messages.js';

describe('CommunitiesPanel', () => {
	it('renders headline, pills, and the questionnaire mock', () => {
		render(CommunitiesPanel);
		expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
		expect(screen.getByText(m['home.poster.communitiesPill1']())).toBeInTheDocument();
		expect(screen.getByRole('img', { name: m['home.poster.qMockAria']() })).toBeInTheDocument();
	});
});

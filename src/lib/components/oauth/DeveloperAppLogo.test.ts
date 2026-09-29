import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OAuthAppSchema } from '$lib/api/generated/types.gen';
import DeveloperAppLogo from './DeveloperAppLogo.svelte';

vi.mock('$lib/components/common/ImageCropperModal.svelte', async () => ({
	default: (await import('../forms/__mocks__/CropperModalStub.svelte')).default
}));

function app(overrides: Partial<OAuthAppSchema> = {}): OAuthAppSchema {
	return {
		registration_source: 'manual',
		id: 'app-1',
		client_id: 'cid-1',
		name: 'Acme',
		description: '',
		client_type: 'public',
		allowed_scopes: ['openid'],
		homepage_url: '',
		privacy_policy_url: '',
		verified: false,
		is_active: true,
		redirect_uris: ['https://example.com/cb'],
		last_used_at: null,
		logo_url: null,
		connections_count: 0,
		...overrides
	};
}

function selectFile() {
	const input = document.querySelector('input[type="file"]') as HTMLInputElement;
	const file = new File(['x'], 'logo.png', { type: 'image/png' });
	Object.defineProperty(input, 'files', { value: [file], configurable: true });
	fireEvent.change(input);
}

describe('DeveloperAppLogo', () => {
	beforeEach(() => {
		global.FileReader = class {
			readAsDataURL = vi.fn();
			onloadend: (() => void) | null = null;
			result = 'data:image/png;base64,test';
		} as unknown as typeof FileReader;
	});

	it('is a labelled section with a named file input', () => {
		render(DeveloperAppLogo, { props: { app: app(), onUpload: vi.fn() } });
		expect(screen.getByRole('region', { name: 'Logo' })).toBeInTheDocument();
		expect(screen.getByLabelText('Logo', { selector: 'input' })).toHaveAttribute('type', 'file');
	});

	it('routes the pick through the square cropper, then uploads the cropped file', async () => {
		const onUpload = vi.fn();
		render(DeveloperAppLogo, { props: { app: app(), onUpload } });
		selectFile();
		(await screen.findByTestId('cropper-save')).click();
		await vi.waitFor(() => expect(onUpload).toHaveBeenCalledOnce());
		expect(onUpload.mock.calls[0][0]).toBeInstanceOf(File);
	});

	it('shows the current logo as the preview', () => {
		render(DeveloperAppLogo, {
			props: { app: app({ logo_url: 'https://api.example.com/logo.png' }), onUpload: vi.fn() }
		});
		expect(screen.getByRole('img')).toHaveAttribute('src', 'https://api.example.com/logo.png');
	});

	it('announces an upload failure and the in-flight state', () => {
		render(DeveloperAppLogo, {
			props: { app: app(), onUpload: vi.fn(), uploading: true, error: 'Nope' }
		});
		expect(screen.getByRole('alert')).toHaveTextContent('Nope');
		expect(screen.getByRole('status')).toBeInTheDocument();
	});
});

// {brand} in attendee-path i18n strings (#1059): resolved to the org on a tenant
// host and "Revel" elsewhere; account/legal copy keeps a literal "Revel".
import { describe, it, expect } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import { locales } from '$lib/paraglide/runtime.js';
import { brandName } from './tenant';
import type { TenantOrganizationSchema } from '$lib/api/generated/types.gen';
import en from '../../../messages/en.json';

const tenant = { id: 'o1', name: '  Acme Club  ' } as TenantOrganizationSchema;

describe('brandName', () => {
	it('is the trimmed org name on a tenant host', () => {
		expect(brandName(tenant)).toBe('Acme Club');
	});
	it('is Revel on the platform host', () => {
		expect(brandName(null)).toBe('Revel');
		expect(brandName(undefined)).toBe('Revel');
	});
	it('falls back to Revel for a blank org name', () => {
		expect(brandName({ ...tenant, name: '   ' })).toBe('Revel');
	});
});

describe('brand-parameterized messages', () => {
	const messages = [
		(brand: string, locale: string) => m['checkEmailPage.title']({ brand }, { locale }),
		(brand: string, locale: string) => m['register.joinRevel']({ brand }, { locale }),
		(brand: string, locale: string) => m['register.demoNudgeBody']({ brand }, { locale }),
		(brand: string, locale: string) => m['confirmEmailChange.confirm_intro']({ brand }, { locale }),
		(brand: string, locale: string) =>
			m['confirmEmailChange.confirm_warningBullet1']({ brand }, { locale }),
		(brand: string, locale: string) =>
			m['accountSettingsPage.pageDescription']({ brand }, { locale }),
		(brand: string, locale: string) => m['unsubscribePage.subtitle']({ brand }, { locale }),
		(brand: string, locale: string) => m['profilePage.pageTitle']({ brand }, { locale }),
		(brand: string, locale: string) => m['compliance.checkout.reservation']({ brand }, { locale })
	];

	it.each(locales.map((l) => [l]))(
		'renders the org name and never a literal {brand} in %s',
		(locale) => {
			for (const render of messages) {
				const out = render('Acme Club', locale);
				expect(out).toContain('Acme Club');
				expect(out).not.toContain('{brand}');
				expect(out).not.toContain('Revel');
			}
		}
	);

	it('renders Revel on the platform and the org on a tenant host', () => {
		expect(m['checkEmailPage.title']({ brand: brandName(null) }, { locale: 'en' })).toBe(
			'Check Your Email - Revel'
		);
		expect(m['profilePage.pageTitle']({ brand: brandName(tenant) }, { locale: 'en' })).toBe(
			'Profile - Acme Club'
		);
	});

	it('keeps the account copy on Revel (not parameterized)', () => {
		expect(en['resetPasswordPage.metaDescription']).toBe(
			'Set a new password for your Revel account'
		);
	});
});

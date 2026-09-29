import { describe, it, expect } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import type { OAuthAppSchema } from '$lib/api/generated/types.gen';
import {
	appFormSchema,
	diffForPatch,
	fieldErrorsFrom,
	isLoopbackHost,
	redirectUriError,
	removedScopes,
	valuesFromApp,
	type AppFormValues
} from './oauth-app-form';

function app(overrides: Partial<OAuthAppSchema> = {}): OAuthAppSchema {
	return {
		id: 'app-1',
		client_id: 'cid',
		name: 'Acme',
		description: 'Plans things.',
		client_type: 'public',
		allowed_scopes: ['openid', 'org:read', 'org:events'],
		redirect_uris: ['https://acme.example/cb'],
		homepage_url: 'https://acme.example',
		privacy_policy_url: '',
		verified: false,
		is_active: true,
		last_used_at: null,
		logo_url: null,
		registration_source: 'manual',
		connections_count: 0,
		...overrides
	};
}

const base: AppFormValues = valuesFromApp(app());

describe('isLoopbackHost', () => {
	it('accepts localhost, 127.0.0.1 and [::1] only', () => {
		expect(isLoopbackHost('localhost')).toBe(true);
		expect(isLoopbackHost('127.0.0.1')).toBe(true);
		expect(isLoopbackHost('[::1]')).toBe(true);
		expect(isLoopbackHost('acme.example')).toBe(false);
		expect(isLoopbackHost('localhost.evil')).toBe(false);
	});
});

describe('redirectUriError', () => {
	it('accepts https for both client types and http loopback for public only', () => {
		expect(redirectUriError('https://acme.example/cb', 'public')).toBeNull();
		expect(redirectUriError('https://acme.example/cb', 'confidential')).toBeNull();
		expect(redirectUriError('http://127.0.0.1:47123/cb', 'public')).toBeNull();
		expect(redirectUriError('http://localhost:3000/cb', 'public')).toBeNull();
		expect(redirectUriError('http://[::1]:3000/cb', 'public')).toBeNull();
		expect(redirectUriError('http://127.0.0.1:47123/cb', 'confidential')).toBeTruthy();
	});

	it('rejects fragments, non-loopback http, other schemes and garbage', () => {
		expect(redirectUriError('https://acme.example/cb#frag', 'public')).toBeTruthy();
		expect(redirectUriError('http://acme.example/cb', 'public')).toBeTruthy();
		expect(redirectUriError('ftp://acme.example/cb', 'public')).toBeTruthy();
		expect(redirectUriError('not a url', 'public')).toBeTruthy();
		expect(redirectUriError('', 'public')).toBeTruthy();
	});

	it('rejects inner whitespace, which new URL would silently percent-encode', () => {
		const invalid = m['oauth.developer.validation.uriInvalid']();
		expect(() => new URL('https://example.com/cb one')).not.toThrow();
		expect(redirectUriError('https://example.com/cb one', 'public')).toBe(invalid);
		expect(redirectUriError('https://example.com/cb\tone', 'confidential')).toBe(invalid);
		expect(redirectUriError('https://example.com/cb\nhttps://evil.example/cb', 'public')).toBe(
			invalid
		);
	});

	it('the schema still trims outer whitespace before validating each URI', () => {
		const inner = appFormSchema('public').safeParse({
			...base,
			redirect_uris: ['https://example.com/cb one']
		});
		expect(inner.success).toBe(false);
		const outer = appFormSchema('public').safeParse({
			...base,
			redirect_uris: ['  https://acme.example/cb  ']
		});
		expect(outer.success).toBe(true);
	});
});

describe('appFormSchema', () => {
	it('accepts a valid public app', () => {
		expect(appFormSchema('public').safeParse(base).success).toBe(true);
	});

	it('requires a name and caps lengths', () => {
		expect(appFormSchema('public').safeParse({ ...base, name: '  ' }).success).toBe(false);
		expect(appFormSchema('public').safeParse({ ...base, name: 'x'.repeat(256) }).success).toBe(
			false
		);
		expect(
			appFormSchema('public').safeParse({ ...base, description: 'x'.repeat(2001) }).success
		).toBe(false);
	});

	it('requires 1..10 unique valid redirect URIs, reported per row', () => {
		expect(appFormSchema('public').safeParse({ ...base, redirect_uris: [] }).success).toBe(false);
		expect(
			appFormSchema('public').safeParse({
				...base,
				redirect_uris: Array(11).fill('https://a.example/cb')
			}).success
		).toBe(false);
		const dup = appFormSchema('public').safeParse({
			...base,
			redirect_uris: ['https://a.example/cb', 'https://a.example/cb']
		});
		expect(dup.success).toBe(false);
		const bad = appFormSchema('confidential').safeParse({
			...base,
			redirect_uris: ['https://a.example/cb', 'http://127.0.0.1/cb']
		});
		expect(bad.success).toBe(false);
		if (!bad.success) expect(bad.error.issues[0].path).toEqual(['redirect_uris', 1]);
	});

	it('requires org:read alongside any other org scope', () => {
		const r = appFormSchema('public').safeParse({
			...base,
			allowed_scopes: ['openid', 'org:events']
		});
		expect(r.success).toBe(false);
		if (!r.success) expect(r.error.issues[0].path).toEqual(['allowed_scopes']);
		expect(
			appFormSchema('public').safeParse({ ...base, allowed_scopes: ['openid', 'me:read'] }).success
		).toBe(true);
	});

	it('allows empty optional URLs and rejects malformed ones', () => {
		expect(
			appFormSchema('public').safeParse({ ...base, homepage_url: '', privacy_policy_url: '' })
				.success
		).toBe(true);
		expect(appFormSchema('public').safeParse({ ...base, homepage_url: 'nope' }).success).toBe(
			false
		);
	});
});

describe('diffForPatch', () => {
	it('sends only changed keys, never client_type, never null', () => {
		expect(diffForPatch(base, base)).toEqual({});
		expect(diffForPatch(base, { ...base, description: 'New' })).toEqual({ description: 'New' });
		expect(diffForPatch(base, { ...base, homepage_url: '' })).toEqual({ homepage_url: '' });
		expect(
			diffForPatch(base, { ...base, allowed_scopes: ['openid', 'org:read', 'org:events'] })
		).toEqual({});
		expect(
			diffForPatch(base, { ...base, allowed_scopes: ['org:read', 'openid', 'org:events'] })
		).toEqual({});
		expect(diffForPatch(base, { ...base, allowed_scopes: [] })).toEqual({ allowed_scopes: [] });
		expect(diffForPatch(base, { ...base, client_type: 'confidential' })).toEqual({});
	});
});

describe('removedScopes', () => {
	it('lists every current scope missing from the next set (not only subsets)', () => {
		expect(removedScopes(['a', 'b'], ['a', 'b'])).toEqual([]);
		expect(removedScopes(['a', 'b'], ['a'])).toEqual(['b']);
		expect(removedScopes(['a', 'b'], ['a', 'c'])).toEqual(['b']);
		expect(removedScopes(['a'], ['a', 'b'])).toEqual([]);
	});
});

describe('fieldErrorsFrom', () => {
	it('maps a 400 {errors} body onto fields, __all__ onto the form', () => {
		expect(
			fieldErrorsFrom({
				errors: { redirect_uris: ['Bad URI'], name: 'Too long', __all__: ['Nope'] }
			})
		).toEqual({
			fields: { redirect_uris: 'Bad URI', name: 'Too long' },
			form: 'Nope'
		});
	});

	it('maps a 422 pydantic body by the last loc segment', () => {
		expect(
			fieldErrorsFrom({ detail: [{ loc: ['body', 'payload', 'description'], msg: 'too long' }] })
		).toEqual({
			fields: { description: 'too long' },
			form: null
		});
	});

	it('keeps indexed 422 paths so a redirect URI row can show its error', () => {
		expect(
			fieldErrorsFrom({
				detail: [{ loc: ['body', 'payload', 'redirect_uris', 1], msg: 'bad uri' }]
			})
		).toEqual({ fields: { 'redirect_uris.1': 'bad uri' }, form: null });
	});

	it('routes payload-root and unknown keys to the form so nothing disappears', () => {
		expect(fieldErrorsFrom({ detail: [{ loc: ['body', 'payload'], msg: 'model error' }] })).toEqual(
			{
				fields: {},
				form: 'model error'
			}
		);
		expect(fieldErrorsFrom({ errors: { weird: ['x'] } })).toEqual({ fields: {}, form: 'x' });
	});

	it('maps a 409 onto the limit copy and anything else onto the generic copy', () => {
		expect(
			fieldErrorsFrom({ detail: 'You have reached the maximum number of apps.', __status: 409 })
				.form
		).toMatch(/limit of apps/);
		expect(fieldErrorsFrom(new Error('boom')).form).toBeTruthy();
		expect(fieldErrorsFrom(null).fields).toEqual({});
	});
});

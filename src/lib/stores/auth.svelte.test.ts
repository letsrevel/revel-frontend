import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authStore } from './auth.svelte';
import type { RevelUserSchema, OrganizationPermissionsSchema } from '$lib/types/auth';

// Mock the API client
vi.mock('$lib/api/client', () => ({
	authObtainToken: vi.fn(),
	authObtainTokenWithOtp: vi.fn(),
	accountMe: vi.fn(),
	permissionMyPermissions: vi.fn()
}));

import {
	authObtainToken,
	authObtainTokenWithOtp,
	accountMe,
	permissionMyPermissions
} from '$lib/api/client';

describe('AuthStore', () => {
	beforeEach(() => {
		// Reset all mocks before each test
		vi.clearAllMocks();

		// Reset auth store state
		authStore.logout();
	});

	describe('Initial State', () => {
		it('should start with null user', () => {
			expect(authStore.user).toBeNull();
		});

		it('should start with null accessToken', () => {
			expect(authStore.accessToken).toBeNull();
		});

		it('should start with null permissions', () => {
			expect(authStore.permissions).toBeNull();
		});

		it('should start as not authenticated', () => {
			expect(authStore.isAuthenticated).toBe(false);
		});

		it('should start as not loading', () => {
			expect(authStore.isLoading).toBe(false);
		});
	});

	describe('Login', () => {
		const mockUser: RevelUserSchema = {
			id: '123',
			email: 'test@example.com',
			email_verified: true,
			preferred_name: 'Test User',
			pronouns: 'they/them',
			is_active: true,
			first_name: 'Test',
			last_name: 'User',
			totp_active: false
		};

		const mockPermissions: OrganizationPermissionsSchema = {
			organization_permissions: {
				'org-1': 'owner',
				'org-2': {
					default: {
						create_event: true,
						edit_event: true
					}
				}
			}
		};

		it('should successfully login with valid credentials', async () => {
			// Mock successful login
			vi.mocked(authObtainToken).mockResolvedValue({
				data: {
					username: 'test@example.com',
					access: 'mock-access-token',
					refresh: 'mock-refresh-token'
				},
				error: undefined,
				request: {} as Request,
				response: {} as Response
			});

			// Mock user data fetch
			vi.mocked(accountMe).mockResolvedValue({
				data: mockUser,
				error: undefined,
				request: {} as Request,
				response: {} as Response
			});

			// Mock permissions fetch
			vi.mocked(permissionMyPermissions).mockResolvedValue({
				data: mockPermissions,
				error: undefined,
				request: {} as Request,
				response: {} as Response
			});

			await authStore.login('test@example.com', 'password');

			expect(authStore.user).toEqual(mockUser);
			expect(authStore.accessToken).toBe('mock-access-token');
			expect(authStore.permissions).toEqual(mockPermissions);
			expect(authStore.isAuthenticated).toBe(true);
		});

		it('should throw error for invalid credentials', async () => {
			vi.mocked(authObtainToken).mockResolvedValue({
				data: undefined,
				error: { message: 'Invalid credentials' } as any,
				request: {} as Request,
				response: {} as Response
			});

			await expect(authStore.login('test@example.com', 'wrong')).rejects.toThrow('Login failed');
		});

		it('should throw 2FA_REQUIRED for users with 2FA enabled', async () => {
			vi.mocked(authObtainToken).mockResolvedValue({
				data: {
					token: 'temp-token',
					type: 'otp'
				},
				error: undefined,
				request: {} as Request,
				response: {} as Response
			});

			await expect(authStore.login('test@example.com', 'password')).rejects.toThrow('2FA_REQUIRED');
		});
	});

	describe('2FA Login', () => {
		const mockUser: RevelUserSchema = {
			id: '123',
			email: 'test@example.com',
			email_verified: true,
			preferred_name: 'Test User',
			pronouns: 'they/them',
			is_active: true,
			first_name: 'Test',
			last_name: 'User',
			totp_active: true
		};

		it('should successfully login with valid OTP', async () => {
			vi.mocked(authObtainTokenWithOtp).mockResolvedValue({
				data: {
					username: 'test@example.com',
					access: 'mock-access-token',
					refresh: 'mock-refresh-token'
				},
				error: undefined,
				request: {} as Request,
				response: {} as Response
			});

			vi.mocked(accountMe).mockResolvedValue({
				data: mockUser,
				error: undefined,
				request: {} as Request,
				response: {} as Response
			});

			vi.mocked(permissionMyPermissions).mockResolvedValue({
				data: { organization_permissions: {} },
				error: undefined,
				request: {} as Request,
				response: {} as Response
			});

			await authStore.loginWithOTP('temp-token', '123456');

			expect(authStore.isAuthenticated).toBe(true);
			expect(authStore.user).toEqual(mockUser);
		});

		it('should throw error for invalid OTP', async () => {
			vi.mocked(authObtainTokenWithOtp).mockResolvedValue({
				data: undefined,
				error: { message: 'Invalid OTP' } as any,
				request: {} as Request,
				response: {} as Response
			});

			await expect(authStore.loginWithOTP('temp-token', 'wrong')).rejects.toThrow(
				'OTP verification failed'
			);
		});
	});

	describe('Logout', () => {
		it('should clear all auth state', async () => {
			// First login
			vi.mocked(authObtainToken).mockResolvedValue({
				data: {
					username: 'test@example.com',
					access: 'token',
					refresh: 'refresh'
				},
				error: undefined,
				request: {} as Request,
				response: {} as Response
			});

			vi.mocked(accountMe).mockResolvedValue({
				data: {
					id: '123',
					email: 'test@example.com'
				} as RevelUserSchema,
				error: undefined,
				request: {} as Request,
				response: {} as Response
			});

			vi.mocked(permissionMyPermissions).mockResolvedValue({
				data: { organization_permissions: {} },
				error: undefined,
				request: {} as Request,
				response: {} as Response
			});

			await authStore.login('test@example.com', 'password');
			expect(authStore.isAuthenticated).toBe(true);

			// Now logout
			await authStore.logout();

			expect(authStore.user).toBeNull();
			expect(authStore.accessToken).toBeNull();
			expect(authStore.permissions).toBeNull();
			expect(authStore.isAuthenticated).toBe(false);
		});
	});

	describe('getAuthHeaders', () => {
		it('should return empty headers when not authenticated', () => {
			const headers = authStore.getAuthHeaders();
			expect(headers).toEqual({});
		});

		it('should return Authorization header when authenticated', () => {
			authStore.setAccessToken('test-token');
			const headers = authStore.getAuthHeaders();
			expect(headers).toEqual({
				Authorization: 'Bearer test-token'
			});
		});
	});

	describe('setAccessToken', () => {
		it('should update the access token', () => {
			authStore.setAccessToken('new-token');
			expect(authStore.accessToken).toBe('new-token');
		});
	});
});

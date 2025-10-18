import { describe, it, expect } from 'vitest';
import {
	registerSchema,
	loginSchema,
	otpSchema,
	resendVerificationSchema,
	calculatePasswordStrength
} from './auth';

describe('Auth Schemas', () => {
	describe('registerSchema', () => {
		it('should validate correct registration data', () => {
			const data = {
				email: 'test@example.com',
				password: 'Test123!abc',
				confirmPassword: 'Test123!abc',
				acceptTerms: true
			};

			const result = registerSchema.safeParse(data);
			expect(result.success).toBe(true);
		});

		it('should reject invalid email', () => {
			const data = {
				email: 'not-an-email',
				password: 'Test123!abc',
				confirmPassword: 'Test123!abc',
				acceptTerms: true
			};

			const result = registerSchema.safeParse(data);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toBe('Invalid email address');
			}
		});

		it('should reject password without uppercase', () => {
			const data = {
				email: 'test@example.com',
				password: 'test123!abc',
				confirmPassword: 'test123!abc',
				acceptTerms: true
			};

			const result = registerSchema.safeParse(data);
			expect(result.success).toBe(false);
			if (!result.success) {
				const error = result.error.issues.find((e) => e.path[0] === 'password');
				expect(error?.message).toContain('uppercase');
			}
		});

		it('should reject password without lowercase', () => {
			const data = {
				email: 'test@example.com',
				password: 'TEST123!ABC',
				confirmPassword: 'TEST123!ABC',
				acceptTerms: true
			};

			const result = registerSchema.safeParse(data);
			expect(result.success).toBe(false);
			if (!result.success) {
				const error = result.error.issues.find((e) => e.path[0] === 'password');
				expect(error?.message).toContain('lowercase');
			}
		});

		it('should reject password without digit', () => {
			const data = {
				email: 'test@example.com',
				password: 'TestABC!abc',
				confirmPassword: 'TestABC!abc',
				acceptTerms: true
			};

			const result = registerSchema.safeParse(data);
			expect(result.success).toBe(false);
			if (!result.success) {
				const error = result.error.issues.find((e) => e.path[0] === 'password');
				expect(error?.message).toContain('digit');
			}
		});

		it('should reject password without special character', () => {
			const data = {
				email: 'test@example.com',
				password: 'Test123abc',
				confirmPassword: 'Test123abc',
				acceptTerms: true
			};

			const result = registerSchema.safeParse(data);
			expect(result.success).toBe(false);
			if (!result.success) {
				const error = result.error.issues.find((e) => e.path[0] === 'password');
				expect(error?.message).toContain('special character');
			}
		});

		it('should reject password shorter than 8 characters', () => {
			const data = {
				email: 'test@example.com',
				password: 'Te1!',
				confirmPassword: 'Te1!',
				acceptTerms: true
			};

			const result = registerSchema.safeParse(data);
			expect(result.success).toBe(false);
			if (!result.success) {
				const error = result.error.issues.find((e) => e.path[0] === 'password');
				expect(error?.message).toContain('8 characters');
			}
		});

		it('should reject mismatched passwords', () => {
			const data = {
				email: 'test@example.com',
				password: 'Test123!abc',
				confirmPassword: 'Different123!',
				acceptTerms: true
			};

			const result = registerSchema.safeParse(data);
			expect(result.success).toBe(false);
			if (!result.success) {
				const error = result.error.issues.find((e) => e.path[0] === 'confirmPassword');
				expect(error?.message).toBe('Passwords do not match');
			}
		});

		it('should reject when terms not accepted', () => {
			const data = {
				email: 'test@example.com',
				password: 'Test123!abc',
				confirmPassword: 'Test123!abc',
				acceptTerms: false
			};

			const result = registerSchema.safeParse(data);
			expect(result.success).toBe(false);
			if (!result.success) {
				const error = result.error.issues.find((e) => e.path[0] === 'acceptTerms');
				expect(error?.message).toContain('accept the terms');
			}
		});
	});

	describe('loginSchema', () => {
		it('should validate correct login data', () => {
			const data = {
				email: 'test@example.com',
				password: 'anypassword',
				rememberMe: false
			};

			const result = loginSchema.safeParse(data);
			expect(result.success).toBe(true);
		});

		it('should reject invalid email', () => {
			const data = {
				email: 'not-an-email',
				password: 'password'
			};

			const result = loginSchema.safeParse(data);
			expect(result.success).toBe(false);
		});

		it('should reject empty password', () => {
			const data = {
				email: 'test@example.com',
				password: ''
			};

			const result = loginSchema.safeParse(data);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toContain('required');
			}
		});

		it('should default rememberMe to false', () => {
			const data = {
				email: 'test@example.com',
				password: 'password'
			};

			const result = loginSchema.safeParse(data);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.rememberMe).toBe(false);
			}
		});
	});

	describe('otpSchema', () => {
		it('should validate 6-digit code', () => {
			const result = otpSchema.safeParse({ code: '123456' });
			expect(result.success).toBe(true);
		});

		it('should reject non-numeric code', () => {
			const result = otpSchema.safeParse({ code: '12345a' });
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toContain('digits');
			}
		});

		it('should reject code shorter than 6 digits', () => {
			const result = otpSchema.safeParse({ code: '12345' });
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toContain('6 digits');
			}
		});

		it('should reject code longer than 6 digits', () => {
			const result = otpSchema.safeParse({ code: '1234567' });
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toContain('6 digits');
			}
		});
	});

	describe('resendVerificationSchema', () => {
		it('should validate correct email', () => {
			const result = resendVerificationSchema.safeParse({ email: 'test@example.com' });
			expect(result.success).toBe(true);
		});

		it('should reject invalid email', () => {
			const result = resendVerificationSchema.safeParse({ email: 'not-an-email' });
			expect(result.success).toBe(false);
		});
	});

	describe('calculatePasswordStrength', () => {
		it('should return Very Weak for empty password', () => {
			const result = calculatePasswordStrength('');
			expect(result.score).toBe(0);
			expect(result.label).toBe('Very Weak');
			expect(result.color).toBe('bg-red-500');
		});

		it('should return Very Weak for short password', () => {
			const result = calculatePasswordStrength('abc');
			expect(result.score).toBe(0);
			expect(result.label).toBe('Very Weak');
		});

		it('should return Weak for 8+ characters only', () => {
			const result = calculatePasswordStrength('abcdefgh');
			expect(result.score).toBe(1);
			expect(result.label).toBe('Weak');
			expect(result.color).toBe('bg-orange-500');
		});

		it('should return Good for 12+ chars with mixed case', () => {
			const result = calculatePasswordStrength('abcdefghABCD');
			// Gets: length 8+, length 12+, mixed case = score 3
			expect(result.score).toBe(3);
			expect(result.label).toBe('Good');
			expect(result.color).toBe('bg-blue-500');
		});

		it('should return Strong for length, mixed case, and digit', () => {
			const result = calculatePasswordStrength('abcdefghABCD123');
			// Gets: length 8+, length 12+, mixed case, digit = score 4
			expect(result.score).toBe(4);
			expect(result.label).toBe('Strong');
			expect(result.color).toBe('bg-green-500');
		});

		it('should return Strong for all requirements', () => {
			const result = calculatePasswordStrength('Abcdefgh123!');
			expect(result.score).toBe(4);
			expect(result.label).toBe('Strong');
			expect(result.color).toBe('bg-green-500');
		});

		it('should cap score at 4', () => {
			// Very long password with all requirements
			const result = calculatePasswordStrength('Abcdefghijklmnopqrstuvwxyz123!@#$');
			expect(result.score).toBe(4);
		});
	});
});

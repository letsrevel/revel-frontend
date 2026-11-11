import { z } from 'zod';
import * as m from '$lib/paraglide/messages.js';

// Zod 4 evaluates `error` callbacks when an issue is raised (at parse time), so
// the message follows the request's locale instead of freezing at import.
export const SPECIAL_CHARACTERS = '!@#$%^&*(),.?":{}|<>-';
const SPECIAL_CHARACTER_PATTERN = new RegExp(
	`[${SPECIAL_CHARACTERS.replace(/[\\\]^-]/g, '\\$&')}]`
);

/**
 * Password validation schema matching backend requirements:
 * - Min 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 * - At least one special character (!@#$%^&*(),.?":{}|<>-)
 */
const passwordSchema = z
	.string()
	.min(8, { error: () => m['authValidation.passwordMinLength']() })
	.regex(/[A-Z]/, { error: () => m['authValidation.passwordUppercase']() })
	.regex(/[a-z]/, { error: () => m['authValidation.passwordLowercase']() })
	.regex(/\d/, { error: () => m['authValidation.passwordDigit']() })
	.regex(SPECIAL_CHARACTER_PATTERN, {
		error: () => m['authValidation.passwordSpecial']({ characters: SPECIAL_CHARACTERS })
	});

/**
 * Registration form schema
 */
export const registerSchema = z
	.object({
		email: z.string().email({ error: () => m['authValidation.invalidEmail']() }),
		password: passwordSchema,
		confirmPassword: z.string(),
		acceptTerms: z.boolean().refine((val) => val === true, {
			error: () => m['authValidation.termsRequired']()
		})
	})
	.refine((data) => data.password === data.confirmPassword, {
		error: () => m['authValidation.passwordsMismatch'](),
		path: ['confirmPassword']
	});

export type RegisterFormData = z.infer<typeof registerSchema>;

/**
 * Login form schema
 */
export const loginSchema = z.object({
	email: z.string().email({ error: () => m['authValidation.invalidEmail']() }),
	password: z.string().min(1, { error: () => m['authValidation.passwordRequired']() }),
	rememberMe: z.boolean().optional().default(false)
});

export type LoginFormData = z.infer<typeof loginSchema>;

/**
 * Two-factor authentication (OTP) schema
 */
export const otpSchema = z.object({
	code: z
		.string()
		.length(6, { error: () => m['authValidation.otpLength']() })
		.regex(/^\d{6}$/, { error: () => m['authValidation.otpDigitsOnly']() })
});

export type OTPFormData = z.infer<typeof otpSchema>;

/**
 * Email verification resend schema
 */
export const resendVerificationSchema = z.object({
	email: z.string().email({ error: () => m['authValidation.invalidEmail']() })
});

export type ResendVerificationFormData = z.infer<typeof resendVerificationSchema>;

/**
 * Password reset request schema
 */
export const passwordResetRequestSchema = z.object({
	email: z.string().email({ error: () => m['authValidation.invalidEmail']() })
});

export type PasswordResetRequestFormData = z.infer<typeof passwordResetRequestSchema>;

/**
 * Password reset confirmation schema
 */
export const passwordResetSchema = z
	.object({
		password: passwordSchema,
		confirmPassword: z.string(),
		token: z.string().min(1, { error: () => m['authValidation.resetTokenRequired']() })
	})
	.refine((data) => data.password === data.confirmPassword, {
		error: () => m['authValidation.passwordsMismatch'](),
		path: ['confirmPassword']
	});

export type PasswordResetFormData = z.infer<typeof passwordResetSchema>;

/**
 * Account deletion confirmation schema
 */
export const accountDeletionConfirmSchema = z.object({
	token: z.string().min(1, { error: () => m['authValidation.deletionTokenRequired']() })
});

export type AccountDeletionConfirmFormData = z.infer<typeof accountDeletionConfirmSchema>;

/**
 * Email change request schema (initiation form on /account/security).
 * Mirrors the backend's `EmailChangeRequestSchema`: lowercased EmailStr + current password.
 */
export const emailChangeRequestSchema = z.object({
	new_email: z
		.string()
		.trim()
		.toLowerCase()
		.email({ error: () => m['authValidation.invalidEmail']() }),
	password: z.string().min(1, { error: () => m['authValidation.passwordRequired']() })
});

export type EmailChangeRequestFormData = z.infer<typeof emailChangeRequestSchema>;

/**
 * Email change confirmation schema (token from the email link).
 */
export const emailChangeConfirmSchema = z.object({
	token: z.string().min(1, { error: () => m['authValidation.confirmationTokenRequired']() })
});

export type EmailChangeConfirmFormData = z.infer<typeof emailChangeConfirmSchema>;

/**
 * Password strength calculator
 * Returns score from 0 (weakest) to 4 (strongest)
 */
export function calculatePasswordStrength(password: string): {
	score: number;
	label: string;
	color: string;
} {
	let score = 0;

	if (password.length >= 8) score++;
	if (password.length >= 12) score++;
	if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
	if (/\d/.test(password)) score++;
	if (/[!@#$%^&*(),.?":{}|<>-]/.test(password)) score++;

	// Cap at 4
	score = Math.min(score, 4);

	const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
	const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];

	return {
		score,
		label: labels[score],
		color: colors[score]
	};
}

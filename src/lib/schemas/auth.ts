import { z } from 'zod';

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
	.min(8, 'Password must be at least 8 characters long')
	.regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
	.regex(/[a-z]/, 'Password must contain at least one lowercase letter')
	.regex(/\d/, 'Password must contain at least one digit')
	.regex(
		/[!@#$%^&*(),.?":{}|<>-]/,
		'Password must contain at least one special character (!@#$%^&*(),.?":{}|<>-)'
	);

/**
 * Registration form schema
 */
export const registerSchema = z
	.object({
		email: z.string().email('Invalid email address'),
		password: passwordSchema,
		confirmPassword: z.string(),
		acceptTerms: z.boolean().refine((val) => val === true, {
			message: 'You must accept the terms and privacy policy'
		})
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: 'Passwords do not match',
		path: ['confirmPassword']
	});

export type RegisterFormData = z.infer<typeof registerSchema>;

/**
 * Login form schema
 */
export const loginSchema = z.object({
	email: z.string().email('Invalid email address'),
	password: z.string().min(1, 'Password is required'),
	rememberMe: z.boolean().optional().default(false)
});

export type LoginFormData = z.infer<typeof loginSchema>;

/**
 * Two-factor authentication (OTP) schema
 */
export const otpSchema = z.object({
	code: z
		.string()
		.length(6, 'Code must be 6 digits')
		.regex(/^\d{6}$/, 'Code must contain only digits')
});

export type OTPFormData = z.infer<typeof otpSchema>;

/**
 * Email verification resend schema
 */
export const resendVerificationSchema = z.object({
	email: z.string().email('Invalid email address')
});

export type ResendVerificationFormData = z.infer<typeof resendVerificationSchema>;

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
	const colors = [
		'bg-red-500',
		'bg-orange-500',
		'bg-yellow-500',
		'bg-blue-500',
		'bg-green-500'
	];

	return {
		score,
		label: labels[score],
		color: colors[score]
	};
}

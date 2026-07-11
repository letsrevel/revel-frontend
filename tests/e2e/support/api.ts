/**
 * Thin backend REST client for ARRANGE steps only.
 *
 * Journeys under test always go through the UI; this client exists so specs can
 * set up state (create events, tiers, tokens, invitations, …) without clicking
 * through unrelated screens. It talks straight to the backend with plain fetch —
 * never through the SvelteKit app — and imports types (only types) from the
 * generated client where useful.
 */

export const API_URL = process.env.PUBLIC_API_URL ?? 'http://localhost:8000';

export interface TokenPair {
	access: string;
	refresh: string;
}

export class ApiError extends Error {
	constructor(
		public readonly status: number,
		public readonly method: string,
		public readonly path: string,
		public readonly body: string
	) {
		super(`${method} ${path} → ${status}: ${body.slice(0, 500)}`);
		this.name = 'ApiError';
	}
}

/**
 * Exchange credentials for a JWT pair (POST /api/auth/token/pair).
 * Retries transient 5xx responses — the dev backend can hiccup under the
 * parallel load of a full suite run.
 */
export async function obtainTokenPair(email: string, password: string): Promise<TokenPair> {
	let response: Response;
	let text: string;
	for (let attempt = 1; ; attempt++) {
		response = await fetch(`${API_URL}/api/auth/token/pair`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: email, password })
		});
		text = await response.text();
		if (response.status < 500 || attempt >= 3) break;
		await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
	}
	if (!response.ok) {
		throw new ApiError(response.status, 'POST', '/api/auth/token/pair', text);
	}
	const data = JSON.parse(text) as Partial<TokenPair> & { type?: string };
	if (!data.access || !data.refresh) {
		throw new Error(
			`Login for ${email} did not return a token pair (2FA enabled?): ${text.slice(0, 200)}`
		);
	}
	return { access: data.access, refresh: data.refresh };
}

/** Bearer-authenticated backend client bound to one user. */
export class ApiClient {
	private constructor(
		public readonly email: string,
		private readonly accessToken: string
	) {}

	static async login(email: string, password: string): Promise<ApiClient> {
		const { access } = await obtainTokenPair(email, password);
		return new ApiClient(email, access);
	}

	async request<T>(method: string, path: string, body?: unknown): Promise<T> {
		// Bounded 5xx retry, mirroring obtainTokenPair: under parallel worker
		// load the dev backend can transiently 500 (observed: Postgres "sorry,
		// too many clients already" surfacing as OperationalError). 4xx is
		// NEVER retried — specs assert on those deliberately.
		let response: Response;
		let text: string;
		for (let attempt = 1; ; attempt++) {
			response = await fetch(`${API_URL}${path}`, {
				method,
				headers: {
					Authorization: `Bearer ${this.accessToken}`,
					...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
				},
				body: body !== undefined ? JSON.stringify(body) : undefined
			});
			text = await response.text();
			if (response.status < 500 || attempt >= 3) break;
			await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
		}
		if (!response.ok) {
			throw new ApiError(response.status, method, path, text);
		}
		return (text ? JSON.parse(text) : undefined) as T;
	}

	get<T>(path: string): Promise<T> {
		return this.request<T>('GET', path);
	}

	post<T>(path: string, body?: unknown): Promise<T> {
		return this.request<T>('POST', path, body);
	}

	put<T>(path: string, body?: unknown): Promise<T> {
		return this.request<T>('PUT', path, body);
	}

	patch<T>(path: string, body?: unknown): Promise<T> {
		return this.request<T>('PATCH', path, body);
	}

	delete<T>(path: string): Promise<T> {
		return this.request<T>('DELETE', path);
	}
}

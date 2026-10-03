/**
 * Server-side response-encoding safety for API calls.
 *
 * Node's fetch (undici) can decode gzip/deflate/br but NOT zstd. Caddy and
 * Cloudflare both offer zstd, so a zstd-encoded body reaching an SSR loader is
 * handed to the generated client undecoded: with no usable Content-Type it
 * parses as a stream/blob, the loader returns a non-POJO, and SvelteKit's
 * devalue throws "Cannot stringify arbitrary non-POJOs" -> SSR 500.
 *
 * Two layers: advertise only decodable encodings, and if an undecodable
 * response still arrives, re-request it once uncompressed.
 */

/** Encodings Node's fetch can decode. Never include zstd. */
export const SERVER_ACCEPT_ENCODING = 'gzip, deflate, br';

/** Content-Encoding tokens Node's fetch cannot decode. */
const UNDECODABLE = ['zstd'];

export function hasUndecodableEncoding(response: Response): boolean {
	const encoding = response.headers.get('content-encoding')?.toLowerCase() ?? '';
	return UNDECODABLE.some((token) => encoding.includes(token));
}

/** Pin Accept-Encoding to what Node can decode. Only call on the server. */
export function applyServerAcceptEncoding(request: Request): Request {
	request.headers.set('Accept-Encoding', SERVER_ACCEPT_ENCODING);
	return request;
}

/**
 * If `response` carries an encoding Node cannot decode, repeat the (idempotent)
 * request asking for an uncompressed body. Otherwise return `response` as-is.
 */
export async function retryUndecodable(response: Response, request: Request): Promise<Response> {
	if (!hasUndecodableEncoding(response)) return response;
	if (request.method !== 'GET' && request.method !== 'HEAD') return response;

	const retry = request.clone();
	retry.headers.set('Accept-Encoding', 'identity');
	return fetch(retry);
}

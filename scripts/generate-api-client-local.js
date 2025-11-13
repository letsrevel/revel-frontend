import { writeFileSync, readFileSync } from 'fs';
import { createClient } from '@hey-api/openapi-ts';

// Use local OpenAPI file directly
const OPENAPI_PATH = '../revel-backend/.artifacts/openapi.json';

console.log(`Generating API client from local file: ${OPENAPI_PATH}...`);

try {
	await createClient({
		client: '@hey-api/client-fetch',
		input: OPENAPI_PATH,
		output: {
			path: './src/lib/api/generated',
			format: 'prettier',
			lint: 'eslint'
		},
		types: {
			enums: 'typescript'
		},
		schemas: false,
		services: {
			asClass: false
		}
	});

	console.log('✅ API client generated!');
	console.log('📝 Removing hash suffixes from function names...');

	// Remove hash suffixes from generated SDK
	const sdkPath = './src/lib/api/generated/sdk.gen.ts';
	let sdkContent = readFileSync(sdkPath, 'utf-8');

	// Replace function names with hash suffixes (e.g., accountMe08B35537 -> accountMe)
	// Pattern: export const functionName[Hash] = -> export const functionName =
	sdkContent = sdkContent.replace(/export const ([a-zA-Z]+)[0-9A-Fa-f]{8,}/g, 'export const $1');

	// Also replace in function calls within the file
	sdkContent = sdkContent.replace(/\b([a-zA-Z]+)[0-9A-Fa-f]{8,}\(/g, '$1(');

	writeFileSync(sdkPath, sdkContent);
	console.log('✅ Hash suffixes removed from SDK!');

	// Fix the client configuration to use SvelteKit environment variable
	console.log('📝 Configuring API client to use PUBLIC_API_URL...');
	const clientPath = './src/lib/api/generated/client.gen.ts';
	let clientContent = readFileSync(clientPath, 'utf-8');

	// Add SvelteKit env import at the top
	if (!clientContent.includes("from '$env/static/public'")) {
		clientContent = clientContent.replace(
			/(\/\/ This file is auto-generated[^\n]*\n\n)/,
			"$1import { PUBLIC_API_URL } from '$env/static/public';\n"
		);
	}

	// Replace hardcoded baseUrl with SvelteKit environment variable
	// Original: baseUrl: 'http://localhost:8000'
	// New: baseUrl: PUBLIC_API_URL || 'http://localhost:8000'
	clientContent = clientContent.replace(
		/baseUrl:\s*['"].*?['"]/,
		"baseUrl: PUBLIC_API_URL || 'http://localhost:8000'"
	);

	writeFileSync(clientPath, clientContent);
	console.log('✅ API client configured to use PUBLIC_API_URL!');

	// Create index.ts to export everything
	const indexContent = `// Re-export everything from generated API
export * from './generated';
export { client } from './generated/client.gen';
`;

	writeFileSync('./src/lib/api/index.ts', indexContent);

	console.log('✅ API client generated successfully!');
	console.log('   Generated files:');
	console.log('   - src/lib/api/generated/types.gen.ts');
	console.log('   - src/lib/api/generated/sdk.gen.ts');
	console.log('   - src/lib/api/generated/client.gen.ts');
	console.log('   - src/lib/api/generated/index.ts');
	console.log('   - src/lib/api/index.ts');
} catch (error) {
	console.error('❌ Failed to generate API client:');
	console.error(error.message);
	process.exit(1);
}

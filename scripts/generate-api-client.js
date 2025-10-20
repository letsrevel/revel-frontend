import { writeFileSync, readFileSync } from 'fs';
import { createClient } from '@hey-api/openapi-ts';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';
const OPENAPI_PATH = `${BACKEND_URL}/api/openapi.json`;

console.log(`Generating API client from ${OPENAPI_PATH}...`);

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

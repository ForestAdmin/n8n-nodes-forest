import * as esbuild from 'esbuild';

await esbuild.build({
	entryPoints: [
		'nodes/Forest/Forest.node.ts',
		'credentials/ForestMcpApi.credentials.ts',
		'credentials/ForestMcpOAuth2Api.credentials.ts',
	],
	bundle: true,
	platform: 'node',
	target: 'es2019',
	format: 'cjs',
	outdir: 'dist',
	external: ['n8n-workflow'],
	sourcemap: false,
});

import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
	plugins: [
		sveltekit(),
		viteStaticCopy({
			targets: [
				{
					src: 'node_modules/onnxruntime-web/dist/*.jsep.*',

					dest: 'wasm'
				}
			]
		})
	],
	define: {
		APP_VERSION: JSON.stringify(process.env.npm_package_version),
		APP_BUILD_HASH: JSON.stringify(process.env.APP_BUILD_HASH || 'dev-build')
	},
	build: {
		sourcemap: true
	},
	worker: {
		format: 'es'
	},
	esbuild: {
		pure: process.env.ENV === 'dev' ? [] : ['console.log', 'console.debug', 'console.error']
	},
	server: {
		host: true,
		hmr: {
			clientPort: 5173,
			host: '10.0.0.16'
		},
		// Dev: browser uses same-origin `/api/v1/...` (see constants.ts); forward to Open WebUI backend.
		proxy: {
			'/api/v1': {
				target: 'http://localhost:8080',
				changeOrigin: true
			},
			'/api': {
				target: 'http://localhost:8080',
				changeOrigin: true
			},
			'/ws': {
				target: 'http://localhost:8080',
				changeOrigin: true,
				ws: true
			},
			'/ollama': {
				target: 'http://localhost:8080',
				changeOrigin: true
			},
			'/openai': {
				target: 'http://localhost:8080',
				changeOrigin: true
			},
			'/oauth': {
				target: 'http://localhost:8080',
				changeOrigin: true
			}
		}
	}
});

import { defineConfig } from 'cypress';

export default defineConfig({
	e2e: {
		baseUrl: 'http://10.0.0.16:8080'
	},
	video: true
});

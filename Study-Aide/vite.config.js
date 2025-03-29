import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	css: {
		postcss: true
	},
	server: {
		hmr: true,
		watch: {
			usePolling: true
		}
	},
	build: {
		sourcemap: true,
		rollupOptions: {
			output: {
				entryFileNames: `[name].[hash].js`,
				chunkFileNames: `[name].[hash].js`,
				assetFileNames: `[name].[hash].[ext]`
			}
		}
	}
});

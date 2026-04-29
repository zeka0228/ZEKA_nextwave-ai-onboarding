import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const ollamaTarget = env.OLLAMA_URL ?? 'http://localhost:11434';

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/llm': {
          target: ollamaTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/llm/, ''),
        },
      },
    },
  };
});

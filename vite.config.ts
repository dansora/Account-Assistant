import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cwd } from 'node:process';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    plugins: [react()],
    base: '/' // Using root base path for standard deployment
  }
})
import {defineConfig, loadEnv} from 'vite'
import react from '@vitejs/plugin-react'


const data = loadEnv("production", process.cwd());

// https://vitejs.dev/config/
// noinspection JSUnusedGlobalSymbols
export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 3000,
  }
})

import { defineConfig } from 'vite'

// Relative base so the same build works at / (Express) and /simple_paw/ (GitHub Pages)
export default defineConfig({ base: './' })

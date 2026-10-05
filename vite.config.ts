import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [{
    name: 'exclude-local-auto-input',
    apply: 'build',
    enforce: 'pre',
    transformIndexHtml: {
      order: 'pre',
      handler: html => html.replace(/<!-- local-auto-input:start -->[\s\S]*?<!-- local-auto-input:end -->/g, ''),
    },
    transform(code, id) {
      if (id.split('?')[0].replaceAll('\\', '/').endsWith('/src/style.css'))
        return code.replace(/\/\* local-auto-input:start \*\/[\s\S]*?\/\* local-auto-input:end \*\//g, '');
    },
  }],
});

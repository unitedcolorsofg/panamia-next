/** @type {import('tailwindcss').Config} */
const config = {
  // NOTE: Tailwind v4 does NOT read this file unless it is loaded via `@config`.
  // The class-based dark mode is configured in app/globals.css via
  // `@custom-variant dark (&:where(.dark, .dark *))`. This setting is kept only
  // for tooling that still reads the JS config.
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
};

export default config;

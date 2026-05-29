/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: 'class', // Driven by next-themes (attribute="class") in app/layout.tsx
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
};

export default config;

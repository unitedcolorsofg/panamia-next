/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: 'media', // Use system color scheme preference
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
};

export default config;

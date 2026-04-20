/** @type {import('tailwindcss').Config} */
export default {
  // The feature components use Tailwind arbitrary-value classes like
  // `bg-[#5a8c4a]` and `text-[#234c78]`. Tailwind v3's JIT engine needs to
  // see every source file that mentions those classes, so we include both
  // the .jsx files at the project root AND anything under /src.
  content: [
    './index.html',
    './*.jsx',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

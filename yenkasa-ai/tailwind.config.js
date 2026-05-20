/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        ai: {
          50: "#f7f4ff",
          100: "#efe8ff",
          200: "#e0d0ff",
          300: "#c8aaff",
          400: "#ab7cff",
          500: "#8b5cf6",
          600: "#7240ea",
          700: "#5e32c8",
          800: "#4d2ca2",
          900: "#412686"
        }
      },
      boxShadow: {
        glass: "0 24px 80px rgba(66, 29, 123, 0.18)",
        glow: "0 18px 50px rgba(131, 72, 255, 0.24)"
      }
    }
  },
  plugins: []
};

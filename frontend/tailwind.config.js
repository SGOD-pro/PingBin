/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "#0a0a0a",
          foreground: "#ffffff",
          active: "#1f1f1f",
          disabled: "#e5e5e5",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
          soft: "#9a9a9a",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // CleanLoop / Clay design tokens
        canvas: "#fffaf0",
        ink: "#0a0a0a",
        body: "#3a3a3a",
        "body-strong": "#1a1a1a",
        hairline: "#e5e5e5",
        "hairline-soft": "#f0f0f0",
        surface: {
          soft: "#faf5e8",
          card: "#f5f0e0",
          strong: "#ebe6d6",
          dark: "#0a1a1a",
          "dark-elevated": "#1a2a2a",
        },
        on: {
          primary: "#ffffff",
          dark: "#ffffff",
          "dark-soft": "#a0a0a0",
        },
        brand: {
          pink: "#ff4d8b",
          teal: "#1a3a3a",
          lavender: "#b8a4ed",
          peach: "#ffb084",
          ochre: "#e8b94a",
          mint: "#a4d4c5",
          coral: "#ff6b5a",
        },
        status: {
          success: "#22c55e",
          warning: "#f59e0b",
          error: "#ef4444",
        },
      },
      borderRadius: {
        xs: "6px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        pill: "9999px",
        full: "9999px",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        display: ["'Plain Black'", "Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      letterSpacing: {
        'tight-xl': '-2.5px',
        'tight-lg': '-2px',
        'tight-md': '-1px',
        'tight-sm': '-0.5px',
        'tight-xs': '-0.3px',
        'wide-caps': '1.5px',
        'wider-caps': '2px',
      },
      boxShadow: {
        'clay-sm': '0 2px 0 #e5e5e5, 0 1px 3px rgba(0,0,0,0.04)',
        'clay-md': '0 4px 0 #ebe6d6, 0 4px 12px rgba(10,10,10,0.06)',
        'clay-lg': '0 6px 0 #ebe6d6, 0 12px 24px rgba(10,10,10,0.08)',
        'clay-dark': '0 4px 0 #000000, 0 8px 24px rgba(0,0,0,0.3)',
      },
    },
  },
  plugins: [],
}
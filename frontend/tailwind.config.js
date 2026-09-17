/**
 * ============================================
 * ADEENA TRADERS - Tailwind Design System
 * ============================================
 * Single source of truth for brand tokens.
 *
 * Design principles
 * -----------------
 * 1. Radius is capped. Business software should read as precise, not playful,
 *    so the whole radius scale tops out at 10px and cards/panels sit at 8-9px.
 *    Overriding the scale (rather than editing every className) guarantees the
 *    rule holds everywhere, including in code written later.
 * 2. Breakpoints cover the full device range from 380px phones (`xs`) to
 *    1920px+ counter displays (`3xl`), so layouts never break at either extreme.
 * 3. Motion is defined once here and reused, so every surface animates with the
 *    same easing and duration language.
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    // ------------------------------------------------------------------
    // Breakpoints - mobile first, from very small phones to ultra-wide
    // ------------------------------------------------------------------
    screens: {
      xs: '380px',      // Small phones (iPhone SE, Galaxy A0x)
      sm: '640px',      // Large phones / small tablets portrait
      md: '768px',      // Tablets
      lg: '1024px',     // Small laptops - sidebar becomes permanent here
      xl: '1280px',     // Desktops
      '2xl': '1536px',  // Large desktops
      '3xl': '1920px',  // Ultra-wide / shop counter displays
      print: { raw: 'print' },
    },
    extend: {
      // ----------------------------------------------------------------
      // Brand palette - Navy (authority) + Gold (value)
      // ----------------------------------------------------------------
      colors: {
        navy: {
          50: '#f4f7fa',
          100: '#e4eaf1',
          200: '#c9d5e3',
          300: '#a2b6cd',
          400: '#7490b1',
          500: '#537298',
          600: '#415b7e',
          700: '#364a66',
          800: '#2f3f56',
          900: '#1d2b3d',
          950: '#0b192c',
        },
        gold: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        // Semantic aliases keep status colours consistent app-wide
        success: {
          50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 500: '#10b981',
          600: '#059669', 700: '#047857', 900: '#064e3b',
        },
        warning: {
          50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 500: '#f59e0b',
          600: '#d97706', 700: '#b45309', 900: '#78350f',
        },
        danger: {
          50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 500: '#ef4444',
          600: '#dc2626', 700: '#b91c1c', 900: '#7f1d1d',
        },
        info: {
          50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 500: '#3b82f6',
          600: '#2563eb', 700: '#1d4ed8', 900: '#1e3a8a',
        },
      },

      // ----------------------------------------------------------------
      // Radius - intentionally capped (design principle #1).
      // `full` is preserved for avatars, pills and status dots only.
      // ----------------------------------------------------------------
      borderRadius: {
        none: '0px',
        sm: '4px',
        DEFAULT: '6px',
        md: '6px',
        lg: '8px',
        xl: '9px',
        '2xl': '10px',
        '3xl': '10px',
        full: '9999px',
      },

      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },

      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '0.875rem' }], // 11px - dense table meta
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1.1' }],
      },

      spacing: {
        18: '4.5rem',
        sidebar: '16rem',
        'sidebar-collapsed': '4.5rem',
        header: '4rem',
      },

      // ----------------------------------------------------------------
      // Elevation - soft and layered, tinted with the brand navy
      // ----------------------------------------------------------------
      boxShadow: {
        xs: '0 1px 2px 0 rgb(11 25 44 / 0.05)',
        card: '0 1px 2px 0 rgb(11 25 44 / 0.04), 0 1px 3px 0 rgb(11 25 44 / 0.06)',
        'card-hover': '0 4px 12px -2px rgb(11 25 44 / 0.10), 0 2px 6px -2px rgb(11 25 44 / 0.06)',
        raised: '0 8px 24px -6px rgb(11 25 44 / 0.14), 0 4px 10px -4px rgb(11 25 44 / 0.08)',
        modal: '0 24px 48px -12px rgb(11 25 44 / 0.28), 0 8px 20px -8px rgb(11 25 44 / 0.16)',
        'inner-top': 'inset 0 1px 0 0 rgb(255 255 255 / 0.06)',
        focus: '0 0 0 3px rgb(245 158 11 / 0.35)',
      },

      // ----------------------------------------------------------------
      // Motion - one shared vocabulary
      // ----------------------------------------------------------------
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'in-out-smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out both',
        'fade-in-up': 'fadeInUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in-down': 'fadeInDown 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in': 'scaleIn 0.18s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in-right': 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in-left': 'slideInLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-up': 'slideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1) both',
        shimmer: 'shimmer 1.6s linear infinite',
        'pulse-ring': 'pulseRing 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 2.5s linear infinite',
        'bounce-subtle': 'bounceSubtle 0.6s ease-in-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseRing: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.4', transform: 'scale(1.35)' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-3px)' },
        },
      },

      backgroundImage: {
        'navy-gradient': 'linear-gradient(135deg, #0b192c 0%, #1d2b3d 55%, #2f3f56 100%)',
        'gold-gradient': 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)',
        sheen: 'linear-gradient(105deg, transparent 35%, rgb(255 255 255 / 0.22) 50%, transparent 65%)',
      },

      zIndex: {
        dropdown: '40',
        sticky: '30',
        overlay: '50',
        modal: '60',
        toast: '100',
      },
    },
  },
  plugins: [],
};

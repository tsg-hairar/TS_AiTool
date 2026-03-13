// ===================================================
// Tailwind CSS Configuration
// ===================================================
// תמיכה מלאה ב-RTL (עברית) + ערכת צבעים מותאמת
// אנימציות ומיקרו-אינטראקציות
// ===================================================

/** @type {import('tailwindcss').Config} */
module.exports = {
  // היכן לחפש classes — רק בקבצי ה-webview
  content: [
    './src/webview/**/*.{tsx,ts,jsx,js,html}',
    './src/shared/**/*.{ts,tsx}',
  ],

  // מצב כהה לפי class (לא לפי system preference)
  darkMode: 'class',

  theme: {
    extend: {
      // צבעים מותאמים לתוסף
      colors: {
        // צבע ראשי — כחול מודרני
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // צבעי סוכנים — כל סוכן בצבע ייחודי (CSS variable with fallback)
        agent: {
          manager: 'var(--agent-manager, #8b5cf6)',      // סגול — מנהל
          architect: 'var(--agent-architect, #06b6d4)',   // תכלת — ארכיטקט
          developer: 'var(--agent-developer, #10b981)',   // ירוק — מפתח
          qa: 'var(--agent-qa, #f59e0b)',                 // כתום — QA
          designer: 'var(--agent-designer, #ec4899)',     // ורוד — מעצב
          security: 'var(--agent-security, #ef4444)',     // אדום — אבטחה
          writer: 'var(--agent-writer, #6366f1)',         // אינדיגו — כותב
        },
        // צבעי רקע כהים — תואמים ל-VS Code
        vscode: {
          bg: 'var(--vscode-editor-background)',
          fg: 'var(--vscode-editor-foreground)',
          border: 'var(--vscode-panel-border)',
          input: 'var(--vscode-input-background)',
          inputBorder: 'var(--vscode-input-border)',
          button: 'var(--vscode-button-background)',
          buttonHover: 'var(--vscode-button-hoverBackground)',
          buttonFg: 'var(--vscode-button-foreground)',
          sidebar: 'var(--vscode-sideBar-background)',
          badge: 'var(--vscode-badge-background)',
          badgeFg: 'var(--vscode-badge-foreground)',
          link: 'var(--vscode-textLink-foreground)',
          error: 'var(--vscode-errorForeground)',
          warning: 'var(--vscode-editorWarning-foreground)',
          success: '#10b981',
        },
      },

      // פונט עברי
      fontFamily: {
        heebo: ['Heebo', 'Arial', 'sans-serif'],
      },

      // ===================================================
      // אנימציות מותאמות — Animations
      // ===================================================
      animation: {
        // --- כניסה/יציאה בסיסיות ---
        'fade-in': 'fadeIn 0.25s ease-out forwards',
        'fade-out': 'fadeOut 0.2s ease-in forwards',
        'slide-up': 'slideUp 0.3s ease-out forwards',
        'slide-down': 'slideDown 0.3s ease-out forwards',
        'slide-in-right': 'slideInRight 0.3s ease-out forwards',
        'slide-in-left': 'slideInLeft 0.3s ease-out forwards',
        'scale-in': 'scaleIn 0.2s ease-out forwards',

        // --- מיקרו-אינטראקציות ---
        'bounce-subtle': 'bounceSubtle 0.4s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'shake': 'shake 0.5s ease-in-out',

        // --- אנימציות ישנות (תאימות) ---
        'slide-in': 'slideIn 0.3s ease-out',
        'typing': 'typing 1.2s steps(3) infinite',

        // --- מודאלים/דיאלוגים ---
        'backdrop-in': 'backdropIn 0.2s ease-out forwards',
        'dialog-in': 'dialogIn 0.25s ease-out forwards',
        'dialog-out': 'dialogOut 0.15s ease-in forwards',

        // --- טעינה ---
        'spinner': 'spinner 0.8s linear infinite',
        'shimmer': 'shimmer 1.5s ease-in-out infinite',
        'dot-bounce-1': 'dotBounce 1.2s ease-in-out infinite',
        'dot-bounce-2': 'dotBounce 1.2s ease-in-out 0.15s infinite',
        'dot-bounce-3': 'dotBounce 1.2s ease-in-out 0.3s infinite',

        // --- רשימות (stagger) ---
        'stagger-1': 'fadeSlideUp 0.35s ease-out 0.05s forwards',
        'stagger-2': 'fadeSlideUp 0.35s ease-out 0.1s forwards',
        'stagger-3': 'fadeSlideUp 0.35s ease-out 0.15s forwards',
        'stagger-4': 'fadeSlideUp 0.35s ease-out 0.2s forwards',
        'stagger-5': 'fadeSlideUp 0.35s ease-out 0.25s forwards',

        // --- מחיקה ---
        'delete-out': 'deleteOut 0.3s ease-in forwards',
      },

      keyframes: {
        // --- כניסה/יציאה ---
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },

        // --- מיקרו-אינטראקציות ---
        bounceSubtle: {
          '0%': { transform: 'scale(1)' },
          '30%': { transform: 'scale(1.06)' },
          '60%': { transform: 'scale(0.97)' },
          '100%': { transform: 'scale(1)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '15%': { transform: 'translateX(-4px)' },
          '30%': { transform: 'translateX(4px)' },
          '45%': { transform: 'translateX(-3px)' },
          '60%': { transform: 'translateX(3px)' },
          '75%': { transform: 'translateX(-1px)' },
          '90%': { transform: 'translateX(1px)' },
        },

        // --- תאימות ---
        slideIn: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        typing: {
          '0%': { content: '"."' },
          '33%': { content: '".."' },
          '66%': { content: '"..."' },
        },

        // --- מודאלים ---
        backdropIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        dialogIn: {
          '0%': { opacity: '0', transform: 'scale(0.92) translateY(-8px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        dialogOut: {
          '0%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          '100%': { opacity: '0', transform: 'scale(0.92) translateY(8px)' },
        },

        // --- טעינה ---
        spinner: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        dotBounce: {
          '0%, 80%, 100%': { transform: 'translateY(0)', opacity: '0.4' },
          '40%': { transform: 'translateY(-6px)', opacity: '1' },
        },

        // --- Stagger list items ---
        fadeSlideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },

        // --- מחיקה ---
        deleteOut: {
          '0%': { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(0.9)' },
        },
      },

      // ===================================================
      // Transition duration / timing presets
      // ===================================================
      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
        '250': '250ms',
        '300': '300ms',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'bounce': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },

      // ===================================================
      // Glass morphism utilities
      // ===================================================
      backdropBlur: {
        xs: '2px',
        glass: '12px',
      },

      // ===================================================
      // Modern border radius values
      // ===================================================
      borderRadius: {
        'glass': '10px',
        'card': '16px',
      },

      // ===================================================
      // Gradient background utilities
      // ===================================================
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-glass': 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
        'gradient-agent': 'linear-gradient(135deg, var(--agent-manager, #8b5cf6), var(--agent-architect, #06b6d4))',
      },
    },
  },

  plugins: [],
};

// ===================================================
// Tailwind CSS Configuration
// ===================================================
// תמיכה מלאה ב-RTL (עברית) + ערכת צבעים מותאמת
// ===================================================

/** @type {import('tailwindcss').Config} */
module.exports = {
  // היכן לחפש classes — רק בקבצי ה-webview
  content: ['./src/webview/**/*.{tsx,ts,html}'],

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
        // צבעי סוכנים — כל סוכן בצבע ייחודי
        agent: {
          manager: '#8b5cf6',    // סגול — מנהל
          architect: '#06b6d4',  // תכלת — ארכיטקט
          developer: '#10b981',  // ירוק — מפתח
          qa: '#f59e0b',         // כתום — QA
          designer: '#ec4899',   // ורוד — מעצב
          security: '#ef4444',   // אדום — אבטחה
          writer: '#6366f1',     // אינדיגו — כותב
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

      // אנימציות מותאמות
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'typing': 'typing 1.2s steps(3) infinite',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        typing: {
          '0%': { content: '"."' },
          '33%': { content: '".."' },
          '66%': { content: '"..."' },
        },
      },
    },
  },

  plugins: [],
};

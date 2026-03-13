// ===================================================
// i18n — הגדרת בינלאומיות (Internationalization)
// ===================================================
// i18next + react-i18next
// שפת ברירת מחדל: עברית (he)
// תמיכה ב-RTL אוטומטית לפי שפה
// ===================================================

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import he from './locales/he.json';
import en from './locales/en.json';

// -------------------------------------------------
// שפות RTL — שפות שנכתבות מימין לשמאל
// -------------------------------------------------
export const RTL_LANGUAGES = ['he', 'ar'];

/** בודק אם שפה מסוימת היא RTL */
export function isRtlLanguage(lang: string): boolean {
  return RTL_LANGUAGES.includes(lang);
}

/** מחזיר את כיוון הטקסט לפי שפה */
export function getDirection(lang: string): 'rtl' | 'ltr' {
  return isRtlLanguage(lang) ? 'rtl' : 'ltr';
}

// -------------------------------------------------
// אתחול i18next
// -------------------------------------------------
i18n.use(initReactI18next).init({
  resources: {
    he: { translation: he },
    en: { translation: en },
  },
  lng: 'he', // שפת ברירת מחדל
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React כבר מנקה XSS
  },
  react: {
    useSuspense: false, // נמנע מ-Suspense — טעינה סינכרונית
  },
});

// -------------------------------------------------
// עדכון כיוון הדף כשמשנים שפה
// -------------------------------------------------
i18n.on('languageChanged', (lang: string) => {
  const dir = getDirection(lang);
  document.documentElement.setAttribute('dir', dir);
  document.documentElement.setAttribute('lang', lang);
});

// הגדרה ראשונית של כיוון
document.documentElement.setAttribute('dir', getDirection(i18n.language));
document.documentElement.setAttribute('lang', i18n.language);

export default i18n;

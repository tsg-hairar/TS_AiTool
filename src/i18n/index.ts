// ===================================================
// i18n Setup — הגדרת תרגומים
// ===================================================

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// תרגומים עבריים
import heCommon from './locales/he/common.json';
import heChat from './locales/he/chat.json';
import heProjects from './locales/he/projects.json';
import heAgents from './locales/he/agents.json';

// תרגומים אנגליים
import enCommon from './locales/en/common.json';
import enChat from './locales/en/chat.json';
import enProjects from './locales/en/projects.json';
import enAgents from './locales/en/agents.json';

void i18n.use(initReactI18next).init({
  resources: {
    he: {
      common: heCommon,
      chat: heChat,
      projects: heProjects,
      agents: heAgents,
    },
    en: {
      common: enCommon,
      chat: enChat,
      projects: enProjects,
      agents: enAgents,
    },
  },
  lng: 'he',
  fallbackLng: 'en',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

export default i18n;

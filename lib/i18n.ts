import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from '@/locales/en/common.json';
import es from '@/locales/es/common.json';
import enToast from '@/locales/en/toast.json';
import esToast from '@/locales/es/toast.json';
import enHome from '@/locales/en/home.json';
import esHome from '@/locales/es/home.json';
import enAbout from '@/locales/en/about.json';
import esAbout from '@/locales/es/about.json';
import enLinks from '@/locales/en/links.json';
import esLinks from '@/locales/es/links.json';
import enPodcasts from '@/locales/en/podcasts.json';
import esPodcasts from '@/locales/es/podcasts.json';
import enContact from '@/locales/en/contact.json';
import esContact from '@/locales/es/contact.json';
import enJointeam from '@/locales/en/jointeam.json';
import esJointeam from '@/locales/es/jointeam.json';
import enSignin from '@/locales/en/signin.json';
import esSignin from '@/locales/es/signin.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: en,
        toast: enToast,
        home: enHome,
        about: enAbout,
        links: enLinks,
        podcasts: enPodcasts,
        contact: enContact,
        jointeam: enJointeam,
        signin: enSignin,
      },
      es: {
        common: es,
        toast: esToast,
        home: esHome,
        about: esAbout,
        links: esLinks,
        podcasts: esPodcasts,
        contact: esContact,
        jointeam: esJointeam,
        signin: esSignin,
      },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'es'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  });

export default i18n;

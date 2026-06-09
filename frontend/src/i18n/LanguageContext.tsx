import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { LANGS, STRINGS, type Lang, type StringKey } from './translations';

const KEY = 'fripa-lang';

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY) as Lang | null;
    if (saved && LANGS.some((l) => l.code === saved)) return saved;
  } catch {
    /* ignore */
  }
  return 'fr';
}

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: StringKey) => string;
}

const LangCtx = createContext<Ctx>({
  lang: 'fr',
  setLang: () => {},
  t: (key) => STRINGS[key]?.fr ?? key,
});

export const useT = () => useContext(LangCtx);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  // Reflect language + direction on <html> so RTL and the lang attribute apply.
  useEffect(() => {
    const dir = LANGS.find((l) => l.code === lang)?.dir ?? 'ltr';
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* ignore */
    }
    setLangState(l);
  }, []);

  const t = useCallback((key: StringKey) => STRINGS[key]?.[lang] ?? STRINGS[key]?.fr ?? key, [lang]);

  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>;
}

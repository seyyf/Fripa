import { useT } from './LanguageContext';
import { LANGS } from './translations';

export function LanguageSwitcher() {
  const { lang, setLang } = useT();
  return (
    <div className="lang-switch" role="group" aria-label="Langue">
      {LANGS.map((l) => (
        <button
          key={l.code}
          className={`lang-switch__btn ${lang === l.code ? 'is-on' : ''}`}
          onClick={() => setLang(l.code)}
          aria-pressed={lang === l.code}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useT } from '../i18n/LanguageContext';

const SHOW_MS = 1900;

// Full-screen brand splash on app launch: the FR mark springs in, then the
// wordmark + slogan, then the whole thing fades out to reveal the app.
export function SplashScreen() {
  const { t } = useT();
  const reduce = useReducedMotion();
  const [show, setShow] = useState(true);

  useEffect(() => {
    const id = window.setTimeout(() => setShow(false), reduce ? 700 : SHOW_MS);
    return () => window.clearTimeout(id);
  }, [reduce]);

  const markIn = reduce
    ? { opacity: 1 }
    : { scale: 1, opacity: 1, rotate: 0 };
  const markFrom = reduce
    ? { opacity: 0 }
    : { scale: 0.6, opacity: 0, rotate: -8 };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          aria-hidden="true"
        >
          <motion.div
            className="splash__mark"
            initial={markFrom}
            animate={markIn}
            transition={reduce ? { duration: 0.3 } : { type: 'spring', stiffness: 260, damping: 18 }}
          >
            FR
          </motion.div>
          <motion.h1
            className="splash__word"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduce ? 0.1 : 0.35, duration: 0.5 }}
          >
            Fripa
          </motion.h1>
          <motion.p
            className="splash__slogan"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduce ? 0.2 : 0.55, duration: 0.5 }}
          >
            {t('header.tagline')} · 🇹🇳
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

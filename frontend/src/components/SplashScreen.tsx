import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion';
import { useT } from '../i18n/LanguageContext';

// How long the whole splash stays up before fading out. Easy to tweak.
const SHOW_MS = 2300;

const WORD = ['F', 'r', 'i', 'p', 'a'];

// The wordmark builds letter-by-letter, each rising into focus.
const letters: Variants = {
  hidden: { opacity: 0, y: 22, filter: 'blur(6px)' },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { delay: 0.55 + i * 0.07, duration: 0.4, ease: [0.2, 0.8, 0.2, 1] },
  }),
};

// Full-screen brand splash: the FR mark flies in like a swipe card and snaps
// to center (teasing the core gesture), a light sweeps across it, two ghost
// cards fan out behind it, then "Fripa" builds letter-by-letter + the slogan.
export function SplashScreen() {
  const { t } = useT();
  const reduce = useReducedMotion();
  const [show, setShow] = useState(true);

  useEffect(() => {
    const id = window.setTimeout(() => setShow(false), reduce ? 800 : SHOW_MS);
    return () => window.clearTimeout(id);
  }, [reduce]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: reduce ? 1 : 1.04 }}
          transition={{ duration: 0.55, ease: 'easeInOut' }}
          aria-hidden="true"
        >
          <div className="splash__stage">
            {/* Ghost cards fanning out behind — hints at a deck of clothes. */}
            {!reduce && (
              <>
                <motion.span
                  className="splash__ghost splash__ghost--left"
                  initial={{ x: 0, rotate: 0, opacity: 0 }}
                  animate={{ x: -34, rotate: -13, opacity: 0.5 }}
                  transition={{ delay: 0.45, type: 'spring', stiffness: 180, damping: 16 }}
                />
                <motion.span
                  className="splash__ghost splash__ghost--right"
                  initial={{ x: 0, rotate: 0, opacity: 0 }}
                  animate={{ x: 34, rotate: 13, opacity: 0.5 }}
                  transition={{ delay: 0.55, type: 'spring', stiffness: 180, damping: 16 }}
                />
              </>
            )}

            <motion.div
              className="splash__mark"
              initial={reduce ? { opacity: 0 } : { x: -260, rotate: -22, opacity: 0 }}
              animate={reduce ? { opacity: 1 } : { x: 0, rotate: 0, opacity: 1 }}
              transition={
                reduce
                  ? { duration: 0.3 }
                  : { type: 'spring', stiffness: 170, damping: 13, mass: 0.9 }
              }
            >
              FR
              {/* Light sweep across the mark once it lands. */}
              {!reduce && (
                <motion.span
                  className="splash__shine"
                  initial={{ x: '-140%' }}
                  animate={{ x: '160%' }}
                  transition={{ delay: 0.7, duration: 0.7, ease: 'easeInOut' }}
                />
              )}
            </motion.div>
          </div>

          <h1 className="splash__word" aria-label="Fripa">
            {reduce ? (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
                Fripa
              </motion.span>
            ) : (
              WORD.map((ch, i) => (
                <motion.span key={i} custom={i} variants={letters} initial="hidden" animate="show">
                  {ch}
                </motion.span>
              ))
            )}
          </h1>

          <motion.p
            className="splash__slogan"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduce ? 0.25 : 1.05, duration: 0.5 }}
          >
            {t('header.tagline')} · 🇹🇳
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

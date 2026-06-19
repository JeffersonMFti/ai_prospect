// Variantes de animação reutilizáveis (Framer Motion).
import type { Variants } from 'framer-motion';

export const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Container que escalona a entrada dos filhos. */
export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.02 } },
};

/** Item que sobe/aparece — combina com `stagger`. */
export const riseItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: easeOut } },
};

/** Transição de página. */
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: easeOut } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.18, ease: 'easeIn' } },
};

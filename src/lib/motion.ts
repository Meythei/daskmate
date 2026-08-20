import type { Variants } from "framer-motion";

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 18, scale: 0.985, filter: "blur(4px)" },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 260, damping: 28, mass: 0.9 },
  },
  exit: {
    opacity: 0,
    y: -14,
    scale: 0.985,
    filter: "blur(4px)",
    transition: { duration: 0.18, ease: "easeIn" },
  },
};

export const tabVariants: Variants = {
  initial: { opacity: 0, x: 12 },
  animate: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 340, damping: 30 } },
  exit: { opacity: 0, x: -12, transition: { duration: 0.12 } },
};

export const staggerList: Variants = {
  animate: { transition: { staggerChildren: 0.045 } },
};

export const listItem: Variants = {
  initial: { opacity: 0, y: 8, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 420, damping: 30 } },
  exit: { opacity: 0, scale: 0.9, transition: { duration: 0.15 } },
};

import { motion } from "framer-motion";
import { IconMoon, IconSun } from "./icons";
import { useTheme } from "../state/ThemeContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <motion.button
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.92 }}
      onClick={(e) => toggleTheme(e.clientX, e.clientY)}
      aria-label={theme === "dark" ? "ライトテーマに切り替え" : "ダークテーマに切り替え"}
      className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink-dim transition-colors hover:border-border-hi hover:text-ink"
    >
      {theme === "dark" ? <IconSun size={15} /> : <IconMoon size={15} />}
    </motion.button>
  );
}

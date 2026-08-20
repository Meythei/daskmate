import { motion } from "framer-motion";

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 disabled:opacity-40 ${
        checked ? "border-transparent bg-ink" : "border-border-hi bg-overlay/5"
      }`}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className={`rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.4)] transition-colors duration-200 ${
          checked ? "bg-bg-deep" : "bg-white"
        }`}
        style={{ marginLeft: checked ? "calc(100% - 1.125rem - 3px)" : "3px", width: "1.125rem", height: "1.125rem" }}
      />
    </button>
  );
}

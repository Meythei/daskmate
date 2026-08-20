import { motion } from "framer-motion";

export interface TabDef {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabBarProps {
  tabs: TabDef[];
  active: string;
  onChange: (id: string) => void;
  layoutId: string;
}

export function TabBar({ tabs, active, onChange, layoutId }: TabBarProps) {
  return (
    <div className="inline-flex gap-1 rounded-2xl border border-border bg-surface/60 p-1 backdrop-blur-sm">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`relative flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-colors duration-200 ${
              isActive ? "text-bg-deep" : "text-ink-dim hover:text-ink"
            }`}
          >
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className="absolute inset-0 rounded-xl bg-ink shadow-[0_2px_12px_rgba(0,0,0,0.35)]"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {tab.icon}
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

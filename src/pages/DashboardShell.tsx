import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { TabBar } from "../components/TabBar";
import { ThemeToggle } from "../components/ThemeToggle";
import { IconCalendar, IconMail, IconSettings } from "../components/icons";
import { tabVariants } from "../lib/motion";
import { useAuth } from "../state/AuthContext";
import { CalendarTab } from "./CalendarTab";
import { MailTab } from "./MailTab";
import { SettingsTab } from "./SettingsTab";

const TABS = [
  { id: "calendar", label: "カレンダー", icon: <IconCalendar /> },
  { id: "mail", label: "メール", icon: <IconMail /> },
  { id: "settings", label: "設定", icon: <IconSettings /> },
];

export function DashboardShell() {
  const { profile } = useAuth();
  const [active, setActive] = useState("calendar");

  return (
    <div className="flex h-full flex-col gap-5 p-6">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="flex items-center gap-2.5">
          <ThemeToggle />
        </div>

        <TabBar tabs={TABS} active={active} onChange={setActive} layoutId="main-tab-pill" />

        <div className="flex items-center justify-end gap-2">
          <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-ink text-xs font-semibold text-bg-deep">
            {profile?.picture ? (
              <img src={profile.picture} alt="" className="h-full w-full object-cover" />
            ) : (
              (profile?.name ?? "?").slice(0, 1)
            )}
          </div>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <AnimatePresence>
          <motion.div
            key={active}
            variants={tabVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute inset-0"
          >
            {active === "calendar" && <CalendarTab />}
            {active === "mail" && <MailTab />}
            {active === "settings" && <SettingsTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

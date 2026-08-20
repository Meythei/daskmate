import { AnimatePresence, motion } from "framer-motion";
import "./App.css";
import { AuroraBackground } from "./components/AuroraBackground";
import { pageVariants } from "./lib/motion";
import { DashboardShell } from "./pages/DashboardShell";
import { LoginPage } from "./pages/LoginPage";
import { AuthProvider, useAuth } from "./state/AuthContext";
import { SettingsProvider } from "./state/SettingsContext";
import { ThemeProvider } from "./state/ThemeContext";

function Root() {
  const { status } = useAuth();

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {status === "signed-in" && <AuroraBackground />}
      {status === "checking" ? (
        <div className="absolute inset-0 grid place-items-center text-ink-faint">
          <div className="flex flex-col items-center gap-3">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-border-hi border-t-brand-2" />
            <p className="text-xs">読み込み中…</p>
          </div>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {status === "signed-out" && <LoginPage key="login" />}
          {status === "signed-in" && (
            <motion.div
              key="dashboard"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="absolute inset-0 z-10"
            >
              <DashboardShell />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SettingsProvider>
          <Root />
        </SettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { AuroraBackground } from "../components/AuroraBackground";
import { IconLogoMark } from "../components/icons";
import { api } from "../lib/api";
import { pageVariants } from "../lib/motion";
import { useAuth } from "../state/AuthContext";

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4c-7.4 0-13.8 4.2-17 10.3z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.3 35.4 26.8 36 24 36c-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.9 39.6 16.4 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.5l6.3 5.3C40.9 36.5 44 30.9 44 24c0-1.3-.1-2.7-.4-3.5z"
      />
    </svg>
  );
}

export function LoginPage() {
  const { login, error } = useAuth();
  const [pending, setPending] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    api.isConfigured().then(setConfigured).catch(() => setConfigured(false));
  }, []);

  const handleLogin = async () => {
    setPending(true);
    await login();
    setPending(false);
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="absolute inset-0 flex items-center justify-center"
    >
      <AuroraBackground />

      <div className="relative z-10 w-[380px]">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="mb-8 text-center"
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-ink text-bg-deep shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
            <IconLogoMark size={28} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">DeskMate</h1>
          <p className="mt-1.5 text-sm text-ink-dim">
            メールとカレンダーを、もっとスムーズに。
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 260, damping: 26 }}
          className="rounded-2xl border border-border bg-surface/80 p-6 shadow-2xl backdrop-blur-md"
        >
          {configured === false && (
            <div className="mb-4 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-xs leading-relaxed text-warn">
              Google / Firebase の接続情報が未設定です。<code>.env</code> を設定してください（SETUP.md参照）。
              プレビュー用にモックデータでログインできます。
            </div>
          )}

          <motion.button
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
            disabled={pending}
            onClick={handleLogin}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-border-hi bg-white px-4 py-3 text-sm font-semibold text-[#1f1f1f] shadow-lg transition-shadow hover:shadow-xl disabled:opacity-60"
          >
            {pending ? (
              <motion.span
                className="h-4 w-4 rounded-full border-2 border-[#1f1f1f]/20 border-t-[#1f1f1f]"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}
              />
            ) : (
              <GoogleMark />
            )}
            {pending ? "サインイン中…" : "Google でサインイン"}
          </motion.button>

          {error && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-3 text-xs text-bad"
            >
              {error}
            </motion.p>
          )}

          <p className="mt-4 text-center text-[11px] leading-relaxed text-ink-faint">
            ブラウザで認証画面が開きます。メールの閲覧とカレンダーの読み書きの権限を要求します。
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { IconInboxEmpty } from "../components/icons";
import { api } from "../lib/api";
import { listenEvent } from "../lib/tauri";
import type { MailNotice } from "../lib/types";
import { listItem, staggerList } from "../lib/motion";
import { useSettings } from "../state/SettingsContext";

interface Notice extends MailNotice {
  id: number;
  at: Date;
}

export function MailTab() {
  const { settings } = useSettings();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [checking, setChecking] = useState(false);
  let seq = 0;

  useEffect(() => {
    const un = listenEvent<MailNotice>("mail://new", (payload) => {
      seq += 1;
      setNotices((prev) => [{ ...payload, id: Date.now() + seq, at: new Date() }, ...prev].slice(0, 30));
    });
    return () => {
      un.then((f) => f());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCheckNow = async () => {
    setChecking(true);
    try {
      await api.pollMailNow();
    } finally {
      setTimeout(() => setChecking(false), 700);
    }
  };

  const watched = settings?.watched_senders ?? [];

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">監視中のメール</h2>
          <p className="mt-0.5 text-xs text-ink-faint">
            {!settings?.mail_watch_enabled
              ? "メール監視は一時停止中です（設定タブでオンにできます）"
              : watched.length > 0
                ? `${watched.length} 件の送信元を ${settings?.poll_interval_sec ?? 60} 秒ごとに確認しています`
                : "設定タブで監視するメールアドレスを追加してください"}
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleCheckNow}
          disabled={checking || watched.length === 0}
          className="flex items-center gap-2 rounded-lg border border-border-hi bg-overlay/5 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-overlay/10 disabled:opacity-40"
        >
          {checking && (
            <motion.span
              className="h-3 w-3 rounded-full border-2 border-current/30 border-t-current"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.6, ease: "linear" }}
            />
          )}
          今すぐ確認
        </motion.button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {watched.map((addr) => (
          <span
            key={addr}
            className="rounded-full border border-border bg-surface-hi px-2.5 py-1 text-[11px] text-ink-dim"
          >
            {addr}
          </span>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto rounded-2xl border border-border bg-surface/50 p-3">
        {notices.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-ink-faint">
            <IconInboxEmpty size={32} />
            <p className="text-sm">まだ新着通知はありません</p>
            <p className="text-xs">対象アドレスからメールが届くとここに表示され、デスクトップ通知が届きます</p>
          </div>
        ) : (
          <motion.ul variants={staggerList} initial="initial" animate="animate" className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {notices.map((n) => (
                <motion.li
                  key={n.id}
                  variants={listItem}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  layout
                  className="rounded-xl border border-border bg-surface-hi/70 px-3.5 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{n.from}</p>
                    <span className="shrink-0 text-[10px] text-ink-faint">
                      {n.at.getHours().toString().padStart(2, "0")}:{n.at.getMinutes().toString().padStart(2, "0")}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-dim">{n.subject || "(件名なし)"}</p>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>
    </div>
  );
}

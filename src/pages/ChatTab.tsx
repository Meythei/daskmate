import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { IconChat } from "../components/icons";
import { api } from "../lib/api";
import { listItem, staggerList } from "../lib/motion";
import type { ChatSpace } from "../lib/types";

const SPACE_TYPE_LABEL: Record<string, string> = {
  SPACE: "スペース",
  GROUP_CHAT: "グループ",
  DIRECT_MESSAGE: "DM",
};

export function ChatTab() {
  const [spaces, setSpaces] = useState<ChatSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [justSent, setJustSent] = useState(false);

  const loadSpaces = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await api.listChatSpaces();
      setSpaces(list);
      if (list.length > 0) setSelected((prev) => prev ?? list[0].name);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSpaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = async () => {
    if (!selected || !text.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      await api.sendChatMessage(selected, text.trim());
      setText("");
      setJustSent(true);
      setTimeout(() => setJustSent(false), 1600);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Google Chat</h2>
          <p className="mt-0.5 text-xs text-ink-faint">参加しているスペースにメッセージを送信します</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={loadSpaces}
          disabled={loading}
          className="rounded-lg border border-border-hi bg-overlay/5 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-overlay/10 disabled:opacity-40"
        >
          再読み込み
        </motion.button>
      </div>

      <AnimatePresence>
        {loadError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-xs leading-relaxed text-bad"
          >
            {loadError}
            <br />
            権限不足の場合は設定タブでログアウトし、再度サインインして Chat
            の権限を許可してください。
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex min-h-0 flex-1 gap-4">
        <div className="w-56 shrink-0 overflow-y-auto rounded-2xl border border-border bg-surface/50 p-2">
          {loading ? (
            <div className="grid h-full place-items-center">
              <motion.span
                className="h-5 w-5 rounded-full border-2 border-border-hi border-t-brand-2"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}
              />
            </div>
          ) : spaces.length === 0 ? (
            <p className="p-3 text-xs leading-relaxed text-ink-faint">
              参加しているスペースが見つかりませんでした。
            </p>
          ) : (
            <motion.ul variants={staggerList} initial="initial" animate="animate" className="flex flex-col gap-1">
              {spaces.map((space) => {
                const isSelected = space.name === selected;
                return (
                  <motion.li key={space.name} variants={listItem}>
                    <button
                      onClick={() => setSelected(space.name)}
                      className="relative flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors"
                    >
                      {isSelected && (
                        <motion.div
                          layoutId="chat-space-selected"
                          className="absolute inset-0 rounded-xl bg-ink"
                          transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        />
                      )}
                      <span
                        className={`relative z-10 truncate ${isSelected ? "font-medium text-bg-deep" : "text-ink-dim"}`}
                      >
                        {space.display_name}
                      </span>
                      <span
                        className={`relative z-10 ml-auto shrink-0 text-[10px] ${isSelected ? "text-bg-deep/60" : "text-ink-faint"}`}
                      >
                        {SPACE_TYPE_LABEL[space.space_type] ?? space.space_type}
                      </span>
                    </button>
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-3 rounded-2xl border border-border bg-surface/50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <IconChat size={16} className="text-ink-faint" />
            {spaces.find((s) => s.name === selected)?.display_name ?? "スペースを選択してください"}
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
            }}
            disabled={!selected}
            placeholder="メッセージを入力… (Ctrl+Enter で送信)"
            className="flex-1 resize-none rounded-xl border border-border bg-bg-deep/40 p-3 text-sm outline-none placeholder:text-ink-faint focus:border-brand-1/60 disabled:opacity-50"
          />

          <AnimatePresence>
            {sendError && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="text-xs text-bad"
              >
                {sendError}
              </motion.p>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-end gap-3">
            <AnimatePresence>
              {justSent && (
                <motion.span
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-ink-faint"
                >
                  送信しました ✓
                </motion.span>
              )}
            </AnimatePresence>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleSend}
              disabled={!selected || !text.trim() || sending}
              className="flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-bg-deep disabled:opacity-40"
            >
              {sending && (
                <motion.span
                  className="h-3 w-3 rounded-full border-2 border-bg-deep/30 border-t-bg-deep"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.6, ease: "linear" }}
                />
              )}
              送信
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}

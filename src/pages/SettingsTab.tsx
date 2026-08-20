import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Toggle } from "../components/Toggle";
import type { EventTemplate, Settings } from "../lib/types";
import { useAuth } from "../state/AuthContext";
import { useSettings } from "../state/SettingsContext";

const PRESET_COLORS = ["#f4f4f5", "#d4d4d8", "#a1a1aa", "#71717a", "#52525b", "#3f3f46", "#27272a"];

function SectionCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-surface/50 p-5"
    >
      <h3 className="text-sm font-semibold">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
      <div className="mt-4">{children}</div>
    </motion.section>
  );
}

export function SettingsTab() {
  const { profile, logout } = useAuth();
  const { settings, update } = useSettings();
  const [newAddr, setNewAddr] = useState("");
  const [newTplTitle, setNewTplTitle] = useState("");
  const [newTplColor, setNewTplColor] = useState(PRESET_COLORS[0]);
  const [newTplDuration, setNewTplDuration] = useState(30);

  if (!settings) {
    return <div className="text-sm text-ink-faint">読み込み中…</div>;
  }

  const patch = (partial: Partial<Settings>) => update({ ...settings, ...partial });

  const addSender = () => {
    const v = newAddr.trim();
    if (!v || settings.watched_senders.includes(v)) return;
    patch({ watched_senders: [...settings.watched_senders, v] });
    setNewAddr("");
  };

  const removeSender = (addr: string) => {
    patch({ watched_senders: settings.watched_senders.filter((a) => a !== addr) });
  };

  const addTemplate = () => {
    const title = newTplTitle.trim();
    if (!title) return;
    const tpl: EventTemplate = {
      id: `tpl-${Date.now()}`,
      title,
      color: newTplColor,
      duration_min: newTplDuration,
    };
    patch({ templates: [...settings.templates, tpl] });
    setNewTplTitle("");
    setNewTplDuration(30);
  };

  const removeTemplate = (id: string) => {
    patch({ templates: settings.templates.filter((t) => t.id !== id) });
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1">
      <SectionCard title="アカウント">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-ink text-sm font-semibold text-bg-deep">
              {profile?.picture ? (
                <img src={profile.picture} alt="" className="h-full w-full object-cover" />
              ) : (
                (profile?.name ?? "?").slice(0, 1)
              )}
            </div>
            <div>
              <p className="text-sm font-medium">{profile?.name}</p>
              <p className="text-xs text-ink-faint">{profile?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-ink-dim transition-colors hover:border-bad/50 hover:text-bad"
          >
            ログアウト
          </button>
        </div>
      </SectionCard>

      <SectionCard title="メール監視" hint="指定したアドレスから新着メールが届いた瞬間にデスクトップ通知します">
        <div className="flex items-center justify-between rounded-xl border border-border bg-surface-hi/50 px-3.5 py-2.5">
          <span className="text-sm">通知を有効にする</span>
          <Toggle
            checked={settings.mail_watch_enabled}
            onChange={(v) => patch({ mail_watch_enabled: v })}
            label="メール監視の有効/無効"
          />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <input
            value={newAddr}
            onChange={(e) => setNewAddr(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSender()}
            placeholder="boss@example.com"
            className="flex-1 rounded-lg border border-border bg-bg-deep/40 px-3 py-2 text-sm outline-none placeholder:text-ink-faint focus:border-brand-1/60"
          />
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={addSender}
            className="rounded-lg bg-ink px-3.5 py-2 text-sm font-medium text-bg-deep"
          >
            追加
          </motion.button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <AnimatePresence initial={false}>
            {settings.watched_senders.map((addr) => (
              <motion.span
                key={addr}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1.5 rounded-full border border-border bg-surface-hi px-2.5 py-1 text-xs"
              >
                {addr}
                <button onClick={() => removeSender(addr)} className="text-ink-faint hover:text-bad">
                  ✕
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
          {settings.watched_senders.length === 0 && (
            <p className="text-xs text-ink-faint">監視するアドレスがまだありません</p>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-ink-dim">
          <span>確認間隔</span>
          <div className="flex items-center gap-1.5">
            {[30, 60, 300].map((sec) => (
              <button
                key={sec}
                onClick={() => patch({ poll_interval_sec: sec })}
                className={`rounded-lg border px-2.5 py-1 transition-colors ${
                  settings.poll_interval_sec === sec
                    ? "border-brand-1/60 bg-brand-1/15 text-ink"
                    : "border-border text-ink-faint hover:text-ink"
                }`}
              >
                {sec < 60 ? `${sec}秒` : `${sec / 60}分`}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="標準出勤時間" hint="この時間帯の中で、予定テンプレートが上から順に詰めて配置されます">
        <div className="flex items-center gap-3">
          <input
            type="time"
            value={settings.work_start}
            onChange={(e) => patch({ work_start: e.target.value })}
            className="rounded-lg border border-border bg-bg-deep/40 px-3 py-2 text-sm outline-none focus:border-brand-1/60"
          />
          <span className="text-ink-faint">〜</span>
          <input
            type="time"
            value={settings.work_end}
            onChange={(e) => patch({ work_end: e.target.value })}
            className="rounded-lg border border-border bg-bg-deep/40 px-3 py-2 text-sm outline-none focus:border-brand-1/60"
          />
        </div>
      </SectionCard>

      <SectionCard title="よく使う予定テンプレート" hint="カレンダー画面でクリックすると、この予定が自動で入力されます">
        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {settings.templates.map((tpl) => (
              <motion.div
                key={tpl.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface-hi/50 px-3 py-2"
              >
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: tpl.color }} />
                <span className="flex-1 truncate text-sm">{tpl.title}</span>
                <span className="text-xs text-ink-faint">{tpl.duration_min}分</span>
                <button
                  onClick={() => removeTemplate(tpl.id)}
                  className="text-ink-faint transition-colors hover:text-bad"
                  aria-label="削除"
                >
                  ✕
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-border-hi/60 p-3">
          <div className="flex items-center gap-2">
            <input
              value={newTplTitle}
              onChange={(e) => setNewTplTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTemplate()}
              placeholder="予定の名前（例: 定例MTG）"
              className="flex-1 rounded-lg border border-border bg-bg-deep/40 px-3 py-2 text-sm outline-none placeholder:text-ink-faint focus:border-brand-1/60"
            />
            <select
              value={newTplDuration}
              onChange={(e) => setNewTplDuration(Number(e.target.value))}
              className="rounded-lg border border-border bg-bg-deep/40 px-2 py-2 text-sm outline-none focus:border-brand-1/60"
            >
              {[30, 60, 90, 120].map((m) => (
                <option key={m} value={m}>
                  {m}分
                </option>
              ))}
            </select>
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewTplColor(c)}
                className="h-6 w-6 rounded-full border border-border-hi transition-transform"
                style={{
                  backgroundColor: c,
                  outline: newTplColor === c ? "2px solid var(--color-ink)" : "none",
                  outlineOffset: 2,
                  transform: newTplColor === c ? "scale(1.1)" : "scale(1)",
                }}
                aria-label={c}
              />
            ))}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={addTemplate}
              className="ml-auto rounded-lg bg-ink px-3.5 py-1.5 text-xs font-medium text-bg-deep"
            >
              テンプレートを追加
            </motion.button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

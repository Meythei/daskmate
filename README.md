# DeskMate

Google アカウントでサインインし、指定した送信元からのメールをデスクトップ通知で
知らせ、Google Calendar によく使う予定をワンクリックで詰め込める Tauri 製の
デスクトップアプリです。

- サインイン: Google OAuth (PKCE, システムブラウザ) + Firebase Auth
- メール監視: 指定アドレスからの新着を起動中ポーリングし、デスクトップ通知
- カレンダー: テンプレートをクリックすると標準出勤時間内に30分単位で自動配置
  （前後が同じ予定なら連結してまとめる）
- UI: React + Tailwind CSS v4 + Framer Motion（トグルスイッチ、スライドする
  アクティブタブ、画面遷移アニメーション）

セットアップ手順（Google Cloud / Firebase の接続情報の取得方法）は
[SETUP.md](./SETUP.md) を参照してください。

## 開発

```bash
npm install
cp .env.example .env   # Google/Firebase の情報を入力
npm run tauri dev
```

`.env` 未設定でも `npm run dev` でモックデータによる UI プレビューが可能です。

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

# DeskMate セットアップ

DeskMate は Tauri (Rust) + React で作られたデスクトップアプリです。Gmail / Google
Calendar への安全なアクセスと、Firebase Auth によるサインインには **あなた自身の
Google Cloud プロジェクトと Firebase プロジェクト**の接続情報が必要です（第三者の
バックエンドは一切経由しません — アクセストークンは常にこの PC 内の OS キーチェーン
にのみ保存されます）。

## 1. Google Cloud Console

1. https://console.cloud.google.com/ で新しいプロジェクトを作成（または既存のものを使用）。
2. **APIs & Services > Library** で以下を有効化:
   - Gmail API
   - Google Calendar API
   - Google Chat API
3. **APIs & Services > OAuth consent screen** を設定（外部 / テストユーザーに自分の
   Google アカウントを追加すればOK。scopes は `gmail.readonly`・`calendar`・
   `chat.spaces.readonly`・`chat.messages.create` を追加）。
4. **APIs & Services > Credentials > Create Credentials > OAuth client ID** で
   アプリケーションの種類に **「デスクトップ アプリ」** を選択して作成。
   - 発行された **クライアントID** と **クライアントシークレット** を控える。

> DeskMate はブラウザを介した OAuth 2.0 (PKCE + ループバックリダイレクト) を使って
> います。Google はデスクトップ埋め込みブラウザでの認証を許可していないため、
> サインイン時はシステムの既定ブラウザが開きます。ローカルの待受先は
> `GOOGLE_REDIRECT_URI`（既定は `http://127.0.0.1:53682/callback`）で固定ポートに
> しているので、他のアプリがそのポートを使っていないか気になる場合はポート番号を
> 変えてください。「デスクトップ アプリ」タイプは登録済みリダイレクトURIとの
> 完全一致を要求しないため、Cloud Console 側への追加登録は不要です。

## 2. Firebase

1. https://console.firebase.google.com/ でプロジェクトを作成（Google Cloud の
   プロジェクトと同じものを選択すると管理が楽です）。
2. **Authentication > Sign-in method** で **Google** プロバイダを有効化。
3. プロジェクトの設定（歯車アイコン）> **全般** の一番下、「マイアプリ」で
   ウェブアプリを追加すると "SDK の設定と構成" に config オブジェクトが
   表示されます。そこにある値をそのまま `.env` に貼り付けられます。

DeskMate は Google のログインで得た id_token を Firebase の
`accounts:signInWithIdp` エンドポイントに渡して Firebase セッションを発行します
（Firebase Web SDK は使わず、Rust 側から直接 REST API を呼び出しています）。
実際に使うのは `FIREBASE_API_KEY` のみで、他の値は未設定でも動作します。

## 3. `.env` の設定

`deskmate/.env.example` を `.env` にコピーし、値を入力してください。
**設定はすべて Rust 側（Tauri バックエンド）で読み込まれ、フロントエンドの
JS バンドルには一切含まれません** — そのため Vite の `VITE_` プレフィックスは
不要です。

```bash
cp .env.example .env
```

```
GOOGLE_CLIENT_ID=xxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_REDIRECT_URI=http://127.0.0.1:53682/callback

FIREBASE_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_DATABASE_URL=
FIREBASE_PROJECT_ID=your-project
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=1234567890
FIREBASE_APP_ID=1:1234567890:web:xxxxxxxxxxxxxxxx
FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

`.env` は `deskmate/`（プロジェクトルート）に置いてください。`npm run tauri dev`
の実行時、作業ディレクトリが `src-tauri/` になっていても起動時に親ディレクトリを
自動的に探して読み込みます。

## 4. 起動

```bash
npm install
npm run tauri dev
```

`.env` を設定しない状態でも `npm run dev`（Tauri を介さないブラウザプレビュー）は
モックデータで動作し、UI やアニメーションの確認ができます。実際の Gmail /
Calendar と連携するには `npm run tauri dev` で Tauri アプリとして起動してください。

## 仕組みのメモ

- **保存場所**: リフレッシュトークン（Google / Firebase）は OS のキーチェーン
  (Windows Credential Manager / macOS Keychain / libsecret) に保存されます。
  監視アドレスやテンプレートなどの設定はアプリのローカルデータフォルダに
  平文 JSON で保存されます。
- **メール監視**: アプリがフォアグラウンド/バックグラウンドで起動している間のみ、
  設定した間隔で Gmail API をポーリングします。OS 常駐サービスは作成しません。
- **カレンダー詰め込み**: テンプレートをクリックすると、標準出勤時間の中で
  30分単位に空いている最も早い枠に予定を作成します。直前 or
  直後に同じタイトルの予定があれば、新規作成せずその予定の時間を延長して
  1つにまとめます。
- **Google Chat**: サインイン中のユーザーとして、参加しているスペース一覧の
  取得とメッセージ送信のみ行います（Bot は使いません）。この機能は既存の
  Google ログインにスコープを追加しただけなので、**既にログイン済みの場合は
  一度ログアウトして再サインインしてください**（Google は毎回同意画面を
  出す設定にしてあるので、そのまま新しいスコープが許可されます）。

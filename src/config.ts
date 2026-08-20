export const config = {
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET ?? "",
  firebaseApiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "",
};

export const isConfigured = Boolean(config.googleClientId && config.firebaseApiKey);

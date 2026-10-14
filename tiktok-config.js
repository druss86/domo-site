// Public config only. The client SECRET never goes here (it lives as a Worker secret).
window.TT = {
  CLIENT_KEY: "sbawsteevczklh29mo",
  BACKEND: "https://domo-tiktok-api.druss86.workers.dev",
  REDIRECT_URI: "https://druss86.github.io/domo-site/callback.html",
  SCOPES: "user.info.basic,video.upload",
  USE_PKCE: true,
};

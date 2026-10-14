(async () => {
  const msg = document.getElementById("cb-msg");
  const q = new URLSearchParams(location.search);
  const state = sessionStorage.getItem("tt_state");
  if (q.get("error")) { msg.textContent = "TikTok sign-in was cancelled or failed: " + (q.get("error_description") || q.get("error")); return; }
  if (!q.get("code") || !state || q.get("state") !== state) { msg.textContent = "Sign-in check failed (state mismatch). Please try again."; return; }
  sessionStorage.removeItem("tt_state");
  try {
    const r = await fetch(TT.BACKEND + "/token", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: q.get("code"), code_verifier: sessionStorage.getItem("tt_verifier") || undefined }),
    }).then(r => r.json());
    sessionStorage.removeItem("tt_verifier");
    if (!r.access_token) throw new Error(r.error_description || r.error || "no token");
    sessionStorage.setItem("tt_token", r.access_token);
    history.replaceState(null, "", "callback.html"); // drop the code from the URL
    location.replace("app.html");
  } catch (e) { msg.textContent = "Couldn't finish sign-in: " + e.message; }
})();

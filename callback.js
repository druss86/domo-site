(async () => {
  const msg = document.getElementById("cb-msg");
  const q = new URLSearchParams(location.search);
  const state = sessionStorage.getItem("tt_state");
  if (q.get("error")) { msg.textContent = "TikTok sign-in was cancelled or failed: " + (q.get("error_description") || q.get("error")); return; }
  // CLI flow: state starts with "cli_" -> show the code for copying, don't exchange it here.
  if ((q.get("state") || "").startsWith("cli_") && q.get("code")) {
    const code = q.get("code");
    document.querySelector("main h1").textContent = "TikTok code for the DOMO CLI";
    msg.innerHTML = "";
    const p = document.createElement("p"); p.textContent = "Copy this code and give it to: node /workspace/domo-tiktok-cli/auth.js --code <code>  (it expires in a few minutes)";
    const box = document.createElement("textarea"); box.id = "cli-code"; box.readOnly = true; box.rows = 3; box.value = code;
    box.style.cssText = "width:100%;font-family:monospace;background:#07080a;color:#dfae60;border:1px solid #26231d;padding:8px";
    const btn = document.createElement("button"); btn.className = "btn"; btn.id = "copy-btn"; btn.textContent = "Copy code";
    btn.onclick = async () => { try { await navigator.clipboard.writeText(code); } catch { box.select(); document.execCommand("copy"); } btn.textContent = "Copied!"; };
    msg.append(p, box, btn);
    history.replaceState(null, "", "callback.html");
    return;
  }
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

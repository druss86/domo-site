(() => {
  const $ = (id) => document.getElementById(id);
  const rand = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, "0")).join("");
  async function sha256hex(s) {
    const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return Array.from(new Uint8Array(d), b => b.toString(16).padStart(2, "0")).join("");
  }
  const token = () => sessionStorage.getItem("tt_token");
  const api = (path, opts = {}) => fetch(TT.BACKEND + path, {
    ...opts, headers: { "Content-Type": "application/json", Authorization: "Bearer " + token(), ...(opts.headers || {}) },
  }).then(r => r.json());
  const setStatus = (t) => { $("status").textContent = t; };

  // Login: CSRF state + PKCE
  $("login-btn").onclick = async () => {
    const state = rand(16);
    sessionStorage.setItem("tt_state", state);
    const p = new URLSearchParams({
      client_key: TT.CLIENT_KEY, response_type: "code", scope: TT.SCOPES,
      redirect_uri: TT.REDIRECT_URI, state,
    });
    if (TT.USE_PKCE) {
      const verifier = rand(32); // 64 chars, within 43–128
      sessionStorage.setItem("tt_verifier", verifier);
      p.set("code_challenge", await sha256hex(verifier)); // TikTok uses hex-encoded SHA256
      p.set("code_challenge_method", "S256");
    }
    location.href = "https://www.tiktok.com/v2/auth/authorize/?" + p.toString();
  };

  $("logout-btn").onclick = () => { sessionStorage.clear(); location.reload(); };

  async function showCreator() {
    const r = await api("/user");
    const u = r.data && r.data.user;
    if (!u) { sessionStorage.removeItem("tt_token"); return; }
    $("nickname").textContent = u.display_name;
    $("avatar").src = u.avatar_url;
    $("login-card").classList.add("hidden");
    $("app-card").classList.remove("hidden");
  }

  let file = null;
  $("file").onchange = (e) => {
    file = e.target.files[0];
    if (!file) return;
    const v = $("preview");
    v.src = URL.createObjectURL(file); v.classList.remove("hidden");
    $("file-info").textContent = `${file.name} · ${(file.size / 1048576).toFixed(1)} MB`;
    $("upload-btn").disabled = false;
  };

  // TikTok chunk rules: files < 5 MB -> one chunk; else chunks of 5–64 MB, last chunk may be larger (≤128 MB).
  function plan(size) {
    const MB = 1048576, CH = 10 * MB;
    if (size < 5 * MB) return { chunk_size: size, total_chunk_count: 1 };
    return { chunk_size: CH, total_chunk_count: Math.max(1, Math.floor(size / CH)) };
  }

  async function putChunk(url, blob, start, end, total) {
    const headers = { "Content-Type": file.type || "video/mp4", "Content-Range": `bytes ${start}-${end}/${total}` };
    try {
      const r = await fetch(url, { method: "PUT", headers, body: blob });
      if (r.ok) return;
      throw new Error("direct " + r.status);
    } catch (e) {
      // CORS fallback via Worker proxy
      const r = await fetch(TT.BACKEND + "/upload/chunk", {
        method: "PUT", headers: { ...headers, Authorization: "Bearer " + token(), "X-Upload-Url": url }, body: blob,
      });
      if (!r.ok) throw new Error("Upload failed (" + r.status + ")");
    }
  }

  $("upload-btn").onclick = async () => {
    if (!file) return;
    $("upload-btn").disabled = true;
    try {
      setStatus("Starting upload…");
      const { chunk_size, total_chunk_count } = plan(file.size);
      const init = await api("/upload/init", { method: "POST", body: JSON.stringify({ video_size: file.size, chunk_size, total_chunk_count }) });
      if (!init.data || init.error?.code !== "ok") throw new Error(init.error?.message || init.error?.code || "init failed");
      const { publish_id, upload_url } = init.data;
      $("progress").classList.remove("hidden");
      for (let i = 0; i < total_chunk_count; i++) {
        const start = i * chunk_size;
        const end = i === total_chunk_count - 1 ? file.size - 1 : start + chunk_size - 1;
        await putChunk(upload_url, file.slice(start, end + 1), start, end, file.size);
        $("bar").style.width = Math.round(((i + 1) / total_chunk_count) * 100) + "%";
      }
      setStatus("Uploaded. Waiting for TikTok to process…");
      poll(publish_id, 0);
    } catch (e) {
      setStatus("Error: " + e.message);
      $("upload-btn").disabled = false;
    }
  };

  async function poll(publish_id, n) {
    const r = await api("/status", { method: "POST", body: JSON.stringify({ publish_id }) });
    const s = r.data?.status;
    if (s === "SEND_TO_USER_INBOX" || s === "PUBLISH_COMPLETE") {
      setStatus("Done! Check your TikTok inbox notifications to finish editing and posting.");
    } else if (s === "FAILED") {
      setStatus("TikTok couldn't process this video: " + (r.data.fail_reason || "unknown reason"));
      $("upload-btn").disabled = false;
    } else if (n < 40) {
      setStatus("Processing on TikTok… (" + (s || "pending") + ")");
      setTimeout(() => poll(publish_id, n + 1), 3000);
    } else setStatus("Still processing. Check your TikTok inbox in a few minutes.");
  }

  if (token()) showCreator();
})();

(() => {
  const panel = document.querySelector("[data-rosie-panel]");
  const log = document.querySelector("[data-rosie-log]");
  const form = document.querySelector("[data-rosie-form]");
  const statusEl = document.querySelector("[data-rosie-status]");
  const openers = document.querySelectorAll("[data-rosie-open]");
  const closer = document.querySelector("[data-rosie-close]");
  const endpoint = "/api/rosie";

  const OFFLINE_HELLO =
    "I'm Rosie — I live in the wall at BlackBarn Labs. The public wire isn't connected to the barn yet, so I can hear you here, but I can't think on the open internet until Chris tunnels me through.\n\nLeave him a note at chris@blackbarnlabs.com, or try again from the lab.";

  const sessionKey = "bbl-rosie-session";
  const getSession = () => {
    let id = localStorage.getItem(sessionKey);
    if (!id) {
      id = `web-${crypto.randomUUID?.() || String(Date.now())}`;
      localStorage.setItem(sessionKey, id);
    }
    return id;
  };

  const addMsg = (role, text) => {
    if (!log) return;
    const el = document.createElement("div");
    el.className = `rosie-msg ${role === "user" ? "user" : "bot"}`;
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  };

  const setStatus = (text, offline = false) => {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.toggle("is-offline", offline);
  };

  const setOpen = (open) => {
    if (!panel) return;
    panel.hidden = !open;
    panel.classList.toggle("is-open", open);
    document.body.classList.toggle("rosie-open", open);
    if (open && log && !log.dataset.greeted) {
      log.dataset.greeted = "1";
      addMsg("bot", "Rosie, BlackBarn Labs. What are you building?");
      ping();
    }
    if (open) {
      panel.querySelector("input")?.focus();
    }
  };

  const ping = async () => {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ping: true, session_id: getSession() }),
      });
      if (res.ok) {
        setStatus("On the wall", false);
        return true;
      }
    } catch {
      /* offline */
    }
    setStatus("Barn network only", true);
    return false;
  };

  const send = async (message) => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        session_id: getSession(),
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.reply || "offline");
    }
    return res.json();
  };

  if (location.hash === "#rosie") {
    setOpen(true);
  }

  openers.forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      setOpen(true);
    });
  });

  closer?.addEventListener("click", () => setOpen(false));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = form.querySelector("input");
    const button = form.querySelector("button");
    const message = (input?.value || "").trim();
    if (!message) return;

    addMsg("user", message);
    input.value = "";
    if (button) button.disabled = true;

    try {
      const data = await send(message);
      addMsg("bot", data.reply || "…");
      setStatus("On the wall", false);
    } catch {
      addMsg("bot", OFFLINE_HELLO);
      setStatus("Barn network only", true);
    } finally {
      if (button) button.disabled = false;
      input?.focus();
    }
  });
})();

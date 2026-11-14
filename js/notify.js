// Notify-me forms: progressive enhancement. Without JS the form posts to
// /api/notify and the Worker answers with a plain page.
(() => {
  const MESSAGES = {
    ok: "Thanks. You're on the list.",
    invalid: "That email address doesn't look right. Check it and try again.",
    rate_limited: "Too many tries from your connection. Wait a few minutes and try again.",
    offline: "Signups aren't switched on yet. Email chris@blackbarnlabs.com and ask to be told.",
    error: "That didn't go through. Try again, or email chris@blackbarnlabs.com.",
  };

  document.querySelectorAll("form[data-notify]").forEach((form) => {
    const status = form.querySelector("[data-notify-status]");
    const button = form.querySelector("button[type=submit]");

    const show = (text, isError) => {
      if (!status) return;
      status.textContent = text;
      status.classList.toggle("is-error", Boolean(isError));
    };

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = form.querySelector("input[name=email]");
      if (email && !email.checkValidity()) {
        show(MESSAGES.invalid, true);
        email.focus();
        return;
      }
      if (button) button.disabled = true;
      show("Sending…", false);
      try {
        const res = await fetch(form.action, {
          method: "POST",
          headers: { Accept: "application/json" },
          body: new URLSearchParams(new FormData(form)),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          show(MESSAGES.ok, false);
          form.reset();
        } else {
          show(MESSAGES[data.error] || MESSAGES.error, true);
        }
      } catch {
        show(MESSAGES.error, true);
      } finally {
        if (button) button.disabled = false;
      }
    });
  });
})();

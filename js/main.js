(() => {
  const header = document.querySelector("[data-header]");
  const toggle = document.querySelector("[data-menu-toggle]");
  const nav = document.querySelector("[data-nav]");
  const hero = document.querySelector("[data-hero]");
  const email = "chris@blackbarnlabs.com";

  const setScrolled = () => {
    header?.classList.toggle("is-scrolled", window.scrollY > 8);
  };

  setScrolled();
  window.addEventListener("scroll", setScrolled, { passive: true });

  const setNav = (open) => {
    document.body.classList.toggle("nav-open", open);
    toggle?.setAttribute("aria-expanded", String(open));
    toggle?.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };

  toggle?.addEventListener("click", () => {
    setNav(!document.body.classList.contains("nav-open"));
  });

  nav?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setNav(false));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setNav(false);
  });

  if (hero && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    hero.addEventListener("pointermove", (event) => {
      const rect = hero.getBoundingClientRect();
      hero.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      hero.style.setProperty("--my", `${event.clientY - rect.top}px`);
    });
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.14, rootMargin: "0px 0px -8% 0px" }
  );

  document.querySelectorAll(".in-view").forEach((el) => observer.observe(el));

  const copyBtn = document.querySelector("[data-copy-email]");
  const status = document.querySelector("[data-copy-status]");

  copyBtn?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(email);
      if (status) status.textContent = "Copied to clipboard";
      copyBtn.textContent = "Copied";
      window.setTimeout(() => {
        copyBtn.textContent = "Copy address";
      }, 2000);
    } catch {
      if (status) status.textContent = email;
    }
  });

  const year = document.querySelector("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());
})();

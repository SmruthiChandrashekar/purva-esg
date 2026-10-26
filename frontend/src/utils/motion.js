/**
 * motion.js — small, dependency-free motion helpers.
 *  - scroll reveal: cards and sections settle in as they enter the viewport
 *  - navbar material: denser blur and a hairline once the page has scrolled
 * Everything is skipped under prefers-reduced-motion.
 */

const REVEAL_SELECTOR = [
  ".tile-card", ".journey-stop", ".home-about .row > *", ".home-stat-card",
  ".auth-feature-card", ".dashboard-action-card",
].map((sel) => `.grm-ui ${sel}`).join(","); // GRM app only; the website pages are untouched

export function initMotion() {
  if (typeof window === "undefined") return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  // ── Navbar: add a hairline + stronger material once content scrolls under it ──
  const onScroll = () => {
    document.documentElement.toggleAttribute("data-scrolled", window.scrollY > 8);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (reduce.matches || !("IntersectionObserver" in window)) return;

  // ── Scroll reveal ──
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-in");
      io.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });

  const seen = new WeakSet();
  const scan = (root) => {
    root.querySelectorAll?.(REVEAL_SELECTOR).forEach((el) => {
      if (seen.has(el)) return;
      seen.add(el);
      // Stagger siblings that arrive together (grid rows, card lists).
      const idx = Array.prototype.indexOf.call(el.parentElement?.children || [], el);
      el.style.setProperty("--reveal-delay", `${Math.min(idx, 6) * 70}ms`);
      el.classList.add("reveal");
      io.observe(el);
    });
  };

  const root = document.getElementById("root");
  if (!root) return;
  scan(root);
  // Routes render lazily, so watch for new nodes.
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; scan(root); });
  }).observe(root, { childList: true, subtree: true });
}

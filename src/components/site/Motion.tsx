"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/*
 * Site-wide motion paced like the UI reference (referensi/recon-ui/MOTION.txt), in one small engine:
 *   - [data-reveal]: fade + rise once when it enters (one IntersectionObserver; app-page cards below the fold are tagged too)
 *   - [data-lines]: masked title lines scrubbed by scroll (--p 0..1 written in one rAF loop)
 *   - [data-open]: the wide media card opens with scroll (--o 0..1, inner picture parallax --py)
 *   - [data-follow]: a preview card that drifts toward the pointer inside its section
 *   - [data-count]: numbers that count up once when visible
 * All of it is skipped under prefers-reduced-motion (the head script never sets html.motion), and nothing is hidden unless
 * html.motion is set, so content stays visible without JavaScript and in screenshots of a hidden tab.
 */
declare global {
  interface Window {
    __ptMotion?: boolean;
  }
}

export function Motion() {
  const path = usePathname();
  useEffect(() => {
    const root = document.documentElement;
    window.__ptMotion = true;
    if (!root.classList.contains("motion")) return;

    // auto-tag app surfaces so app pages get the same reveal without touching every component
    document.querySelectorAll<HTMLElement>("main .card, main .card-soft, main .tbl-wrap, main .verdict").forEach((el, i) => {
      if (el.closest("[data-reveal]") || el.hasAttribute("data-reveal")) return;
      const r = el.getBoundingClientRect();
      if (r.top < innerHeight * 0.9) return;
      el.setAttribute("data-reveal", "");
      el.style.setProperty("--rd", `${(i % 3) * 70}ms`);
    });

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("in");
          io.unobserve(e.target);
          const n = e.target.querySelectorAll<HTMLElement>("[data-count]");
          (e.target.hasAttribute("data-count") ? [e.target as HTMLElement] : [...n]).forEach(countUp);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    const watch = () => document.querySelectorAll("[data-reveal]:not(.in), [data-count]:not([data-counted])").forEach((el) => io.observe(el));
    watch();
    // content that renders later (live data, client tools) is picked up too
    const mo = new MutationObserver(() => watch());
    mo.observe(document.querySelector("main") ?? document.body, { childList: true, subtree: true });

    let raf = 0;
    const tick = () => {
      raf = 0;
      const vh = innerHeight;
      document.querySelectorAll<HTMLElement>("[data-lines]").forEach((el) => {
        const r = el.getBoundingClientRect();
        // 0 while the title's top is at the bottom of the screen, 1 once it reaches 70 % of the height
        const p = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.3)));
        el.style.setProperty("--p", p.toFixed(3));
      });
      document.querySelectorAll<HTMLElement>("[data-open]").forEach((el) => {
        const r = el.getBoundingClientRect();
        const o = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.8)));
        el.style.setProperty("--o", o.toFixed(3));
        const mid = (r.top + r.height / 2 - vh / 2) / vh;
        el.style.setProperty("--py", `${(mid * -40).toFixed(1)}px`);
      });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    tick();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);

    const followers = [...document.querySelectorAll<HTMLElement>("[data-follow]")];
    const onMove = (ev: PointerEvent) => {
      for (const f of followers) {
        const host = f.parentElement?.closest("section") ?? f.parentElement;
        if (!host) continue;
        const r = host.getBoundingClientRect();
        if (ev.clientY < r.top || ev.clientY > r.bottom) continue;
        const dx = (ev.clientX - (r.left + r.width / 2)) / r.width;
        const dy = (ev.clientY - (r.top + r.height / 2)) / r.height;
        f.style.transform = `translate(${(dx * 60).toFixed(1)}px, ${(dy * 40).toFixed(1)}px) rotate(${(dx * 4).toFixed(2)}deg)`;
      }
    };
    if (followers.length) addEventListener("pointermove", onMove, { passive: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
      removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [path]);
  return null;
}

function countUp(el: HTMLElement) {
  if (el.dataset.counted) return;
  el.dataset.counted = "1";
  const end = Number(el.dataset.count);
  if (!Number.isFinite(end)) return;
  const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
  const t0 = performance.now();
  const dur = 1200;
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / dur);
    el.textContent = fmt(end * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

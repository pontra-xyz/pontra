"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NAV } from "@/config/nav";
import { Wordmark } from "@/components/site/Mark";
import { CloseIcon } from "@/components/site/Icons";
import { NavWallet } from "@/components/wallet/WalletButton";
import { CaBox } from "@/components/site/CaCopy";
import { useFocusTrap } from "@/components/site/useFocusTrap";

/*
 * As the UI reference: a fixed, transparent header (wordmark left, upper-case links in the middle, an underlined call to action
 * on the right). Past the first screen the middle links step away and only the action and MENU stay; MENU opens a full-screen
 * black menu. Pontra adds the wallet button and the CA pill (inside the menu) the project rules require.
 */
export function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [solid, setSolid] = useState(false);
  const [compact, setCompact] = useState(false);
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const on = () => {
      setSolid(window.scrollY > 12);
      setCompact(window.scrollY > Math.min(560, window.innerHeight * 0.6));
      // like the reference, the header turns white-on-black while a black section is under it
      const probe = 40;
      const under = [...document.querySelectorAll<HTMLElement>("main .is-dark, footer.is-dark")].some((el) => {
        const r = el.getBoundingClientRect();
        return r.top <= probe && r.bottom > probe;
      });
      setDark(under);
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <>
      <header className={`hdr ${solid ? "solid" : ""} ${compact ? "compact" : ""} ${dark ? "on-dark" : ""}`} data-testid="header">
        <div className="wrap flex h-[76px] items-center gap-4 md:h-[110px]">
          <Link href="/" aria-label="Pontra home" className="shrink-0">
            <Wordmark size={34} dark={dark} />
          </Link>
          <nav aria-label="Main" className="hdr-nav hidden flex-1 items-center justify-center gap-[clamp(18px,2.6vw,42px)] xl:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={path === n.href || path.startsWith(`${n.href}/`) ? "page" : undefined}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex min-w-0 items-center gap-3 md:gap-6 xl:ml-0">
            <Link href="/workspace" className="ulink hidden md:inline">
              Open app
            </Link>
            <NavWallet label="Connect" />
            <button type="button" className="ulink" aria-expanded={open} onClick={() => setOpen(true)} data-testid="menu-open">
              Menu
            </button>
          </div>
        </div>
      </header>
      {open ? <MobileMenu onClose={() => setOpen(false)} path={path} /> : null}
    </>
  );
}

function MobileMenu({ onClose, path }: { onClose: () => void; path: string }) {
  const trap = useRef<HTMLDivElement>(null);
  useFocusTrap(trap, true, onClose);
  // Portal to <body>: the header's backdrop-filter would otherwise clip a fixed overlay to its own box.
  return createPortal(
    <div className="menu hero-in" role="dialog" aria-modal="true" aria-label="Menu" ref={trap} data-testid="menu">
      <div className="wrap flex h-[76px] items-center justify-between md:h-[110px]">
        <Wordmark size={34} dark />
        <button type="button" className="ulink" aria-label="Close the menu" onClick={onClose}>
          <span className="inline-flex items-center gap-2">
            Close <CloseIcon size={14} />
          </span>
        </button>
      </div>
      <div className="wrap grid gap-10 pb-12 md:grid-cols-[1.4fr_1fr] md:pt-6">
        <nav aria-label="Main">
          {[{ href: "/", label: "Home" }, ...NAV].map((n, i) => (
            <span className="ln" key={n.href}>
              <span style={{ "--i": i } as React.CSSProperties}>
                <Link href={n.href} onClick={onClose} className="menu-link" aria-current={path === n.href ? "page" : undefined}>
                  {n.label}
                </Link>
              </span>
            </span>
          ))}
        </nav>
        <div className="fade grid content-start gap-5" style={{ "--i": 3 } as React.CSSProperties}>
          <p className="body-md text-white/70">Cap tables, vesting and transfer checks. A proposal for Robinhood Chain, running here as a prototype on sample data.</p>
          <CaBox testid="menu-ca" />
          <Link href="/transfer" className="btn btn-line text-white" onClick={onClose}>
            Check a transfer
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  );
}

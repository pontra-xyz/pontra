export const NAV = [
  { href: "/workspace", label: "Workspace" },
  { href: "/vesting", label: "Vesting" },
  { href: "/transfer", label: "Transfer check" },
  { href: "/ledger", label: "Ledger" },
  { href: "/network", label: "Network" },
  { href: "/method", label: "Method" },
  { href: "/token", label: "Token" },
] as const;

/** Every public route, for the sitemap. */
export const ROUTES = ["/", "/workspace", "/vesting", "/transfer", "/ledger", "/network", "/method", "/token"] as const;

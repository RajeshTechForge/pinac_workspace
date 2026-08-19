import { useEffect, useRef, useState } from "react";
import { Menu, X, User, LogOut, ChevronRight } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthUser = {
  readonly name: string;
  readonly email: string;
  readonly avatarUrl: string | null;
};

type NavbarProps = {
  readonly currentPath: string;
  readonly githubStars?: number;
  /** Populated by MainLayout.astro via getSession(); null means logged-out. */
  readonly user?: AuthUser | null;
};

type NavLink = {
  readonly label: string;
  readonly route: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const NAV_LINKS: readonly NavLink[] = [
  { label: "Products", route: "/products" },
  { label: "Resources", route: "/resources" },
  { label: "Documentation", route: "/docs" },
  { label: "Pricing", route: "/pricing" },
  { label: "Download", route: "/download" },
];

const SCROLL_SURFACE_THRESHOLD = 80;
const SCROLL_HIDE_THRESHOLD = 20;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatStarCount(stars: number): string {
  if (stars >= 1000) {
    return `${(stars / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return stars.toString();
}

/** Returns up-to-2 initials from a full name string. */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (
    parts[0].charAt(0).toUpperCase() +
    parts[parts.length - 1].charAt(0).toUpperCase()
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

type AvatarProps = {
  readonly user: AuthUser;
  readonly size?: "sm" | "md";
};

/** Renders the user's avatar image or a monogram fallback. */
function Avatar({ user, size = "md" }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const sizeClasses = size === "sm" ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm";

  if (user.avatarUrl && !imgError) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        className={`${sizeClasses} rounded-full object-cover ring-1 ring-void-500/50 select-none`}
        onError={() => setImgError(true)}
        draggable={false}
      />
    );
  }

  return (
    <span
      className={`${sizeClasses} inline-flex items-center justify-center rounded-full bg-nebula/15 ring-1 ring-nebula/30 text-nebula font-semibold select-none`}
      aria-hidden="true"
    >
      {getInitials(user.name)}
    </span>
  );
}

type ProfileDropdownProps = {
  readonly user: AuthUser;
  readonly onClose: () => void;
};

/** Desktop profile dropdown panel. */
function ProfileDropdown({ user, onClose }: ProfileDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };

    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [onClose]);

  const handleSignOut = async () => {
    onClose();
    try {
      const res = await fetch("/api/auth/signout", { method: "POST" });
      const data = (await res.json().catch(() => null)) as {
        ok: boolean;
        redirectTo: string;
      } | null;
      window.location.href = data?.redirectTo ?? "/";
    } catch {
      window.location.href = "/";
    }
  };

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="User menu"
      className="absolute right-0 top-full mt-2.5 w-64 origin-top-right animate-in fade-in slide-in-from-top-2 duration-150"
    >
      {/* Dropdown panel */}
      <div className="rounded-xl bg-void-700/95 backdrop-blur-xl border border-void-500/25 shadow-2xl overflow-hidden">
        {/* User identity header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-void-500/20">
          <Avatar user={user} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-star-100">
              {user.name}
            </p>
            <p className="truncate text-xs text-star-400">{user.email}</p>
          </div>
        </div>

        {/* Menu items */}
        <div className="py-1.5">
          <a
            href="/profile"
            role="menuitem"
            onClick={onClose}
            className="group flex items-center gap-3 px-4 py-2.5 text-sm text-star-300 transition-colors hover:bg-void-500/40 hover:text-star-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-nebula"
          >
            <User className="h-4 w-4 shrink-0 text-star-400 group-hover:text-nebula transition-colors" />
            <span>Profile</span>
          </a>
        </div>

        {/* Divider + Sign out */}
        <div className="border-t border-void-500/20 py-1.5">
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="group flex w-full items-center gap-3 px-4 py-2.5 text-sm text-star-300 transition-colors hover:bg-redshift/10 hover:text-redshift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-redshift"
          >
            <LogOut className="h-4 w-4 shrink-0 text-star-400 group-hover:text-redshift transition-colors" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function Navbar({ currentPath, githubStars, user = null }: NavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const lastScrollY = useRef(0);

  useEffect(() => {
    // Hide navbar on scroll-down, show immediately on scroll-up.
    // Never hides while the mobile menu is open.
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      setIsScrolled(currentScrollY > SCROLL_SURFACE_THRESHOLD);

      if (isMenuOpen) {
        lastScrollY.current = currentScrollY;
        return;
      }

      const delta = currentScrollY - lastScrollY.current;
      if (delta > SCROLL_HIDE_THRESHOLD) {
        setIsVisible(false);
      } else if (delta < -SCROLL_HIDE_THRESHOLD) {
        setIsVisible(true);
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isMenuOpen]);

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);
  const toggleDropdown = () => setIsDropdownOpen((prev) => !prev);
  const closeDropdown = () => setIsDropdownOpen(false);

  const handleMobileSignOut = async () => {
    closeMenu();
    try {
      const res = await fetch("/api/auth/signout", { method: "POST" });
      const data = (await res.json().catch(() => null)) as {
        ok: boolean;
        redirectTo: string;
      } | null;
      window.location.href = data?.redirectTo ?? "/";
    } catch {
      window.location.href = "/";
    }
  };

  const surfaceClasses = isScrolled
    ? "bg-void-700/90 backdrop-blur-sm"
    : "bg-transparent";
  const visibilityClasses = isVisible ? "translate-y-0" : "-translate-y-full";

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-out ${surfaceClasses} ${visibilityClasses}`}
      >
        <nav
          className="mx-auto flex h-16 max-w-7xl items-center justify-between px-inline"
          aria-label="Primary navigation"
        >
          {/* ── Logo ── */}
          <a
            href="/"
            className="flex shrink-0 items-center gap-2 text-star-100 transition-colors focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nebula"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              className="text-current"
            >
              <path
                d="M12 2L20.5 7V17L12 22L3.5 17V7L12 2Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M12 8L16.5 10.5V15.5L12 18L7.5 15.5V10.5L12 8Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            <span className="font-sans text-lg font-medium tracking-tight">
              Pinac
            </span>
          </a>

          {/* ── Desktop nav links ── */}
          <div className="hidden major-xs:relative major-xs:flex major-xs:items-center major-xs:gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.route}
                className="rounded-md px-3 py-2 font-sans text-sm text-star-300 transition-colors hover:bg-void-500/55 hover:text-star-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nebula cursor-pointer"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* ── Right-side actions ── */}
          <div className="flex items-center gap-3 shrink-0">
            {/* GitHub */}
            <a
              href="https://github.com/pinac-workspace/pinac"
              target="_blank"
              rel="noopener noreferrer"
              className="group hidden items-center gap-1.5 rounded-md px-3 py-2 text-star-300 transition-colors hover:bg-void-500/55 hover:text-star-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nebula major-xs:inline-flex"
              aria-label="View Pinac on GitHub"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
              {typeof githubStars === "number" && (
                <span className="font-mono text-xs transition-colors">
                  ★ {formatStarCount(githubStars)}
                </span>
              )}
            </a>

            {/* ── Authenticated: Avatar + Dropdown ── */}
            {user ? (
              <div className="relative hidden major-xs:block">
                <button
                  type="button"
                  id="user-menu-button"
                  onClick={toggleDropdown}
                  aria-haspopup="true"
                  aria-expanded={isDropdownOpen}
                  aria-controls="user-menu"
                  className="flex items-center gap-2 rounded-full p-0.5 ring-1 ring-transparent transition-all hover:ring-nebula/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nebula"
                >
                  <Avatar user={user} size="md" />
                  <span className="sr-only">Open user menu</span>
                </button>

                {isDropdownOpen && (
                  <div id="user-menu">
                    <ProfileDropdown user={user} onClose={closeDropdown} />
                  </div>
                )}
              </div>
            ) : (
              /* ── Guest: Login + Sign Up ── */
              <>
                <a
                  href="/auth/sign-in"
                  className="hidden rounded-md px-3 py-2 font-sans text-sm text-star-200 transition-colors hover:bg-void-500/80 hover:text-star-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nebula major-xs:inline-flex items-center justify-center whitespace-nowrap shrink-0"
                >
                  Login
                </a>

                <a
                  href="/auth/sign-up"
                  className="inline-flex items-center justify-center rounded-md bg-nebula/90 px-4 py-2 font-sans text-sm font-medium text-void-900 transition-colors hover:bg-nebula focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nebula focus-visible:ring-offset-2 focus-visible:ring-offset-void-900 whitespace-nowrap shrink-0"
                >
                  Sign Up
                </a>
              </>
            )}

            {/* Hamburger — mobile only */}
            <button
              type="button"
              onClick={toggleMenu}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-star-300 transition-colors hover:text-star-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nebula major-xs:hidden z-50 relative"
              aria-expanded={isMenuOpen}
              aria-controls="mobile-menu"
              aria-label={
                isMenuOpen ? "Close navigation menu" : "Open navigation menu"
              }
            >
              {isMenuOpen ? (
                <X className="h-5 w-5" strokeWidth={1.5} />
              ) : (
                <Menu className="h-5 w-5" strokeWidth={1.5} />
              )}
            </button>
          </div>
        </nav>
      </header>

      {/* ── Mobile Menu Backdrop ── */}
      <div
        className={`fixed inset-0 bg-void-900/60 backdrop-blur-sm z-40 transition-opacity duration-300 major-xs:hidden ${
          isMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={closeMenu}
        aria-hidden="true"
      />

      {/* ── Mobile Menu Bottom Sheet ── */}
      <div
        id="mobile-menu"
        className={`fixed bottom-0 left-0 right-0 z-50 overflow-hidden transition-all duration-300 ease-out major-xs:hidden ${
          isMenuOpen ? "translate-y-0" : "translate-y-full pointer-events-none"
        }`}
      >
        <div
          className={`bg-void-800/95 backdrop-blur-xl border-t border-void-500/20 px-6 pt-8 pb-10 rounded-t-3xl transition-transform duration-300 ease-out flex flex-col gap-2 ${
            isMenuOpen ? "translate-y-0" : "translate-y-10"
          }`}
        >
          {/* Drag Handle */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-void-500/40 rounded-full" />

          {/* ── Mobile: User identity (logged-in only) ── */}
          {user && (
            <div className="flex items-center gap-3 mb-4 px-1">
              <Avatar user={user} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-star-100">
                  {user.name}
                </p>
                <p className="truncate text-xs text-star-400">{user.email}</p>
              </div>
            </div>
          )}

          {/* Nav links */}
          <div className="flex flex-col gap-1 mb-4">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.route}
                onClick={closeMenu}
                className="group flex items-center justify-between rounded-xl px-4 py-3.5 font-sans text-lg font-medium text-star-300 transition-all hover:bg-void-500/30 hover:text-star-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nebula"
              >
                {link.label}
                <ChevronRight className="w-5 h-5 opacity-0 -translate-x-4 transition-all group-hover:opacity-100 group-hover:translate-x-0 text-nebula" />
              </a>
            ))}
          </div>

          {/* Bottom CTA section */}
          <div className="flex flex-col gap-3 pt-4 border-t border-void-500/20">
            {/* GitHub — always visible */}
            <a
              href="https://github.com/pinac-workspace/pinac"
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeMenu}
              className="group flex items-center justify-center gap-3 w-full rounded-xl bg-void-900/50 border border-void-500/30 px-4 py-3.5 font-sans text-base text-star-200 transition-colors hover:bg-void-500/50 hover:text-star-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nebula"
            >
              <svg
                className="w-5 h-5 group-hover:text-white transition-colors"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
              <span>GitHub</span>
              {typeof githubStars === "number" && (
                <span className="ml-auto flex items-center gap-1 rounded-full bg-void-900 px-2.5 py-0.5 text-xs font-medium text-star-400 border border-void-500/20">
                  ★ {formatStarCount(githubStars)}
                </span>
              )}
            </a>

            {user ? (
              /* ── Mobile: logged-in actions ── */
              <>
                <a
                  href="/profile"
                  onClick={closeMenu}
                  className="flex items-center justify-center gap-2.5 w-full rounded-xl bg-void-700/60 border border-void-500/30 px-4 py-3.5 font-sans text-base font-medium text-star-200 transition-colors hover:bg-void-600/60 hover:text-star-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nebula"
                >
                  <User className="h-5 w-5 text-star-400" />
                  Profile
                </a>

                <button
                  type="button"
                  onClick={handleMobileSignOut}
                  className="flex items-center justify-center gap-2.5 w-full rounded-xl bg-redshift/10 border border-redshift/20 px-4 py-3.5 font-sans text-base font-medium text-redshift transition-colors hover:bg-redshift/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-redshift"
                >
                  <LogOut className="h-5 w-5" />
                  Sign out
                </button>
              </>
            ) : (
              /* ── Mobile: guest actions ── */
              <>
                <a
                  href="/auth/sign-up"
                  onClick={closeMenu}
                  className="flex items-center justify-center w-full rounded-xl bg-nebula/90 px-4 py-3.5 font-sans text-base font-semibold text-void-900 transition-colors hover:bg-nebula focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nebula"
                >
                  Sign Up
                </a>
                <a
                  href="/auth/sign-in"
                  onClick={closeMenu}
                  className="flex items-center justify-center w-full rounded-xl bg-nebula/10 border border-nebula/20 px-4 py-3.5 font-sans text-base font-medium text-nebula transition-colors hover:bg-nebula/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nebula"
                >
                  Login
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default Navbar;

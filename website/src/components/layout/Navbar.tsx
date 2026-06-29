import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";

type NavbarProps = {
  readonly currentPath: string;
  readonly githubStars?: number;
};

type NavLink = {
  readonly label: string;
  readonly route: string;
};

const NAV_LINKS: readonly NavLink[] = [
  { label: "Products", route: "/products" },
  { label: "Resources", route: "/resources" },
  { label: "Documentation", route: "/docs" },
  { label: "Pricing", route: "/pricing" },
  { label: "Download", route: "/download" },
];

const SCROLL_SURFACE_THRESHOLD = 80;
const SCROLL_HIDE_THRESHOLD = 20;

function formatStarCount(stars: number): string {
  if (stars >= 1000) {
    return `${(stars / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return stars.toString();
}

export function Navbar({ currentPath, githubStars }: NavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

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

  useEffect(() => {
    // Prevent underlying page scroll while the mobile menu is open.
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMenuOpen]);

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);

  const surfaceClasses = isScrolled
    ? "bg-void-700/90 backdrop-blur-sm"
    : "bg-transparent";
  const visibilityClasses = isVisible ? "translate-y-0" : "-translate-y-full";

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ease-out ${surfaceClasses} ${visibilityClasses}`}
    >
      <nav
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
        aria-label="Primary navigation"
      >
        <a
          href="/"
          className="flex items-center gap-2 text-star-100 transition-colors focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nebula"
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

        <div className="hidden md:relative md:flex md:items-center md:gap-1">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              className="rounded-md px-3 py-2 font-sans text-sm text-star-300 transition-colors hover:bg-void-500/55 hover:text-star-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nebula cursor-pointer"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-md px-3 py-2 flex items-center hover:bg-void-500/55 text-star-300 hover:text-star-200">
            <a
              href="#"
              className="group hidden items-center gap-1.5 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nebula md:inline-flex"
              aria-label="View Pinac on GitHub"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
              {typeof githubStars === "number" && (
                <span className="font-mono text-xs transition-colors ">
                  ★ {formatStarCount(githubStars)}
                </span>
              )}
            </a>
          </div>
          <div className="rounded-md flex items-center hover:bg-void-500/80">
            <a
              href="/auth/login"
              className="hidden rounded px-3 py-2 font-sans text-sm text-star-200 transition-colors hover:text-star-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nebula md:inline-block"
            >
              Login
            </a>
          </div>

          <a
            href="/auth/signup"
            className="inline-flex items-center rounded-md bg-nebula/90 px-4 py-2 font-sans text-sm font-medium text-void-900 transition-colors hover:bg-nebula focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nebula focus-visible:ring-offset-2 focus-visible:ring-offset-void-900"
          >
            Sign Up
          </a>

          <button
            type="button"
            onClick={toggleMenu}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-star-300 transition-colors hover:text-star-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nebula md:hidden"
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

      {isMenuOpen && (
        <div
          id="mobile-menu"
          className="fixed inset-x-0 top-16 bottom-0 z-40 bg-void-700/95 backdrop-blur-sm md:hidden"
        >
          <div className="flex h-full flex-col px-6 py-10">
            <div className="flex flex-col gap-6">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.label}
                  onClick={closeMenu}
                  className="rounded-md px-3 py-2 font-sans text-lg text-star-300 transition-colors hover:bg-void-800/60 hover:text-star-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nebula"
                >
                  {link.label}
                </a>
              ))}
            </div>

            <div className="mt-10 flex flex-col gap-6">
              <a
                href="#"
                onClick={closeMenu}
                className="inline-flex items-center gap-2 rounded text-star-300 transition-colors hover:text-star-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nebula"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                </svg>
                {typeof githubStars === "number" && (
                  <span className="font-mono text-sm text-star-400">
                    ★ {formatStarCount(githubStars)}
                  </span>
                )}
                <span className="font-sans text-lg">GitHub</span>
              </a>

              <a
                href="/auth/login"
                onClick={closeMenu}
                className="rounded font-sans text-lg text-star-200 transition-colors hover:text-star-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nebula"
              >
                Login
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export default Navbar;

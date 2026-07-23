/**
 * SidebarFooter.tsx — Bottom bar of the sidebar.
 *
 * Displays:
 *  - User avatar (initial derived from the authenticated user's name / email).
 *  - Display name (from the authenticated user — falls back to local setting).
 *  - Settings button.
 *  - Sign-out button.
 *
 * User identity comes from AuthContext (the authenticated CurrentUser) rather
 * than the local settings displayName, so the sidebar always reflects who is
 * actually signed in. The local displayName setting remains available in
 * the Settings panel for UI personalisation.
 */

import { Settings, LogOut } from "lucide-react";
import { useChatContext } from "../../context/ChatContext";
import { useAuth } from "../../context/AuthContext";
import Tooltip from "../ui/Tooltip";

export default function SidebarFooter() {
  const { dispatch } = useChatContext();
  const { status, logout } = useAuth();

  // Derive display name and initial from the authenticated user.
  // AuthGate ensures SidebarFooter is never rendered while unauthenticated,
  // but we guard defensively to satisfy TypeScript and avoid a runtime throw.
  const user = status.kind === "authenticated" ? status.user : null;
  const displayName = user
    ? (user.firstName ?? user.email)
    : "User";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="mt-auto border-t border-border px-3 py-2 flex items-center gap-2">
      {/* User avatar — shows first letter of name or email */}
      <div className="w-5 h-5 rounded-sm bg-surface-3 flex items-center justify-center text-[10px] font-mono text-text-muted shrink-0">
        {initial}
      </div>

      {/* Display name — truncated to available space */}
      <span className="text-xs font-ui text-text-secondary truncate flex-1">
        {displayName}
      </span>

      {/* Settings button */}
      <Tooltip label="Settings">
        <button
          onClick={() => dispatch({ type: "TOGGLE_SETTINGS" })}
          aria-label="Settings"
          className="p-1 text-text-muted hover:text-text-secondary hover:bg-surface-3 rounded-sm transition-colors duration-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
        >
          <Settings size={13} />
        </button>
      </Tooltip>

      {/* Sign-out button */}
      <Tooltip label="Sign out">
        <button
          onClick={() => {
            void logout();
          }}
          aria-label="Sign out"
          className="p-1 text-text-muted hover:text-text-secondary hover:bg-surface-3 rounded-sm transition-colors duration-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
        >
          <LogOut size={13} />
        </button>
      </Tooltip>
    </div>
  );
}

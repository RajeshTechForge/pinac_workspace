/**
 * index.ts — Public barrel export for the desktop auth library.
 *
 * Import from this file, not from individual modules:
 *   import { startLogin, initDeepLinkHandler, isAuthenticated } from "@/lib/auth";
 *
 * Intentionally NOT re-exported (internal / security-sensitive):
 *   - getPendingFlow, clearPendingFlow  (auth flow internal state)
 *   - generateCodeVerifier              (only used inside authFlow)
 */

// PKCE primitives (exported for unit-testing purposes)
export { generateCodeChallenge, generateState } from "./pkce";

// Auth flow
export { startLogin } from "./authFlow";

// Deep-link handler
export {
  initDeepLinkHandler,
  onAuthSuccess,
  onAuthError,
  type DeepLinkAuthError,
  type AuthSuccessPayload,
} from "./deepLinkHandler";

// Token exchange
export {
  exchangeCodeForTokens,
  type WorkOSTokenResponse,
  type TokenExchangeError,
  type TokenExchangeResult,
} from "./tokenExchange";

// Secure storage
export {
  saveTokens,
  getTokens,
  clearTokens,
  type StoredTokens,
} from "./secureStorage";

// Session
export {
  getCurrentUser,
  isAuthenticated,
  silentRefresh,
  startRefreshTimer,
  stopRefreshTimer,
  logout,
  type CurrentUser,
  type RefreshResult,
} from "./session";

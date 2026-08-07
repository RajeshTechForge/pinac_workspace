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

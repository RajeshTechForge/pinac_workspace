export const prerender = false;

import type { APIRoute } from "astro";
import {
  workos,
  WORKOS_CLIENT_ID,
  WORKOS_COOKIE_PASSWORD,
  SESSION_COOKIE,
  POST_LOGIN_ROUTE,
  baseCookieOptions,
  toSafeUser,
} from "../../../lib/workos";

interface VerifyRequestBody {
  code?: unknown;
  pendingAuthenticationToken?: unknown;
}

interface ApiError {
  code: "INVALID_BODY" | "INVALID_CODE" | "EXPIRED_CODE" | "API_ERROR";
  message: string;
}

interface VerifySuccess {
  ok: true;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  redirectTo: string;
}

type VerifyResponse = VerifySuccess | { ok: false; error: ApiError };

function json(body: VerifyResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return json(
      {
        ok: false,
        error: { code: "INVALID_BODY", message: "Invalid JSON body." },
      },
      400
    );
  }

  const { code, pendingAuthenticationToken } =
    (parsed ?? {}) as VerifyRequestBody;

  if (
    typeof pendingAuthenticationToken !== "string" ||
    pendingAuthenticationToken.trim().length === 0
  ) {
    return json(
      {
        ok: false,
        error: {
          code: "INVALID_BODY",
          message:
            "Missing authentication token. Please sign in again to restart verification.",
        },
      },
      400
    );
  }

  if (typeof code !== "string" || code.trim().length === 0) {
    return json(
      {
        ok: false,
        error: {
          code: "INVALID_BODY",
          message: "Verification code is required.",
        },
      },
      400
    );
  }

  try {
    const authRes =
      await workos.userManagement.authenticateWithEmailVerification({
        clientId: WORKOS_CLIENT_ID,
        code: code.trim(),
        pendingAuthenticationToken: pendingAuthenticationToken.trim(),
        session: {
          sealSession: true,
          cookiePassword: WORKOS_COOKIE_PASSWORD,
        },
      });

    const res = json(
      {
        ok: true,
        user: toSafeUser(authRes.user),
        redirectTo: POST_LOGIN_ROUTE,
      },
      200
    );

    res.headers.append(
      "Set-Cookie",
      `${SESSION_COOKIE}=${authRes.sealedSession}; Path=/; HttpOnly; SameSite=Lax${
        baseCookieOptions().secure ? "; Secure" : ""
      }; Max-Age=40000000`
    );
    return res;
  } catch (err) {
    const e = err as { code?: string; message?: string };
    const errCode = e.code ?? "";
    const msg = e.message ?? "";

    if (errCode === "email_verification_code_invalid" || /invalid/i.test(msg)) {
      return json(
        {
          ok: false,
          error: {
            code: "INVALID_CODE",
            message:
              "The verification code is incorrect. Please check and try again.",
          },
        },
        400
      );
    }

    if (errCode === "email_verification_code_expired" || /expired/i.test(msg)) {
      return json(
        {
          ok: false,
          error: {
            code: "EXPIRED_CODE",
            message:
              "The verification code has expired. Please sign in again to receive a new code.",
          },
        },
        410
      );
    }

    return json(
      {
        ok: false,
        error: {
          code: "API_ERROR",
          message: "Verification failed. Please try again.",
        },
      },
      502
    );
  }
};

export const prerender = false;

import type { APIRoute } from "astro";
import {
  workos,
  WORKOS_COOKIE_PASSWORD,
  WORKOS_CLIENT_ID,
  SESSION_COOKIE,
  baseCookieOptions,
  toSafeUser,
} from "../../../lib/workos";

interface SigninRequestBody {
  email?: unknown;
  password?: unknown;
}

interface ApiError {
  code:
    | "INVALID_BODY"
    | "INVALID_CREDENTIALS"
    | "EMAIL_NOT_VERIFIED"
    | "RATE_LIMITED"
    | "API_ERROR";
  message: string;
  pendingAuthenticationToken?: string;
  email?: string;
}

interface SigninSuccess {
  ok: true;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  redirectTo: string;
}

type SigninResponse =
  SigninSuccess | { ok: false; error: ApiError; redirectTo?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body: SigninResponse, status: number): Response {
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
      400,
    );
  }

  const { email, password } = (parsed ?? {}) as SigninRequestBody;

  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return json(
      {
        ok: false,
        error: { code: "INVALID_BODY", message: "A valid email is required." },
      },
      400,
    );
  }
  if (typeof password !== "string" || password.length === 0) {
    return json(
      {
        ok: false,
        error: { code: "INVALID_BODY", message: "Password is required." },
      },
      400,
    );
  }

  try {
    const authRes = await workos.userManagement.authenticateWithPassword({
      clientId: WORKOS_CLIENT_ID,
      email: email.trim().toLowerCase(),
      password,
      session: {
        sealSession: true,
        cookiePassword: WORKOS_COOKIE_PASSWORD,
      },
    });

    const res = json(
      {
        ok: true,
        user: toSafeUser(authRes.user),
        redirectTo: "/dashboard",
      },
      200,
    );

    res.headers.append(
      "Set-Cookie",
      `${SESSION_COOKIE}=${authRes.sealedSession}; Path=/; HttpOnly; SameSite=Lax${
        baseCookieOptions().secure ? "; Secure" : ""
      }; Max-Age=40000000`,
    );
    return res;
  } catch (err) {
    const e = err as {
      code?: string;
      message?: string;
      pendingAuthenticationToken?: string;
    };
    const code = e.code ?? "";

    if (code === "email_verification_required") {
      const pat = e.pendingAuthenticationToken ?? "";
      const encodedEmail = encodeURIComponent(email.trim().toLowerCase());
      return json(
        {
          ok: false,
          error: {
            code: "EMAIL_NOT_VERIFIED",
            message: "Please verify your email address before signing in.",
            pendingAuthenticationToken: pat,
            email: email.trim().toLowerCase(),
          },
          redirectTo: `/auth/verify-email?email=${encodedEmail}&token=${encodeURIComponent(pat)}`,
        },
        403,
      );
    }
    if (
      code === "invalid_credentials" ||
      code === "invalid_grant" ||
      /invalid credentials/i.test(e.message ?? "")
    ) {
      return json(
        {
          ok: false,
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Incorrect email or password.",
          },
        },
        401,
      );
    }
    if (code === "rate_limit_exceeded" || /rate limit/i.test(e.message ?? "")) {
      return json(
        {
          ok: false,
          error: {
            code: "RATE_LIMITED",
            message: "Too many attempts. Please wait a moment and try again.",
          },
        },
        429,
      );
    }

    return json(
      {
        ok: false,
        error: {
          code: "API_ERROR",
          message: "Sign-in failed. Please try again.",
        },
      },
      502,
    );
  }
};

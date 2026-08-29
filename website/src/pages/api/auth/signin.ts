export const prerender = false;

import type { APIRoute } from "astro";
import {
  createSupabaseServerClient,
  createDesktopTransferCode,
  POST_LOGIN_ROUTE,
  DESKTOP_CALLBACK_URI,
  toSafeUser,
  type SafeUser,
} from "../../../lib/supabase";

interface SigninRequestBody {
  email?: unknown;
  password?: unknown;
  desktop?: unknown;
  code_challenge?: unknown;
  state?: unknown;
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
  user: SafeUser;
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

export const POST: APIRoute = async (context) => {
  const { request, cookies } = context;

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

  const { email, password, desktop, code_challenge, state } = (parsed ??
    {}) as SigninRequestBody;

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

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const supabase = createSupabaseServerClient(cookies, request);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      const msg = error.message.toLowerCase();
      const code = error.code ?? "";

      if (code === "email_not_confirmed" || msg.includes("not confirmed")) {
        // Automatically trigger OTP resend so the user receives a fresh 6-digit code
        try {
          await supabase.auth.resend({
            type: "signup",
            email: normalizedEmail,
          });
        } catch {
          // Non-blocking catch if resend is rate-limited
        }

        const encodedEmail = encodeURIComponent(normalizedEmail);
        return json(
          {
            ok: false,
            error: {
              code: "EMAIL_NOT_VERIFIED",
              message:
                "Please verify your email address before signing in. A new code has been sent.",
              email: normalizedEmail,
            },
            redirectTo: `/auth/verify-email?email=${encodedEmail}`,
          },
          403,
        );
      }

      if (
        code === "invalid_credentials" ||
        code === "invalid_grant" ||
        msg.includes("invalid login credentials") ||
        msg.includes("invalid credentials")
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

      if (
        error.status === 429 ||
        code === "over_request_rate_limit" ||
        msg.includes("rate limit")
      ) {
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

      console.error("[api/auth/signin] Supabase sign-in error:", error.message);
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

    if (!data.user) {
      return json(
        {
          ok: false,
          error: {
            code: "API_ERROR",
            message: "Sign-in failed. User not returned.",
          },
        },
        502,
      );
    }

    const safeUser = toSafeUser(data.user);

    // If initiated from desktop flow with PKCE code_challenge:
    if (
      desktop === true &&
      typeof code_challenge === "string" &&
      code_challenge.trim().length > 0 &&
      data.session
    ) {
      const transferCode = await createDesktopTransferCode({
        code_challenge: code_challenge.trim(),
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: safeUser,
      });

      const stateStr = typeof state === "string" ? state : "";
      const desktopRedirect = `${DESKTOP_CALLBACK_URI}?code=${encodeURIComponent(transferCode)}&state=${encodeURIComponent(stateStr)}`;

      return json(
        {
          ok: true,
          user: safeUser,
          redirectTo: desktopRedirect,
        },
        200,
      );
    }

    // Standard web login:
    return json(
      {
        ok: true,
        user: safeUser,
        redirectTo: POST_LOGIN_ROUTE,
      },
      200,
    );
  } catch (err) {
    console.error("[api/auth/signin] Unexpected error:", err);
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

export const prerender = false;

import type { APIRoute } from "astro";
import {
  workos,
  WORKOS_CLIENT_ID,
  WORKOS_COOKIE_PASSWORD,
} from "../../../lib/workos";

interface SignupRequestBody {
  email?: unknown;
  password?: unknown;
  firstName?: unknown;
  lastName?: unknown;
}

interface ApiError {
  code:
    | "INVALID_EMAIL"
    | "WEAK_PASSWORD"
    | "USER_EXISTS"
    | "INVALID_BODY"
    | "API_ERROR";
  message: string;
}

interface SignupSuccess {
  ok: true;
  userId: string;
  redirectTo: string;
  pendingVerification: boolean;
}

type SignupResponse = SignupSuccess | { ok: false; error: ApiError };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body: SignupResponse, status: number): Response {
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

  const { email, password, firstName, lastName } = (parsed ??
    {}) as SignupRequestBody;

  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return json(
      {
        ok: false,
        error: { code: "INVALID_EMAIL", message: "A valid email is required." },
      },
      400,
    );
  }

  if (typeof password !== "string" || password.length < 8) {
    return json(
      {
        ok: false,
        error: {
          code: "WEAK_PASSWORD",
          message: "Password must be at least 8 characters.",
        },
      },
      400,
    );
  }

  try {
    const user = await workos.userManagement.createUser({
      email: email.trim().toLowerCase(),
      password,
      firstName:
        typeof firstName === "string" && firstName.trim()
          ? firstName.trim()
          : undefined,
      lastName:
        typeof lastName === "string" && lastName.trim()
          ? lastName.trim()
          : undefined,
    });

    const normalizedEmail = email.trim().toLowerCase();
    try {
      await workos.userManagement.authenticateWithPassword({
        clientId: WORKOS_CLIENT_ID,
        email: normalizedEmail,
        password,
        session: {
          sealSession: true,
          cookiePassword: WORKOS_COOKIE_PASSWORD,
        },
      });

      // Should never reach here for a freshly-created unverified user;
      // fall back to the legacy "sign in to verify" path defensively.
      return json(
        {
          ok: true,
          userId: user.id,
          redirectTo: "/auth/sign-in?created=1",
          pendingVerification: true,
        },
        201,
      );
    } catch (authErr) {
      const aErr = authErr as {
        code?: string;
        message?: string;
        pendingAuthenticationToken?: string;
      };
      const aCode = aErr.code ?? "";

      if (aCode === "email_verification_required") {
        const token = aErr.pendingAuthenticationToken ?? "";
        if (!token) {
          return json(
            {
              ok: true,
              userId: user.id,
              redirectTo: "/auth/sign-in?created=1",
              pendingVerification: true,
            },
            201,
          );
        }
        const encodedEmail = encodeURIComponent(normalizedEmail);
        const encodedToken = encodeURIComponent(token);
        return json(
          {
            ok: true,
            userId: user.id,
            redirectTo: `/auth/verify-email?email=${encodedEmail}&token=${encodedToken}`,
            pendingVerification: true,
          },
          201,
        );
      }

      // Any other post-creation auth error: don't leak details, fall back
      // to sign-in so the user can still trigger verification manually.
      return json(
        {
          ok: true,
          userId: user.id,
          redirectTo: "/auth/sign-in?created=1",
          pendingVerification: true,
        },
        201,
      );
    }
  } catch (err) {
    const e = err as { code?: string; message?: string };
    const msg = e.message ?? "";

    // WorkOS returns specific codes. Map the common ones deterministically.
    if (e.code === "email_already_in_use" || /already exists/i.test(msg)) {
      return json(
        {
          ok: false,
          error: {
            code: "USER_EXISTS",
            message: "An account with this email already exists.",
          },
        },
        409,
      );
    }
    if (
      e.code === "password_strength_validation_failed" ||
      /password/i.test(msg)
    ) {
      return json(
        {
          ok: false,
          error: {
            code: "WEAK_PASSWORD",
            message:
              "Password is too weak. Use a longer, more complex password.",
          },
        },
        400,
      );
    }
    if (e.code === "email_validation_failed" || /email/i.test(msg)) {
      return json(
        {
          ok: false,
          error: {
            code: "INVALID_EMAIL",
            message: "WorkOS rejected this email address.",
          },
        },
        400,
      );
    }

    // Never leak raw SDK error details to the client.
    return json(
      {
        ok: false,
        error: {
          code: "API_ERROR",
          message: "Sign-up failed. Please try again.",
        },
      },
      502,
    );
  }
};

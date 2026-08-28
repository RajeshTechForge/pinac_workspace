export const prerender = false;

import type { APIRoute } from "astro";
import {
  createSupabaseServerClient,
  APP_BASE_URL,
  POST_LOGIN_ROUTE,
} from "../../../lib/supabase";

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

  const normalizedEmail = email.trim().toLowerCase();
  const fName =
    typeof firstName === "string" && firstName.trim()
      ? firstName.trim()
      : undefined;
  const lName =
    typeof lastName === "string" && lastName.trim()
      ? lastName.trim()
      : undefined;

  try {
    const supabase = createSupabaseServerClient(cookies, request);

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          first_name: fName,
          last_name: lName,
          firstName: fName,
          lastName: lName,
        },
        emailRedirectTo: `${APP_BASE_URL}/api/auth/callback`,
      },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      const code = error.code ?? "";

      if (
        code === "user_already_exists" ||
        msg.includes("already registered") ||
        msg.includes("already exists") ||
        msg.includes("user already exists")
      ) {
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
        code === "weak_password" ||
        msg.includes("password") ||
        msg.includes("weak")
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

      if (
        code === "validation_failed" ||
        msg.includes("email") ||
        msg.includes("invalid")
      ) {
        return json(
          {
            ok: false,
            error: {
              code: "INVALID_EMAIL",
              message: "Invalid email address format.",
            },
          },
          400,
        );
      }

      console.error("[api/auth/signup] Supabase signUp error:", error.message);
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

    // Supabase security feature: when user enumeration protection is enabled
    // and email is already registered, signUp returns a user with empty identities.
    if (
      data.user &&
      Array.isArray(data.user.identities) &&
      data.user.identities.length === 0
    ) {
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

    if (!data.user) {
      return json(
        {
          ok: false,
          error: {
            code: "API_ERROR",
            message: "Sign-up failed. User not created.",
          },
        },
        502,
      );
    }

    // Check if email confirmation is pending
    const isPendingVerification = !data.session;
    const encodedEmail = encodeURIComponent(normalizedEmail);

    return json(
      {
        ok: true,
        userId: data.user.id,
        redirectTo: isPendingVerification
          ? `/auth/verify-email?email=${encodedEmail}`
          : POST_LOGIN_ROUTE,
        pendingVerification: isPendingVerification,
      },
      201,
    );
  } catch (err) {
    console.error("[api/auth/signup] Unexpected error:", err);
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

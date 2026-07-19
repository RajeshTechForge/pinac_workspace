export const prerender = false;

import type { APIRoute } from "astro";
import { workos } from "../../../lib/workos";

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
      400
    );
  }

  const { email, password, firstName, lastName } =
    (parsed ?? {}) as SignupRequestBody;

  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return json(
      {
        ok: false,
        error: { code: "INVALID_EMAIL", message: "A valid email is required." },
      },
      400
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
      400
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

    const success: SignupSuccess = {
      ok: true,
      userId: user.id,
      redirectTo: "/signin?created=1",
    };
    return json(success, 201);
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
        409
      );
    }
    if (e.code === "password_strength_validation_failed" || /password/i.test(msg)) {
      return json(
        {
          ok: false,
          error: {
            code: "WEAK_PASSWORD",
            message:
              "Password is too weak. Use a longer, more complex password.",
          },
        },
        400
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
        400
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
      502
    );
  }
};

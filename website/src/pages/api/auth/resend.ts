export const prerender = false;

import type { APIRoute } from "astro";
import {
  createSupabaseServerClient,
  APP_BASE_URL,
} from "../../../lib/supabase";

interface ResendRequestBody {
  email?: unknown;
}

interface ResendResponse {
  ok: boolean;
  message?: string;
  error?: {
    code: string;
    message: string;
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body: ResendResponse, status: number): Response {
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

  const { email } = (parsed ?? {}) as ResendRequestBody;

  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return json(
      {
        ok: false,
        error: { code: "INVALID_EMAIL", message: "A valid email is required." },
      },
      400,
    );
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const supabase = createSupabaseServerClient(cookies, request);

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: normalizedEmail,
      options: {
        emailRedirectTo: `${APP_BASE_URL}/api/auth/callback`,
      },
    });

    if (error) {
      console.error("[api/auth/resend] Supabase resend error:", error.message);

      if (
        error.status === 429 ||
        error.message.toLowerCase().includes("rate")
      ) {
        return json(
          {
            ok: false,
            error: {
              code: "RATE_LIMITED",
              message: "Please wait a moment before requesting another code.",
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
            message: "Failed to resend verification code. Please try again.",
          },
        },
        502,
      );
    }

    return json(
      {
        ok: true,
        message: "A new 6-digit verification code has been sent to your email.",
      },
      200,
    );
  } catch (err) {
    console.error("[api/auth/resend] Unexpected error:", err);
    return json(
      {
        ok: false,
        error: {
          code: "API_ERROR",
          message: "Failed to resend verification code.",
        },
      },
      502,
    );
  }
};

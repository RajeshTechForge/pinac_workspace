export const prerender = false;

import type { APIRoute } from "astro";
import {
  createSupabaseServerClient,
  POST_LOGIN_ROUTE,
  toSafeUser,
  type SafeUser,
} from "../../../lib/supabase";

interface VerifyRequestBody {
  code?: unknown;
  email?: unknown;
  pendingAuthenticationToken?: unknown;
}

interface ApiError {
  code: "INVALID_BODY" | "INVALID_CODE" | "EXPIRED_CODE" | "API_ERROR";
  message: string;
}

interface VerifySuccess {
  ok: true;
  user: SafeUser;
  redirectTo: string;
}

type VerifyResponse = VerifySuccess | { ok: false; error: ApiError };

function json(body: VerifyResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const POST: APIRoute = async (context) => {
  const { request, cookies, url } = context;

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

  const { code, email, pendingAuthenticationToken } = (parsed ??
    {}) as VerifyRequestBody;

  const resolvedEmail =
    (typeof email === "string" && email.trim()) ||
    (typeof pendingAuthenticationToken === "string" &&
      pendingAuthenticationToken.includes("@") &&
      pendingAuthenticationToken.trim()) ||
    url.searchParams.get("email") ||
    "";

  if (!resolvedEmail) {
    return json(
      {
        ok: false,
        error: {
          code: "INVALID_BODY",
          message:
            "Missing email address. Please sign in again to restart verification.",
        },
      },
      400,
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
      400,
    );
  }

  const normalizedEmail = resolvedEmail.trim().toLowerCase();
  const token = code.trim();

  try {
    const supabase = createSupabaseServerClient(cookies, request);

    // 1. Attempt verification with 'signup' OTP type
    let { data, error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token,
      type: "signup",
    });

    // 2. If 'signup' fails, attempt fallback to 'email' (email confirmation)
    if (error && !data?.user) {
      const emailRetry = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token,
        type: "email",
      });
      if (!emailRetry.error && emailRetry.data?.user) {
        data = emailRetry.data;
        error = null;
      }
    }

    // 3. If 'email' fails, attempt fallback to 'magiclink'
    if (error && !data?.user) {
      const magicRetry = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token,
        type: "magiclink",
      });
      if (!magicRetry.error && magicRetry.data?.user) {
        data = magicRetry.data;
        error = null;
      }
    }

    if (error) {
      const msg = error.message.toLowerCase();
      const errCode = error.code ?? "";

      console.error(
        "[api/auth/verify-email] verifyOtp error:",
        error.message,
        `code: ${errCode}`,
        `status: ${error.status}`,
      );

      // Only mark as strictly EXPIRED if error code specifically indicates expired
      if (errCode === "otp_expired" || errCode === "token_expired") {
        return json(
          {
            ok: false,
            error: {
              code: "EXPIRED_CODE",
              message:
                "The verification code has expired. Please sign in again to receive a new code.",
            },
          },
          410,
        );
      }

      // Supabase returns "Token has expired or is invalid" for general code mismatches
      if (
        errCode === "bad_code" ||
        errCode === "otp_invalid" ||
        errCode === "validation_failed" ||
        msg.includes("invalid") ||
        msg.includes("incorrect") ||
        msg.includes("token has expired or is invalid") ||
        error.status === 400 ||
        error.status === 401
      ) {
        return json(
          {
            ok: false,
            error: {
              code: "INVALID_CODE",
              message:
                "The verification code is incorrect. Please check and try again.",
            },
          },
          400,
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
        502,
      );
    }

    if (!data?.user) {
      return json(
        {
          ok: false,
          error: {
            code: "API_ERROR",
            message: "Verification failed. User not found.",
          },
        },
        502,
      );
    }

    return json(
      {
        ok: true,
        user: toSafeUser(data.user),
        redirectTo: POST_LOGIN_ROUTE,
      },
      200,
    );
  } catch (err) {
    console.error("[api/auth/verify-email] Unexpected error:", err);
    return json(
      {
        ok: false,
        error: {
          code: "API_ERROR",
          message: "Verification failed. Please try again.",
        },
      },
      502,
    );
  }
};

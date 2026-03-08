"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

export default function VerifyMagicLink() {
  const params = useSearchParams();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");

  useEffect(() => {
    const email = params.get("email");
    const token = params.get("token");

    if (!email || !token) {
      setStatus("error");
      return;
    }

    signIn("magic-link", {
      email,
      token,
      callbackUrl: "/",
      redirect: true,
    }).catch(() => setStatus("error"));
  }, [params]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="text-center max-w-sm">
        <div className="w-12 h-12 rounded-xl bg-harvest-500 flex items-center justify-center font-extrabold text-2xl text-white mx-auto mb-4" style={{ fontFamily: "Georgia, serif" }}>F</div>

        {status === "verifying" && (
          <>
            <h1 className="text-lg font-bold mb-2" style={{ fontFamily: "Georgia, serif" }}>Logging you in...</h1>
            <div className="w-6 h-6 border-2 border-field-200 border-t-field-600 rounded-full animate-spin mx-auto mt-4" />
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="text-lg font-bold mb-2 text-red-700" style={{ fontFamily: "Georgia, serif" }}>Link expired or invalid</h1>
            <p className="text-sm text-stone-500 mb-4">This login link may have expired or already been used.</p>
            <a href="/login" className="inline-block px-6 py-2.5 bg-field-700 text-white rounded-lg text-sm font-semibold hover:bg-field-800 transition">
              Back to Login
            </a>
          </>
        )}
      </div>
    </div>
  );
}

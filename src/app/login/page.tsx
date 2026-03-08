"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [magicSent, setMagicSent] = useState(false);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const result = await signIn("credentials", {
      login: login.toLowerCase().trim(),
      password,
      redirect: false,
    });

    if (result?.error) {
      setErrorMsg("Invalid username/email or password");
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: login.toLowerCase().trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setMagicSent(true);
      } else {
        setErrorMsg(data.error || "Something went wrong");
      }
    } catch {
      setErrorMsg("Network error — please try again");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "linear-gradient(160deg, #1a3c19 0%, #245a1e 40%, #2d7225 100%)" }}>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-harvest-500 flex items-center justify-center font-extrabold text-3xl text-white mx-auto mb-3" style={{ fontFamily: "Georgia, serif" }}>F</div>
          <h1 className="text-3xl font-bold text-white" style={{ fontFamily: "Georgia, serif" }}>FieldFlow</h1>
          <p className="text-white/50 text-sm mt-1">Farm Contracting Management</p>
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10">

          {magicSent ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-field-500/20 flex items-center justify-center mx-auto mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5fad52" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              </div>
              <h2 className="text-lg font-bold text-white mb-1" style={{ fontFamily: "Georgia, serif" }}>Check your email</h2>
              <p className="text-white/60 text-sm mb-4">We've sent a login link to <strong className="text-white/80">{login}</strong></p>
              <button onClick={() => { setMagicSent(false); setMode("password"); }} className="text-sm text-white/50 hover:text-white/80 transition underline">
                Back to login
              </button>
            </div>
          ) : (
            <>
              {/* Mode tabs */}
              <div className="flex bg-white/5 rounded-lg p-0.5 mb-5">
                <button onClick={() => setMode("password")}
                  className={`flex-1 py-2 text-sm font-semibold rounded-md transition ${mode === "password" ? "bg-white/15 text-white" : "text-white/40 hover:text-white/60"}`}>
                  Password
                </button>
                <button onClick={() => setMode("magic")}
                  className={`flex-1 py-2 text-sm font-semibold rounded-md transition ${mode === "magic" ? "bg-white/15 text-white" : "text-white/40 hover:text-white/60"}`}>
                  Email Link
                </button>
              </div>

              <form onSubmit={mode === "password" ? handlePasswordLogin : handleMagicLink}>
                {/* Username / Email */}
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-white/50 mb-1.5">
                    {mode === "password" ? "Username or Email" : "Email"}
                  </label>
                  <input
                    type={mode === "magic" ? "email" : "text"}
                    required
                    value={login}
                    onChange={e => setLogin(e.target.value)}
                    placeholder={mode === "password" ? "username or you@example.co.uk" : "you@example.co.uk"}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-white/10 border border-white/15 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition"
                  />
                </div>

                {/* Password (only in password mode) */}
                {mode === "password" && (
                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-white/50 mb-1.5">Password</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 rounded-lg bg-white/10 border border-white/15 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition"
                    />
                  </div>
                )}

                {/* Error */}
                {errorMsg && (
                  <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-200 text-sm">
                    {errorMsg}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg bg-field-600 text-white font-semibold text-sm hover:bg-field-700 transition disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                >
                  {loading
                    ? "Please wait..."
                    : mode === "password"
                      ? "Log In"
                      : "Send Login Link"
                  }
                </button>
              </form>

              {mode === "password" && (
                <button onClick={() => setMode("magic")} className="w-full text-center mt-3 text-xs text-white/40 hover:text-white/60 transition">
                  Forgot password? Use email link instead
                </button>
              )}
            </>
          )}
        </div>

        <p className="text-center text-white/20 text-xs mt-6">FieldFlow v0.1.0</p>
      </div>
    </div>
  );
}

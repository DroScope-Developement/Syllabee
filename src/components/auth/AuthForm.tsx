import { useState, type FormEvent } from "react";

type AuthMode = "signIn" | "signUp";

interface AuthFormProps {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
}

export function AuthForm({ onSignIn, onSignUp }: AuthFormProps) {
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      if (mode === "signIn") {
        await onSignIn(email.trim(), password);
      } else {
        const result = await onSignUp(email.trim(), password);
        if (result.needsEmailConfirmation) {
          setMessage("Check your email to confirm your account, then sign in.");
          setMode("signIn");
          setPassword("");
        }
      }
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex rounded-lg bg-stone-100 p-1">
        <button
          type="button"
          onClick={() => {
            setMode("signIn");
            setError(null);
            setMessage(null);
          }}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
            mode === "signIn"
              ? "bg-white text-stone-900 shadow-sm"
              : "text-stone-500 hover:text-stone-700"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("signUp");
            setError(null);
            setMessage(null);
          }}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
            mode === "signUp"
              ? "bg-white text-stone-900 shadow-sm"
              : "text-stone-500 hover:text-stone-700"
          }`}
        >
          Create account
        </button>
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
        <div>
          <label htmlFor="auth-email" className="block text-sm font-medium text-stone-700">
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm text-stone-900 outline-none transition-colors focus:border-honey-400 focus:ring-2 focus:ring-honey-100"
          />
        </div>

        <div>
          <label htmlFor="auth-password" className="block text-sm font-medium text-stone-700">
            Password
          </label>
          <input
            id="auth-password"
            type="password"
            autoComplete={mode === "signIn" ? "current-password" : "new-password"}
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm text-stone-900 outline-none transition-colors focus:border-honey-400 focus:ring-2 focus:ring-honey-100"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        {message && (
          <p className="text-sm text-honey-800">{message}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-honey-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-honey-800 disabled:opacity-60"
        >
          {isSubmitting
            ? "Please wait…"
            : mode === "signIn"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>
    </div>
  );
}

function formatAuthError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("invalid login credentials")) {
      return "Incorrect email or password.";
    }
    if (message.includes("user already registered")) {
      return "An account with this email already exists. Try signing in.";
    }
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-shell">
          <div className="auth-card text-center text-sm text-steel-500">
            Loading sign-in…
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

import { AuthForm } from "@/components/auth/auth-form";
import { loginAction } from "@/app/auth/form-actions";

export function LoginForm({ initialError = "", initialMessage = "" }: { initialError?: string; initialMessage?: string }) {
  return <AuthForm mode="login" action={loginAction} initialState={{ success: Boolean(initialMessage) && !initialError, message: initialError || initialMessage }} />;
}

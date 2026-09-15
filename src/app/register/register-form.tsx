import { AuthForm } from "@/components/auth/auth-form";
import { registerAction } from "@/app/auth/form-actions";

export function RegisterForm() {
  return <AuthForm mode="register" action={registerAction} />;
}

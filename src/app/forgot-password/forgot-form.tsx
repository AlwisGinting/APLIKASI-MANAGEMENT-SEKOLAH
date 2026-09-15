import { AuthForm } from "@/components/auth/auth-form";
import { forgotPasswordAction } from "@/app/auth/form-actions";

export function ForgotPasswordForm() {
  return <AuthForm mode="forgot" action={forgotPasswordAction} />;
}

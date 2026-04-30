import { createFileRoute } from "@tanstack/react-router";
import { SignUp } from "@clerk/tanstack-react-start";

export const Route = createFileRoute("/sign-up")({ component: SignUpPage });

function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <SignUp
        routing="hash"
        forceRedirectUrl="/dashboard"
        signInUrl="/sign-in"
      />
    </div>
  );
}

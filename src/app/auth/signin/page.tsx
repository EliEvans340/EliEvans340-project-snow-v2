import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignInButtons } from "./signin-buttons";

export default async function SignInPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-ice-400 mb-2">Welcome back</h1>
          <p className="text-snow-400">Sign in to access your favorites and more</p>
        </div>
        <div className="bg-snow-800 rounded-xl p-6 border border-snow-700">
          <SignInButtons />
        </div>
        <p className="text-center text-sm text-snow-500 mt-4">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}

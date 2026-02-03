import Image from "next/image";
import { auth } from "@/auth";

export default async function AccountPage() {
  const session = await auth();

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-ice-400 mb-8">Account</h1>
        <div className="bg-snow-800 rounded-xl p-6 border border-snow-700">
          <div className="flex items-center gap-4 mb-6">
            {session?.user?.image ? (
              <Image
                src={session.user.image}
                alt={session.user.name || "User avatar"}
                width={64}
                height={64}
                className="rounded-full"
                unoptimized
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-ice-600 flex items-center justify-center text-white text-2xl font-medium">
                {session?.user?.name?.[0] || session?.user?.email?.[0] || "U"}
              </div>
            )}
            <div>
              <h2 className="text-xl font-semibold text-snow-100">
                {session?.user?.name || "User"}
              </h2>
              <p className="text-snow-400">{session?.user?.email}</p>
            </div>
          </div>
          <div className="border-t border-snow-700 pt-6">
            <h3 className="text-lg font-medium text-snow-200 mb-4">
              Account Settings
            </h3>
            <p className="text-snow-400 text-sm">
              Account settings and preferences coming soon.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { UserMenu } from "./user-menu";
import { HeaderSearch } from "./header-search";

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-snow-900/80 backdrop-blur-sm border-b border-snow-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-ice-400">ProjectSnow</span>
          </Link>
          <div className="flex items-center gap-4">
            <HeaderSearch />
            <UserMenu />
          </div>
        </div>
      </div>
    </header>
  );
}

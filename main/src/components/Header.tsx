import Link from "next/link";
import UserProfile from "@/components/UserProfile";

const navLinkClass =
  "shrink-0 whitespace-nowrap rounded-lg border border-green-200/30 px-2.5 py-1.5 text-xs text-green-200 transition hover:border-green-200/60 hover:bg-green-200/10 hover:text-green-100 sm:px-3 sm:text-sm";

export default function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#181b1f]/90 backdrop-blur-md">
      <div className="mx-3 flex flex-col gap-2 py-3 sm:mx-5 sm:gap-3 md:flex-row md:items-center">
        <UserProfile className="py-0 mx-0 shrink-0" />
        <nav
          className="flex flex-wrap items-center gap-1.5 sm:gap-2"
          aria-label="主导航"
        >
          <Link href="/" className={navLinkClass}>
            主页
          </Link>
          <Link href="/free_shadowing" className={navLinkClass}>
            自由跟读
          </Link>
          <Link href="/free_shadowing/free" className={navLinkClass}>
            超自由跟读
          </Link>
          <Link href="/leaderboard" className={navLinkClass}>
            🏆 排行榜
          </Link>
          <Link href="/whitepaper" className={navLinkClass}>
            👉说明书👈
          </Link>
        </nav>
      </div>
    </header>
  );
}

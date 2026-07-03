"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderTree,
  Layers,
  LogOut,
  Shirt,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/features/auth/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const NAV = [
  { href: "/", label: "Wardrobe", icon: Shirt },
  { href: "/outfits", label: "Outfits", icon: Layers },
  { href: "/categories", label: "Categories", icon: FolderTree },
  { href: "/fields", label: "Custom fields", icon: SlidersHorizontal },
];

export function AppSidebar({ email }: { email?: string }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-16 shrink-0 flex-col items-center border-r bg-sidebar py-4 md:w-56 md:items-stretch md:px-3">
      <Link href="/" className="mb-6 flex items-center gap-2.5 md:px-2">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Shirt className="size-4.5" />
        </div>
        <span className="hidden text-sm font-semibold tracking-tight md:block">
          Closet
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="hidden md:block">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col items-center gap-1 md:items-stretch">
        <Separator className="my-2" />
        {email && (
          <p className="hidden truncate px-2.5 pb-1 text-xs text-muted-foreground md:block">
            {email}
          </p>
        )}
        <div className="flex items-center justify-between gap-1 md:px-1">
          <ThemeToggle />
          <form action={signOut}>
            <Button
              variant="ghost"
              size="icon"
              type="submit"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </Button>
          </form>
        </div>
      </div>
    </aside>
  );
}

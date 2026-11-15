"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction, switchBusinessAction } from "@/server/actions";
import { Button } from "@/components/ui/button";

export type NavItem = { href: string; label: string };

export function AppFrame({
  area,
  items,
  heading,
  profileName,
  memberships,
  activeBusinessId,
  notice,
  children,
}: {
  area: string;
  items: NavItem[];
  heading: string;
  profileName: string;
  memberships?: { id: string; name: string }[];
  activeBusinessId?: string;
  notice?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-svh bg-background md:grid md:grid-cols-[16.5rem_minmax(0,1fr)]">
      <aside className="hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex md:min-h-svh md:flex-col">
        <Brand area={area} />
        <SideLinks items={items} />
      </aside>
      <div className="flex min-h-full min-w-0 flex-col">
        <header className="flex items-center gap-3 border-b px-4 py-3 md:px-8">
          <details className="md:hidden">
            <summary className="cursor-pointer list-none text-sm font-medium">Menu</summary>
            <div className="absolute left-4 right-4 z-20 mt-2 rounded-xl border bg-popover p-2 text-popover-foreground shadow-none">
              <SideLinks items={items} />
            </div>
          </details>
          <div className="min-w-0">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">{area}</p>
            <h1 className="truncate font-heading text-lg leading-tight">{heading}</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {memberships && memberships.length > 1 && activeBusinessId ? (
              <form action={switchBusinessAction} className="hidden items-center gap-2 sm:flex">
                <select
                  name="businessId"
                  defaultValue={activeBusinessId}
                  aria-label="Active business"
                  className="h-8 max-w-48 rounded-lg border border-input bg-transparent px-2 text-sm"
                >
                  {memberships.map((membership) => (
                    <option key={membership.id} value={membership.id}>
                      {membership.name}
                    </option>
                  ))}
                </select>
                <Button type="submit" variant="outline" size="sm">
                  Switch
                </Button>
              </form>
            ) : null}
            <p className="hidden text-sm text-muted-foreground lg:block">{profileName}</p>
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </header>
        {notice ? (
          <div className="border-b bg-destructive/10 px-4 py-3 text-sm text-destructive md:px-8">
            {notice}
          </div>
        ) : null}
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}

function Brand({ area }: { area: string }) {
  return (
    <Link href={area === "Platform" ? "/admin" : "/app"} className="block px-5 py-6">
      <p className="font-heading text-2xl leading-none">iAGO</p>
      <p className="mt-1 text-xs tracking-[0.18em] text-sidebar-foreground/70 uppercase">Loyalty</p>
    </Link>
  );
}

function SideLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="grid gap-1 px-3">
      {items.map((item) => {
        const active = pathname === item.href || (item.href !== "/app" && item.href !== "/admin" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              active
                ? "rounded-lg bg-sidebar-accent px-3 py-2 text-sm text-sidebar-accent-foreground"
                : "rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/70"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

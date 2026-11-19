"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IagoMark } from "@/components/iago-mark";
import { Button } from "@/components/ui/button";
import { signOutAction, switchBusinessAction } from "@/server/actions";

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
    <div className="min-h-screen bg-bone md:grid md:grid-cols-[16.5rem_minmax(0,1fr)]">
      <aside className="hidden border-r border-ink-line bg-ink text-bone md:flex md:min-h-screen md:flex-col">
        <div className="px-5 py-6">
          <IagoMark
            href={area === "Platform" ? "/admin" : "/app"}
            subtitle={area === "Platform" ? "Platform" : "Loyalty"}
            tone="bone"
            size="sm"
          />
        </div>
        <SideLinks items={items} />
        <div className="mt-auto border-t border-ink-line px-5 py-4 text-xs text-mute">
          iAGO Digital
        </div>
      </aside>
      <div className="flex min-h-full min-w-0 flex-col">
        <header className="flex items-center gap-3 border-b border-ink/10 bg-bone px-4 py-3 md:px-8">
          <details className="md:hidden">
            <summary className="cursor-pointer list-none text-sm font-medium text-ink">Menu</summary>
            <div className="absolute left-4 right-4 z-20 mt-2 rounded-xl border border-ink/10 bg-bone p-2 text-ink shadow-none">
              <SideLinks items={items} ink />
            </div>
          </details>
          <div className="min-w-0">
            <p className="text-xs tracking-[0.18em] text-mute uppercase">{area}</p>
            <h1 className="truncate font-heading text-lg font-bold tracking-tight text-ink">{heading}</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {memberships && memberships.length > 1 && activeBusinessId ? (
              <form action={switchBusinessAction} className="hidden items-center gap-2 sm:flex">
                <select
                  name="businessId"
                  defaultValue={activeBusinessId}
                  aria-label="Active business"
                  className="h-8 max-w-48 rounded-lg border border-ink/15 bg-transparent px-2 text-sm text-ink"
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
            <p className="hidden text-sm text-mute lg:block">{profileName}</p>
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </header>
        {notice ? (
          <div className="border-b border-coral/20 bg-coral/10 px-4 py-3 text-sm text-coral-dim md:px-8">
            {notice}
          </div>
        ) : null}
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}

function SideLinks({ items, ink = false }: { items: NavItem[]; ink?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="grid gap-1 px-3">
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/app" && item.href !== "/admin" && pathname.startsWith(item.href));
        if (ink) {
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                active
                  ? "rounded-lg bg-ink px-3 py-2 text-sm text-bone"
                  : "rounded-lg px-3 py-2 text-sm text-ink/75 hover:bg-ink/5"
              }
            >
              {item.label}
            </Link>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              active
                ? "rounded-lg bg-coral px-3 py-2 text-sm font-medium text-ink"
                : "rounded-lg px-3 py-2 text-sm text-bone/75 hover:bg-ink-raised hover:text-bone"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SITE } from "@/lib/site";

const nav = [
  { href: "/", label: "Product" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  return (
    <header className="glass sticky top-0 z-50 border-b border-border/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-heading text-xl tracking-tight">{SITE.name}</span>
          <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            {SITE.product}
          </span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          <a
            href={`${SITE.studioUrl}/services`}
            className="transition-colors hover:text-foreground"
          >
            Studio
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Login</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/register">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

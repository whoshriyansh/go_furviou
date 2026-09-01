import Link from "next/link";
import { SITE } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="font-heading text-2xl">{SITE.name}</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            IT product studio building MVPs, SaaS, AI applications, and internal
            tools. {SITE.product} is our email outreach product — import leads,
            connect Gmail, and send sequences from your own inbox.
          </p>
          <a
            href={`mailto:${SITE.supportEmail}`}
            className="mt-4 inline-block text-sm text-foreground"
          >
            {SITE.supportEmail}
          </a>
        </div>
        <div>
          <p className="text-xs tracking-widest text-muted-foreground uppercase">
            Product
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link href="/">Home</Link>
            </li>
            <li>
              <Link href="/login">Login</Link>
            </li>
            <li>
              <Link href="/register">Get started</Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs tracking-widest text-muted-foreground uppercase">
            Company
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <a href={`${SITE.studioUrl}/services`}>Services</a>
            </li>
            <li>
              <Link href="/privacy">Privacy</Link>
            </li>
            <li>
              <Link href="/terms">Terms</Link>
            </li>
            <li>
              <Link href="/contact">Contact</Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border px-6 py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {SITE.name}. All rights reserved.
      </div>
    </footer>
  );
}

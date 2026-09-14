import Link from "next/link";
import { SITE } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="font-heading text-2xl">{SITE.name}</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {SITE.product} is Furviou&apos;s outreach product. The studio
            builds websites and products for startups and local businesses in
            the US and India. Founded by {SITE.founder.name} (@
            {SITE.founder.handle}).
          </p>
          <a
            href={`mailto:${SITE.supportEmail}`}
            className="mt-4 inline-block text-sm text-foreground"
          >
            {SITE.supportEmail}
          </a>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
            {SITE.socials.map((social) => (
              <a key={social.name} href={social.href}>
                {social.name}
              </a>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs tracking-widest text-muted-foreground uppercase">
            Furviou
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link href="/">Go</Link>
            </li>
            <li>
              <a href={SITE.sibling.href}>{SITE.sibling.name}</a>
            </li>
            <li>
              <a href={SITE.studioUrl}>Studio</a>
            </li>
            <li>
              <a href={`${SITE.studioUrl}/work`}>Work</a>
            </li>
            <li>
              <a href={`${SITE.studioUrl}/it-solutions-delhi`}>
                IT solutions in Delhi
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs tracking-widest text-muted-foreground uppercase">
            Legal
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link href="/privacy">Privacy</Link>
            </li>
            <li>
              <Link href="/terms">Terms</Link>
            </li>
            <li>
              <Link href="/contact">Contact</Link>
            </li>
            <li>
              <Link href="/login">Login</Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border px-6 py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {SITE.name}. {SITE.product} is a Furviou
        product.
      </div>
    </footer>
  );
}

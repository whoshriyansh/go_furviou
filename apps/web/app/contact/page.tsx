import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { SiteShell } from "@/components/site/SiteShell";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: `Contact ${SITE.name} about Go.`,
};

export default function ContactPage() {
  return (
    <SiteShell>
      <main className="blueprint-grid">
        <div className="mx-auto max-w-3xl px-6 py-24">
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
            / Contact
          </p>
          <h1 className="font-heading mt-4 text-5xl md:text-6xl">
            Questions about Go or consent.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Product support and Google OAuth questions go to a real person — not
            a ticket black hole.
          </p>
          <div className="mt-10 space-y-6 border-t border-border pt-10">
            <div>
              <p className="text-xs tracking-widest text-muted-foreground uppercase">
                Product support
              </p>
              <a
                className="mt-2 inline-block text-xl"
                href={`mailto:${SITE.supportEmail}`}
              >
                {SITE.supportEmail}
              </a>
            </div>
            <div>
              <p className="text-xs tracking-widest text-muted-foreground uppercase">
                User support / consent screen
              </p>
              <a
                className="mt-2 inline-block text-xl"
                href={`mailto:${SITE.consentEmail}`}
              >
                {SITE.consentEmail}
              </a>
            </div>
          </div>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild>
              <a href={`mailto:${SITE.supportEmail}`}>Email us</a>
            </Button>
            <Button variant="outline" asChild>
              <a href={SITE.studioUrl}>Furviou studio</a>
            </Button>
          </div>
        </div>
      </main>
    </SiteShell>
  );
}

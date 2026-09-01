import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HomeAuth } from "@/components/site/HomeAuth";
import { SiteShell } from "@/components/site/SiteShell";

const chapters = [
  {
    roman: "I",
    year: "2026",
    title: "Connect Gmail",
    body: "Sign in, then connect the Google mailbox you actually send from. OAuth only — we never ask for your password.",
  },
  {
    roman: "II",
    year: "2026",
    title: "Import leads",
    body: "Upload a CSV, map columns, keep custom fields like ice breakers. Leads live in your account, not locked inside one campaign.",
  },
  {
    roman: "III",
    year: "2026",
    title: "Build the sequence",
    body: "Write the first email and follow-ups. Set delays, keep threads intact, stop automatically when someone replies.",
  },
  {
    roman: "IV",
    year: "2026",
    title: "Send from your inbox",
    body: "Go uses your Gmail sending limits and schedule so outreach looks like you — because it is you.",
  },
];

export default function HomePage() {
  return (
    <SiteShell>
      <main>
        <section className="blueprint-grid border-b border-border">
          <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
            <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
              Furviou · Go · 2026
            </p>
            <h1 className="font-heading mt-6 max-w-3xl text-5xl leading-[1.1] text-balance md:text-7xl">
              Import leads. Send sequences. From your Gmail.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Go is Furviou&apos;s outreach product. One job: connect your
              mailbox, add leads to a campaign, and send email follow-ups that
              stop when people reply.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" asChild>
                <Link href="/register">Get started</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">Login</Link>
              </Button>
            </div>
            <div className="mt-8">
              <HomeAuth />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
            / How it works
          </p>
          <h2 className="font-heading mt-3 text-4xl md:text-5xl">
            One problem. Shipped properly.
          </h2>
          <div className="mt-12 divide-y divide-border border-y border-border">
            {chapters.map((chapter) => (
              <article
                key={chapter.roman}
                className="grid gap-4 py-10 md:grid-cols-[140px_1fr]"
              >
                <p className="text-sm text-muted-foreground">
                  Chapter {chapter.roman}
                  <span className="ml-2 text-gold">{chapter.year}</span>
                </p>
                <div>
                  <h3 className="font-heading text-3xl">{chapter.title}</h3>
                  <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
                    {chapter.body}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </SiteShell>
  );
}

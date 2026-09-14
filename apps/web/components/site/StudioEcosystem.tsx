import { SITE } from "@/lib/site";

export function StudioEcosystem() {
  return (
    <section className="border-t border-border bg-card/40">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
          / A Furviou product
        </p>
        <h2 className="font-heading mt-3 text-4xl md:text-5xl">
          Built by the same studio that ships client work
        </h2>
        <p className="mt-4 max-w-2xl text-muted-foreground leading-relaxed">
          {SITE.product} is made by Furviou — a Delhi product studio for
          startups, solo founders, and local businesses in the US and India.
          Founded by {SITE.founder.name} (@{SITE.founder.handle}).
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <a
            href={SITE.studioUrl}
            className="rounded-2xl border border-border bg-card p-6 shadow-soft transition-colors hover:border-primary/30"
          >
            <p className="text-xs tracking-widest text-muted-foreground uppercase">
              Studio
            </p>
            <p className="font-heading mt-2 text-2xl">Furviou</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Custom websites and products. Validate first, then invest.
            </p>
          </a>
          <a
            href={SITE.sibling.href}
            className="rounded-2xl border border-border bg-card p-6 shadow-soft transition-colors hover:border-primary/30"
          >
            <p className="text-xs tracking-widest text-muted-foreground uppercase">
              Sibling product
            </p>
            <p className="font-heading mt-2 text-2xl">{SITE.sibling.name}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {SITE.sibling.tagline}
            </p>
          </a>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <p className="text-xs tracking-widest text-muted-foreground uppercase">
              Delivered work
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {SITE.work.map((item) => (
                <li key={item.name}>
                  <a href={item.href} className="hover:text-primary">
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
            <a
              href={`${SITE.studioUrl}/work`}
              className="mt-4 inline-block text-sm text-primary"
            >
              All work on Furviou
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

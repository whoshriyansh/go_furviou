import type { Metadata } from "next";
import { SiteShell } from "@/components/site/SiteShell";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms for using ${SITE.name} Go.`,
};

export default function TermsPage() {
  return (
    <SiteShell>
      <article className="mx-auto max-w-3xl px-6 py-20">
        <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
          Legal · Effective 1 September 2026
        </p>
        <h1 className="font-heading mt-4 text-5xl">Terms of Service</h1>
        <p className="mt-6 text-muted-foreground">
          These terms govern your use of Go at {SITE.url}, operated by{" "}
          {SITE.name}. If you do not agree, do not use the product.
        </p>

        <section className="mt-12 space-y-4 text-[15px] leading-7">
          <h2 className="font-heading text-3xl">The product</h2>
          <p>
            Go lets you import leads, build email sequences, and send those
            emails through mailboxes you connect (starting with Gmail). It is
            provided as-is while we continue to ship features.
          </p>
        </section>

        <section className="mt-10 space-y-4 text-[15px] leading-7">
          <h2 className="font-heading text-3xl">Accounts</h2>
          <p>
            You must sign in with a Google account you are authorised to use.
            You are responsible for activity under your account and for keeping
            access to that Google account secure.
          </p>
        </section>

        <section className="mt-10 space-y-4 text-[15px] leading-7">
          <h2 className="font-heading text-3xl">Mailboxes and Google</h2>
          <p>
            Connecting Gmail grants Go permission to send mail as you, within
            the scopes you approve on Google&apos;s consent screen. You can
            revoke access in Google Account settings. You must comply with
            Google&apos;s terms and Gmail policies. We may suspend sending if
            Google or a provider flags the mailbox.
          </p>
        </section>

        <section className="mt-10 space-y-4 text-[15px] leading-7">
          <h2 className="font-heading text-3xl">Acceptable use</h2>
          <p>
            You are solely responsible for the content of emails and for having
            a lawful basis to contact each lead (including anti-spam rules such
            as CAN-SPAM, CASL, and GDPR where they apply). Do not use Go to
            send malware, phishing, or deceptive messages, or to harass
            recipients. We may suspend accounts that abuse the service or harm
            deliverability.
          </p>
        </section>

        <section className="mt-10 space-y-4 text-[15px] leading-7">
          <h2 className="font-heading text-3xl">Your data</h2>
          <p>
            You retain rights to your leads and campaign content. Our{" "}
            <a href="/privacy">Privacy Policy</a> explains how we handle
            personal data, including Google user data.
          </p>
        </section>

        <section className="mt-10 space-y-4 text-[15px] leading-7">
          <h2 className="font-heading text-3xl">Liability</h2>
          <p>
            Go is provided without warranties of deliverability, inbox
            placement, or uninterrupted service. To the fullest extent allowed
            by law, {SITE.name} is not liable for lost profits, bounced mail,
            provider blocks, or damages arising from your campaigns. Our total
            liability for a claim is limited to the amount you paid us for Go
            in the three months before the claim (or zero if Go is free).
          </p>
        </section>

        <section className="mt-10 space-y-4 text-[15px] leading-7">
          <h2 className="font-heading text-3xl">Contact</h2>
          <p>
            {SITE.supportEmail}
            <br />
            Consent / verification: {SITE.consentEmail}
          </p>
        </section>
      </article>
    </SiteShell>
  );
}

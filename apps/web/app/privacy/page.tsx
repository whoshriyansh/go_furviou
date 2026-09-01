import type { Metadata } from "next";
import { SiteShell } from "@/components/site/SiteShell";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${SITE.name} Go collects, uses, and protects your data.`,
};

export default function PrivacyPage() {
  return (
    <SiteShell>
      <article className="mx-auto max-w-3xl px-6 py-20">
        <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
          Legal · Effective 1 September 2026
        </p>
        <h1 className="font-heading mt-4 text-5xl">Privacy Policy</h1>
        <p className="mt-6 text-muted-foreground">
          This policy applies to Go ({SITE.url}), a product of {SITE.name}. For
          studio work see{" "}
          <a href={SITE.studioUrl}>{SITE.studioUrl.replace("https://", "")}</a>.
        </p>

        <section className="mt-12 space-y-4 text-[15px] leading-7">
          <h2 className="font-heading text-3xl">Who we are</h2>
          <p>
            {SITE.name} operates Go. Questions about this policy or consent:
            <br />
            Product support:{" "}
            <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>
            <br />
            OAuth / consent contact:{" "}
            <a href={`mailto:${SITE.consentEmail}`}>{SITE.consentEmail}</a>
          </p>
        </section>

        <section className="mt-10 space-y-4 text-[15px] leading-7">
          <h2 className="font-heading text-3xl">What we collect</h2>
          <p>
            When you sign in with Google we receive your Google account id,
            verified email address, name, and profile photo. We store these to
            create and identify your Go account.
          </p>
          <p>
            When you connect a Gmail mailbox (later in the product) we receive
            OAuth tokens so Go can send campaign email through that mailbox on
            your behalf. We store mailbox address, token metadata, and sending
            limits. We do not receive your Google password.
          </p>
          <p>
            You may upload leads (email, name, company, website, and custom
            fields). We store campaign copy, send logs, and reply/open events
            needed to run sequences.
          </p>
        </section>

        <section className="mt-10 space-y-4 text-[15px] leading-7">
          <h2 className="font-heading text-3xl">How we use Google data</h2>
          <p>
            Sign-in data is used only to authenticate you. Gmail access is used
            only to send the emails you authorise in Go, detect replies so
            follow-ups can stop, and show delivery status. We do not use Google
            user data for ads. We do not sell it. We do not use it to train
            independent AI models.
          </p>
          <p>
            {SITE.name}&apos;s use of information received from Google APIs
            adheres to the{" "}
            <a href="https://developers.google.com/terms/api-services-user-data-policy">
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>
        </section>

        <section className="mt-10 space-y-4 text-[15px] leading-7">
          <h2 className="font-heading text-3xl">Sharing</h2>
          <p>
            We share data with infrastructure providers that host Go (for
            example database and cloud hosting) under contract, and if required
            by law. We do not share your Gmail contents or lead lists with
            unrelated third parties for their marketing.
          </p>
        </section>

        <section className="mt-10 space-y-4 text-[15px] leading-7">
          <h2 className="font-heading text-3xl">Retention and your choices</h2>
          <p>
            We keep account and campaign data while your account is active. You
            can disconnect Google access in your Google Account permissions at
            any time. You can request deletion of your Go account and associated
            data by emailing {SITE.supportEmail}. Tokens are revoked when you
            disconnect a mailbox or delete your account.
          </p>
        </section>

        <section className="mt-10 space-y-4 text-[15px] leading-7">
          <h2 className="font-heading text-3xl">Security</h2>
          <p>
            Access tokens and secrets are stored on our servers and transmitted
            over HTTPS. No method of storage is perfectly secure; we take
            commercially reasonable steps to protect your information.
          </p>
        </section>

        <section className="mt-10 space-y-4 text-[15px] leading-7">
          <h2 className="font-heading text-3xl">Changes</h2>
          <p>
            We may update this policy. The effective date at the top will
            change. Continued use of Go after an update means you accept the
            revised policy.
          </p>
        </section>
      </article>
    </SiteShell>
  );
}

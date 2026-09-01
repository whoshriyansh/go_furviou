import { GoogleSignInButton } from "../../../components/GoogleSignInButton";

export default function RegisterPage() {
  return (
    <section>
      <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
        Chapter I
      </p>
      <h1 className="font-heading mt-2 text-4xl">Get started</h1>
      <p className="mt-2 mb-6 text-sm text-muted-foreground">
        Create your Go account with Google. Same button if you already have one.
      </p>
      <GoogleSignInButton mode="register" />
    </section>
  );
}

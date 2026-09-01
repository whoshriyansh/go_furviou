import { GoogleSignInButton } from "../../../components/GoogleSignInButton";

export default function LoginPage() {
  return (
    <section>
      <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
        Chapter I
      </p>
      <h1 className="font-heading mt-2 text-4xl">Login</h1>
      <p className="mt-2 mb-6 text-sm text-muted-foreground">
        Continue with the Google account you want to use for Go.
      </p>
      <GoogleSignInButton mode="login" />
    </section>
  );
}

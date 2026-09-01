export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
      }}
    >
      {children}
    </main>
  );
}

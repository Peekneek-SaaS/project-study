import { SignIn } from "@clerk/nextjs";

/**
 * The split-screen `(auth)` layout already centres this and decides how wide it
 * is, so there is nothing to position here — the extra centring wrapper this
 * used to carry only fought it. How the card *looks* is set once on
 * `ClerkProvider`: the shadcn theme for colours and type, `--radius` for the
 * corners, and `elevation: flush` to drop the card's own shadow and border so
 * it sits on the page rather than floating above it.
 */
export default function SignInPage() {
  return (
    <SignIn
      appearance={{
        // Fills the slot the layout gives it instead of centring at its own
        // intrinsic width, which left the form narrower than its column.
        elements: { rootBox: "w-full", cardBox: "w-full" },
      }}
    />
  );
}

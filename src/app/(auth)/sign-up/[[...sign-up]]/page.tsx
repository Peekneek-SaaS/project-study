import { SignUp } from "@clerk/nextjs";

/** The sign-in page's twin — see it for where the styling actually comes from. */
export default function SignUpPage() {
  return (
    <SignUp
      appearance={{
        elements: { rootBox: "w-full", cardBox: "w-full" },
      }}
    />
  );
}

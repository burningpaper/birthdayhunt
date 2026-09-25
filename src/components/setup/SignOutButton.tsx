"use client";

import { useRouter } from "next/navigation";
import { QuietButton } from "./ui";

export function SignOutButton() {
  const router = useRouter();
  return (
    <QuietButton
      onClick={async () => {
        await fetch("/api/setup/login", { method: "DELETE" });
        router.replace("/setup/login");
        router.refresh();
      }}
    >
      Sign out
    </QuietButton>
  );
}

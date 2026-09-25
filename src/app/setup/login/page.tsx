import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/setup/LoginForm";
import { isSetupAuthed } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in · Treasure Hunt Setup" };

export default async function LoginPage() {
  if (await isSetupAuthed()) redirect("/setup");
  return (
    <main className="toybox grid min-h-dvh place-items-center px-4 py-10">
      <LoginForm />
    </main>
  );
}

import { redirect } from "next/navigation";
import { isSetupAuthed } from "@/lib/auth";
import { MarbleLab } from "./MarbleLab";

/** Parent-only workbench for the Marble Run 3D rebuild. */
export default async function MarbleLabPage() {
  if (!(await isSetupAuthed())) redirect("/setup/login");
  return <MarbleLab />;
}

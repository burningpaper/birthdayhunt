import type { Metadata } from "next";
import { Styleguide } from "@/components/Styleguide";

export const metadata: Metadata = { title: "Toybox Plastic styleguide" };

/** The living reference for DESIGN.md. Check visual changes here first. */
export default function StyleguidePage() {
  return <Styleguide />;
}

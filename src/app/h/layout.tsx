import type { Viewport } from "next";

/** Play screens behave like a game: no pinch-zoom, painted edge to edge. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#101c3c",
};

export default function PlayLayout({ children }: LayoutProps<"/h">) {
  return children;
}

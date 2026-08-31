import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WaitRelay: Fork Flight",
  description: "A playable decision relay that turns AI waiting time into meaningful human input.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

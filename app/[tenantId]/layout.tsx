import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";

/**
 * Onboarding portal layout — isolated from the main locale layout tree.
 *
 * Like /studio, this segment owns its own <html>/<body> because it sits
 * outside the [locale] routing and doesn't need next-intl, JSON-LD, or the
 * marketing site's navigation chrome. The middleware matcher in proxy.ts
 * is updated to skip /onboarding so next-intl doesn't redirect it.
 */

const body = Geist({
  subsets: ["latin"],
  variable: "--font-body-src",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SmartVolve Onboarding",
  description: "Portale di onboarding interattivo SmartVolve",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" className={`${body.variable} dark`}>
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              :root {
                --bg:          #080A0F;
                --bg-surface:  #0F1117;
                --bg-raised:   #161B26;
                --ink:         #F2F2F0;
                --ink-soft:    #8B8FA8;
                --line:        rgba(255, 255, 255, 0.08);
                --accent:      #3B82F6;
                --accent-glow: #1D4ED8;
                --radius:      0.625rem;
              }
            `,
          }}
        />
      </head>
      <body
        style={{
          margin: 0,
          background: "var(--bg)",
          color: "var(--ink)",
          fontFamily:
            "var(--font-body-src), system-ui, -apple-system, sans-serif",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        {children}
      </body>
    </html>
  );
}

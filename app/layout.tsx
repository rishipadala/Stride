import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stride \u2014 Your Friendly Neighborhood Work Tracker",
  description: "Log your daily work, build streaks, and show anyone what you've been up to. Neo-brutalist, Spidey-powered, and actually fun to use.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;0,9..144,800;1,9..144,400&family=Inter:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        {/* Landing-page display face. Kept in its own request so that if this
            family is ever renamed upstream, the 400 can't take the app's
            core three families down with it. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('stride-theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark')})()` }} />
        {children}
      </body>
    </html>
  );
}
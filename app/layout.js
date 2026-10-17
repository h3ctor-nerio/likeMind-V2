import "./globals.css";
import { AuthProvider } from "./components/AuthProvider";
import Nav from "./components/Nav";
import { UiLanguageProvider, LanguageWidget } from "./components/UiLanguage";

export const metadata = {
  title: "LikeMinds",
  description: "Share a thought, find people who feel the same, and meet up when you're ready.",
};

export const viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Bricolage+Grotesque:opsz,wght@12..96,500..800&display=swap"
        />
      </head>
      <body>
        <AuthProvider>
          <UiLanguageProvider>
          <Nav />
          <LanguageWidget />
          <main>{children}</main>
          <footer className="footer">
            Team 10 prototype for 2026 UAlbany AI in Society Inaugural Competition. Your thoughts stay anonymous unless you choose otherwise. In the US, call or text 988 any time if you're in crisis.
            <br />
            Maps &copy; OpenStreetMap contributors.
          </footer>
          </UiLanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

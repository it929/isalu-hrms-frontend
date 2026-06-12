import "./globals.css";
import { ThemeProvider } from "../contexts/ThemeContext";
import { SessionProvider } from "../contexts/SessionContext";

export const metadata = {
  title: "Isalu HRMS",
  description: "Advanced Human Resource Management System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <SessionProvider>
            {children}
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

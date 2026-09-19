import type { Metadata } from "next";
import Script from "next/script";
import { Roboto } from "next/font/google";
import { SessionProvider } from "@/components/SessionProvider";
import { APP_NAME } from "@/lib/copy";
import "./globals.css";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: APP_NAME,
  description:
    "Don't waste hours wondering if a resume is even worth it. See job data on Indeed and Seek, then score the fit before you rewrite.",
  icons: {
    icon: [{ url: "/Jobcific-favicon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${roboto.className} antialiased`}>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-6GJR5MR5P9"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-6GJR5MR5P9');
          `}
        </Script>
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "yk9ou5rl9c");
          `}
        </Script>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}

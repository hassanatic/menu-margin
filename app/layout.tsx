import type { ReactNode } from "react";

export const metadata = {
  title: "menu-margin",
  description: "Food cost, menu margins and HACCP checks for a small restaurant",
};

const styles = `
  body { font-family: system-ui, sans-serif; margin: 0; color: #1d1d1f; background: #fafafa; }
  header { display: flex; gap: 1.5rem; align-items: baseline; padding: 1rem 1.5rem; background: #fff; border-bottom: 1px solid #e5e5e5; }
  header a { color: inherit; text-decoration: none; }
  main { padding: 1.5rem; max-width: 960px; }
  table { border-collapse: collapse; width: 100%; background: #fff; }
  th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #eee; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .warn { color: #b3261e; font-weight: 600; }
  form { display: grid; gap: 0.5rem; max-width: 420px; margin-bottom: 1.5rem; }
  input, select, button { font: inherit; padding: 0.4rem; }
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <style>{styles}</style>
        <header>
          <strong>menu-margin</strong>
          <a href="/">Menu costing</a>
          <a href="/haccp">HACCP log</a>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}

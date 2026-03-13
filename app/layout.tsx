import "./globals.css";

export const metadata = {
  title: "Electrothon Molecular Viewer",
  description: "3D Molecular Visualization demo with 3Dmol.js"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100">{children}</body>
    </html>
  );
}


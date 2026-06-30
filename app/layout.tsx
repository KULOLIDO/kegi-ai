import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "柯基AI",
  description: "可爱、科技感的信息柯基 AI 图片生成 MVP"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

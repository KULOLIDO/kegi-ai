# 柯基AI

一个面向“信息柯基”IP 的 AI 图片风格生成 MVP。

## 技术栈

- Next.js App Router + TypeScript
- Tailwind CSS
- Supabase Auth / Database / Storage
- OpenAI Image API
- Vercel 部署

## 本地启动

```bash
npm install
npm run dev
```

复制 `.env.example` 为 `.env.local`，填入 Supabase 与 OpenAI 配置。

## Supabase 配置

1. 在 Supabase SQL Editor 执行 `supabase/schema.sql`。
2. `schema.sql` 会尝试创建公开 bucket：`generations`；如果权限不足，请在 Supabase Storage 手动创建同名公开 bucket。
3. 在 Authentication > Sign In / Providers 中开启 Anonymous Sign-ins。

## Vercel 部署

在 Vercel 项目环境变量中配置：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_BASE_URL`，AIUXU 使用 `https://api.aiuxu.com/v1`
- `OPENAI_API_KEY`
- `OPENAI_IMAGE_MODEL`，AIUXU/APIMart GPT-Image-2 使用 `gpt-image-2`
- `OPENAI_IMAGE_SIZE`，默认 `1:1`
- `OPENAI_IMAGE_RESOLUTION`，默认 `1k`，可选 `1k` / `2k` / `4k`
- `NEXT_PUBLIC_SITE_URL`

部署后把 Supabase Authentication 的 Site URL 改成 Vercel 域名。

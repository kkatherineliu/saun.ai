This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Flask Backend for Room Rater

The app has a Next.js frontend (`localhost:3000`) and Flask backend (`localhost:5001`).

### 1. Backend setup

```bash
cd backend
python -m venv .venv
# Windows PowerShell
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Then set your key in `backend/.env`:

```env
GEMINI_API_KEY=your_key_here
```

### 2. Run backend

```bash
cd backend
python app.py
```

Health check:

```bash
curl http://localhost:5001/api/health
```

### 3. Run frontend

From repo root:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Optional frontend env override (repo root `.env.local`):

```env
NEXT_PUBLIC_API_BASE=http://localhost:5001
```

### 4. Active API endpoints

- `POST /api/sessions` (upload image)
- `POST /api/sessions/:session_id/rate`
- `POST /api/sessions/:session_id/generate`
- `GET /api/jobs/:job_id`
- `GET /api/sessions/:session_id`

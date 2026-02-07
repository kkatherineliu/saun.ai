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

## Flask Backend for Gemini Photo Analysis

The project includes a Flask backend in `backend/` that accepts an image, sends it to Gemini, and returns a structured JSON response.

### 1. Backend setup

```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Set `GEMINI_API_KEY` in `backend/.env`.

### 2. Run backend

```bash
cd backend
flask --app app run --port 5000
```

Health check:

```bash
curl http://localhost:5000/health
```

### 3. API endpoint

`POST /api/analyze-photo`

- Content type: `multipart/form-data`
- Required field: `image` (file)
- Optional field: `prompt` (string)

Example response:

```json
{
  "data": {
    "summary": "A cat sitting on a couch.",
    "labels": ["cat", "couch", "indoor"],
    "confidence": 0.92,
    "safety_notes": []
  }
}
```

### 4. Frontend fetch example (Next.js)

```ts
const formData = new FormData();
formData.append("image", fileInput.files[0]);
formData.append("prompt", "Describe this image for a product catalog.");

const res = await fetch("http://localhost:5000/api/analyze-photo", {
  method: "POST",
  body: formData,
});

const data = await res.json();
```

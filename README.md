# devpost link: [CURAiTE](https://devpost.com/software/saun-ai)


Most people don’t lack taste — they lack tools.

We all have a _vision_ for how our space should feel, but there’s a huge gap between imagining a room and confidently designing it. Sometimes, Pinterest is overwhelming, furniture is expensive, and you can’t actually see if your ideas will work together.

CURAiTE bridges that gap by acting as your personal interior design team — helping you visualize, refine, and bring your vision to life; curating the perfect space for any vibe.

## 💡 What It Does
- Gives smart room suggestions around feng shui, lighting, colour, and layout
- Lets you chat with an AI interior designer to fine-tune your space
- Recommends furniture pieces you can actually buy
- Talk to a feng shui master to understand your room’s harmony
- Iterates on previous designs so each version builds on the last

## 🛠️ How We Built It
**Gemini API** for image generation + interior design agents
**ElevenLabs** for live voice chats with designers and feng shui experts
*SERP API* for finding furniture online
Frontend: Next.js, Tailwind CSS, shadcn
Backend: Flask, SQLite

## ⚡ Challenges
- Designing a UI that’s intuitive while still allowing deep customization

## 🏆 What We’re Proud Of
- Building a full-stack app end-to-end under time pressure
- Successfully integrating multiple AI APIs
- Turning abstract “vibes” into something visual and actionable

## 📚 What We Learned
- The basics of feng shui :p
- How to integrate and orchestrate multiple APIs
- Prompt engineering for structured, reliable outputs

## 🚀 What’s Next for CURAiTE
- Budget and location-aware furniture recommendations
- Deployment and stronger safeguards against malicious inputs

# Setup

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

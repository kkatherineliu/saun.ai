import os
import io
import json
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
import time as _time
import requests
from PIL import Image
from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from sqlalchemy import create_engine, Column, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
import base64
import hashlib
import threading
import re
from datetime import datetime
from typing import Any, Dict, Optional, List

import requests
from PIL import Image
from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from sqlalchemy import create_engine, Column, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

# ----------------------------
# Config
# ----------------------------
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BACKEND_DIR, ".env"))

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
CORS_ORIGIN = os.getenv("CORS_ORIGIN", "*")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///app.db")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")

GEMINI_RATING_MODEL = os.getenv("GEMINI_RATING_MODEL", "gemini-3-flash-preview")
NANOBANANA_MODEL = os.getenv("NANOBANANA_MODEL", "gemini-2.5-flash-image")

MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "10"))
FIXED_CATEGORIES = ["organization", "lighting", "spacing", "color_harmony", "cleanliness", "feng shui"]

if not GEMINI_API_KEY:
    raise RuntimeError("Missing GEMINI_API_KEY in environment")

os.makedirs(UPLOAD_DIR, exist_ok=True)

# Gemini REST base
BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
UPLOAD_BASE_URL = "https://generativelanguage.googleapis.com/upload/v1beta"

# ----------------------------
# DB setup
# ----------------------------
Base = declarative_base()
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {})
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

class Session(Base):
    __tablename__ = "sessions"
    id = Column(String, primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="uploaded")  # uploaded, rated, generating, done, error

    original_image_path = Column(String, nullable=False)
    original_image_url = Column(String, nullable=False)
    original_file_uri = Column(String, nullable=True)  # Gemini Files API uri (optional but recommended)

    rating_json = Column(Text, nullable=True)
    suggestions_json = Column(Text, nullable=True)

    images = relationship("ImageAsset", back_populates="session", cascade="all, delete-orphan")
    jobs = relationship("GenerationJob", back_populates="session", cascade="all, delete-orphan")

class ImageAsset(Base):
    __tablename__ = "image_assets"
    id = Column(String, primary_key=True)
    session_id = Column(String, ForeignKey("sessions.id"), nullable=False)
    kind = Column(String, nullable=False)  # original, generated
    path = Column(String, nullable=False)
    url = Column(String, nullable=False)
    meta_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("Session", back_populates="images")

class GenerationJob(Base):
    __tablename__ = "generation_jobs"
    id = Column(String, primary_key=True)
    session_id = Column(String, ForeignKey("sessions.id"), nullable=False)
    status = Column(String, default="queued")  # queued, running, done, error
    requested_edits_json = Column(Text, nullable=False)
    result_images_json = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("Session", back_populates="jobs")

Base.metadata.create_all(engine)

# ----------------------------
# Minimal in-memory rate limiter (hackathon-safe)
# ----------------------------
_RATE_WINDOW_SEC = 60
_RATE_LIMIT = int(os.getenv("RATE_LIMIT_PER_MINUTE", "30"))
_ip_hits: Dict[str, List[float]] = {}
_ip_lock = threading.Lock()

def check_rate_limit(ip: str) -> bool:
    now = _time.time()
    with _ip_lock:
        hits = _ip_hits.get(ip, [])
        hits = [t for t in hits if now - t < _RATE_WINDOW_SEC]
        if len(hits) >= _RATE_LIMIT:
            _ip_hits[ip] = hits
            return False
        hits.append(now)
        _ip_hits[ip] = hits
        return True

# ----------------------------
# Gemini helpers (REST)
# ----------------------------
def _headers_json() -> Dict[str, str]:
    return {"x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json"}

def gemini_generate_content(model: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    url = f"{BASE_URL}/models/{model}:generateContent"
    r = requests.post(url, headers=_headers_json(), json=payload, timeout=120)
    r.raise_for_status()
    return r.json()

def gemini_resumable_upload(file_bytes: bytes, mime_type: str, display_name: str) -> Dict[str, Any]:
    """
    Best-practice media upload via Files API resumable protocol. :contentReference[oaicite:4]{index=4}
    Returns the full file object response, including file.uri.
    """
    num_bytes = len(file_bytes)

    # Start resumable session
    start_url = f"{UPLOAD_BASE_URL}/files?key={GEMINI_API_KEY}"
    start_headers = {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": str(num_bytes),
        "X-Goog-Upload-Header-Content-Type": mime_type,
        "Content-Type": "application/json",
    }
    metadata = {"file": {"displayName": display_name}}
    start_resp = requests.post(start_url, headers=start_headers, json=metadata, timeout=60)
    start_resp.raise_for_status()

    upload_url = start_resp.headers.get("x-goog-upload-url")
    if not upload_url:
        raise RuntimeError("Missing x-goog-upload-url from resumable upload start response")

    # Upload bytes + finalize
    up_headers = {
        "Content-Length": str(num_bytes),
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize",
    }
    up_resp = requests.post(upload_url, headers=up_headers, data=file_bytes, timeout=120)
    up_resp.raise_for_status()
    return up_resp.json()

def extract_text_from_gemini(resp: Dict[str, Any]) -> str:
    """
    Gemini responses can have multiple parts; concatenate all text parts.
    """
    candidates = resp.get("candidates", [])
    if not candidates:
        return ""
    parts = candidates[0].get("content", {}).get("parts", [])
    texts = []
    for p in parts:
        if "text" in p and p["text"] is not None:
            texts.append(p["text"])
    return "".join(texts).strip()

def extract_inline_images_from_gemini(resp: Dict[str, Any]) -> List[Dict[str, str]]:
    """
    For Nano Banana, images are typically returned as inlineData: {mimeType, data(base64)}. :contentReference[oaicite:5]{index=5}
    """
    out = []
    candidates = resp.get("candidates", [])
    if not candidates:
        return out
    parts = candidates[0].get("content", {}).get("parts", [])
    for p in parts:
        inline = p.get("inlineData") or p.get("inline_data")  # some SDK examples use inline_data; REST uses inlineData in docs
        if inline and inline.get("data"):
            out.append({"mimeType": inline.get("mimeType", "image/png"), "data": inline["data"]})
    return out

# ----------------------------
# Prompt schema for rating output (Structured Outputs)
# ----------------------------
RATING_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "overall_score": {"type": "number", "description": "Overall interior design score from 0 to 10."},
        "breakdown": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "organization": {"type": "number"},
                "lighting": {"type": "number"},
                "spacing": {"type": "number"},
                "color_harmony": {"type": "number"},
                "cleanliness": {"type": "number"},
                "feng shui": {"type": "number"},
            },
            "required": FIXED_CATEGORIES,
        },
        "summary": {"type": "string", "description": "1-2 sentence summary of the room's design."},
        "suggestions": {
            "type": "array",
            "minItems": 6,
            "maxItems": 6,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "id": {"type": "string", "description": "Stable short id like s1, s2..."},
                    "category": {"type": "string", "enum": FIXED_CATEGORIES},
                    "title": {"type": "string"},
                    "why": {"type": "string"},
                    "steps": {"type": "array", "items": {"type": "string"}},
                    "impact": {"type": "string", "description": "low|medium|high"},
                    "effort": {"type": "string", "description": "low|medium|high"},
                },
                "required": ["id", "category", "title", "why", "steps", "impact", "effort"],
            },
        },
        "risks_or_tradeoffs": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["overall_score", "breakdown", "summary", "suggestions"],
}

def build_rating_prompt(criteria: List[str]) -> str:
    crit = ", ".join(criteria)
    return f"""
You are an expert interior designer. Analyze the provided room photo and rate it from 0 to 10.

Criteria: {crit}

Scoring rubric:
- 10 = magazine-ready, balanced lighting, cohesive color palette, good furniture spacing, minimal clutter.
- 0 = unusable/invalid image.

Rules:
- Be kind and objective; do NOT judge the person.
- Suggestions must be visually actionable and feasible to apply in an edited photo.
- Return exactly 6 suggestions total: one per category.
- Allowed categories only: organization, lighting, spacing, color_harmony, cleanliness, feng shui.
- The `category` field for each suggestion must use one of those exact values.

Return ONLY valid JSON matching the provided schema. No markdown, no extra text.
""".strip()

def build_edit_prompt(
    selected_suggestions: List[Dict[str, Any]],
    selected_categories: List[str],
    additional_changes: List[str],
    user_extra: str,
) -> str:
    bullets = "\n".join([f"- [{s.get('category', 'uncategorized')}] {s.get('title')}: {s.get('steps')}" for s in selected_suggestions])
    category_line = ", ".join(selected_categories) if selected_categories else "none"
    extra_lines = "\n".join([f"- {x}" for x in additional_changes]) if additional_changes else "- none"
    return f"""
Edit the provided room photo realistically.

Hard constraints:
- Preserve the same camera angle, layout, and geometry.
- Keep the room identity consistent (same walls, windows, floor).
- Apply ONLY the changes listed below; do not add new doors/windows or radically change architecture.
- Photorealistic, natural lighting, no surreal artifacts.

Apply these changes:
{bullets}

Selected improvement categories:
{category_line}

Additional user changes:
{extra_lines}

User style preference (optional): {user_extra or "none"}

Return an edited image.
""".strip()

def _safe_json_loads(value: Optional[str], fallback):
    if not value:
        return fallback
    try:
        return json.loads(value)
    except Exception:
        return fallback

def _get_latest_generated_asset(db, session_id: str) -> Optional[ImageAsset]:
    return (
        db.query(ImageAsset)
        .filter(ImageAsset.session_id == session_id, ImageAsset.kind == "generated")
        .order_by(ImageAsset.created_at.desc())
        .first()
    )

def _mime_from_path(path: str) -> str:
    lower = path.lower()
    if lower.endswith(".png"):
        return "image/png"
    if lower.endswith(".webp"):
        return "image/webp"
    return "image/jpeg"

def generate_rating_for_session(db, sess: Session) -> Dict[str, Any]:
    prompt = build_rating_prompt(FIXED_CATEGORIES)

    parts = []
    if sess.original_file_uri:
        parts.append({"fileData": {"fileUri": sess.original_file_uri, "mimeType": "image/jpeg"}})
    else:
        with open(sess.original_image_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")
        parts.append({"inlineData": {"mimeType": "image/jpeg", "data": b64}})

    parts.append({"text": prompt})

    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseJsonSchema": RATING_SCHEMA,
            "temperature": 0.2
        }
    }

    resp = gemini_generate_content(GEMINI_RATING_MODEL, payload)
    text = extract_text_from_gemini(resp)
    if not text:
        raise RuntimeError("Gemini returned empty response text for structured output")

    rating_obj = json.loads(text)
    suggestions = rating_obj.get("suggestions", [])
    sess.rating_json = json.dumps(rating_obj)
    sess.suggestions_json = json.dumps(suggestions)
    sess.status = "rated"
    db.commit()
    return rating_obj

# ----------------------------
# Background job runner (simple)
# ----------------------------
_job_threads: Dict[str, threading.Thread] = {}
_job_lock = threading.Lock()

def run_generation_job(job_id: str):
    db = SessionLocal()
    try:
        job: GenerationJob = db.query(GenerationJob).get(job_id)
        if not job:
            return
        job.status = "running"
        db.commit()

        sess: Session = db.query(Session).get(job.session_id)
        if not sess:
            job.status = "error"
            job.error_message = "Session not found"
            db.commit()
            return

        requested = json.loads(job.requested_edits_json)
        selected_suggestions = requested["selected_suggestions"]
        selected_categories = requested.get("selected_categories", [])
        additional_changes = requested.get("additional_changes", [])
        user_extra = requested.get("user_prompt_extra", "")
        num_variations = 1

        # Build prompt
        edit_prompt = build_edit_prompt(selected_suggestions, selected_categories, additional_changes, user_extra)

        # Start from the latest generated image when available; otherwise use original upload.
        parts = []
        latest_generated = _get_latest_generated_asset(db, sess.id)
        if latest_generated:
            with open(latest_generated.path, "rb") as f:
                b64 = base64.b64encode(f.read()).decode("utf-8")
            parts.append({"inlineData": {"mimeType": _mime_from_path(latest_generated.path), "data": b64}})
        elif sess.original_file_uri:
            parts.append({"fileData": {"fileUri": sess.original_file_uri, "mimeType": "image/jpeg"}})
        else:
            with open(sess.original_image_path, "rb") as f:
                b64 = base64.b64encode(f.read()).decode("utf-8")
            parts.append({"inlineData": {"mimeType": "image/jpeg", "data": b64}})

        parts.append({"text": edit_prompt})

        generated_urls = []
        for _ in range(num_variations):
            payload = {"contents": [{"parts": parts}]}
            resp = gemini_generate_content(NANOBANANA_MODEL, payload)
            imgs = extract_inline_images_from_gemini(resp)

            if not imgs:
                # Sometimes models return text-only error/explanation
                t = extract_text_from_gemini(resp)
                raise RuntimeError(f"Nano Banana returned no image. Model text: {t[:400]}")

            # Save first image part
            img0 = imgs[0]
            img_bytes = base64.b64decode(img0["data"])
            out_id = str(uuid.uuid4())
            out_name = f"{out_id}.png"
            out_path = os.path.join(UPLOAD_DIR, out_name)
            with open(out_path, "wb") as f:
                f.write(img_bytes)

            url = f"/uploads/{out_name}"
            generated_urls.append(url)

            asset = ImageAsset(
                id=out_id,
                session_id=sess.id,
                kind="generated",
                path=out_path,
                url=url,
                meta_json=json.dumps({"mimeType": img0.get("mimeType", "image/png"), "model": NANOBANANA_MODEL}),
            )
            db.add(asset)
            db.commit()

        job.status = "done"
        job.result_images_json = json.dumps(generated_urls)
        sess.status = "done"
        db.commit()

    except Exception as e:
        job = db.query(GenerationJob).get(job_id)
        if job:
            job.status = "error"
            job.error_message = str(e)
            db.commit()
        sess = None
        if job:
            sess = db.query(Session).get(job.session_id)
        if sess:
            sess.status = "error"
            db.commit()
    finally:
        db.close()

def start_job_thread(job_id: str):
    t = threading.Thread(target=run_generation_job, args=(job_id,), daemon=True)
    with _job_lock:
        _job_threads[job_id] = t
    t.start()

# ----------------------------
# Flask app
# ----------------------------
app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024
CORS(app, resources={r"/api/*": {"origins": CORS_ORIGIN}})

@app.get("/api/health")
def health():
    return jsonify({"ok": True})

@app.get("/uploads/<path:filename>")
def uploads(filename):
    return send_from_directory(UPLOAD_DIR, filename)

def client_ip() -> str:
    return request.headers.get("X-Forwarded-For", request.remote_addr or "unknown").split(",")[0].strip()

def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()

@app.post("/api/sessions")
def create_session():
    ip = client_ip()
    if not check_rate_limit(ip):
        return jsonify({"error": {"code": "rate_limited", "message": "Too many requests"}}), 429

    if "image" not in request.files:
        return jsonify({"error": {"code": "bad_request", "message": "Missing form-data field: image"}}), 400

    file = request.files["image"]
    if not file.filename:
        return jsonify({"error": {"code": "bad_request", "message": "Empty filename"}}), 400

    raw = file.read()
    if not raw:
        return jsonify({"error": {"code": "bad_request", "message": "Empty file"}}), 400

    # Basic mime guard
    mime = file.mimetype or "application/octet-stream"
    if mime not in ("image/jpeg", "image/png", "image/webp"):
        return jsonify({"error": {"code": "unsupported_media_type", "message": f"Unsupported mime: {mime}"}}), 415

    # Normalize to JPEG to keep downstream consistent
    try:
        img = Image.open(io.BytesIO(raw)).convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=92)
        img_bytes = buf.getvalue()
        mime = "image/jpeg"
    except Exception:
        return jsonify({"error": {"code": "bad_image", "message": "Could not parse image"}}), 400

    sid = str(uuid.uuid4())
    filename = f"{sid}.jpg"
    path = os.path.join(UPLOAD_DIR, filename)
    with open(path, "wb") as f:
        f.write(img_bytes)

    # Upload to Gemini Files API (recommended) :contentReference[oaicite:6]{index=6}
    file_uri = None
    try:
        uploaded = gemini_resumable_upload(img_bytes, mime, display_name=f"room-{sid}")
        file_uri = uploaded.get("file", {}).get("uri")
    except Exception as e:
        # Not fatal for hackathon; we can fall back to inlineData.
        file_uri = None

    db = SessionLocal()
    try:
        sess = Session(
            id=sid,
            status="uploaded",
            original_image_path=path,
            original_image_url=f"/uploads/{filename}",
            original_file_uri=file_uri,
        )
        db.add(sess)

        asset = ImageAsset(
            id=str(uuid.uuid4()),
            session_id=sid,
            kind="original",
            path=path,
            url=f"/uploads/{filename}",
            meta_json=json.dumps({"mimeType": mime, "sha256": sha256_bytes(img_bytes)}),
        )
        db.add(asset)
        db.commit()

        try:
            rating_obj = generate_rating_for_session(db, sess)
        except json.JSONDecodeError:
            sess.status = "error"
            db.commit()
            return jsonify({
                "error": {"code": "bad_model_output", "message": "Gemini did not return valid JSON"},
                "session_id": sid,
                "original_image_url": sess.original_image_url,
            }), 502
        except requests.HTTPError as e:
            sess.status = "error"
            db.commit()
            return jsonify({
                "error": {"code": "gemini_error", "message": str(e)},
                "session_id": sid,
                "original_image_url": sess.original_image_url,
            }), 502

        return jsonify({
            "session_id": sid,
            "original_image_url": sess.original_image_url,
            "file_uri": file_uri,  # optional
            "rating_result": rating_obj,
        })
    finally:
        db.close()

@app.post("/api/sessions/<session_id>/rate")
def rate_session(session_id: str):
    ip = client_ip()
    if not check_rate_limit(ip):
        return jsonify({"error": {"code": "rate_limited", "message": "Too many requests"}}), 429

    db = SessionLocal()
    try:
        sess: Optional[Session] = db.query(Session).get(session_id)
        if not sess:
            return jsonify({"error": {"code": "not_found", "message": "Session not found"}}), 404

        rating_obj = generate_rating_for_session(db, sess)
        return jsonify(rating_obj)

    except json.JSONDecodeError:
        return jsonify({"error": {"code": "bad_model_output", "message": "Gemini did not return valid JSON"}}), 502
    except requests.HTTPError as e:
        return jsonify({"error": {"code": "gemini_error", "message": str(e)}}), 502
    finally:
        db.close()

@app.post("/api/sessions/<session_id>/generate")
def generate(session_id: str):
    ip = client_ip()
    if not check_rate_limit(ip):
        return jsonify({"error": {"code": "rate_limited", "message": "Too many requests"}}), 429

    body = request.get_json(silent=True) or {}
    selected_ids = body.get("selected_suggestion_ids") or []
    selected_categories = body.get("selected_categories") or []
    selected_categories = [c for c in selected_categories if c in FIXED_CATEGORIES]
    additional_changes = body.get("additional_changes") or body.get("additional_suggestions") or []
    if isinstance(additional_changes, str):
        additional_changes = [additional_changes]
    additional_changes = [str(x).strip() for x in additional_changes if str(x).strip()]
    user_extra = body.get("user_prompt_extra", "")
    num_variations = 1

    db = SessionLocal()
    try:
        sess: Optional[Session] = db.query(Session).get(session_id)
        if not sess:
            return jsonify({"error": {"code": "not_found", "message": "Session not found"}}), 404

        if not sess.suggestions_json and not sess.rating_json:
            return jsonify({"error": {"code": "bad_state", "message": "Session has no rating/suggestions"}}), 400

        all_suggestions = _safe_json_loads(sess.suggestions_json, [])
        selected_ids_set = set(selected_ids)
        selected_categories_set = set(selected_categories)
        chosen = [
            s for s in all_suggestions
            if s.get("id") in selected_ids_set or s.get("category") in selected_categories_set
        ]

        if not chosen and selected_categories:
            chosen = [{
                "id": f"cat-{c}",
                "category": c,
                "title": f"Improve {c.replace('_', ' ')}",
                "why": f"User selected {c.replace('_', ' ')} as a priority.",
                "steps": [f"Apply improvements focused on {c.replace('_', ' ')}."],
                "impact": "medium",
                "effort": "medium",
            } for c in selected_categories]

        if not chosen and all_suggestions:
            chosen = all_suggestions[:1]

        job_id = str(uuid.uuid4())
        job = GenerationJob(
            id=job_id,
            session_id=sess.id,
            status="queued",
            requested_edits_json=json.dumps({
                "selected_suggestions": chosen,
                "selected_categories": selected_categories,
                "additional_changes": additional_changes,
                "user_prompt_extra": user_extra,
                "num_variations": num_variations,
                "model": NANOBANANA_MODEL,
            })
        )
        db.add(job)
        sess.status = "generating"
        db.commit()

        start_job_thread(job_id)

        return jsonify({"job_id": job_id, "status": "queued"})
    finally:
        db.close()


@app.post("/api/generate-products")
def generate_products():
    ip = client_ip()
    if not check_rate_limit(ip):
        return jsonify({"error": {"code": "rate_limited", "message": "Too many requests"}}), 429

    body = request.get_json(silent=True) or {}
    prompt = body.get("prompt", "")
    if not prompt or not isinstance(prompt, str):
        return jsonify({"error": {"code": "bad_request", "message": "Missing prompt"}}), 400

    # Build a concise instruction to return a JSON array of descriptive product names
    instruction = (
        "Given the following edit prompt for an interior design image, produce a JSON array (only) of up to 12 products"
        " that would likely appear in the edited image. For each product, provide a brief but descriptive name (2-5 words)"
        " that includes style/material details (e.g., 'Modern Beige Linen Sofa', 'Minimalist Chrome Floor Lamp')."
        " Return only a JSON array of product name strings, no extra text."
        f"\n\nPrompt:\n{prompt}"
    )

    try:
        payload = {
            "contents": [{"parts": [{"text": instruction}]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0.5}
        }
        resp = gemini_generate_content(GEMINI_RATING_MODEL, payload)
        text = extract_text_from_gemini(resp)
        if text:
            try:
                data = json.loads(text)
                if isinstance(data, list):
                    # normalize strings
                    products = [str(x).strip() for x in data if isinstance(x, (str, int, float)) and str(x).strip()]
                    return jsonify({"products": products})
            except Exception:
                # fall through to fallback parsing
                pass
    except requests.HTTPError as e:
        # let fallback handle
        pass
    except Exception:
        pass

    # Fallback: naive extraction from prompt (split punctuation/newlines)
    parts = [p.strip() for p in re.split(r"\r?\n|,|;|\||\\/", prompt) if p.strip()]
    products = list(dict.fromkeys(parts))[:12]
    return jsonify({"products": products})


# ----------------------------
# SerpApi proxy endpoints
# ----------------------------
SERPAPI_KEY = os.getenv("SERPAPI_KEY")
SERP_CACHE_TTL = int(os.getenv("SERP_CACHE_TTL", "60"))
_serp_cache = {}

def _serp_cache_get(key: str):
    item = _serp_cache.get(key)
    if not item:
        return None
    expires_at, payload = item
    if _time.time() > expires_at:
        _serp_cache.pop(key, None)
        return None
    return payload

def _serp_cache_set(key: str, payload):
    _serp_cache[key] = (_time.time() + SERP_CACHE_TTL, payload)

def _fetch_serp_one(query: str):
    key = query.lower()
    cached = _serp_cache_get(key)
    if cached:
        return cached

    if not SERPAPI_KEY:
        raise RuntimeError("Missing SERPAPI_KEY env var")

    params = {
        "engine": "google_shopping",
        "q": query,
        "api_key": SERPAPI_KEY,
    }

    r = requests.get("https://serpapi.com/search.json", params=params, timeout=20)
    r.raise_for_status()
    data = r.json()

    results = data.get("shopping_results") or []
    if not results:
        payload = {"query": query, "result": None}
        _serp_cache_set(key, payload)
        return payload

    top = results[0]
    payload = {
        "query": query,
        "result": {
            "title": top.get("title"),
            "link": top.get("link") or top.get("product_link"),
            "image": top.get("thumbnail"),
            "price": top.get("price"),
            "source": top.get("source"),
            "rating": top.get("rating"),
            "reviews": top.get("reviews"),
        },
    }
    _serp_cache_set(key, payload)
    return payload


@app.get("/api/batch_search")
def batch_search():
    raw = (request.args.get("q") or "").strip()
    if not raw:
        return jsonify({"error": "Missing q"}), 400

    parts = [p.strip() for p in raw.split(",")]
    parts = [p for p in parts if p]

    # de-dupe preserving order
    seen = set()
    queries = []
    for p in parts:
        k = p.lower()
        if k not in seen:
            seen.add(k)
            queries.append(p)

    MAX_ITEMS = 12
    queries = queries[:MAX_ITEMS]

    if not queries:
        return jsonify({"queries": [], "results": []})

    MAX_WORKERS = min(4, len(queries))
    out_by_query = {}
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        future_map = {ex.submit(_fetch_serp_one, q): q for q in queries}
        for fut in as_completed(future_map):
            q = future_map[fut]
            try:
                out_by_query[q] = fut.result()
            except Exception as e:
                out_by_query[q] = {"query": q, "result": None, "error": str(e)}

    results = [out_by_query[q] for q in queries]
    return jsonify({"queries": queries, "results": results})


@app.get("/api/search")
def search():
    q = (request.args.get("q") or "").strip()
    if not q:
        return jsonify({"error": "Missing q"}), 400

    cached = _serp_cache_get(q.lower())
    if cached:
        return jsonify(cached)

    try:
        payload = _fetch_serp_one(q)
        return jsonify(payload)
    except Exception as e:
        return jsonify({"query": q, "result": None, "error": str(e)})

@app.get("/api/jobs/<job_id>")
def job_status(job_id: str):
    db = SessionLocal()
    try:
        job: Optional[GenerationJob] = db.query(GenerationJob).get(job_id)
        if not job:
            return jsonify({"error": {"code": "not_found", "message": "Job not found"}}), 404

        return jsonify({
            "job_id": job.id,
            "status": job.status,
            "generated_images": json.loads(job.result_images_json) if job.result_images_json else [],
            "error": job.error_message,
        })
    finally:
        db.close()

@app.get("/api/sessions/<session_id>")
def get_session(session_id: str):
    db = SessionLocal()
    try:
        sess: Optional[Session] = db.query(Session).get(session_id)
        if not sess:
            return jsonify({"error": {"code": "not_found", "message": "Session not found"}}), 404

        images = db.query(ImageAsset).filter(ImageAsset.session_id == sess.id).order_by(ImageAsset.created_at.asc()).all()
        jobs = db.query(GenerationJob).filter(GenerationJob.session_id == sess.id).order_by(GenerationJob.created_at.desc()).all()

        return jsonify({
            "session": {
                "id": sess.id,
                "status": sess.status,
                "created_at": sess.created_at.isoformat() + "Z",
                "original_image_url": sess.original_image_url,
                "file_uri": sess.original_file_uri,
            },
            "rating_result": json.loads(sess.rating_json) if sess.rating_json else None,
            "images": [{"id": im.id, "kind": im.kind, "url": im.url, "meta": json.loads(im.meta_json) if im.meta_json else None} for im in images],
            "jobs": [{
                "id": j.id,
                "status": j.status,
                "generated_images": json.loads(j.result_images_json) if j.result_images_json else [],
                "error": j.error_message
            } for j in jobs]
        })
    finally:
        db.close()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)

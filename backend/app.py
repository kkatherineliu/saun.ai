import base64
import json
import os
from typing import Any

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_API_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
)
MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024

PROMPT_TEMPLATE = """Analyze this photo and return JSON only with this exact shape:
{
  "summary": "short description",
  "labels": ["label1", "label2"],
  "confidence": 0.0,
  "safety_notes": ["optional note"]
}

Rules:
- confidence must be a number from 0 to 1.
- labels should be short and relevant.
- safety_notes can be an empty array.
- Return valid JSON only. No markdown.
"""


def _validate_structured_response(data: dict[str, Any]) -> tuple[bool, str]:
    required_keys = {"summary", "labels", "confidence", "safety_notes"}
    if set(data.keys()) != required_keys:
        return False, "Response keys do not match required schema."

    if not isinstance(data["summary"], str):
        return False, "summary must be a string."
    if not isinstance(data["labels"], list) or not all(
        isinstance(label, str) for label in data["labels"]
    ):
        return False, "labels must be an array of strings."
    if not isinstance(data["confidence"], (int, float)):
        return False, "confidence must be a number."
    if not 0 <= float(data["confidence"]) <= 1:
        return False, "confidence must be between 0 and 1."
    if not isinstance(data["safety_notes"], list) or not all(
        isinstance(note, str) for note in data["safety_notes"]
    ):
        return False, "safety_notes must be an array of strings."

    return True, ""


def _extract_gemini_text(payload: dict[str, Any]) -> str:
    candidates = payload.get("candidates", [])
    if not candidates:
        raise ValueError("Gemini returned no candidates.")

    parts = candidates[0].get("content", {}).get("parts", [])
    text_parts = [part.get("text", "") for part in parts if "text" in part]
    raw_text = "".join(text_parts).strip()

    if not raw_text:
        raise ValueError("Gemini returned an empty response.")
    return raw_text


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)

    @app.get("/health")
    def health() -> Any:
        return jsonify({"ok": True})

    @app.post("/api/analyze-photo")
    def analyze_photo() -> Any:
        if not GEMINI_API_KEY:
            return jsonify({"error": "Missing GEMINI_API_KEY environment variable."}), 500

        if "image" not in request.files:
            return jsonify({"error": "Missing image file. Use multipart field name 'image'."}), 400

        image_file = request.files["image"]
        image_bytes = image_file.read()
        if not image_bytes:
            return jsonify({"error": "Uploaded image is empty."}), 400
        if len(image_bytes) > MAX_IMAGE_SIZE_BYTES:
            return jsonify({"error": "Image too large. Max size is 10MB."}), 413

        mime_type = image_file.mimetype or "image/jpeg"
        custom_prompt = request.form.get("prompt", "").strip()
        prompt = custom_prompt if custom_prompt else PROMPT_TEMPLATE

        request_body = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt},
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": base64.b64encode(image_bytes).decode("utf-8"),
                            }
                        },
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
            },
        }

        try:
            gemini_response = requests.post(
                f"{GEMINI_API_URL}?key={GEMINI_API_KEY}",
                json=request_body,
                timeout=45,
            )
            gemini_response.raise_for_status()
            gemini_payload = gemini_response.json()

            raw_text = _extract_gemini_text(gemini_payload)
            parsed = json.loads(raw_text)
            

            return jsonify({"data": parsed})
        except requests.HTTPError as exc:
            details = exc.response.text if exc.response is not None else str(exc)
            return jsonify({"error": "Gemini request failed.", "details": details}), 502
        except json.JSONDecodeError:
            return (
                jsonify(
                    {
                        "error": "Model did not return valid JSON.",
                        "details": "Try a stricter prompt or lower temperature.",
                    }
                ),
                502,
            )
        except Exception as exc:
            return jsonify({"error": "Unexpected server error.", "details": str(exc)}), 500

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type RatingResult = {
  overall_score: number;
  breakdown: Record<string, number>;
  summary: string;
  suggestions: Array<{
    id: string;
    title: string;
    why: string;
    steps: string[];
    impact: "low" | "medium" | "high";
    effort: "low" | "medium" | "high";
    tags: string[];
  }>;
  risks_or_tradeoffs?: string[];
};

type JobStatus = {
  job_id: string;
  status: "queued" | "running" | "done" | "error";
  generated_images: string[];
  error: string | null;
};

const DEFAULT_CRITERIA = ["organization", "lighting", "spacing", "color_harmony", "cleanliness"];

export default function Home() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5001";

  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);

  const [rating, setRating] = useState<RatingResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [userExtra, setUserExtra] = useState<string>("");
  const [numVariations, setNumVariations] = useState<number>(2);

  const [job, setJob] = useState<JobStatus | null>(null);
  const [generated, setGenerated] = useState<string[]>([]);

  const pollTimer = useRef<NodeJS.Timeout | null>(null);

  const originalAbsolute = useMemo(() => {
    if (!originalUrl) return null;
    return originalUrl.startsWith("http") ? originalUrl : `${apiBase}${originalUrl}`;
  }, [originalUrl, apiBase]);

  const generatedAbsolute = useMemo(() => {
    return generated.map((u) => (u.startsWith("http") ? u : `${apiBase}${u}`));
  }, [generated, apiBase]);

  const [origin, setOrigin] = useState<string>("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  function resetAll() {
    setBusy(null);
    setSessionId(null);
    setOriginalUrl(null);
    setRating(null);
    setSelectedIds(new Set());
    setUserExtra("");
    setNumVariations(2);
    setJob(null);
    setGenerated([]);
  }

  async function upload() {
    if (!file) return alert("Pick an image first.");
    setBusy("Uploading...");

    try {
      const form = new FormData();
      form.append("image", file);

      const res = await fetch(`${apiBase}/api/sessions`, {
        method: "POST",
        body: form,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Upload failed");

      setSessionId(data.session_id);
      setOriginalUrl(data.original_image_url);
      setRating(null);
      setSelectedIds(new Set());
      setJob(null);
      setGenerated([]);
    } catch (e: any) {
      alert(e.message || String(e));
    } finally {
      setBusy(null);
    }
  }

  async function rate() {
    if (!sessionId) return alert("Upload first.");
    setBusy("Rating with Gemini...");

    try {
      const res = await fetch(`${apiBase}/api/sessions/${sessionId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criteria: DEFAULT_CRITERIA }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Rate failed");

      setRating(data);
      // default-select top 2 suggestions
      const top = (data?.suggestions || []).slice(0, 2).map((s: any) => s.id);
      setSelectedIds(new Set(top));
    } catch (e: any) {
      alert(e.message || String(e));
    } finally {
      setBusy(null);
    }
  }

  function startPolling(jobId: string) {
    if (pollTimer.current) clearInterval(pollTimer.current);

    pollTimer.current = setInterval(async () => {
      try {
        const res = await fetch(`${apiBase}/api/jobs/${jobId}`);
        const data = (await res.json()) as JobStatus;
        if (!res.ok) throw new Error((data as any)?.error?.message || "Job poll failed");

        setJob(data);

        if (data.status === "done") {
          setGenerated(data.generated_images || []);
          if (pollTimer.current) clearInterval(pollTimer.current);
          pollTimer.current = null;
        } else if (data.status === "error") {
          if (pollTimer.current) clearInterval(pollTimer.current);
          pollTimer.current = null;
        }
      } catch (e) {
        // ignore occasional poll errors
      }
    }, 1200);
  }

  async function generate() {
    if (!sessionId) return alert("Upload + rate first.");
    if (!rating) return alert("Rate first.");
    if (selectedIds.size === 0) return alert("Select at least one suggestion.");

    setBusy("Starting generation...");
    try {
      const res = await fetch(`${apiBase}/api/sessions/${sessionId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selected_suggestion_ids: Array.from(selectedIds),
          user_prompt_extra: userExtra,
          num_variations: numVariations,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Generate failed");

      setJob({ job_id: data.job_id, status: data.status, generated_images: [], error: null });
      setGenerated([]);
      startPolling(data.job_id);
    } catch (e: any) {
      alert(e.message || String(e));
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Room Rater (Next.js Test UI)</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Backend: <code>{apiBase}</code>
      </p>

      <section style={cardStyle}>
        <h2 style={h2Style}>1) Upload a room photo</h2>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0] || null;
              setFile(f);
            }}
          />
          <button disabled={!file || !!busy} onClick={upload} style={buttonStyle}>
            Upload
          </button>
          <button disabled={!!busy} onClick={resetAll} style={buttonSecondaryStyle}>
            Reset
          </button>
          {busy && <span style={{ opacity: 0.8 }}>{busy}</span>}
        </div>

        {sessionId && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 14, opacity: 0.85 }}>
              <b>Session:</b> <code>{sessionId}</code>
            </div>
          </div>
        )}

        {originalAbsolute && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 14, marginBottom: 6, opacity: 0.85 }}>Original image</div>
            <img
              src={originalAbsolute}
              alt="Original"
              style={{ width: "100%", maxHeight: 420, objectFit: "contain", borderRadius: 12, border: "1px solid #eee" }}
            />
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={h2Style}>2) Rate with Gemini</h2>
        <button disabled={!sessionId || !!busy} onClick={rate} style={buttonStyle}>
          Rate (0–10)
        </button>

        {rating && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
              <div style={{ fontSize: 20 }}>
                Overall: <b>{rating.overall_score}</b>/10
              </div>
              <div style={{ opacity: 0.8 }}>{rating.summary}</div>
            </div>

            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              {Object.entries(rating.breakdown || {}).map(([k, v]) => (
                <div key={k} style={miniCardStyle}>
                  <div style={{ fontSize: 12, opacity: 0.8, textTransform: "capitalize" }}>{k.replaceAll("_", " ")}</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{v}</div>
                </div>
              ))}
            </div>

            <h3 style={{ marginTop: 16, marginBottom: 8 }}>Suggestions (select what to apply)</h3>
            <div style={{ display: "grid", gap: 10 }}>
              {(rating.suggestions || []).map((s) => {
                const checked = selectedIds.has(s.id);
                return (
                  <label key={s.id} style={{ ...miniCardStyle, cursor: "pointer" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(s.id)) next.delete(s.id);
                            else next.add(s.id);
                            return next;
                          });
                        }}
                        style={{ marginTop: 4 }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                          <div style={{ fontWeight: 700 }}>
                            {s.title} <span style={{ opacity: 0.6, fontWeight: 500 }}>({s.id})</span>
                          </div>
                          <div style={{ fontSize: 12, opacity: 0.75 }}>
                            impact: <b>{s.impact}</b> • effort: <b>{s.effort}</b>
                          </div>
                        </div>
                        <div style={{ marginTop: 6, opacity: 0.85 }}>{s.why}</div>
                        {s.steps?.length ? (
                          <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 18, opacity: 0.9 }}>
                            {s.steps.slice(0, 4).map((st, idx) => (
                              <li key={idx}>{st}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={h2Style}>3) Generate redesigned images (Nano Banana)</h2>

        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 14, opacity: 0.85 }}>Extra style prompt (optional)</label>
            <input
              value={userExtra}
              onChange={(e) => setUserExtra(e.target.value)}
              placeholder='e.g. "Scandinavian minimal, warm natural light"'
              style={inputStyle}
            />
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontSize: 14, opacity: 0.85 }}>Variations:</label>
            <input
              type="number"
              min={1}
              max={4}
              value={numVariations}
              onChange={(e) => setNumVariations(Number(e.target.value))}
              style={{ ...inputStyle, width: 90 }}
            />
            <button disabled={!rating || selectedIds.size === 0 || !!busy} onClick={generate} style={buttonStyle}>
              Generate
            </button>
          </div>

          {job && (
            <div style={{ fontSize: 14, opacity: 0.9 }}>
              <b>Job:</b> <code>{job.job_id}</code> • <b>Status:</b> {job.status}
              {job.error ? (
                <div style={{ marginTop: 6, color: "crimson" }}>
                  <b>Error:</b> {job.error}
                </div>
              ) : null}
            </div>
          )}

          {generatedAbsolute.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <h3 style={{ marginTop: 0 }}>Generated images</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                {generatedAbsolute.map((u, idx) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                    <div style={miniCardStyle}>
                      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Variant {idx + 1}</div>
                      <img src={u} alt={`Generated ${idx + 1}`} style={{ width: "100%", height: 220, objectFit: "cover", borderRadius: 12, border: "1px solid #eee" }} />
                      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                        Click to open full size
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <footer style={{ marginTop: 24, opacity: 0.7, fontSize: 13 }}>
        Tip: if images don’t show, make sure your Flask backend CORS allows <code>{origin}</code> and that Flask is running on <code>localhost:5001</code>.
      </footer>
    </main>
  );
}

const cardStyle: React.CSSProperties = {
  border: "1px solid #eaeaea",
  borderRadius: 16,
  padding: 16,
  marginTop: 14,
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
};

const miniCardStyle: React.CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 14,
  padding: 12,
  background: "white",
};

const h2Style: React.CSSProperties = { marginTop: 0, marginBottom: 10, fontSize: 18 };

const buttonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #111",
  background: "#111",
  color: "white",
  cursor: "pointer",
};

const buttonSecondaryStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #ddd",
  background: "white",
  color: "#111",
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #ddd",
  width: "100%",
};

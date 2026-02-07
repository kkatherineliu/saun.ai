"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChatSidebar, type Message, type Suggestion } from "@/components/ChatSidebar";
import { cn } from "@/lib/utils";

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:5001";
const DESIGN_SESSION_KEY = "saun-design-session";

type RatingResult = {
  overall_score: number;
  summary: string;
  breakdown?: Record<string, number>;
  suggestions?: Suggestion[];
};

type JobStatus = {
  job_id: string;
  status: string;
  generated_images?: string[];
  error?: string | null;
};

export default function DesignPage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [rating, setRating] = useState<RatingResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [userExtra, setUserExtra] = useState("");
  const [numVariations, setNumVariations] = useState(2);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [generated, setGenerated] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    { 
      id: "1", 
      role: "assistant", 
      content: "Hello! I'm your design assistant. Upload a room photo to get started, and I'll help you redesign it." 
    }
  ]);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore session passed from landing page (after Analyze)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(DESIGN_SESSION_KEY);
      if (raw) {
        const { session_id, original_image_url } = JSON.parse(raw) as {
          session_id?: string;
          original_image_url?: string | null;
        };
        if (session_id) {
          setSessionId(session_id);
          if (original_image_url) setOriginalUrl(original_image_url);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const originalAbsolute = useMemo(() => {
    if (!originalUrl) return null;
    return originalUrl.startsWith("http") ? originalUrl : `${apiBase}${originalUrl}`;
  }, [originalUrl]);

  const generatedAbsolute = useMemo(
    () => generated.map((u) => (u.startsWith("http") ? u : `${apiBase}${u}`)),
    [generated]
  );

  const resetAll = useCallback(() => {
    if (typeof window !== "undefined") sessionStorage.removeItem(DESIGN_SESSION_KEY);
    setBusy(null);
    setSessionId(null);
    setOriginalUrl(null);
    setRating(null);
    setSelectedIds(new Set());
    setUserExtra("");
    setNumVariations(2);
    setJob(null);
    setGenerated([]);
    setFile(null);
  }, []);

  const upload = useCallback(async () => {
    if (!file) return alert("Pick an image first.");
    setBusy("Uploading...");
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch(`${apiBase}/api/sessions`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error((data?.error?.message as string) ?? "Upload failed");
      setSessionId(data.session_id);
      setOriginalUrl(data.original_image_url);
      setRating(null);
      setSelectedIds(new Set());
      setJob(null);
      setGenerated([]);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, [file]);

  const rate = useCallback(async () => {
    if (!sessionId) return alert("Upload first.");
    setBusy("Rating...");
    try {
      const res = await fetch(`${apiBase}/api/sessions/${sessionId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criteria: [] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data?.error?.message as string) ?? "Rate failed");
      setRating(data as RatingResult);
      const top = (data?.suggestions ?? []).slice(0, 2).map((s: Suggestion) => s.id);
      setSelectedIds(new Set(top));

      // Add assistant message with suggestions
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `I've analyzed your room! It has a score of ${data.overall_score}/10. ${data.summary}\n\nHere are my suggestions for improvement:`,
          suggestions: data.suggestions
        }
      ]);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, [sessionId]);

  const startPolling = useCallback(
    (jobId: string) => {
      if (pollTimer.current) clearInterval(pollTimer.current);
      pollTimer.current = setInterval(async () => {
        try {
          const res = await fetch(`${apiBase}/api/jobs/${jobId}`);
          const data = (await res.json()) as JobStatus;
          if (!res.ok) return;
          setJob(data);
          if (data.status === "done") {
            setGenerated(data.generated_images ?? []);
            if (pollTimer.current) clearInterval(pollTimer.current);
            pollTimer.current = null;
          } else if (data.status === "error") {
            if (pollTimer.current) clearInterval(pollTimer.current);
            pollTimer.current = null;
          }
        } catch {
          // ignore
        }
      }, 1200);
    },
    []
  );

  const generate = useCallback(async () => {
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
      if (!res.ok) throw new Error((data?.error?.message as string) ?? "Generate failed");
      setJob({
        job_id: data.job_id,
        status: data.status ?? "pending",
        generated_images: [],
        error: null,
      });
      setGenerated([]);
      startPolling(data.job_id);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, [sessionId, rating, selectedIds, userExtra, numVariations, startPolling]);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  const cardClass =
    "rounded-2xl border border-neutral-200 bg-white/80 p-6 shadow-sm text-left";
  const h2Class = "font-serif text-xl font-medium text-neutral-900 mb-3";
  const btnClass =
    "rounded-full border border-neutral-900 bg-neutral-900 px-6 py-3 text-sm font-medium text-white hover:bg-black transition-colors disabled:opacity-50 disabled:pointer-events-none";
  const btnSecondaryClass =
    "rounded-full border border-neutral-900 px-6 py-3 text-sm font-medium text-neutral-900 hover:bg-neutral-900 hover:text-white transition-colors disabled:opacity-50";

  return (
    <div className="flex min-h-screen bg-background">
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-2xl space-y-8 p-8 md:p-12">
          <div>
            <Link
              href="/"
              className="text-sm uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
            >
              ← Back
            </Link>
          </div>
          <h1 className="font-serif text-4xl tracking-tight text-foreground">Design</h1>
          {/* 1) Upload — skipped when session passed from landing */}
          <section className={cardClass}>
            <h2 className={h2Class}>1) Room photo</h2>
            {sessionId && originalAbsolute ? (
              <>
                <p className="text-sm text-neutral-600">
                  Using the image you uploaded on the landing page. Continue to Rate and Generate below.
                </p>
                <p className="mt-2 text-xs text-neutral-500">
                  <strong>Session:</strong> <code className="rounded bg-neutral-100 px-1">{sessionId}</code>
                </p>
                <div className="mt-4">
                  <p className="mb-2 text-sm text-neutral-600">Original image</p>
                  <img
                    src={originalAbsolute}
                    alt="Original room"
                    className="w-full max-h-[420px] rounded-xl border border-neutral-200 object-contain"
                  />
                </div>
                <button
                  type="button"
                  onClick={resetAll}
                  className={cn(btnSecondaryClass, "mt-4")}
                >
                  Start over (upload a different image)
                </button>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="text-sm text-neutral-700 file:mr-3 file:rounded-full file:border-0 file:bg-neutral-900 file:px-4 file:py-2 file:text-sm file:text-white file:hover:bg-black"
                  />
                  <button
                    type="button"
                    disabled={!file || !!busy}
                    onClick={upload}
                    className={btnClass}
                  >
                    Upload
                  </button>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={resetAll}
                    className={btnSecondaryClass}
                  >
                    Reset
                  </button>
                  {busy && (
                    <span className="text-sm text-neutral-500">{busy}</span>
                  )}
                </div>
                {sessionId && (
                  <p className="mt-3 text-sm text-neutral-600">
                    <strong>Session:</strong> <code className="rounded bg-neutral-100 px-1">{sessionId}</code>
                  </p>
                )}
                {originalAbsolute && (
                  <div className="mt-4">
                    <p className="mb-2 text-sm text-neutral-600">Original image</p>
                    <img
                      src={originalAbsolute}
                      alt="Original room"
                      className="w-full max-h-[420px] rounded-xl border border-neutral-200 object-contain"
                    />
                  </div>
                )}
              </>
            )}
          </section>

          {/* 2) Rate */}
          <section className={cardClass}>
            <h2 className={h2Class}>2) Rate room</h2>
            <button
              type="button"
              disabled={!sessionId || !!busy}
              onClick={rate}
              className={btnClass}
            >
              Rate (0–10)
            </button>

            {rating && (
              <div className="mt-6 space-y-4">
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="font-serif text-2xl text-neutral-900">
                    Overall: <strong>{rating.overall_score}</strong>/10
                  </span>
                  <p className="text-neutral-600">{rating.summary}</p>
                </div>

                {rating.breakdown && Object.keys(rating.breakdown).length > 0 && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {Object.entries(rating.breakdown).map(([k, v]) => (
                      <div
                        key={k}
                        className="rounded-xl border border-neutral-200 bg-white p-3"
                      >
                        <p className="text-xs uppercase tracking-wider text-neutral-500">
                          {k.replaceAll("_", " ")}
                        </p>
                        <p className="font-serif text-lg font-semibold text-neutral-900">
                          {v}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <h3 className="mb-3 font-serif text-lg font-medium text-neutral-900">
                    Suggestions (select what to apply)
                  </h3>
                  <div className="space-y-3">
                    {(rating.suggestions ?? []).map((s) => {
                      const checked = selectedIds.has(s.id);
                      return (
                        <label
                          key={s.id}
                          className={cn(
                            "flex cursor-pointer gap-3 rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-300",
                            checked && "border-neutral-900 ring-1 ring-neutral-900"
                          )}
                        >
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
                            className="mt-1 h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-medium text-neutral-900">
                                {s.title}{" "}
                                <span className="font-normal text-neutral-500">
                                  ({s.id})
                                </span>
                              </span>
                              <span className="text-xs text-neutral-500">
                                impact: <strong>{s.impact}</strong> • effort:{" "}
                                <strong>{s.effort}</strong>
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-neutral-600">{s.why}</p>
                            {s.steps && s.steps.length > 0 && (
                              <ul className="mt-2 list-inside list-disc space-y-0.5 pl-2 text-sm text-neutral-600">
                                {s.steps.slice(0, 4).map((st, idx) => (
                                  <li key={idx}>{st}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* 3) Generate */}
          <section className={cardClass}>
            <h2 className={h2Class}>3) Generate redesigned images</h2>
            <div className="flex flex-wrap items-center gap-4">
              <label className="text-sm text-neutral-600">Variations:</label>
              <input
                type="number"
                min={1}
                max={4}
                value={numVariations}
                onChange={(e) =>
                  setNumVariations(Math.min(4, Math.max(1, Number(e.target.value) || 1)))
                }
                className="w-20 rounded-lg border border-neutral-200 bg-background px-3 py-2 text-sm text-foreground"
              />
              <button
                type="button"
                disabled={
                  !rating ||
                  selectedIds.size === 0 ||
                  !!busy
                }
                onClick={generate}
                className={btnClass}
              >
                Generate
              </button>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              Use the sidebar on the right to add an optional style prompt.
            </p>

            {job && (
              <div className="mt-4 text-sm text-neutral-600">
                <strong>Job:</strong> <code className="rounded bg-neutral-100 px-1">{job.job_id}</code> •{" "}
                <strong>Status:</strong> {job.status}
                {job.error && (
                  <p className="mt-2 text-red-600">
                    <strong>Error:</strong> {job.error}
                  </p>
                )}
              </div>
            )}

            {generatedAbsolute.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-3 font-serif text-lg font-medium text-neutral-900">
                  Generated images
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {generatedAbsolute.map((u, idx) => (
                    <a
                      key={u}
                      href={u}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-xl border border-neutral-200 bg-white p-3 transition-shadow hover:shadow-md"
                    >
                      <p className="mb-2 text-xs uppercase tracking-wider text-neutral-500">
                        Variant {idx + 1}
                      </p>
                      <img
                        src={u}
                        alt={`Generated ${idx + 1}`}
                        className="h-52 w-full rounded-lg border border-neutral-100 object-cover"
                      />
                      <p className="mt-2 text-xs text-neutral-500">
                        Click to open full size
                      </p>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      <ChatSidebar
        value={userExtra}
        onChange={setUserExtra}
        messages={messages}
        selectedSuggestionIds={selectedIds}
        onToggleSuggestion={(id) => {
          setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          });
        }}
        onSubmit={(text) => {
          setMessages((prev) => [
            ...prev,
            { id: Date.now().toString(), role: "user", content: text }
          ]);
          setUserExtra("");
        }}
      />
    </div>
  );
}

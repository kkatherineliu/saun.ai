"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChatSidebar } from "@/components/ChatSidebar";
import { cn } from "@/lib/utils";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5001";
const DESIGN_SESSION_KEY = "saun-design-session";
const FIXED_CATEGORIES = [
  "organization",
  "lighting",
  "spacing",
  "color_harmony",
  "cleanliness",
  "feng shui",
] as const;

type Suggestion = {
  id: string;
  category?: string;
  title: string;
  why: string;
  impact: string;
  effort: string;
  steps?: string[];
};

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

type StoredSession = {
  session_id?: string;
  original_image_url?: string | null;
  rating_result?: RatingResult | null;
};

type SessionApiResponse = {
  rating_result?: RatingResult | null;
};

function toTitleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function DesignPage() {
  const [busy, setBusy] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [rating, setRating] = useState<RatingResult | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [userExtra, setUserExtra] = useState("");
  const [additionalChanges, setAdditionalChanges] = useState("");
  const [job, setJob] = useState<JobStatus | null>(null);
  const [generated, setGenerated] = useState<string[]>([]);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyRating = useCallback((result: RatingResult | null) => {
    setRating(result);
    if (!result) {
      setSelectedCategories(new Set());
      return;
    }

    const categoriesFromSuggestions = new Set(
      (result.suggestions ?? [])
        .map((s) => s.category)
        .filter((c): c is string => typeof c === "string")
    );

    if (categoriesFromSuggestions.size > 0) {
      setSelectedCategories(categoriesFromSuggestions);
    } else {
      setSelectedCategories(new Set(FIXED_CATEGORIES));
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(DESIGN_SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredSession;
        if (parsed.session_id) {
          setSessionId(parsed.session_id);
        }
        if (parsed.original_image_url) {
          setOriginalUrl(parsed.original_image_url);
        }
        if (parsed.rating_result) {
          applyRating(parsed.rating_result);
        }
      }
    } catch {
      // ignore session restore errors
    } finally {
      setSessionLoaded(true);
    }
  }, [applyRating]);

  useEffect(() => {
    if (!sessionLoaded || !sessionId || rating) return;
    let cancelled = false;

    const hydrate = async () => {
      setBusy("Loading session...");
      try {
        const res = await fetch(`${apiBase}/api/sessions/${sessionId}`);
        const data = (await res.json()) as SessionApiResponse;
        if (!res.ok || cancelled) return;
        applyRating(data.rating_result ?? null);
      } catch {
        // ignore load failures
      } finally {
        if (!cancelled) setBusy(null);
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [applyRating, rating, sessionId, sessionLoaded]);

  const originalAbsolute = useMemo(() => {
    if (!originalUrl) return null;
    return originalUrl.startsWith("http") ? originalUrl : `${apiBase}${originalUrl}`;
  }, [originalUrl]);

  const generatedAbsolute = useMemo(
    () => generated.map((u) => (u.startsWith("http") ? u : `${apiBase}${u}`)),
    [generated]
  );

  const latestGeneratedAbsolute = generatedAbsolute[0] ?? null;

  const resetAll = useCallback(() => {
    if (typeof window !== "undefined") sessionStorage.removeItem(DESIGN_SESSION_KEY);
    setBusy(null);
    setSessionId(null);
    setOriginalUrl(null);
    setRating(null);
    setSelectedCategories(new Set());
    setUserExtra("");
    setAdditionalChanges("");
    setJob(null);
    setGenerated([]);
  }, []);

  const startPolling = useCallback((jobId: string) => {
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
        // ignore polling errors
      }
    }, 1200);
  }, []);

  const generate = useCallback(async () => {
    if (!sessionId) return alert("Upload first.");
    if (!rating) return alert("Rating has not loaded yet.");

    const hasInputs =
      selectedCategories.size > 0 ||
      additionalChanges.trim().length > 0 ||
      userExtra.trim().length > 0;

    if (!hasInputs) {
      return alert("Select at least one category or add additional changes.");
    }

    const additionalChangeItems = additionalChanges
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    setBusy("Starting generation...");
    try {
      const res = await fetch(`${apiBase}/api/sessions/${sessionId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selected_categories: Array.from(selectedCategories),
          additional_changes: additionalChangeItems,
          user_prompt_extra: userExtra,
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
      startPolling(data.job_id as string);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, [additionalChanges, rating, selectedCategories, sessionId, startPolling, userExtra]);

  const toggleCategory = useCallback((category: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  const cardClass = "rounded-2xl border border-neutral-200 bg-white/80 p-6 shadow-sm text-left";
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
            <Link href="/" className="text-sm uppercase tracking-wider text-neutral-500 hover:text-neutral-900">
              Back
            </Link>
          </div>
          <h1 className="font-serif text-4xl tracking-tight text-foreground">Design</h1>

          {!sessionLoaded ? (
            <p className="text-neutral-500">Loading...</p>
          ) : !sessionId || !originalAbsolute ? (
            <section className={cardClass}>
              <h2 className={h2Class}>No image yet</h2>
              <p className="text-neutral-600">
                Upload a room photo on the home page and click <strong>Analyze Photo</strong>.
              </p>
              <Link href="/" className={cn(btnClass, "mt-4 inline-block")}>
                Go to home page
              </Link>
            </section>
          ) : (
            <>
              <section className={cardClass}>
                <h2 className={h2Class}>1) Original room photo</h2>
                <p className="text-sm text-neutral-600">
                  This image stays fixed so you can compare each newly generated redesign.
                </p>
                <p className="mt-2 text-xs text-neutral-500">
                  <strong>Session:</strong> <code className="rounded bg-neutral-100 px-1">{sessionId}</code>
                </p>
                <div className="mt-4">
                  <img
                    src={originalAbsolute}
                    alt="Original room"
                    className="w-full max-h-[420px] rounded-xl border border-neutral-200 object-contain"
                  />
                </div>
                <button type="button" onClick={resetAll} className={cn(btnSecondaryClass, "mt-4")}>
                  Start over
                </button>
              </section>

              <section className={cardClass}>
                <h2 className={h2Class}>2) Initial rating and suggestions</h2>
                {!rating ? (
                  <p className="text-neutral-600">Initial suggestions are loading...</p>
                ) : (
                  <div className="mt-2 space-y-4">
                    <div className="flex flex-wrap items-baseline gap-3">
                      <span className="font-serif text-2xl text-neutral-900">
                        Overall: <strong>{rating.overall_score}</strong>/10
                      </span>
                      <p className="text-neutral-600">{rating.summary}</p>
                    </div>

                    {rating.breakdown && Object.keys(rating.breakdown).length > 0 && (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {Object.entries(rating.breakdown).map(([k, v]) => (
                          <div key={k} className="rounded-xl border border-neutral-200 bg-white p-3">
                            <p className="text-xs uppercase tracking-wider text-neutral-500">{toTitleCase(k)}</p>
                            <p className="font-serif text-lg font-semibold text-neutral-900">{v}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div>
                      <h3 className="mb-3 font-serif text-lg font-medium text-neutral-900">Category suggestions</h3>
                      <div className="space-y-3">
                        {(rating.suggestions ?? []).map((s) => (
                          <div
                            key={s.id}
                            className="rounded-xl border border-neutral-200 bg-white p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-medium text-neutral-900">
                                {s.title} <span className="font-normal text-neutral-500">({s.id})</span>
                              </span>
                              <span className="text-xs text-neutral-500">
                                {toTitleCase(s.category ?? "uncategorized")} • impact: <strong>{s.impact}</strong> • effort: <strong>{s.effort}</strong>
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-neutral-600">{s.why}</p>
                            {s.steps && s.steps.length > 0 && (
                              <ul className="mt-2 list-inside list-disc space-y-0.5 pl-2 text-sm text-neutral-600">
                                {s.steps.slice(0, 4).map((st, idx) => (
                                  <li key={`${s.id}-${idx}`}>{st}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </section>

              <section className={cardClass}>
                <h2 className={h2Class}>3) Generate redesigned image</h2>
                <button
                  type="button"
                  disabled={!rating || !!busy}
                  onClick={generate}
                  className={btnClass}
                >
                  {busy ? busy : "Generate"}
                </button>
                <p className="mt-2 text-xs text-neutral-500">
                  One image is generated per iteration. New runs update the after image using the latest generated result.
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

                {latestGeneratedAbsolute && (
                  <div className="mt-6">
                    <h3 className="mb-3 font-serif text-lg font-medium text-neutral-900">Latest redesigned image</h3>
                    <a
                      href={latestGeneratedAbsolute}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-xl border border-neutral-200 bg-white p-3 transition-shadow hover:shadow-md"
                    >
                      <img
                        src={latestGeneratedAbsolute}
                        alt="Latest redesigned room"
                        className="max-h-[420px] w-full rounded-lg border border-neutral-100 object-contain"
                      />
                      <p className="mt-2 text-xs text-neutral-500">Click to open full size</p>
                    </a>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>

      <ChatSidebar
        categories={FIXED_CATEGORIES}
        selectedCategories={selectedCategories}
        onToggleCategory={toggleCategory}
        extraChanges={additionalChanges}
        onExtraChangesChange={setAdditionalChanges}
        value={userExtra}
        onChange={setUserExtra}
        placeholder='e.g. "Scandinavian minimal, warm natural light"'
        label="Extra style prompt (optional)"
      />
    </div>
  );
}

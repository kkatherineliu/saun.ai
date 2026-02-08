"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChatSidebar, type Message, type Suggestion } from "@/components/ChatSidebar";
import { cn } from "@/lib/utils";
import { ArrowRight, MoveRight, Sparkles, Star } from "lucide-react";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5001";
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
const Assets = () => {
  return (
    <section className="mt-32 w-full max-w-5xl pt-24 border-t border-neutral-300/50 relative z-10">
      <div className="flex flex-col md:flex-row justify-between items-start gap-12">
        <div className="space-y-4">
          <h3 className="font-serif text-3xl">Design Elements</h3>
          <p className="text-neutral-500 text-sm max-w-xs">
            Reusable components and typography styles matching the curated aesthetic.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 w-full max-w-2xl">
          {/* Buttons */}
          <div className="space-y-6">
            <p className="text-xs uppercase tracking-widest text-neutral-400 font-medium">Buttons</p>

            <div className="flex flex-col gap-4 items-start">
              {/* Primary Button */}
              <button className="group relative flex items-center justify-between gap-4 px-8 py-4 bg-[#121212] text-[#F3F1E7] rounded-none hover:bg-neutral-800 transition-all duration-300 w-full md:w-auto min-w-[200px]">
                <span className="font-serif text-lg tracking-wide">Get Started</span>
                <MoveRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </button>

              {/* Secondary Button */}
              <button className="group flex items-center gap-3 px-6 py-3 border border-[#121212] text-[#121212] rounded-full hover:bg-[#121212] hover:text-[#F3F1E7] transition-all duration-300">
                <span className="text-sm font-medium tracking-wide">View Gallery</span>
              </button>

              {/* Text Link */}
              <button className="group flex items-center gap-2 text-[#121212] hover:opacity-70 transition-opacity">
                <span className="border-b border-black pb-0.5 text-sm uppercase tracking-widest">Learn More</span>
                <ArrowRight className="w-4 h-4 -rotate-45 group-hover:rotate-0 transition-transform duration-300" />
              </button>
            </div>
          </div>

          {/* Typography & Cards */}
          <div className="space-y-6">
            <p className="text-xs uppercase tracking-widest text-neutral-400 font-medium">Typography & Surface</p>

            <div className="p-8 bg-white border border-neutral-100 shadow-sm hover:shadow-md transition-shadow duration-300">
              <div className="flex items-center gap-2 mb-4 text-neutral-400">
                <Sparkles className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Feature Card</span>
              </div>
              <h4 className="font-serif text-2xl mb-2">Modern Minimalist</h4>
              <p className="text-neutral-500 text-sm leading-relaxed">
                Clean lines, neutral palette, and functional furniture design.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default function DesignPage() {
  const [busy, setBusy] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [rating, setRating] = useState<RatingResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [userExtra, setUserExtra] = useState("");
  const [additionalChanges, setAdditionalChanges] = useState("");
  const [numVariations, setNumVariations] = useState(2);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [generated, setGenerated] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasAutoRatedRef = useRef(false);

  const applyRating = useCallback((result: RatingResult | null) => {
    setRating(result);
    if (!result) {
      setSelectedIds(new Set());
      return;
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

  useEffect(() => {
    if (!rating) return;

    if (selectedIds.size === 0 && rating.suggestions?.length) {
      setSelectedIds(new Set(rating.suggestions.slice(0, 2).map((s) => s.id)));
    }

    setMessages((prev) => {
      const hasSuggestions = prev.some((msg) => (msg.suggestions ?? []).length > 0);
      if (hasSuggestions) return prev;
      return [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `I've analyzed your room! It has a score of ${rating.overall_score}/10. ${rating.summary}\n\nHere are my suggestions for improvement:`,
          suggestions: rating.suggestions ?? [],
        },
      ];
    });
  }, [rating, selectedIds.size]);

  const originalAbsolute = useMemo(() => {
    if (!originalUrl) return null;
    return originalUrl.startsWith("http") ? originalUrl : `${apiBase}${originalUrl}`;
  }, [originalUrl]);

  const displayImageUrl = originalAbsolute ?? undefined;

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
    setAdditionalChanges("");
    setNumVariations(2);
    setJob(null);
    setGenerated([]);
    hasAutoRatedRef.current = false;
  }, []);

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
      applyRating(data as RatingResult);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, [applyRating, sessionId]);

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
      selectedIds.size > 0 || additionalChanges.trim().length > 0 || userExtra.trim().length > 0;

    if (!hasInputs) {
      return alert("Select at least one suggestion or add additional changes.");
    }

    const additionalChangeItems = additionalChanges
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const selectedCategories = Array.from(
      new Set(
        (rating.suggestions ?? [])
          .filter((s) => selectedIds.has(s.id))
          .map((s) => s.category)
          .filter((c): c is string => typeof c === "string")
      )
    );

    setBusy("Starting generation...");
    try {
      const res = await fetch(`${apiBase}/api/sessions/${sessionId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selected_suggestion_ids: Array.from(selectedIds),
          selected_categories: selectedCategories,
          additional_changes: additionalChangeItems,
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
      startPolling(data.job_id as string);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, [additionalChanges, numVariations, rating, selectedIds, sessionId, startPolling, userExtra]);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);


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
            <section className="">
              {/* Left Column: Image + Overall/Loading */}
              <div className="lg:col-span-5 space-y-6 sticky top-8">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-widest text-neutral-500 font-medium">
                    Original Photo
                  </p>
                  <button
                    type="button"
                    onClick={resetAll}
                    className="text-xs font-medium text-neutral-400 hover:text-neutral-900 transition-colors"
                  >
                    Start over
                  </button>
                </div>
                
                <div className="relative aspect-3/4 w-full overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100 shadow-sm">
                  <img
                    src={displayImageUrl}
                    alt="Original room"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 pointer-events-none bg-linear-to-t from-black/5 to-transparent" />
                </div>

                {/* Status / Overall Rating Area */}
                <div className="min-h-[120px]">
                  {busy ? (
                    <div className="flex flex-col gap-4 animate-in fade-in duration-300 py-2">
                      <div className="flex items-center gap-3 text-neutral-900">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent" />
                        <p className="text-sm font-medium tracking-wide">{busy}</p>
                      </div>
                      <p className="text-xs text-neutral-500 max-w-xs leading-relaxed">
                        Our AI is analyzing lighting, composition, and style to provide tailored recommendations.
                      </p>
                    </div>
                  ) : rating ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <div>
                        <p className="text-xs uppercase tracking-widest text-neutral-400 mb-2">Overall Score</p>
                        <div className="flex items-baseline gap-3">
                          <span className="font-serif text-6xl text-foreground tracking-tight">
                            {rating.overall_score}
                          </span>
                          <span className="text-2xl text-neutral-300 font-light">/10</span>
                        </div>
                      </div>
                      
                      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                        <div
                          className="h-full rounded-full bg-neutral-900 transition-all duration-1000 ease-out"
                          style={{ width: `${Math.min(Math.max(rating.overall_score * 10, 0), 100)}%` }}
                        />
                      </div>
                      
                      <p className="text-base leading-relaxed text-neutral-600 border-l-2 border-neutral-200 pl-4 py-1">
                        {rating.summary}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Right Column: Breakdown Grid */}
              <div className="lg:col-span-7">
                {rating?.breakdown && Object.keys(rating.breakdown).length > 0 ? (
                  <div className="bg-white rounded-[2rem] p-8 md:p-10 border border-neutral-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                     <h3 className="mb-10 font-serif text-2xl text-foreground">Analysis Breakdown</h3>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-12">
                      {Object.entries(rating.breakdown).map(([k, v]) => (
                        <div key={k} className="group flex flex-col gap-3">
                          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400 group-hover:text-neutral-900 transition-colors">
                            {k.replaceAll("_", " ")}
                          </p>
                          <div className="flex items-center gap-1.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={cn(
                                  "w-6 h-6 transition-all duration-300",
                                  i < Math.round(v / 2)
                                    ? "fill-neutral-900 text-neutral-900"
                                    : "fill-neutral-100 text-neutral-100 group-hover:fill-neutral-200 group-hover:text-neutral-200"
                                )}
                                strokeWidth={1.5}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : !busy && (
                  <div className="h-full flex items-center justify-center p-12 text-neutral-300 border-2 border-dashed border-neutral-100 rounded-3xl">
                    <p>Details will appear here...</p>
                  </div>
                )}
              </div>
            </section>
          ) : sessionLoaded ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
              <div className="p-4 rounded-full bg-neutral-100">
                <Sparkles className="w-8 h-8 text-neutral-400" />
              </div>
              <div className="space-y-2">
                <h2 className="font-serif text-2xl text-foreground">No Active Session</h2>
                <p className="text-neutral-500 max-w-xs mx-auto">
                  Start by uploading a photo of your room on the homepage.
                </p>
              </div>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-8 py-3 bg-neutral-900 text-white rounded-full font-medium hover:bg-black hover:scale-105 transition-all duration-300"
              >
                <span>Go to Homepage</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : null}
        </div>
      </main>

      <ChatSidebar
        value={userExtra}
        onChange={setUserExtra}
        placeholder='e.g. "Scandinavian minimal, warm natural light"'
        label="Extra style prompt (optional)"
      />
    </div>
  );
}

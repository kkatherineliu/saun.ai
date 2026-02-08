"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChatSidebar, type Message, type Suggestion } from "@/components/ChatSidebar";
import Agent, { type ElevenLabsAgent } from "@/components/Agent";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight, MoveRight, Sparkles, Star, RotateCcw } from "lucide-react";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5001";
const DESIGN_SESSION_KEY = "saun-design-session";

const VOICE_AGENTS: ElevenLabsAgent[] = [
  {
    id: "agent_2601kgxsvkcde51v5rsm0s81ywyk",
    name: "Master Lin",
    description: "Feng Shui Master",
  },
  {
    id: "agent_5801kgxsfvfkf899188qr66th132",
    name: "Ava",
    description: "Interior Design Assistant",
  },
];

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
  const [isCurating, setIsCurating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [userExtra, setUserExtra] = useState("");
  const [additionalChanges, setAdditionalChanges] = useState("");
  const [numVariations, setNumVariations] = useState(2);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [generated, setGenerated] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  
  // New State for View Mode and Reset Button
  const [viewMode, setViewMode] = useState<'original' | 'after'>('original');
  const [isResetExpanded, setIsResetExpanded] = useState(false);
  const router = useRouter();

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

    setMessages((prev) => {
      const hasSuggestions = prev.some((msg) => (msg.suggestions ?? []).length > 0);
      if (hasSuggestions) return prev;
      return [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `I've analyzed your room! ${rating.summary}\n\nHere are my suggestions for improvement:`,
          suggestions: rating.suggestions ?? [],
        },
      ];
    });
  }, [rating]);

  const originalAbsolute = useMemo(() => {
    if (!originalUrl) return null;
    return originalUrl.startsWith("http") ? originalUrl : `${apiBase}${originalUrl}`;
  }, [originalUrl]);

  const displayImageUrl = originalAbsolute ?? undefined;

  const generatedAbsolute = useMemo(
    () => generated.map((u) => (u.startsWith("http") ? u : `${apiBase}${u}`)),
    [generated]
  );
  const afterImageUrl = generatedAbsolute[0] ?? null;
  const showAfter =
    isCurating || job?.status === "pending" || job?.status === "running" || !!afterImageUrl;

  // Auto-switch view mode when after image is available/generating
  useEffect(() => {
    if (showAfter) {
      setViewMode('after');
    } else {
      setViewMode('original');
    }
  }, [showAfter]);

  const resetAll = useCallback(() => {
    if (typeof window !== "undefined") sessionStorage.removeItem(DESIGN_SESSION_KEY);
    // Force a hard navigation to ensure clean state
    window.location.href = "/";
  }, []);

  const toggleSuggestion = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSubmitMessage = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "user", content: trimmed },
      ]);
      setUserExtra("");
      setAdditionalChanges(additionalChanges + "\n" + trimmed);
    },
    []
  );

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
          setIsCurating(false);
          if (pollTimer.current) clearInterval(pollTimer.current);
          pollTimer.current = null;
        } else if (data.status === "error") {
          setIsCurating(false);
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
    setIsCurating(true);
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
      if (data.status === "done") {
        setIsCurating(false);
      }
      startPolling(data.job_id as string);
    } catch (e: unknown) {
      setIsCurating(false);
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      setAdditionalChanges("");
      setUserExtra("");
    }
  }, [additionalChanges, numVariations, rating, selectedIds, sessionId, startPolling, userExtra]);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);


  return (
    <div className="flex min-h-screen bg-white">
      <main className="flex-1 overflow-auto relative">
        <div className="fixed bottom-6 left-6 z-40">
          <Agent agents={VOICE_AGENTS} className="w-[360px] bg-white/95 backdrop-blur" />
        </div>


        {/* Start Over Button - Moved to Top Right */}
        {sessionId && (
          <div className="absolute top-8 right-8 z-50">
            <button
              type="button"
              onClick={() => {
                if (isResetExpanded) {
                  resetAll();
                } else {
                  setIsResetExpanded(true);
                }
              }}
              onMouseLeave={() => setIsResetExpanded(false)}
              className={cn(
                "flex items-center justify-center rounded-full bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:shadow-xl transition-all duration-300 ease-in-out border border-neutral-100",
                isResetExpanded ? "pl-3 pr-5 py-3 gap-2" : "w-12 h-12"
              )}
            >
              <RotateCcw className={cn("w-5 h-5 text-neutral-900", isResetExpanded ? "rotate-[-180deg] transition-transform duration-500" : "")} />
              <span className={cn(
                "text-sm font-medium text-neutral-900 whitespace-nowrap overflow-hidden transition-all duration-300",
                isResetExpanded ? "max-w-[100px] opacity-100" : "max-w-0 opacity-0"
              )}>
                Start Over
              </span>
            </button>
          </div>
        )}

        <div className="relative z-10 mx-auto max-w-360 space-y-8 p-8 md:p-12">
          <div className="flex flex-row items-center gap-4">
            <Link href="/" className="flex items-center text-sm uppercase tracking-wider text-neutral-500 hover:text-neutral-900">
              <ArrowLeft className="w-4 h-4 mr-1" />
              <span>Back</span>
            </Link>
          </div>

          {!sessionLoaded ? (
            <p className="text-neutral-500">Loading...</p>
          ) : sessionId && originalAbsolute ? (
            showAfter ? (
              // BEFORE / AFTER VIEW
              <div className="flex flex-col items-center justify-center w-full h-[85vh] relative animate-in fade-in duration-500">
                {/* Image Container - Flex centered, no border on container itself */}
                <div className="relative w-full h-full flex items-center justify-center p-4">
                   <img
                     src={viewMode === 'original' ? displayImageUrl : (afterImageUrl || displayImageUrl)}
                     alt={viewMode === 'original' ? "Original room" : "Curated room"}
                     className={cn(
                       "max-h-full max-w-full w-auto h-auto object-contain rounded-lg shadow-[0_20px_50px_-12px_rgba(0,0,0,0.25)] ring-1 ring-black/10 transition-all duration-500",
                       viewMode === 'after' && !afterImageUrl && "opacity-50 blur-sm scale-105"
                     )}
                   />
                   
                   {/* Generating State Overlay - Centered over the image area */}
                   {viewMode === 'after' && !afterImageUrl && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
                         <div className="bg-white/90 backdrop-blur-md px-8 py-6 rounded-2xl shadow-2xl border border-white/50 flex flex-col items-center gap-4 animate-in zoom-in-95 duration-300">
                           <div className="relative">
                             <div className="h-12 w-12 rounded-full border-[3px] border-neutral-100 border-t-neutral-900 animate-spin" />
                             <Sparkles className="absolute inset-0 m-auto h-5 w-5 text-neutral-900 animate-pulse" />
                           </div>
                           <div className="text-center space-y-1">
                             <p className="text-sm font-semibold text-neutral-900">Redesigning your space</p>
                             <p className="text-xs text-neutral-500">Applying your selected styles...</p>
                           </div>
                         </div>
                      </div>
                   )}
                </div>

                {/* Bottom Toggle Controls */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
                  <div className="flex items-center gap-1 bg-white/80 backdrop-blur-xl p-1.5 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.12)] ring-1 ring-black/5">
                    <button
                      onClick={() => setViewMode('original')}
                      className={cn(
                        "px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-200",
                        viewMode === 'original' 
                          ? "bg-neutral-900 text-white shadow-md" 
                          : "text-neutral-500 hover:text-neutral-900 hover:bg-black/5"
                      )}
                    >
                      Before
                    </button>
                    <button
                      onClick={() => setViewMode('after')}
                      className={cn(
                        "px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-200",
                        viewMode === 'after' 
                          ? "bg-neutral-900 text-white shadow-md" 
                          : "text-neutral-500 hover:text-neutral-900 hover:bg-black/5"
                      )}
                    >
                      After
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              // INITIAL UPLOAD & RATING VIEW
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                {/* Left Column: Image */}
                <div className="flex flex-col gap-6">
                  <div className="flex items-center justify-between shrink-0">
                    <p className="text-xs uppercase tracking-widest text-neutral-500 font-medium">
                      Original Photo
                    </p>
                  </div>
                  
                  <div className="relative w-full flex items-center justify-center bg-neutral-50/50 rounded-2xl p-4 md:p-8 min-h-[50vh]">
                    <img
                      src={displayImageUrl}
                      alt="Original room"
                      className="max-h-[60vh] max-w-full w-auto h-auto object-contain rounded-lg shadow-xl ring-1 ring-black/5"
                    />
                  </div>
                </div>

                {/* Right Column: Rating & Breakdown */}
                <div className="flex flex-col justify-center space-y-12 py-2">
                  <div className="w-full">
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
                      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div>
                          <div className="flex items-end justify-between border-b border-neutral-900 pb-4">
                            <h2 className="font-serif text-2xl text-foreground">Overall</h2>
                            <div className="flex items-baseline gap-1">
                              <span className="font-serif text-5xl text-foreground tracking-tight">
                                {rating.overall_score}
                              </span>
                              <span className="text-xl text-neutral-400 font-light">/10</span>
                            </div>
                          </div>
                          {rating.breakdown && Object.keys(rating.breakdown).length > 0 && (
                            <div className="space-y-4 pt-4">
                              <div className="grid grid-cols-1 gap-y-4">
                                {Object.entries(rating.breakdown).map(([k, v]) => (
                                  <div
                                    key={k}
                                    className="group flex items-center justify-between py-3 rounded-lg px-4 hover:bg-neutral-100 transition-colors"
                                  >
                                    <p className="text-xs font-medium uppercase tracking-widest text-neutral-500 group-hover:text-neutral-900 transition-colors">
                                      {k.replaceAll("_", " ")}
                                    </p>
                                    <div className="flex items-center gap-1">
                                      {Array.from({ length: 5 }).map((_, i) => (
                                        <Star
                                          key={i}
                                          className={cn(
                                            "w-4 h-4 transition-all duration-300",
                                            i < Math.round(v / 2)
                                              ? "fill-neutral-900 text-neutral-900"
                                              : "fill-transparent text-neutral-300 group-hover:text-neutral-400"
                                          )}
                                          strokeWidth={1.5}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>
            )
          ) : (
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
          )}
        </div>
      </main>

      <ChatSidebar
        className="bg-white/95 border-l border-neutral-100 shadow-[0_0_40px_rgba(0,0,0,0.03)]"
        value={userExtra}
        onChange={setUserExtra}
        placeholder="Extra modifications..."
        messages={messages}
        selectedSuggestionIds={selectedIds}
        onToggleSuggestion={toggleSuggestion}
        onSubmit={handleSubmitMessage}
        onCurate={generate}
        isCurating={isCurating}
      />
    </div>
  );
}

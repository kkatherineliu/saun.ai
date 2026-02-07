"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type AnalyzeResult = {
  summary: string;
  labels: string[];
  confidence: number;
  safety_notes: string[];
};

const STORAGE_KEY = "saun-analyze-result";

export default function DesignPage() {
  const [payload, setPayload] = useState<AnalyzeResult | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        setPayload(JSON.parse(raw) as AnalyzeResult);
      }
    } catch {
      setPayload(null);
    }
  }, []);

  if (payload === null) {
    return (
      <div className="flex min-h-screen flex-1 flex-col items-center justify-center gap-6 p-8">
        <p className="text-lg text-neutral-600">No design data yet.</p>
        <Link
          href="/"
          className="rounded-full border border-neutral-900 px-6 py-3 text-sm font-medium text-neutral-900 hover:bg-neutral-900 hover:text-white transition-colors"
        >
          Upload a photo on the home page
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex-1 p-8 md:p-16">
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-900 uppercase tracking-wider">
            ← Back
          </Link>
        </div>
        <h1 className="font-serif text-4xl tracking-tight text-foreground">Design</h1>
        <section className="rounded-2xl border border-neutral-200 bg-white/80 p-6 shadow-sm text-left">
          <h2 className="font-serif text-xl font-medium text-neutral-900 mb-3">Analysis</h2>
          <p className="text-neutral-600 mb-4">{payload.summary}</p>
          {payload.labels?.length > 0 && (
            <p className="text-xs uppercase tracking-wider text-neutral-500 mb-1">Labels</p>
          )}
          <p className="text-sm text-neutral-700 mb-4">{payload.labels?.join(", ")}</p>
          {typeof payload.confidence === "number" && (
            <p className="text-sm text-neutral-600">Confidence: {(payload.confidence * 100).toFixed(0)}%</p>
          )}
          {payload.safety_notes?.length > 0 && (
            <>
              <p className="text-xs uppercase tracking-wider text-neutral-500 mt-4 mb-1">Safety notes</p>
              <ul className="text-sm text-neutral-700 list-disc list-inside">
                {payload.safety_notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

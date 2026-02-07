"use client";

import { FormEvent, useState } from "react";

type AnalyzeResponse = {
  data: {
    summary: string;
    labels: string[];
    confidence: number;
    safety_notes: string[];
  };
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse["data"] | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (!file) {
      setError("Please select an image first.");
      return;
    }

    const formData = new FormData();
    formData.append("image", file);
    if (prompt.trim()) {
      formData.append("prompt", prompt.trim());
    }

    setLoading(true);
    try {
      const response = await fetch("http://localhost:5000/api/analyze-photo", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error ?? "Request failed.");
        return;
      }

      setResult((payload as AnalyzeResponse).data);
    } catch {
      setError("Could not reach backend. Ensure Flask is running on port 5000.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Photo Analyzer</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded border p-4">
        <label className="flex flex-col gap-2">
          <span>Image</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="rounded border p-2"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span>Optional prompt</span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe this image for a product catalog."
            className="min-h-24 rounded border p-2"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "Analyzing..." : "Analyze Photo"}
        </button>
      </form>

      {error ? <p className="rounded border border-red-500 p-3 text-red-600">{error}</p> : null}

      {result ? (
        <section className="rounded border p-4">
          <h2 className="mb-2 text-lg font-medium">Structured Result</h2>
          <pre className="overflow-x-auto whitespace-pre-wrap text-sm">
            {JSON.stringify(result, null, 2)}
          </pre>
        </section>
      ) : null}
    </main>
  );
}

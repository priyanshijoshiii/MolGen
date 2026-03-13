"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface GenerateResponse {
  prompt: string;
  valid_count: number;
  validity_pct: number;
  molecules: any[];
}

function MetricCard({
  label,
  value,
  format
}: {
  label: string;
  value: number | null | undefined;
  format?: (v: number) => string;
}) {
  const text = value == null ? "—" : format ? format(value) : String(value);
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
      <div className="text-xs font-medium tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-100">{text}</div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();

  const [molecularGoal, setMolecularGoal] = useState("");
  const [qed, setQed] = useState(0.9);
  const [logp, setLogp] = useState(2.0);
  const [tpsa, setTpsa] = useState(70.0);
  const [mw, setMw] = useState(320.0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const body = {
        prompt: molecularGoal,
        qed,
        logp,
        tpsa,
        mw,
        n: 50
      };

      const res = await fetch("http://127.0.0.1:8000/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        throw new Error(`Backend error (${res.status})`);
      }

      const data = (await res.json()) as GenerateResponse;
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("moleculeResults", JSON.stringify(data));
        window.sessionStorage.setItem("molecularGoal", molecularGoal);
      }

      router.push("/results");
    } catch (e: any) {
      setError(e?.message ?? "Failed to generate molecules");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-10">
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-300">
            Design Studio
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
            Molecular Design Studio
          </h1>
          <p className="max-w-2xl text-sm text-slate-400">
            Describe your biochemical intent, tune the key ADMET descriptors, and send the request to the
            generative model for synthesis.
          </p>
        </header>

        <section className="grid gap-8 md:grid-cols-[1.3fr,0.9fr]">
          <div className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-slate-900/40">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Molecular Goal
              </label>
              <textarea
                value={molecularGoal}
                onChange={(e) => setMolecularGoal(e.target.value)}
                placeholder="e.g. Orally bioavailable CNS ligand with balanced polarity and high QED."
                rows={3}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-50 outline-none ring-0 placeholder:text-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300">Biochemical Targets</span>
                <span className="text-[11px] text-slate-500">Adjust and then run generation</span>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400">
                    <span>QED</span>
                    <span className="font-semibold text-slate-200">{qed.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={qed}
                    onChange={(e) => setQed(parseFloat(e.target.value))}
                    className="w-full accent-emerald-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400">
                    <span>LogP</span>
                    <span className="font-semibold text-slate-200">{logp.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={-1}
                    max={6}
                    step={0.1}
                    value={logp}
                    onChange={(e) => setLogp(parseFloat(e.target.value))}
                    className="w-full accent-emerald-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400">
                    <span>TPSA</span>
                    <span className="font-semibold text-slate-200">{tpsa.toFixed(1)} Å²</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={150}
                    step={1}
                    value={tpsa}
                    onChange={(e) => setTpsa(parseFloat(e.target.value))}
                    className="w-full accent-emerald-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400">
                    <span>Molecular Weight</span>
                    <span className="font-semibold text-slate-200">{mw.toFixed(0)} Da</span>
                  </div>
                  <input
                    type="range"
                    min={150}
                    max={550}
                    step={5}
                    value={mw}
                    onChange={(e) => setMw(parseFloat(e.target.value))}
                    className="w-full accent-emerald-400"
                  />
                </div>
              </div>
            </div>

            {error ? (
              <div className="rounded-xl border border-rose-900/60 bg-rose-950/70 px-4 py-3 text-xs text-rose-200">
                {error}
              </div>
            ) : null}

            <div className="flex justify-end">
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/40 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Denoising & Synthesizing..." : "Generate Molecules"}
              </button>
            </div>
          </div>

          <aside className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
            <h2 className="text-sm font-semibold text-slate-100">Run Summary</h2>
            <p className="text-xs text-slate-400">
              We will launch a batch of {50} candidates, score them with RDKit-based descriptors, and surface the
              top 5 in the Discovery Lab.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <MetricCard label="QED target" value={qed} format={(v) => v.toFixed(2)} />
              <MetricCard label="logP target" value={logp} format={(v) => v.toFixed(2)} />
              <MetricCard label="TPSA target" value={tpsa} format={(v) => v.toFixed(1)} />
              <MetricCard label="MW target" value={mw} format={(v) => v.toFixed(0)} />
            </div>
          </aside>
        </section>
      </div>

      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur">
          <div className="space-y-3 rounded-2xl border border-emerald-500/40 bg-slate-900 px-6 py-5 text-center shadow-xl shadow-emerald-500/30">
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-300">
              Denoising &amp; Synthesizing
            </div>
            <div className="text-sm text-slate-200">
              Sending your constraints to the model and assembling candidate chemotypes…
            </div>
          </div>
        </div>
      )}
    </main>
  );
}


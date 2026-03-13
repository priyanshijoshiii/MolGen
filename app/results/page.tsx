"use client";

import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface MoleculeResult {
  smiles: string;
  sdf_string?: string;
  qed: number;
  logp: number;
  tpsa?: number;
  mw?: number;
  lipinski?: number;
  reward_score?: number;
}

interface GenerateResponse {
  prompt: string;
  valid_count: number;
  validity_pct: number;
  molecules: MoleculeResult[];
}

export default function ResultsPage() {
  const router = useRouter();
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const viewerInstanceRef = useRef<any>(null);

  const [data, setData] = useState<GenerateResponse | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const canRender3D = useMemo(() => typeof window !== "undefined", []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.sessionStorage.getItem("moleculeResults");
    const storedGoal = window.sessionStorage.getItem("molecularGoal");
    if (!stored) {
      router.replace("/");
      return;
    }
    try {
      const parsed = JSON.parse(stored) as GenerateResponse;
      setData(parsed);
    } catch {
      router.replace("/");
    }
    setGoal(storedGoal);
  }, [router]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.$3Dmol) {
      setScriptLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!canRender3D || !scriptLoaded || !viewerRef.current || !window.$3Dmol) return;

    if (!viewerInstanceRef.current) {
      viewerInstanceRef.current = window.$3Dmol.createViewer(viewerRef.current, {
        backgroundColor: "white"
      });
    }

    const viewer = viewerInstanceRef.current;
    if (!viewer) return;

    const mol = data?.molecules?.[selectedIndex];
    if (!mol?.sdf_string) return;

    try {
      viewer.clear();
      viewer.addModel(mol.sdf_string, "sdf");
      viewer.setStyle({}, { stick: {}, sphere: { scale: 0.3 }, colorscheme: "cpk" });
      viewer.zoomTo();
      viewer.spin(true);
      viewer.render();
    } catch {
      // ignore rendering errors
    }
  }, [canRender3D, scriptLoaded, data, selectedIndex]);

  const molecules = data?.molecules ?? [];
  const selected = molecules[selectedIndex];

  return (
    <>
      <Script 
        src="https://3Dmol.org/build/3Dmol-min.js" 
        strategy="afterInteractive" 
        onLoad={() => setScriptLoaded(true)}
      />
      <main className="min-h-screen bg-slate-950 text-slate-50">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8">
          <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/40 bg-sky-500/5 px-3 py-1 text-xs font-medium text-sky-300">
                Discovery Lab
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
                Generated Candidate Space
              </h1>
              {goal ? (
                <p className="mt-2 max-w-2xl text-xs text-slate-400">
                  Goal: <span className="text-slate-200">{goal}</span>
                </p>
              ) : null}
              {data ? (
                <p className="mt-1 text-xs text-slate-500">
                  {data.valid_count} valid molecules • {data.validity_pct.toFixed(1)}% validity
                </p>
              ) : null}
            </div>
            <button
              onClick={() => router.push("/")}
              className="mt-3 inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-200 hover:border-slate-500 hover:bg-slate-800"
            >
              Back to Design Studio
            </button>
          </header>

          <section className="grid gap-6 lg:grid-cols-[1.4fr,0.9fr]">
            <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-100">3D Viewer</div>
                  <div className="text-xs text-slate-400">
                    Top candidate rendered with 3Dmol.js • spin + zoom
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-800 bg-white">
                <div ref={viewerRef} id="gldiv" className="h-[420px] w-full" />
              </div>

              <div className="mt-2 text-xs text-slate-400">
                {selected?.smiles ? (
                  <>
                    <span className="font-medium text-slate-300">SMILES:</span> {selected.smiles}
                  </>
                ) : (
                  "Select a candidate from the panel to inspect its 3D conformation."
                )}
              </div>
            </div>

            <aside className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-100">Top 5 Possible Molecules</h2>
                <span className="text-[10px] uppercase tracking-wide text-slate-500">
                  Click to inspect
                </span>
              </div>

              <div className="grid gap-3">
                {molecules.slice(0, 5).map((mol, idx) => {
                  const isActive = idx === selectedIndex;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedIndex(idx)}
                      className={`flex flex-col items-start rounded-xl border px-3 py-3 text-left text-xs transition ${
                        isActive
                          ? "border-emerald-500 bg-emerald-500/10"
                          : "border-slate-800 bg-slate-900/60 hover:border-slate-600"
                      }`}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="font-medium text-slate-100">Candidate {idx + 1}</span>
                        {typeof mol.reward_score === "number" ? (
                          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] text-emerald-300">
                            score {mol.reward_score.toFixed(3)}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 line-clamp-1 font-mono text-[10px] text-slate-400">
                        {mol.smiles}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-300">
                        <span>QED {mol.qed?.toFixed(3) ?? "—"}</span>
                        <span>logP {mol.logp?.toFixed(2) ?? "—"}</span>
                        {typeof mol.lipinski === "number" ? (
                          <span
                            className={
                              mol.lipinski === 0
                                ? "text-emerald-300"
                                : mol.lipinski === 1
                                  ? "text-amber-300"
                                  : "text-rose-300"
                            }
                          >
                            Lipinski {mol.lipinski === 0 ? "clean" : `${mol.lipinski} violations`}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>
          </section>
        </div>
      </main>
    </>
  );
}


"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileCode, GitCompare, Sparkles } from "lucide-react";
import { collapseUnchanged, countChanges, diffLines } from "../../lib/diff";

/**
 * The guide-page product widget. Static sample on the left, converted result
 * on the right, already filled — no model call, no free use burned.
 * "Translate Your Own Code" deep-links to the live converter with From/To set.
 */
export default function GuideSandbox({ source, target, before, after, ownHref }) {
  const [viewMode, setViewMode] = useState("diff");
  const allRows = useMemo(() => diffLines(before, after), [before, after]);
  const stats = useMemo(() => countChanges(allRows), [allRows]);
  const rows = useMemo(() => collapseUnchanged(allRows, 2), [allRows]);

  return (
    <section className="mt-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col bg-slate-900 rounded-xl border border-slate-800 overflow-hidden min-h-[280px]">
          <div className="bg-slate-800/50 px-4 py-2 border-b border-slate-800 text-xs font-semibold text-slate-400">
            ORIGINAL CODE ({source})
          </div>
          <pre className="flex-1 p-4 font-mono text-sm text-slate-200 whitespace-pre-wrap overflow-auto">
            {before}
          </pre>
        </div>
        <div className="flex flex-col bg-slate-900 rounded-xl border border-slate-800 overflow-hidden min-h-[280px]">
          <div className="bg-slate-800/50 px-4 py-2 border-b border-slate-800 text-xs font-semibold text-slate-400 flex justify-between items-center">
            <span>MIGRATED CODE ({target})</span>
            <div className="flex items-center rounded-md border border-slate-700 overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode("code")}
                className={`flex items-center gap-1 px-2 py-1 text-xs transition ${
                  viewMode === "code"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                Result
              </button>
              <button
                type="button"
                onClick={() => setViewMode("diff")}
                className={`flex items-center gap-1 px-2 py-1 text-xs transition ${
                  viewMode === "diff"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <GitCompare className="w-3.5 h-3.5" />
                Diff
              </button>
            </div>
          </div>
          {viewMode === "code" ? (
            <pre className="flex-1 p-4 font-mono text-sm text-indigo-200 whitespace-pre-wrap overflow-auto">
              {after}
            </pre>
          ) : (
            <div className="flex-1 flex flex-col">
              <div className="px-4 py-1.5 border-b border-slate-800 text-xs text-slate-400 flex gap-3">
                <span className="text-emerald-400">+{stats.added} added</span>
                <span className="text-rose-400">-{stats.removed} removed</span>
              </div>
              <div className="flex-1 overflow-auto font-mono text-sm">
                {rows.map((row, index) => {
                  if (row.type === "skip") {
                    return (
                      <div
                        key={index}
                        className="px-4 py-1 text-xs text-slate-600 bg-slate-950/40 select-none"
                      >
                        ⋯ {row.count} unchanged {row.count === 1 ? "line" : "lines"}
                      </div>
                    );
                  }
                  const tone =
                    row.type === "added"
                      ? "bg-emerald-500/10 text-emerald-200"
                      : row.type === "removed"
                      ? "bg-rose-500/10 text-rose-200"
                      : "text-slate-300";
                  const sign =
                    row.type === "added" ? "+" : row.type === "removed" ? "-" : " ";
                  return (
                    <div key={index} className={`flex ${tone}`}>
                      <span className="w-10 shrink-0 px-1 text-right text-slate-600 select-none">
                        {row.leftNumber ?? ""}
                      </span>
                      <span className="w-10 shrink-0 px-1 text-right text-slate-600 select-none">
                        {row.rightNumber ?? ""}
                      </span>
                      <span className="w-4 shrink-0 select-none opacity-70">{sign}</span>
                      <span className="whitespace-pre-wrap break-words pr-4">
                        {row.text || " "}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <Link
          href={ownHref}
          className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2.5 rounded-lg transition"
        >
          Translate Your Own Code
          <Sparkles className="w-4 h-4" />
        </Link>
        <p className="text-xs text-slate-500">
          This sample is already converted — it does not use a free daily conversion.
          The button opens the live tool with {source} → {target} selected.
        </p>
      </div>
    </section>
  );
}

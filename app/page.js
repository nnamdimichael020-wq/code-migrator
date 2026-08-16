"use client";

import { useState, useEffect, useRef } from "react";
import { Code2, Copy, Check, Sparkles, Zap, Lock } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { Code2, Copy, Check, Sparkles, Zap, Lock, GitCompare, FileCode } from "lucide-react";
import { diffLines, countChanges, collapseUnchanged } from "../lib/diff";

const LANGUAGES = [
  "PostgreSQL", "Oracle SQL", "Snowflake SQL", "Google BigQuery",
  const [remaining, setRemaining] = useState(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [viewMode, setViewMode] = useState("code");

  const diffRows = useMemo(() => {
    if (!outputCode) return [];
    return collapseUnchanged(diffLines(inputCode, outputCode), 2);
  }, [inputCode, outputCode]);

  const diffStats = useMemo(() => countChanges(diffRows), [diffRows]);
  const turnstileBox = useRef(null);
  const turnstileId = useRef(null);

            <div className="bg-slate-800/50 px-4 py-2 border-b border-slate-800 text-xs font-semibold text-slate-400 flex justify-between items-center">
              <span>MIGRATED CODE ({targetLang})</span>
              {outputCode && (
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-xs"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied!" : "Copy Code"}
                </button>
                <div className="flex items-center gap-3">
                  <div className="flex items-center rounded-md border border-slate-700 overflow-hidden">
                    <button
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
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-xs"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied!" : "Copy Code"}
                  </button>
                </div>
              )}
            </div>
            <textarea
              readOnly
              value={outputCode}
              placeholder="Converted code will appear here..."
              className="flex-1 w-full bg-transparent p-4 font-mono text-sm text-indigo-200 resize-none focus:outline-none min-h-[300px]"
            />

            {viewMode === "code" || !outputCode ? (
              <textarea
                readOnly
                value={outputCode}
                placeholder="Converted code will appear here..."
                className="flex-1 w-full bg-transparent p-4 font-mono text-sm text-indigo-200 resize-none focus:outline-none min-h-[300px]"
              />
            ) : (
              <div className="flex-1 min-h-[300px] flex flex-col">
                <div className="px-4 py-1.5 border-b border-slate-800 text-xs text-slate-400 flex gap-3">
                  <span className="text-emerald-400">+{diffStats.added} added</span>
                  <span className="text-rose-400">-{diffStats.removed} removed</span>
                  {diffStats.added === 0 && diffStats.removed === 0 && (
                    <span className="text-slate-500">no line-level changes</span>
                  )}
                </div>
                <div className="flex-1 overflow-auto font-mono text-sm">
                  {diffRows.map((row, index) => {
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

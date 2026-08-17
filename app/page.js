"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import {
  Code2, Copy, Check, Sparkles, Zap, Lock, GitCompare, FileCode,
  Filter, History, Download, ChevronDown, Trash2, RotateCcw, AlertTriangle
} from "lucide-react";
import { diffLines, countChanges, collapseUnchanged } from "../lib/diff";
import { groupExplanation, reviewNotes } from "../lib/classify";
import { pairGotchas } from "../lib/pairs";
import {
  loadHistory, saveHistoryEntry, clearHistory, loadPrefs, savePrefs,
  withComments, asDiffText, downloadText, extensionFor
} from "../lib/history";
const LANGUAGES = [
  "PostgreSQL", "Oracle SQL", "Snowflake SQL", "Google BigQuery",
  "MySQL", "Python", "JavaScript / Node.js", "TypeScript",
  "Excel VBA", "C#", "Java", "PHP"
];
const DAILY_LIMIT = 3;
const TURNSTILE_SITE_KEY = "0x4AAAAAAEO2i1RSHJtRwNpP";
export default function Home() {
  const [sourceLang, setSourceLang] = useState("Oracle SQL");
  const [targetLang, setTargetLang] = useState("PostgreSQL");
  const [inputCode, setInputCode] = useState("");
  const [outputCode, setOutputCode] = useState("");
  const [explanation, setExplanation] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [remaining, setRemaining] = useState(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [viewMode, setViewMode] = useState("diff");
  const [onlyChanges, setOnlyChanges] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  // Set after mount only, so the server and first client render agree.
  const [isMac, setIsMac] = useState(false);
  // The code the diff is against — frozen at conversion time, so editing the
  // input box afterwards can't silently rewrite the diff you're reading.
  const [diffBase, setDiffBase] = useState("");
  const allDiffRows = useMemo(() => {
    if (!outputCode) return [];
    return diffLines(diffBase, outputCode);
  }, [diffBase, outputCode]);
  const diffStats = useMemo(() => countChanges(allDiffRows), [allDiffRows]);
  const diffRows = useMemo(() => {
    if (allDiffRows.length === 0) return [];
    if (onlyChanges) return allDiffRows.filter((row) => row.type !== "same");
    return collapseUnchanged(allDiffRows, 2);
  }, [allDiffRows, onlyChanges]);
  const changeGroups = useMemo(() => groupExplanation(explanation), [explanation]);
  // Generic keyword flags, plus the known traps for this specific dialect pair.
  const flags = useMemo(() => {
    const generic = reviewNotes(explanation);
    const specific = pairGotchas(sourceLang, targetLang);
    return Array.from(new Set([...specific, ...generic]));
  }, [explanation, sourceLang, targetLang]);
  const turnstileBox = useRef(null);
  const turnstileId = useRef(null);
  const applyUsage = (data) => {
    if (typeof data?.remaining === "number") setRemaining(data.remaining);
  };
  const resetTurnstile = () => {
    setTurnstileToken("");
    if (window.turnstile && turnstileId.current != null) {
      window.turnstile.reset(turnstileId.current);
    }
  };
  // Restore the user's last view choice and their local history.
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || ""));
    const prefs = loadPrefs();
    if (prefs.viewMode === "code" || prefs.viewMode === "diff") setViewMode(prefs.viewMode);
    if (typeof prefs.onlyChanges === "boolean") setOnlyChanges(prefs.onlyChanges);
    setHistory(loadHistory());
  }, []);
  useEffect(() => {
    fetch("/api/convert", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (typeof data?.remaining === "number") applyUsage(data);
      })
      .catch(() => setRemaining(DAILY_LIMIT));
  }, []);
  useEffect(() => {
    const start = () => {
      if (!window.turnstile || !turnstileBox.current || turnstileId.current != null) return;
      turnstileId.current = window.turnstile.render(turnstileBox.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: "dark",
        callback: (token) => setTurnstileToken(token),
        "expired-callback": () => setTurnstileToken(""),
        "error-callback": () => setTurnstileToken("")
      });
    };
    if (window.turnstile) {
      start();
      return;
    }
    const existing = document.querySelector("script[data-codeshift-turnstile]");
    if (existing) {
      existing.addEventListener("load", start);
      return () => existing.removeEventListener("load", start);
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.codeshiftTurnstile = "1";
    script.onload = start;
    document.head.appendChild(script);
  }, []);
  // `override` lets History re-run an old entry without waiting for React
  // state to flush. Without it a re-run would send the currently-typed code.
  const handleConvert = async (override = null) => {
    const srcLang = override?.sourceLang ?? sourceLang;
    const tgtLang = override?.targetLang ?? targetLang;
    const code = override?.inputCode ?? inputCode;
    if (!code.trim()) return;
    if (remaining === 0) {
      setShowPaywall(true);
      return;
    }
    if (!turnstileToken) {
      alert("Wait a second for the human check, then try again.");
      return;
    }
    setLoading(true);
    setOutputCode("");
    setExplanation([]);
    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceLang: srcLang,
          targetLang: tgtLang,
          code,
          turnstileToken
        }),
      });
      const data = await res.json();
      applyUsage(data);
      resetTurnstile();
      if (data.error === "Daily free limit reached.") {
        setShowPaywall(true);
        return;
      }
      if (data.error) throw new Error(data.error);
      setOutputCode(data.convertedCode);
      setExplanation(data.explanation || []);
      setDiffBase(code);
      setHistory(
        saveHistoryEntry({
          sourceLang: srcLang,
          targetLang: tgtLang,
          inputCode: code,
          outputCode: data.convertedCode,
          explanation: data.explanation || []
        })
      );
    } catch (err) {
      alert(err.message || "Error generating conversion. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  const flashCopied = () => {
    setCopied(true);
    setShowCopyMenu(false);
    setTimeout(() => setCopied(false), 2000);
  };
  const copyToClipboard = () => {
    navigator.clipboard.writeText(outputCode);
    flashCopied();
  };
  const copyWithComments = () => {
    navigator.clipboard.writeText(
      withComments({ code: outputCode, explanation, sourceLang, targetLang })
    );
    flashCopied();
  };
  const copyAsDiff = () => {
    navigator.clipboard.writeText(asDiffText(allDiffRows));
    flashCopied();
  };
  const downloadResult = () => {
    downloadText(`converted.${extensionFor(targetLang)}`, outputCode);
    setShowCopyMenu(false);
  };
  const changeView = (mode) => {
    setViewMode(mode);
    savePrefs({ viewMode: mode });
  };
  const toggleOnlyChanges = () => {
    setOnlyChanges((prev) => {
      savePrefs({ onlyChanges: !prev });
      return !prev;
    });
  };
  const restoreEntry = (entry) => {
    setSourceLang(entry.sourceLang);
    setTargetLang(entry.targetLang);
    setInputCode(entry.inputCode);
    setOutputCode(entry.outputCode);
    setExplanation(entry.explanation || []);
    setDiffBase(entry.inputCode);
    setShowHistory(false);
  };
  // Costs one of the daily uses, unlike restoreEntry which is free.
  const rerunEntry = (entry) => {
    setSourceLang(entry.sourceLang);
    setTargetLang(entry.targetLang);
    setInputCode(entry.inputCode);
    setShowHistory(false);
    handleConvert({
      sourceLang: entry.sourceLang,
      targetLang: entry.targetLang,
      inputCode: entry.inputCode
    });
  };
  const removeHistory = () => {
    clearHistory();
    setHistory([]);
    setShowHistory(false);
  };
  const relativeTime = (ts) => {
    const mins = Math.round((Date.now() - ts) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
  };
  // Ctrl/Cmd + Enter converts from anywhere on the page, including from
  // inside the textarea. Registered after handleConvert so it always closes
  // over the current state.
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        if (!loading && inputCode.trim() && remaining !== null) handleConvert();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });
  const remainingLabel = remaining === null ? "…" : `${remaining}/${DAILY_LIMIT} remaining`;
  const shortcutLabel = isMac ? "⌘ + Enter" : "Ctrl + Enter";
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code2 className="w-6 h-6 text-indigo-400" />
          <span className="font-bold text-lg tracking-tight">CodeShift AI</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {history.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowHistory((v) => !v)}
                className="flex items-center gap-1.5 text-slate-300 hover:text-white transition"
              >
                <History className="w-4 h-4" />
                History ({history.length})
              </button>
              {showHistory && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowHistory(false)} />
                  <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-20">
                    <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                      <span
                        className="text-xs text-slate-400"
                        title="History is stored in this browser. It survives closing the tab, but does not follow you to another browser or device."
                      >
                        Saved in this browser only
                      </span>
                      <button
                        onClick={removeHistory}
                        className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Clear
                      </button>
                    </div>
                    {history.map((entry) => (
                      <div
                        key={entry.id}
                        className="px-3 py-2 border-b border-slate-800/60 last:border-0 hover:bg-slate-800/50 transition"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-indigo-300 truncate">
                            {entry.sourceLang} → {entry.targetLang}
                          </span>
                          <span className="text-[10px] text-slate-500 shrink-0">
                            {relativeTime(entry.at)}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                          {entry.inputCode.split("\n")[0]}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5">
                          <button
                            onClick={() => restoreEntry(entry)}
                            className="text-[11px] font-medium text-slate-300 hover:text-white"
                          >
                            Restore <span className="text-slate-500">(free)</span>
                          </button>
                          <button
                            onClick={() => rerunEntry(entry)}
                            disabled={loading || remaining === 0}
                            className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 disabled:opacity-40 flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Re-run <span className="text-slate-500">(uses 1)</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <span className="text-slate-400">
            Free Daily Uses: <strong className="text-indigo-400">{remainingLabel}</strong>
          </span>
          <button
            onClick={() => setShowPaywall(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition"
          >
            <Zap className="w-4 h-4" /> Go Pro ($7)
          </button>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6">
        <div className="text-center py-4">
          <h1 className="text-3xl font-extrabold text-white sm:text-4xl">
            Instant SQL & Code Translator
          </h1>
          <p className="mt-2 text-slate-400">
            Migrate queries, scripts, and legacy code across dialects in seconds.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center bg-slate-900 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase font-semibold text-slate-500 w-12">From:</span>
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              className="bg-slate-800 text-white rounded-lg px-3 py-2 w-full border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase font-semibold text-slate-500 w-12">To:</span>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="bg-slate-800 text-white rounded-lg px-3 py-2 w-full border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
          <div className="flex flex-col bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="bg-slate-800/50 px-4 py-2 border-b border-slate-800 text-xs font-semibold text-slate-400">
              ORIGINAL CODE ({sourceLang})
            </div>
            <textarea
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              placeholder="Paste code or SQL script here..."
              className="flex-1 w-full bg-transparent p-4 font-mono text-sm text-slate-200 resize-none focus:outline-none min-h-[300px]"
            />
            <div className="p-3 border-t border-slate-800 bg-slate-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div ref={turnstileBox} className="min-h-[65px]" />
              <button
                onClick={() => handleConvert()}
                disabled={loading || !inputCode.trim() || remaining === null}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg flex items-center justify-center gap-2 transition"
              >
                {loading ? "Translating..." : "Translate Code"}
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline text-[11px] text-indigo-200/70 font-normal ml-0.5">
                  {shortcutLabel}
                </span>
              </button>
            </div>
          </div>
          <div className="flex flex-col bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="bg-slate-800/50 px-4 py-2 border-b border-slate-800 text-xs font-semibold text-slate-400 flex justify-between items-center">
              <span>MIGRATED CODE ({targetLang})</span>
              {outputCode && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center rounded-md border border-slate-700 overflow-hidden">
                    <button
                      onClick={() => changeView("code")}
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
                      onClick={() => changeView("diff")}
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
                  <div className="relative">
                    <button
                      onClick={() => setShowCopyMenu((v) => !v)}
                      className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-xs"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? "Copied!" : "Copy"}
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    {showCopyMenu && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowCopyMenu(false)} />
                        <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden">
                          <button
                            onClick={copyToClipboard}
                            className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 transition"
                          >
                            Copy code
                            <span className="block text-[10px] text-slate-500">Just the converted code</span>
                          </button>
                          <button
                            onClick={copyWithComments}
                            className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 transition"
                          >
                            Copy with comments
                            <span className="block text-[10px] text-slate-500">Key changes as a comment header</span>
                          </button>
                          <button
                            onClick={copyAsDiff}
                            className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 transition"
                          >
                            Copy as diff
                            <span className="block text-[10px] text-slate-500">Plain text, for a PR or chat</span>
                          </button>
                          <button
                            onClick={downloadResult}
                            className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 transition border-t border-slate-800 flex items-center gap-1.5"
                          >
                            <Download className="w-3 h-3" />
                            Download .{extensionFor(targetLang)}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
            {viewMode === "code" || !outputCode ? (
              <textarea
                readOnly
                value={outputCode}
                placeholder="Converted code will appear here..."
                className="flex-1 w-full bg-transparent p-4 font-mono text-sm text-indigo-200 resize-none focus:outline-none min-h-[300px]"
              />
            ) : (
              <div className="flex-1 min-h-[300px] flex flex-col">
                <div className="px-4 py-1.5 border-b border-slate-800 text-xs text-slate-400 flex gap-3 items-center">
                  <span className="text-emerald-400">+{diffStats.added} added</span>
                  <span className="text-rose-400">-{diffStats.removed} removed</span>
                  {diffStats.added === 0 && diffStats.removed === 0 && (
                    <span className="text-slate-500">no line-level changes</span>
                  )}
                  <button
                    onClick={toggleOnlyChanges}
                    className={`ml-auto flex items-center gap-1 px-2 py-0.5 rounded border transition ${
                      onlyChanges
                        ? "border-indigo-500 text-indigo-300 bg-indigo-500/10"
                        : "border-slate-700 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Filter className="w-3 h-3" />
                    Only changes
                  </button>
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
        {explanation.length > 0 && (
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
            <h3 className="text-sm font-semibold text-indigo-400 mb-3">Key Changes Made:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              {changeGroups.map((group) => (
                <div key={group.id}>
                  <div className="flex items-baseline gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                      {group.label}
                    </h4>
                    <span className="text-[10px] text-slate-500">{group.items.length}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-1">{group.hint}</p>
                  <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
                    {group.items.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            {flags.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-800">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-400">
                    Worth checking yourself
                  </h4>
                </div>
                <ul className="list-disc list-inside text-sm text-slate-400 space-y-1">
                  {flags.map((flag, index) => (
                    <li key={index}>{flag}</li>
                  ))}
                </ul>
                <p className="text-[11px] text-slate-600 mt-2">
                  These are common migration pitfalls, flagged by keyword. Always test converted
                  code before shipping it.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
      {showPaywall && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full shadow-2xl text-center flex flex-col gap-4">
            <div className="w-12 h-12 bg-indigo-600/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white">Daily Free Limit Reached</h2>
            <p className="text-sm text-slate-400">
              You have used your {DAILY_LIMIT} free conversions for today on this network. Come back tomorrow, or wait for Pro checkout.
            </p>
            <div className="bg-slate-800 p-4 rounded-xl text-left border border-slate-700">
              <div className="text-2xl font-black text-white">$7 <span className="text-xs font-normal text-slate-400">/ month</span></div>
              <ul className="text-xs text-slate-300 mt-2 space-y-1.5">
                <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" /> Unlimited daily conversions</li>
                <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" /> Support for scripts up to 5,000 lines</li>
                <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" /> Priority API response speed</li>
              </ul>
            </div>
            <button
              type="button"
              disabled
              className="bg-slate-700 text-slate-300 font-semibold py-2.5 rounded-lg w-full cursor-not-allowed"
            >
              Pro checkout coming soon
            </button>
            <p className="text-xs text-slate-500">
              This is a free public beta. Payments are not live yet.
            </p>
            <button
              onClick={() => setShowPaywall(false)}
              className="text-xs text-slate-500 hover:text-slate-400 mt-1"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

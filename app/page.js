"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import {
  Code2, Copy, Check, Sparkles, Zap, Lock, GitCompare, FileCode,
  Filter, History, Download, ChevronDown, Trash2, RotateCcw, AlertTriangle,
  AlignLeft, Database, FolderOpen
} from "lucide-react";
import { diffLines, countChanges, collapseUnchanged } from "../lib/diff";
import { groupExplanation } from "../lib/classify";
import Link from "next/link";
import { PAIRS } from "../lib/pairs";
import { collectIssues, issuesSummary } from "../lib/issues";
import { FREE_MAX_LINES, SIZE_LIMIT_CODE, inspectPaste } from "../lib/limits";
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
// Static homepage sample — no API call, no quota. Keep this short so both
// panes stay above the fold on a typical laptop.
const HOME_EXAMPLE = {
  source: "Oracle SQL",
  target: "PostgreSQL",
  input: `SELECT emp_id,
       NVL(bonus, 0) AS bonus,
       SYSDATE AS run_at
FROM employees
WHERE ROWNUM <= 5;`,
  output: `SELECT emp_id,
       COALESCE(bonus, 0) AS bonus,
       CURRENT_TIMESTAMP AS run_at
FROM employees
LIMIT 5;`
};
export default function Home() {
  const [sourceLang, setSourceLang] = useState(HOME_EXAMPLE.source);
  const [targetLang, setTargetLang] = useState(HOME_EXAMPLE.target);
  const [inputCode, setInputCode] = useState(HOME_EXAMPLE.input);
  const [outputCode, setOutputCode] = useState(HOME_EXAMPLE.output);
  const [explanation, setExplanation] = useState([]);
  const [pitfalls, setPitfalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [remaining, setRemaining] = useState(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallReason, setPaywallReason] = useState("limit");
  const [turnstileToken, setTurnstileToken] = useState("");
  // Result view for the canned sample so the Diff chrome stays off until
  // the visitor actually converts.
  const [viewMode, setViewMode] = useState("code");
  const [showingExample, setShowingExample] = useState(true);
  const [onlyChanges, setOnlyChanges] = useState(false);
  // "idiomatic" rewrites into target-native patterns; "literal" preserves the
  // source's structure line-for-line. Persisted, because it's a working habit.
  const [style, setStyle] = useState("idiomatic");
  const [showSchemaNote, setShowSchemaNote] = useState(false);
  const [showFolderNote, setShowFolderNote] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  // Set after mount only, so the server and first client render agree.
  const [isMac, setIsMac] = useState(false);
  // The code the diff is against — frozen at conversion time, so editing the
  // input box afterwards can't silently rewrite the diff you're reading.
  const [diffBase, setDiffBase] = useState(HOME_EXAMPLE.input);
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
  const pasteInfo = useMemo(() => inspectPaste(inputCode), [inputCode]);
  const flags = useMemo(
    () =>
      collectIssues({
        explanation,
        sourceLang,
        targetLang,
        inputCode: diffBase,
        outputCode,
        modelPitfalls: pitfalls
      }),
    [explanation, sourceLang, targetLang, diffBase, outputCode, pitfalls]
  );
  const turnstileBox = useRef(null);
  const turnstileId = useRef(null);
  const inputRef = useRef(null);
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
    // Preselect the language pair when arriving from a /convert/... guide page,
    // e.g. /?from=Python&to=JavaScript %2F Node.js
    const params = new URLSearchParams(window.location.search);
    const from = params.get("from");
    const to = params.get("to");
    if (from && LANGUAGES.includes(from)) setSourceLang(from);
    if (to && LANGUAGES.includes(to)) setTargetLang(to);
    const otherPair =
      (from && from !== HOME_EXAMPLE.source) || (to && to !== HOME_EXAMPLE.target);
    if (otherPair) {
      setInputCode("");
      setOutputCode("");
      setDiffBase("");
      setShowingExample(false);
    }
    if (window.location.hash === "#translator") {
      requestAnimationFrame(() => {
        document.getElementById("translator")?.scrollIntoView({ behavior: "smooth", block: "start" });
        inputRef.current?.focus();
      });
    }
    const prefs = loadPrefs();
    // Keep the canned sample on Result view. Restore Diff only after a real run
    // or when arriving for a different language pair.
    if (!otherPair) {
      setViewMode("code");
    } else if (prefs.viewMode === "code" || prefs.viewMode === "diff") {
      setViewMode(prefs.viewMode);
    }
    if (typeof prefs.onlyChanges === "boolean") setOnlyChanges(prefs.onlyChanges);
    if (prefs.style === "idiomatic" || prefs.style === "literal") setStyle(prefs.style);
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
    if (inspectPaste(code).tooLong) {
      setPaywallReason("size");
      setShowPaywall(true);
      return;
    }
    if (remaining === 0) {
      setPaywallReason("limit");
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
    setPitfalls([]);
    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceLang: srcLang,
          targetLang: tgtLang,
          code,
          turnstileToken,
          style: override?.style ?? style
        }),
      });
      const data = await res.json();
      applyUsage(data);
      resetTurnstile();
      if (data.error === "Daily free limit reached.") {
        setPaywallReason("limit");
        setShowPaywall(true);
        return;
      }
      if (data.code === SIZE_LIMIT_CODE) {
        setPaywallReason("size");
        setShowPaywall(true);
        return;
      }
      if (data.error) throw new Error(data.error);
      setOutputCode(data.convertedCode);
      setExplanation(data.explanation || []);
      setPitfalls(Array.isArray(data.pitfalls) ? data.pitfalls : []);
      setDiffBase(code);
      setShowingExample(false);
      setHistory(
        saveHistoryEntry({
          sourceLang: srcLang,
          targetLang: tgtLang,
          inputCode: code,
          outputCode: data.convertedCode,
          explanation: data.explanation || [],
          pitfalls: Array.isArray(data.pitfalls) ? data.pitfalls : [],
          style: override?.style ?? style
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
  const changeStyle = (next) => {
    setStyle(next);
    savePrefs({ style: next });
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
    setPitfalls(entry.pitfalls || []);
    setDiffBase(entry.inputCode);
    setShowingExample(false);
    setShowHistory(false);
  };
  // Costs one of the daily uses, unlike restoreEntry which is free.
  const rerunEntry = (entry) => {
    setSourceLang(entry.sourceLang);
    setTargetLang(entry.targetLang);
    setInputCode(entry.inputCode);
    setShowHistory(false);
    const entryStyle = entry.style === "literal" ? "literal" : "idiomatic";
    changeStyle(entryStyle);
    handleConvert({
      sourceLang: entry.sourceLang,
      targetLang: entry.targetLang,
      inputCode: entry.inputCode,
      style: entryStyle
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
        if (!loading && inputCode.trim() && remaining !== null && !inspectPaste(inputCode).tooLong) {
          handleConvert();
        } else if (inspectPaste(inputCode).tooLong) {
          setPaywallReason("size");
          setShowPaywall(true);
        }
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
                          <span className="flex items-center gap-2 shrink-0">
                            {entry.style === "literal" && (
                              <span className="text-[10px] uppercase tracking-wide text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                                Literal
                              </span>
                            )}
                            <span className="text-[10px] text-slate-500">
                              {relativeTime(entry.at)}
                            </span>
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
            onClick={() => {
              setPaywallReason(pasteInfo.tooLong ? "size" : "limit");
              setShowPaywall(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition"
          >
            <Zap className="w-4 h-4" /> Go Pro ($7)
          </button>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6">
        <div className="text-center py-2">
          <h1 className="text-3xl font-extrabold text-white sm:text-4xl">
            Instant SQL & Code Translator
          </h1>
          <p className="mt-2 text-slate-400">
            Oracle → Postgres, MySQL → Snowflake, VBA → Python in seconds.
          </p>
          <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-400">
            <li className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              {DAILY_LIMIT} free conversions a day
            </li>
            <li className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              No signup required
            </li>
            <li className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              Diff view + silent pitfall warnings
            </li>
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            Built for developers migrating Oracle, MySQL, and legacy VBA code.
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
        <div id="translator" className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 scroll-mt-24">
          <div className="flex flex-col bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="bg-slate-800/50 px-4 py-2 border-b border-slate-800 text-xs font-semibold text-slate-400">
              ORIGINAL CODE ({sourceLang})
            </div>
            <textarea
              ref={inputRef}
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              placeholder="Paste code or SQL script here..."
              className="flex-1 w-full bg-transparent p-4 font-mono text-sm text-slate-200 resize-none focus:outline-none min-h-[300px]"
            />
            <div className="p-3 border-t border-slate-800 bg-slate-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div ref={turnstileBox} className="min-h-[65px]" />
              <button
                onClick={() => handleConvert()}
                disabled={loading || !inputCode.trim() || remaining === null || pasteInfo.tooLong}
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
              {outputCode && !showingExample && (
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
        {showingExample &&
          sourceLang === HOME_EXAMPLE.source &&
          targetLang === HOME_EXAMPLE.target && (
          <p className="text-xs text-slate-500 -mt-3">
            Example: Oracle → PostgreSQL — edit and re-translate anytime.
          </p>
        )}
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="text-xs uppercase font-semibold text-slate-500 sm:w-24 shrink-0">
              Style:
            </span>
            <div className="flex items-center rounded-lg border border-slate-700 overflow-hidden self-start">
              <button
                type="button"
                onClick={() => changeStyle("idiomatic")}
                aria-pressed={style === "idiomatic"}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition ${
                  style === "idiomatic"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Idiomatic
              </button>
              <button
                type="button"
                onClick={() => changeStyle("literal")}
                aria-pressed={style === "literal"}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition ${
                  style === "literal"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <AlignLeft className="w-3.5 h-3.5" />
                Literal
              </button>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              {style === "idiomatic"
                ? "Rewrites into target-native patterns — vectorised pandas, set-based SQL. Best performance."
                : "Preserves the original structure line-for-line, loops included. Best for review and audit."}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 border-t border-slate-800 pt-4">
            <span className="text-xs uppercase font-semibold text-slate-500 sm:w-24 shrink-0">
              Schema:
            </span>
            <button
              type="button"
              onClick={() => setShowSchemaNote((open) => !open)}
              aria-expanded={showSchemaNote}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-dashed border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition self-start"
            >
              <Database className="w-3.5 h-3.5" />
              Add table schema
              <span className="text-[10px] uppercase tracking-wide bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                Planned
              </span>
            </button>
            <p className="text-xs text-slate-500 leading-relaxed">
              Paste a CREATE TABLE so column names and types stop being guesses.
            </p>
          </div>
          {showSchemaNote && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-xs text-slate-400 leading-relaxed flex flex-col gap-2">
              <p className="text-slate-300 font-medium">Not built yet — here is the honest status.</p>
              <p>
                Right now the converter only sees the code you paste, so when your SQL
                references a column it cannot verify, it infers a sensible type. Feeding it
                your real DDL would remove that guesswork.
              </p>
              <p>
                It is the next substantial thing on the list. It is not live because a schema
                eats into the same size budget as your code, and doing it properly means
                raising that budget first.
              </p>
              <p className="text-slate-500">
                No email capture here, and no waitlist. When it ships it will simply appear.
              </p>
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 border-t border-slate-800 pt-4">
            <span className="text-xs uppercase font-semibold text-slate-500 sm:w-24 shrink-0">
              Folder:
            </span>
            <button
              type="button"
              onClick={() => setShowFolderNote((open) => !open)}
              aria-expanded={showFolderNote}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-dashed border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition self-start"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Upload a folder
              <span className="text-[10px] uppercase tracking-wide bg-indigo-600/20 text-indigo-300 px-1.5 py-0.5 rounded">
                Pro
              </span>
            </button>
            <p className="text-xs text-slate-500 leading-relaxed">
              Drop a folder of scripts. Free stays one paste at a time.
            </p>
          </div>
          {showFolderNote && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-xs text-slate-400 leading-relaxed flex flex-col gap-2">
              <p className="text-slate-300 font-medium">Shown so you know it is on the list — it does not upload anything yet.</p>
              <p>
                A real folder drop would send every file through the same converter, and the
                free Gemini key cannot take that. When Pro checkout is live, this button will
                open a folder picker and convert one file at a time.
              </p>
              <p>
                Nothing is read from your disk when you click this. There is no hidden file
                input.
              </p>
              <button
                type="button"
                onClick={() => {
                  setPaywallReason("folder");
                  setShowPaywall(true);
                }}
                className="self-start text-xs font-medium text-indigo-400 hover:text-indigo-300"
              >
                See Pro
              </button>
            </div>
          )}
        </div>
        {pasteInfo.tooLong && (
          <div className="bg-indigo-500/10 border border-indigo-500/40 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <div className="text-sm font-semibold text-indigo-200">
                This looks like a longer script ({pasteInfo.lineCount} lines)
              </div>
              <p className="text-xs text-indigo-200/70 mt-0.5">
                Free converts one snippet at a time, up to {FREE_MAX_LINES} lines.
                Split it into smaller pieces, or wait for Pro — longer scripts are on that list.
                Folder upload is not part of this.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setPaywallReason("size");
                setShowPaywall(true);
              }}
              className="shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
            >
              See Pro
            </button>
          </div>
        )}
        {!pasteInfo.tooLong && pasteInfo.multiStatement && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="flex-1 text-xs text-slate-400">
              This looks like several statements. Free works best one snippet at a time.
              Batches and folder upload will be Pro.
            </p>
            <button
              type="button"
              onClick={() => {
                setPaywallReason("size");
                setShowPaywall(true);
              }}
              className="shrink-0 text-xs font-medium text-indigo-400 hover:text-indigo-300"
            >
              See Pro
            </button>
          </div>
        )}
        {explanation.length > 0 && flags.length > 0 && (
          <a
            href="#worth-checking"
            className="bg-amber-500/10 border border-amber-500/40 rounded-xl px-4 py-3 flex items-start gap-3 hover:border-amber-400/70 transition"
          >
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-amber-300">
                {issuesSummary(flags.length)}
              </div>
              <p className="text-xs text-amber-200/70 mt-0.5">
                These compile or run but can change results. Review the list below before you ship.
              </p>
            </div>
          </a>
        )}
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
      <section className="max-w-6xl w-full mx-auto px-6 pt-12">
        <h2 className="text-xl font-bold text-white">Conversion guides</h2>
        <p className="mt-1 text-sm text-slate-400">
          Each guide has a syntax mapping table, the traps that change behaviour without
          throwing an error, and a button that opens this converter with the languages
          already selected.
        </p>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PAIRS.map((p) => (
            <Link
              key={p.slug}
              href={`/convert/${p.slug}`}
              className="group bg-slate-900 border border-slate-800 hover:border-indigo-600 rounded-lg px-4 py-3 transition"
            >
              <div className="text-sm font-semibold text-slate-200 group-hover:text-white">
                {p.source} → {p.target}
              </div>
              <div className="mt-1 text-xs text-slate-500 line-clamp-2">{p.blurb}</div>
            </Link>
          ))}
        </div>
        <Link
          href="/convert"
          className="inline-block mt-5 text-sm font-medium text-indigo-400 hover:text-indigo-300 transition"
        >
          View all converters →
        </Link>
      </section>
      <section className="max-w-6xl w-full mx-auto px-6 pt-14">
        <h2 className="text-xl font-bold text-white">Why CodeShift</h2>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <FileCode className="w-6 h-6 text-indigo-400" />
            <h3 className="mt-3 text-sm font-semibold text-white">Not just SQL</h3>
            <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
              Five SQL dialects plus Python, JavaScript, TypeScript, Excel VBA, C#, Java
              and PHP. Most converters stop at SQL.
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <GitCompare className="w-6 h-6 text-indigo-400" />
            <h3 className="mt-3 text-sm font-semibold text-white">Diff and pitfall warnings</h3>
            <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
              See exactly which lines changed, and get flagged on the differences that
              silently change behaviour instead of throwing an error.
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <Lock className="w-6 h-6 text-indigo-400" />
            <h3 className="mt-3 text-sm font-semibold text-white">Lightweight and private</h3>
            <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
              No account for free use. Your code is sent to the model to be converted and
              is not stored on our servers; history stays in your own browser.
            </p>
          </div>
        </div>
      </section>
      <section className="max-w-6xl w-full mx-auto px-6 pt-14">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-5 py-4 text-center">
          <p className="text-xs text-slate-400">
            Built for developers migrating legacy Oracle, MySQL and VBA code.
            Free public beta — {DAILY_LIMIT} conversions a day, no account.
          </p>
        </div>
      </section>
      <footer className="max-w-6xl mx-auto px-4 pb-12 pt-4">
        <div className="border-t border-slate-800 pt-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-1">
            Conversion guides
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Syntax mapping tables and the migration traps that change behaviour without
            throwing an error.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
            {PAIRS.map((p) => (
              <Link
                key={p.slug}
                href={`/convert/${p.slug}`}
                className="text-xs text-slate-400 hover:text-indigo-400 transition"
              >
                {p.source} → {p.target}
              </Link>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link
              href="/convert"
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition"
            >
              All converters
            </Link>
            <button
              type="button"
              onClick={() => setShowPaywall(true)}
              className="text-xs font-medium text-slate-400 hover:text-white transition"
            >
              CodeShift Pro
            </button>
          </div>
          <p className="mt-4 text-[11px] text-slate-600">
            Automated conversion is a starting point, not a guarantee. Always review and
            test converted code before running it against production data.
          </p>
        </div>
      </footer>
      {showPaywall && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full shadow-2xl text-center flex flex-col gap-4">
            <div className="w-12 h-12 bg-indigo-600/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white">
              {paywallReason === "folder"
                ? "Folder upload is a Pro feature"
                : paywallReason === "size"
                ? "This script is bigger than the free limit"
                : "Daily Free Limit Reached"}
            </h2>
            <p className="text-sm text-slate-400">
              {paywallReason === "folder"
                ? "Free stays one paste at a time. A folder of scripts will convert file-by-file when Pro checkout is live — nothing is uploaded today."
                : paywallReason === "size"
                ? `Free converts one snippet up to ${FREE_MAX_LINES} lines. Split this paste, or wait for Pro for longer scripts and folder upload.`
                : `You have used your ${DAILY_LIMIT} free conversions for today on this network. Come back tomorrow, or wait for Pro checkout.`}
            </p>
            <div className="bg-slate-800 p-4 rounded-xl text-left border border-slate-700">
              <div className="text-2xl font-black text-white">$7 <span className="text-xs font-normal text-slate-400">/ month</span></div>
              <ul className="text-xs text-slate-300 mt-2 space-y-1.5">
                <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" /> Unlimited daily conversions</li>
                <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" /> Longer scripts and multi-statement batches</li>
                <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" /> Upload a folder of scripts (one file at a time)</li>
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

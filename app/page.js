"use client";

import { useState, useEffect } from "react";
import { Code2, Copy, Check, Sparkles, Zap, Lock } from "lucide-react";

const LANGUAGES = [
  "PostgreSQL", "Oracle SQL", "Snowflake SQL", "Google BigQuery",
  "MySQL", "Python", "JavaScript / Node.js", "TypeScript",
  "Excel VBA", "C#", "Java", "PHP"
];

const DAILY_LIMIT = 3;

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

  const applyUsage = (data) => {
    if (typeof data?.remaining === "number") setRemaining(data.remaining);
    if (typeof data?.remaining === "number" && data.remaining <= 0) {
      setShowPaywall(true);
    }
  };

  useEffect(() => {
    fetch("/api/convert", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (typeof data?.remaining === "number") applyUsage(data);
      })
      .catch(() => setRemaining(DAILY_LIMIT));
  }, []);

  const handleConvert = async () => {
    if (!inputCode.trim()) return;

    if (remaining === 0) {
      setShowPaywall(true);
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
        body: JSON.stringify({ sourceLang, targetLang, code: inputCode }),
      });

      const data = await res.json();
      applyUsage(data);

      if (res.status === 429) {
        setShowPaywall(true);
        return;
      }

      if (data.error) throw new Error(data.error);

      setOutputCode(data.convertedCode);
      setExplanation(data.explanation || []);
    } catch (err) {
      alert(err.message || "Error generating conversion. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(outputCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const remainingLabel = remaining === null ? "…" : `${remaining}/${DAILY_LIMIT} remaining`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code2 className="w-6 h-6 text-indigo-400" />
          <span className="font-bold text-lg tracking-tight">CodeShift AI</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
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
            <div className="p-3 border-t border-slate-800 bg-slate-900 flex justify-end">
              <button
                onClick={handleConvert}
                disabled={loading || !inputCode.trim() || remaining === null}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg flex items-center gap-2 transition"
              >
                {loading ? "Translating..." : "Translate Code"}
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-col bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
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
              )}
            </div>
            <textarea
              readOnly
              value={outputCode}
              placeholder="Converted code will appear here..."
              className="flex-1 w-full bg-transparent p-4 font-mono text-sm text-indigo-200 resize-none focus:outline-none min-h-[300px]"
            />
          </div>
        </div>

        {explanation.length > 0 && (
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
            <h3 className="text-sm font-semibold text-indigo-400 mb-2">Key Changes Made:</h3>
            <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
              {explanation.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
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

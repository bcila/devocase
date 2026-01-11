"use client";

import { useState, useEffect, useRef } from "react";
import mermaid from "mermaid";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { saveAs } from "file-saver";

type HistoryItem = {
  id: string;
  input: string;
  mermaid: string;
  timestamp: number;
};

export default function Home() {
  const [input, setInput] = useState("");
  const [mermaidCode, setMermaidCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const diagramRef = useRef<HTMLDivElement>(null);

  // Mermaid config
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      themeVariables: {
        primaryColor: "#0ea5e9",
        primaryTextColor: "#ffffff",
        primaryBorderColor: "#0ea5e9",
        lineColor: "#64748b",
        secondaryColor: "#1e293b",
      },
      flowchart: { curve: "basis" },
    });
  }, []);

  // History
  useEffect(() => {
    const saved = localStorage.getItem("flowchart_history");
    if (saved) {
      try {
        setHistory((JSON.parse(saved) as HistoryItem[]).slice(0, 3));
      } catch {}
    }
  }, []);

  const addToHistory = (inputText: string, code: string) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      input: inputText.slice(0, 80) + (inputText.length > 80 ? "..." : ""),
      mermaid: code,
      timestamp: Date.now(),
    };

    setHistory((prev) => {
      const updated = [newItem, ...prev].slice(0, 3);
      localStorage.setItem("flowchart_history", JSON.stringify(updated));
      return updated;
    });
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: input }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Hata oluştu");

      setMermaidCode(data.mermaid);
      addToHistory(input, data.mermaid);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadPNG = async () => {
    if (!mermaidCode) return;

    try {
      const { svg } = await mermaid.render("mermaid-png-temp", mermaidCode);

      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svg, "image/svg+xml");
      const svgElement = svgDoc.documentElement;

      let viewBox = svgElement.getAttribute("viewBox");
      if (!viewBox) {
        viewBox = "0 0 800 600";
      }

      const [, , vbWidth, vbHeight] = viewBox.split(/\s+/).map(Number);

      const scale = 2;
      const outputWidth = vbWidth * scale;
      const outputHeight = vbHeight * scale;

      const img = new Image();
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context alınamadı");

      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, outputWidth, outputHeight);

      ctx.drawImage(img, 0, 0, outputWidth, outputHeight);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            saveAs(blob, `flowchart-${Date.now()}.png`);
          }
        },
        "image/png",
        1.0
      );
    } catch (err) {
      console.error("PNG oluşturma hatası:", err);
      alert(
        "PNG oluşturulamadı. Lütfen SVG indirmeyi deneyin veya diagramı küçültün."
      );
    }
  };
  const downloadSVG = async () => {
    if (!mermaidCode) return;
    try {
      const { svg } = await mermaid.render("mermaid-svg-download", mermaidCode);
      const blob = new Blob([svg], { type: "image/svg+xml" });
      saveAs(blob, `flowchart-${Date.now()}.svg`);
    } catch {
      alert("SVG indirme hatası");
    }
  };

  const loadFromHistory = (item: HistoryItem) => {
    setInput(item.input);
    setMermaidCode(item.mermaid);
  };

  useEffect(() => {
    if (!mermaidCode) return;

    const container = document.getElementById("mermaid-container");
    if (container) {
      container.innerHTML = "";
      mermaid
        .render("mermaid-diagram", mermaidCode)
        .then(({ svg }) => {
          container.innerHTML = svg;
        })
        .catch((err) => {
          console.error(err);
          container.innerHTML =
            "<p class='text-red-400'>Diagram render edilemedi</p>";
        });
    }
  }, [mermaidCode]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sol: Input + History */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div>
            <h2 className="text-2xl font-bold mb-4">Sürecini Tarif Et</h2>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Örnek: Kullanıcı login olur, başarısızsa hata mesajı alır..."
              className="w-full h-64 p-4 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none font-mono text-sm"
            />
            <button
              onClick={handleSubmit}
              disabled={loading || !input.trim()}
              className="mt-4 w-full py-4 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? "Oluşturuluyor..." : "Şema Oluştur →"}
            </button>

            {error && (
              <div className="mt-4 p-4 bg-red-900/50 rounded-xl">{error}</div>
            )}
          </div>

          {history.length > 0 && (
            <div className="bg-slate-800/70 p-4 rounded-xl border border-slate-700">
              <h3 className="font-semibold mb-3">Son Şemalar</h3>
              <ul className="space-y-2 text-sm">
                {history.map((item) => (
                  <li
                    key={item.id}
                    onClick={() => loadFromHistory(item)}
                    className="p-2 bg-slate-700/50 rounded cursor-pointer hover:bg-slate-600/50 transition"
                  >
                    {item.input}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Sağ: Diagram + Zoom/Pan + İndirme */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="flex gap-3 justify-end">
            {mermaidCode && (
              <>
                <button
                  onClick={downloadPNG}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm"
                >
                  PNG İndir
                </button>
                <button
                  onClick={downloadSVG}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm"
                >
                  SVG İndir
                </button>
              </>
            )}
          </div>

          <div
            ref={diagramRef}
            className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden min-h-[500px] relative"
          >
            {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-cyan-500"></div>
                <p className="text-cyan-400">Akış şeması oluşturuluyor...</p>
              </div>
            ) : mermaidCode ? (
              <TransformWrapper
                initialScale={1}
                minScale={0.3}
                maxScale={5}
                limitToBounds={false}
                wheel={{ step: 0.1 }}
                pinch={{ disabled: false }}
              >
                <TransformComponent
                  wrapperStyle={{ width: "100%", height: "100%" }}
                  contentStyle={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "2rem",
                  }}
                >
                  <div
                    id="mermaid-container"
                    className="bg-white/5 rounded-2xl p-8 min-w-[800px]"
                  />
                </TransformComponent>
              </TransformWrapper>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                Henüz şema yok... Sol taraftan tarif et!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

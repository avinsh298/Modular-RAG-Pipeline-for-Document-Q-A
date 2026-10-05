import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import { 
  Send, 
  UploadCloud, 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  Bot, 
  User, 
  Loader2 
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function App() {
  const [query, setQuery] = useState("");
  const [activeDoc, setActiveDoc] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Welcome! **Please upload a PDF document** on the left to start.\n\n" +
        "Each upload automatically replaces any previous data, ensuring queries are answered exclusively from your active document.",
      isWelcome: true,
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [openSources, setOpenSources] = useState({});

  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const toggleSourceDrawer = (index) => {
    setOpenSources((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!query.trim() || loading || uploading) return;

    const userText = query.trim();

    const conversationHistory = messages
      .filter((m) => !m.isWelcome)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    setMessages((prev) => [...prev, { role: "user", content: userText }]);
    setQuery("");
    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE}/query`, {
        query: userText,
        history: conversationHistory,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.data.answer,
          sources: response.data.sources || [],
        },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Failed to generate answer. Ensure a document is uploaded and backend is running.",
          sources: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith(".pdf")) {
      setUploadStatus("Only PDF documents are supported.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    setUploadStatus(`Indexing "${file.name}"...`);

    try {
      await axios.post(`${API_BASE}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setActiveDoc(file.name);
      setUploadStatus(`Active: ${file.name}`);

      setMessages([
        {
          role: "assistant",
          content: `📄 **"${file.name}" is now indexed!** Earlier documents were cleared.\n\nYou can ask any question about this document.`,
        },
      ]);
    } catch (err) {
      console.error(err);
      setUploadStatus("Upload or indexing failed.");
    } finally {
      setUploading(false);
      e.target.value = null;
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Sidebar */}
      <aside className="w-80 border-r border-slate-800 bg-slate-900/40 p-6 flex flex-col justify-between">
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-600 rounded-lg shadow-md shadow-indigo-500/20">
                <FileText className="w-5 h-5 text-white" />
              </span>
              <h1 className="text-lg font-bold tracking-tight text-white">Modular RAG</h1>
            </div>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Document Question & Answering Engine
            </p>
          </div>

          {/* Upload Card */}
          <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 block">
              Document Upload
            </label>

            <label className={`flex flex-col items-center justify-center border-2 border-dashed border-slate-600 hover:border-indigo-500 rounded-lg p-5 cursor-pointer transition bg-slate-900/50 group ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
              <UploadCloud className="w-8 h-8 text-indigo-400 group-hover:scale-110 transition duration-200 mb-1" />
              <span className="text-xs text-slate-200 font-medium">Upload PDF file</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Replaces previous document</span>
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>

            {uploading && (
              <div className="flex items-center gap-2 text-xs text-indigo-300 animate-pulse bg-indigo-950/40 p-2 rounded-lg border border-indigo-800/50">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Parsing & indexing...</span>
              </div>
            )}
            {uploadStatus && !uploading && (
              <p className="text-xs text-slate-300 break-words bg-slate-900/70 p-2 rounded-lg border border-slate-800">
                {uploadStatus}
              </p>
            )}
          </div>

          <div className="text-[11px] text-slate-500 space-y-1">
            <p>• Parsing: Docling</p>
            <p>• Embeddings: Sentence-Transformers</p>
            <p>• Vector Store: LanceDB</p>
            <p>• Reranker: Cohere Rerank v3.5</p>
            <p>• LLM: Groq</p>
          </div>
        </div>

        {activeDoc && (
          <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-[11px] text-slate-400">
            <span className="text-slate-500 block mb-0.5 font-medium">Currently Loaded:</span>
            <span className="text-slate-200 font-mono break-all">{activeDoc}</span>
          </div>
        )}
      </aside>

      {/* Main Chat Interface */}
      <main className="flex-1 flex flex-col justify-between h-full bg-slate-950">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex gap-3 max-w-3xl ${
                m.role === "user" ? "ml-auto justify-end" : "mr-auto justify-start"
              }`}
            >
              {m.role === "assistant" && (
                <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-indigo-400" />
                </div>
              )}

              <div className="space-y-2 max-w-2xl">
                <div
                  className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-indigo-600 text-white rounded-br-none"
                      : "bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none shadow-sm"
                  }`}
                >
                  {/* Formatted Markdown Rendering */}
                  {m.role === "user" ? (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  ) : (
                    <ReactMarkdown
                      components={{
                        p: ({ node, ...props }) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                        ul: ({ node, ...props }) => <ul className="list-disc pl-5 my-2 space-y-1.5" {...props} />,
                        ol: ({ node, ...props }) => <ol className="list-decimal pl-5 my-2 space-y-1.5" {...props} />,
                        li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
                        strong: ({ node, ...props }) => <strong className="font-semibold text-indigo-300" {...props} />,
                        h3: ({ node, ...props }) => <h3 className="font-bold text-white text-sm my-2" {...props} />,
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  )}
                </div>

                {/* Evidence Citations */}
                {m.sources && m.sources.length > 0 && (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                    <button
                      onClick={() => toggleSourceDrawer(idx)}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-400 hover:text-indigo-400 transition"
                    >
                      <span>Evidence Citations ({m.sources.length} chunks)</span>
                      {openSources[idx] ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {openSources[idx] && (
                      <div className="p-3 pt-0 space-y-2 max-h-60 overflow-y-auto">
                        {m.sources.map((s) => (
                          <div
                            key={s.index}
                            className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-[11px] text-slate-300 font-mono leading-relaxed"
                          >
                            <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-800">
                              <span className="font-semibold text-indigo-400">
                                Chunk #{s.index}
                              </span>
                              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 font-sans">
                                📄 {s.document}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap">{s.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {m.role === "user" && (
                <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0 mt-1">
                  <User className="w-4 h-4 text-slate-300" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 max-w-3xl mr-auto items-center">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
              </div>
              <p className="text-xs text-slate-400 animate-pulse">
                Retrieving chunks and generating answer...
              </p>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Query Input Bar */}
        <form
          onSubmit={handleSend}
          className="p-4 border-t border-slate-800/80 bg-slate-900/60 flex items-center gap-3"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question about the active document..."
            disabled={loading || uploading}
            className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 transition disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || uploading || !query.trim()}
            className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition shadow-md shadow-indigo-600/20"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </main>
    </div>
  );
}
"use client";

import { useState } from "react";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface Preset {
  model: string;
  provider: string;
  messages: unknown;
  temperature: number | null;
}

interface Props {
  projectId: string;
  preset: Preset | null;
}

const PROVIDERS = [
  { value: "openai", label: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"] },
  { value: "anthropic", label: "Anthropic", models: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"] },
  { value: "groq", label: "Groq", models: ["llama-3.1-70b-versatile", "mixtral-8x7b-32768"] },
];

function parseMessages(raw: unknown): Message[] {
  if (Array.isArray(raw)) {
    return raw.map((m: any) => ({
      role: m.role ?? "user",
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    }));
  }
  return [{ role: "user", content: "" }];
}

export default function PlaygroundClient({ projectId, preset }: Props) {
  const [provider, setProvider] = useState(preset?.provider ?? "openai");
  const [model, setModel] = useState(preset?.model ?? "gpt-4o-mini");
  const [temperature, setTemperature] = useState(preset?.temperature ?? 0.7);
  const [messages, setMessages] = useState<Message[]>(parseMessages(preset?.messages));
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const providerInfo = PROVIDERS.find((p) => p.value === provider) ?? PROVIDERS[0];

  function updateMessage(index: number, field: "role" | "content", value: string) {
    const next = [...messages];
    (next[index] as any)[field] = value;
    setMessages(next);
  }

  function addMessage() {
    setMessages([...messages, { role: "user", content: "" }]);
  }

  function removeMessage(index: number) {
    setMessages(messages.filter((_, i) => i !== index));
  }

  async function runPlayground() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const systemMessage = messages.find((m) => m.role === "system");
      const nonSystem = messages.filter((m) => m.role !== "system");

      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/playground/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model,
          messages: provider === "anthropic" ? nonSystem : messages,
          systemPrompt: provider === "anthropic" ? systemMessage?.content : undefined,
          temperature,
          apiKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? data.error ?? "Request failed");
      } else {
        setResult(data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Config panel */}
      <div className="space-y-4">
        <div className="border border-gray-800 rounded-lg p-4 bg-gray-900/40">
          <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Provider</label>
          <select
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value);
              const info = PROVIDERS.find((p) => p.value === e.target.value);
              if (info) setModel(info.models[0]);
            }}
            className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-sm text-gray-100"
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>

          <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 mt-4">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-sm text-gray-100"
          >
            {providerInfo.models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 mt-4">
            Temperature: {temperature.toFixed(2)}
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full"
          />

          <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 mt-4">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={provider === "anthropic" ? "sk-ant-..." : "sk-..."}
            className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-sm text-gray-100 font-mono"
          />
          <p className="text-xs text-gray-600 mt-1">Never stored. Only used for this request.</p>
        </div>

        <div className="border border-gray-800 rounded-lg p-4 bg-gray-900/40">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Messages</label>
            <button onClick={addMessage} className="text-xs text-gray-400 hover:text-gray-200">+ Add</button>
          </div>
          <div className="space-y-2">
            {messages.map((m, i) => (
              <div key={i} className="border border-gray-800 rounded p-2 bg-gray-950">
                <div className="flex items-center gap-2 mb-2">
                  <select
                    value={m.role}
                    onChange={(e) => updateMessage(i, "role", e.target.value)}
                    className="text-xs bg-gray-900 border border-gray-800 rounded px-2 py-1 text-gray-300"
                  >
                    <option value="system">system</option>
                    <option value="user">user</option>
                    <option value="assistant">assistant</option>
                  </select>
                  <div className="flex-1" />
                  {messages.length > 1 && (
                    <button
                      onClick={() => removeMessage(i)}
                      className="text-xs text-gray-600 hover:text-red-400"
                    >
                      remove
                    </button>
                  )}
                </div>
                <textarea
                  value={m.content}
                  onChange={(e) => updateMessage(i, "content", e.target.value)}
                  rows={3}
                  className="w-full bg-transparent border-0 text-sm text-gray-100 font-mono resize-y focus:outline-none"
                  placeholder="Message content..."
                />
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={runPlayground}
          disabled={loading || !apiKey}
          className="w-full bg-green-500 hover:bg-green-400 disabled:bg-gray-800 disabled:text-gray-500 text-black font-bold py-3 rounded transition-colors"
        >
          {loading ? "Running..." : "Run"}
        </button>
      </div>

      {/* Result panel */}
      <div className="space-y-4">
        <div className="border border-gray-800 rounded-lg p-4 bg-gray-900/40 min-h-[200px]">
          <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Response</label>
          {error && <div className="text-sm text-red-400">{error}</div>}
          {!error && !result && <div className="text-sm text-gray-600">Run the call to see the response here.</div>}
          {result && (
            <div>
              <div className="text-sm text-gray-100 whitespace-pre-wrap font-mono bg-gray-950 rounded p-3 border border-gray-800">
                {result.content ?? "(empty)"}
              </div>
              {result.usage && (
                <div className="text-xs text-gray-500 mt-3 flex gap-4">
                  <span>prompt: {result.usage.promptTokens}</span>
                  <span>completion: {result.usage.completionTokens}</span>
                  <span>total: {result.usage.totalTokens}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {result && (
          <details className="border border-gray-800 rounded-lg bg-gray-900/40">
            <summary className="cursor-pointer px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Raw response</summary>
            <pre className="p-4 text-xs font-mono text-gray-400 overflow-auto max-h-96">
              {JSON.stringify(result.response, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

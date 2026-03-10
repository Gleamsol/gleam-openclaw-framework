import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  model?: string;
  tokenUsage?: { input: number; output: number };
}

const AVAILABLE_MODELS = [
  { id: "gpt-5.4", name: "GPT-5.4", tier: "premium", badge: "Default" },
  { id: "minimax-m2.7", name: "MiniMax M2.7", tier: "premium", badge: "" },
  { id: "claude-vertex", name: "Claude Vertex", tier: "premium", badge: "" },
  { id: "gemini-3-flash", name: "Gemini 3 Flash", tier: "standard", badge: "Fast" },
  { id: "minimax-m2.1", name: "MiniMax M2.1", tier: "standard", badge: "Recommended" },
  { id: "kimi-k2.5", name: "Kimi K2.5", tier: "standard", badge: "" },
];

export const AgentConsole: React.FC = () => {
  const { publicKey, connected } = useWallet();
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("gpt-5.4");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([
    "tavily_search",
    "agent_browser",
  ]);

  const SKILLS = [
    { id: "tavily_search", name: "Tavily Search", icon: "🔍" },
    { id: "agent_browser", name: "Agent Browser", icon: "🌐" },
    { id: "rhclaw_multimodal", name: "RHClaw Multimodal", icon: "🎨" },
    { id: "code_executor", name: "Code Executor", icon: "💻" },
    { id: "skill_vetter", name: "Skill Vetter", icon: "✅" },
  ];

  const sendMessage = async () => {
    if (!input.trim() || !connected) return;

    const userMessage: AgentMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: selectedModel,
          input: input,
          skills: selectedSkills,
          credential: publicKey?.toBase58(),
        }),
      });

      const data = await response.json();

      const assistantMessage: AgentMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.data?.result || `Task ${data.data?.taskId} queued for execution.`,
        timestamp: new Date(),
        model: selectedModel,
        tokenUsage: data.data?.tokenUsage,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "system",
          content: `Error: ${error.message}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSkill = (skillId: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skillId)
        ? prev.filter((s) => s !== skillId)
        : [...prev, skillId]
    );
  };

  return (
    <div className="card flex flex-col h-[600px]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Agent Console</h3>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
        >
          {AVAILABLE_MODELS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name} {model.badge ? `(${model.badge})` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Skills selector */}
      <div className="flex flex-wrap gap-2 mb-4">
        {SKILLS.map((skill) => (
          <button
            key={skill.id}
            onClick={() => toggleSkill(skill.id)}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
              selectedSkills.includes(skill.id)
                ? "bg-openclaw-500/20 text-openclaw-400 border border-openclaw-500/30"
                : "bg-gray-800 text-gray-400 border border-gray-700"
            }`}
          >
            {skill.icon} {skill.name}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <p className="text-2xl mb-2">🤖</p>
              <p>Start a conversation with OpenClaw Agent</p>
              <p className="text-sm mt-1">Powered by Solana MEME tokens</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`p-3 rounded-lg ${
              msg.role === "user"
                ? "bg-openclaw-500/10 border border-openclaw-500/20 ml-8"
                : msg.role === "system"
                  ? "bg-red-500/10 border border-red-500/20"
                  : "bg-gray-800 mr-8"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-gray-400">
                {msg.role === "user" ? "You" : msg.role === "assistant" ? "Agent" : "System"}
              </span>
              {msg.model && (
                <span className="text-xs bg-gray-700 px-2 py-0.5 rounded">{msg.model}</span>
              )}
              <span className="text-xs text-gray-600 ml-auto">
                {msg.timestamp.toLocaleTimeString()}
              </span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            {msg.tokenUsage && (
              <p className="text-xs text-gray-500 mt-1">
                Tokens: {msg.tokenUsage.input}↑ {msg.tokenUsage.output}↓
              </p>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="bg-gray-800 p-3 rounded-lg mr-8">
            <div className="flex items-center gap-2">
              <div className="animate-pulse flex gap-1">
                <div className="w-2 h-2 bg-openclaw-500 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-openclaw-500 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                <div className="w-2 h-2 bg-openclaw-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
              </div>
              <span className="text-xs text-gray-400">Agent is thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder={connected ? "Ask OpenClaw Agent anything..." : "Connect wallet to start"}
          disabled={!connected || isLoading}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-openclaw-500 disabled:opacity-50"
        />
        <button
          onClick={sendMessage}
          disabled={!connected || isLoading || !input.trim()}
          className="btn-primary disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
};

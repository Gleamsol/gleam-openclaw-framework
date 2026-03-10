import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { TokenBalance } from "./components/TokenBalance";
import { AgentConsole } from "./components/AgentConsole";

const TIERS = [
  {
    name: "Basic",
    tokens: "1,000+",
    features: ["Gemini 3 Flash", "MiniMax M2.1", "Web Search", "50 calls/day"],
    color: "from-gray-500 to-gray-600",
  },
  {
    name: "Standard",
    tokens: "10,000+",
    features: ["+ Kimi K2.5", "+ MiniMax M2.7", "Code Execution", "500 calls/day"],
    color: "from-openclaw-500 to-openclaw-600",
  },
  {
    name: "Premium",
    tokens: "100,000+",
    features: ["All Models (GPT-5.4)", "All Skills", "Agent Browser", "5,000 calls/day"],
    color: "from-solana-purple to-solana-green",
  },
];

const App: React.FC = () => {
  const { connected, publicKey } = useWallet();
  const [tokenBalance, setTokenBalance] = useState(0);

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-openclaw-500 to-solana-green flex items-center justify-center font-bold text-lg">
              G
            </div>
            <div>
              <h1 className="text-xl font-bold">Gleam OpenClaw</h1>
              <p className="text-xs text-gray-500">Solana-Powered AI Agent Platform</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {connected && (
              <div className="text-right text-sm">
                <p className="text-gray-400">
                  {publicKey?.toBase58().substring(0, 4)}...{publicKey?.toBase58().slice(-4)}
                </p>
                <p className="text-openclaw-400 font-mono">{tokenBalance.toLocaleString()} GLEAM</p>
              </div>
            )}
            <WalletMultiButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {!connected ? (
          /* Landing Section */
          <div className="text-center py-20">
            <h2 className="text-5xl font-bold mb-4 bg-gradient-to-r from-openclaw-400 to-solana-green bg-clip-text text-transparent">
              OpenClaw Agent
            </h2>
            <p className="text-xl text-gray-400 mb-2">
              Pay with Solana MEME tokens. Access powerful AI agents.
            </p>
            <p className="text-gray-500 mb-8 max-w-2xl mx-auto">
              Hold GLEAM tokens to unlock GPT-5.4, MiniMax M2.7, Gemini 3 Flash, Kimi K2.5,
              and more. Powered by the OpenClaw Agent framework with Tavily Search,
              AgentBrowser, and RHClaw multi-modal capabilities.
            </p>
            <WalletMultiButton />

            {/* Tier Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
              {TIERS.map((tier) => (
                <div key={tier.name} className="card-hover text-left">
                  <div className={`w-full h-1 rounded-full bg-gradient-to-r ${tier.color} mb-4`} />
                  <h3 className="text-lg font-bold mb-1">{tier.name}</h3>
                  <p className="text-2xl font-mono text-openclaw-400 mb-4">{tier.tokens}</p>
                  <ul className="space-y-2">
                    {tier.features.map((f) => (
                      <li key={f} className="text-sm text-gray-400 flex items-center gap-2">
                        <span className="text-solana-green">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Dashboard */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <TokenBalance
                tokenMint={import.meta.env.VITE_GLEAM_TOKEN_MINT}
                onBalanceChange={setTokenBalance}
              />

              {/* Quick Stats */}
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">Access Tier</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Current Tier</span>
                    <span className="font-medium text-openclaw-400">
                      {tokenBalance >= 100000
                        ? "Premium"
                        : tokenBalance >= 10000
                          ? "Standard"
                          : tokenBalance >= 1000
                            ? "Basic"
                            : "None"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Daily Calls</span>
                    <span className="font-mono">
                      {tokenBalance >= 100000
                        ? "5,000"
                        : tokenBalance >= 10000
                          ? "500"
                          : tokenBalance >= 1000
                            ? "50"
                            : "0"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Models Available</span>
                    <span className="font-mono">
                      {tokenBalance >= 100000
                        ? "7"
                        : tokenBalance >= 10000
                          ? "4"
                          : tokenBalance >= 1000
                            ? "2"
                            : "0"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <AgentConsole />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-16">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-sm text-gray-500">
          <p>Gleam OpenClaw API Solana Framework v2.0.0 — MIT License</p>
          <p className="mt-1">
            Built with Solana, OpenClaw Agent, GPT-5.4, MiniMax M2.7, Gemini 3 Flash, Kimi K2.5
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;

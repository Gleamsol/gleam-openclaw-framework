import React, { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";

interface TokenInfo {
  mint: string;
  symbol: string;
  balance: string;
  decimals: number;
  uiBalance: number;
}

interface Props {
  tokenMint?: string;
  onBalanceChange?: (balance: number) => void;
}

export const TokenBalance: React.FC<Props> = ({ tokenMint, onBalanceChange }) => {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [solBalance, setSolBalance] = useState<number>(0);

  useEffect(() => {
    if (!publicKey) return;

    const fetchBalances = async () => {
      setLoading(true);
      try {
        // Fetch SOL balance
        const lamports = await connection.getBalance(publicKey);
        setSolBalance(lamports / 1e9);

        // Fetch SPL token accounts
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
          publicKey,
          { programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") }
        );

        const tokenList: TokenInfo[] = tokenAccounts.value.map((account) => {
          const info = account.account.data.parsed.info;
          return {
            mint: info.mint,
            symbol: info.mint.substring(0, 6) + "...",
            balance: info.tokenAmount.amount,
            decimals: info.tokenAmount.decimals,
            uiBalance: info.tokenAmount.uiAmount || 0,
          };
        });

        setTokens(tokenList);

        // Report specific token balance
        if (tokenMint) {
          const target = tokenList.find((t) => t.mint === tokenMint);
          onBalanceChange?.(target?.uiBalance || 0);
        }
      } catch (error) {
        console.error("Failed to fetch balances:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBalances();
    const interval = setInterval(fetchBalances, 30000);
    return () => clearInterval(interval);
  }, [publicKey, connection, tokenMint, onBalanceChange]);

  if (!publicKey) {
    return (
      <div className="card text-center">
        <p className="text-gray-400">Connect your wallet to view balances</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">Token Balances</h3>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-openclaw-500" />
        </div>
      ) : (
        <div className="space-y-3">
          {/* SOL Balance */}
          <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-solana-purple to-solana-green flex items-center justify-center text-xs font-bold">
                SOL
              </div>
              <span className="font-medium">Solana</span>
            </div>
            <span className="font-mono">{solBalance.toFixed(4)} SOL</span>
          </div>

          {/* SPL Tokens */}
          {tokens.map((token) => (
            <div
              key={token.mint}
              className={`flex items-center justify-between p-3 rounded-lg ${
                tokenMint && token.mint === tokenMint
                  ? "bg-openclaw-500/10 border border-openclaw-500/30"
                  : "bg-gray-800"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-openclaw-500/20 flex items-center justify-center text-xs font-bold text-openclaw-400">
                  {token.symbol.substring(0, 3)}
                </div>
                <div>
                  <span className="font-medium text-sm">{token.symbol}</span>
                  <p className="text-xs text-gray-500 font-mono">{token.mint}</p>
                </div>
              </div>
              <span className="font-mono">{token.uiBalance.toLocaleString()}</span>
            </div>
          ))}

          {tokens.length === 0 && (
            <p className="text-gray-500 text-center py-4">No SPL tokens found</p>
          )}
        </div>
      )}
    </div>
  );
};

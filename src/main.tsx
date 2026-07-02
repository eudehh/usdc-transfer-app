/* eslint-disable react-refresh/only-export-components -- this is the app entry file, not a fast-refresh module */
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  http,
  type Address,
  type Hash,
  type TransactionReceipt,
  createPublicClient,
  createWalletClient,
  custom,
  encodeFunctionData,
  formatUnits,
  isAddress,
} from "viem";
import { sepolia } from "viem/chains";
import "viem/window";
import "./pixel.css";

const hasWallet = typeof window !== "undefined" && typeof window.ethereum !== "undefined";

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(),
});

const walletClient = hasWallet
  ? createWalletClient({
      chain: sepolia,
      transport: custom(window.ethereum!),
    })
  : null;

const USDC_CONTRACT_ADDRESS: Address = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const USDC_ABI = [
  {
    constant: false,
    inputs: [
      { name: "_to", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// A tiny pixel-art coin with a $ in the middle, drawn as SVG "pixels".
const COIN_DOLLAR = [
  "..#..",
  ".###.",
  "#.#..",
  ".###.",
  "..#.#",
  ".###.",
  "..#..",
];

function PixelCoin({ size = 22 }: { size?: number }) {
  const cell = 2;
  const ox = 6;
  const oy = 4;
  return (
    <svg
      className="px-coin-svg"
      width={size}
      height={size}
      viewBox="0 0 22 22"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="10" fill="#ffd93d" stroke="#0a0a12" strokeWidth="2" />
      <circle cx="11" cy="11" r="7.5" fill="none" stroke="#d99e1f" strokeWidth="1" />
      {COIN_DOLLAR.flatMap((row, r) =>
        row.split("").map((c, col) =>
          c === "#" ? (
            <rect
              key={`${r}-${col}`}
              x={ox + col * cell}
              y={oy + r * cell}
              width={cell}
              height={cell}
              fill="#7a5200"
            />
          ) : null,
        ),
      )}
    </svg>
  );
}

function shorten(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// USDC has 6 decimals; show a compact, human-friendly number.
function formatUsdc(bal: bigint) {
  return Number(formatUnits(bal, 6)).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

// Turn raw wallet/RPC errors into something a human can act on.
function friendlyError(err: unknown): string {
  const raw = err as { code?: number; message?: string; cause?: { code?: number } };
  const code = raw?.code ?? raw?.cause?.code;
  const msg = raw?.message ?? "Something went wrong.";
  if (code === -32002 || /already pending/i.test(msg)) {
    return "A wallet request is already open. Click the MetaMask icon in your toolbar to approve or dismiss it, then try again.";
  }
  if (code === 4001 || /rejected|denied/i.test(msg)) {
    return "Request was rejected in your wallet.";
  }
  return msg;
}

function Example() {
  const [account, setAccount] = useState<Address>();
  const [chainId, setChainId] = useState<number>();
  const [balance, setBalance] = useState<bigint>();
  const [tab, setTab] = useState<"send" | "receive">("send");
  const [copied, setCopied] = useState(false);
  const [hash, setHash] = useState<Hash>();
  const [receipt, setReceipt] = useState<TransactionReceipt>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const addressInput = React.createRef<HTMLInputElement>();
  const valueInput = React.createRef<HTMLInputElement>();

  const wrongNetwork = account !== undefined && chainId !== undefined && chainId !== sepolia.id;

  const readBalance = (owner: Address) =>
    publicClient.readContract({
      address: USDC_CONTRACT_ADDRESS,
      abi: USDC_ABI,
      functionName: "balanceOf",
      args: [owner],
    });

  // Refresh the Sepolia USDC balance whenever the connected account changes.
  // (Balance is cleared in the disconnect path, so no sync setState needed here.)
  useEffect(() => {
    if (!account) return;
    let active = true;
    readBalance(account)
      .then((bal) => active && setBalance(bal))
      .catch(() => active && setBalance(undefined));
    return () => {
      active = false;
    };
  }, [account]);

  const copyAddress = async () => {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(account);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Couldn't copy automatically — select the address and copy it.");
    }
  };

  // On load, silently restore an already-connected account (no popup).
  useEffect(() => {
    if (!walletClient) return;
    (async () => {
      try {
        const [address] = await walletClient.getAddresses();
        if (address) {
          setAccount(address);
          setChainId(await walletClient.getChainId());
        }
      } catch {
        // ignore — user just isn't connected yet
      }
    })();
  }, []);

  // Keep account + chain in sync when the user switches them in the wallet.
  useEffect(() => {
    const provider = hasWallet ? window.ethereum : undefined;
    if (!provider?.on) return;

    const onChainChanged = (id: string) => setChainId(Number(id));
    const onAccountsChanged = (accounts: string[]) => {
      const next = (accounts[0] as Address | undefined) ?? undefined;
      setAccount(next);
      if (!next) setBalance(undefined);
    };

    provider.on("chainChanged", onChainChanged);
    provider.on("accountsChanged", onAccountsChanged);
    return () => {
      provider.removeListener?.("chainChanged", onChainChanged);
      provider.removeListener?.("accountsChanged", onAccountsChanged);
    };
  }, []);

  const connect = async () => {
    if (!walletClient || busy) return;
    setError(undefined);
    setBusy(true);
    try {
      // Reuse an existing permission if we already have one — avoids a
      // duplicate "already pending" prompt.
      let [address] = await walletClient.getAddresses();
      if (!address) {
        [address] = await walletClient.requestAddresses();
      }
      setAccount(address);
      setChainId(await walletClient.getChainId());
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const switchToSepolia = async () => {
    if (!walletClient) return;
    setError(undefined);
    try {
      await walletClient.switchChain({ id: sepolia.id });
      setChainId(sepolia.id);
    } catch {
      // The chain may not be added to the wallet yet — try adding it, then retry.
      try {
        await walletClient.addChain({ chain: sepolia });
        setChainId(sepolia.id);
      } catch (addErr) {
        setError((addErr as Error).message);
      }
    }
  };

  const sendTransaction = async () => {
    if (!walletClient || !account) return;
    if (wrongNetwork) {
      setError("Wrong network. Switch to Sepolia first.");
      return;
    }
    setError(undefined);
    setReceipt(undefined);
    setHash(undefined);

    const to = addressInput.current?.value ?? "";
    const value = valueInput.current?.value ?? "";

    if (!isAddress(to)) {
      setError("Enter a valid recipient address (0x...).");
      return;
    }
    if (!/^\d+$/.test(value) || BigInt(value) <= 0n) {
      setError("Enter a positive whole USDC amount.");
      return;
    }

    const valueInWei = BigInt(value) * 10n ** 6n; // USDC has 6 decimals

    const data = encodeFunctionData({
      abi: USDC_ABI,
      functionName: "transfer",
      args: [to, valueInWei],
    });

    setBusy(true);
    try {
      const txHash = await walletClient.sendTransaction({
        account,
        to: USDC_CONTRACT_ADDRESS,
        data,
      });
      setHash(txHash);

      const txReceipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      setReceipt(txReceipt);
      readBalance(account).then(setBalance).catch(() => {});
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-stage">
      {account && (
        <div className="px-bubble">
          <div className="px-bubble-head">
            <PixelCoin size={16} />
            <span>YOUR BALANCE</span>
          </div>
          <b className="px-bubble-amount">
            {balance === undefined ? "..." : formatUsdc(balance)} USDC
          </b>
        </div>
      )}

      <div className="px-card">
        <h1 className="px-title">
          <PixelCoin size={30} />
          USDC WALLET
        </h1>
        <p className="px-sub">SEPOLIA TESTNET &middot; SEND & RECEIVE USDC</p>

      {!hasWallet ? (
        // ---- No wallet installed ----
        <>
          <div className="px-status px-status--err">
            NO WALLET DETECTED. INSTALL METAMASK TO CONTINUE.
          </div>
          <div className="px-field" style={{ marginTop: 20 }}>
            <a
              className="px-btn"
              href="https://metamask.io/download/"
              target="_blank"
              rel="noreferrer"
            >
              INSTALL METAMASK
            </a>
          </div>
        </>
      ) : !account ? (
        // ---- Wallet present, not connected ----
        <button className="px-btn" onClick={connect} disabled={busy}>
          {busy ? "CONNECTING..." : "CONNECT WALLET"}
        </button>
      ) : (
        // ---- Connected ----
        <>
          <div className="px-account">
            <span className="px-dot" />
            {shorten(account)}
          </div>

          <div className="px-tabs">
            <button
              className={`px-tab ${tab === "send" ? "px-tab--active" : ""}`}
              onClick={() => setTab("send")}
            >
              SEND
            </button>
            <button
              className={`px-tab ${tab === "receive" ? "px-tab--active" : ""}`}
              onClick={() => setTab("receive")}
            >
              RECEIVE
            </button>
          </div>

          <div className="px-tab-panel">
          {tab === "send" ? (
            <>
              {wrongNetwork && (
                <div className="px-status px-status--pending" style={{ marginTop: 0, marginBottom: 20 }}>
                  WRONG NETWORK (CHAIN {chainId}).
                  <br />
                  THIS APP NEEDS SEPOLIA.
                  <div style={{ marginTop: 12 }}>
                    <button className="px-btn px-btn--warn" onClick={switchToSepolia}>
                      SWITCH TO SEPOLIA
                    </button>
                  </div>
                </div>
              )}

              <div className="px-field">
                <label className="px-label" htmlFor="to">
                  RECIPIENT
                </label>
                <input id="to" className="px-input" ref={addressInput} placeholder="0x..." />
              </div>

              <div className="px-field">
                <label className="px-label" htmlFor="amount">
                  AMOUNT (USDC)
                </label>
                <input id="amount" className="px-input" ref={valueInput} placeholder="10" inputMode="numeric" />
              </div>

              <button
                className="px-btn px-btn--green"
                onClick={sendTransaction}
                disabled={busy || wrongNetwork}
              >
                {busy ? "SENDING..." : "SEND USDC"}
              </button>
            </>
          ) : (
            <>
              <p className="px-label" style={{ marginBottom: 12 }}>
                SHARE THIS ADDRESS TO RECEIVE USDC ON SEPOLIA
              </p>
              <div className="px-receive-addr">{account}</div>
              <button className="px-btn" onClick={copyAddress}>
                {copied ? "COPIED!" : "COPY ADDRESS"}
              </button>
            </>
          )}
          </div>
        </>
      )}

      {/* ---- Status area ---- */}
      {error && <div className="px-status px-status--err">ERROR: {error}</div>}

      {hash && !receipt && (
        <div className="px-status px-status--pending">
          TX SENT<span className="px-blink">_</span>
          <br />
          WAITING FOR CONFIRMATION...
          <br />
          <b>HASH:</b> {hash}
        </div>
      )}

      {receipt && (
          <div className="px-status px-status--ok">
            {receipt.status === "success" ? "TRANSFER CONFIRMED!" : "TRANSFER REVERTED"}
            <br />
            <b>STATUS:</b> {receipt.status}
            <br />
            <b>BLOCK:</b> {receipt.blockNumber.toString()}
          </div>
        )}
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(<Example />);

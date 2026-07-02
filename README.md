# 🪙 USDC Wallet — Pixel Edition

A tiny, retro **pixel-art** dApp for sending and receiving [USDC](https://www.circle.com/usdc) on the **Sepolia testnet**. Connect an injected wallet (MetaMask), check your balance in a floating pixel thought-balloon, and transfer test USDC to any address.

Built with **React + TypeScript + Vite + [viem](https://viem.sh)**.

<p align="center">
  <img src="docs/demo.gif" alt="USDC Wallet pixel-art demo: connect, view balance, receive & copy address, send USDC" width="420" />
</p>

> The demo above is an automated end-to-end test recorded with [Playwright](https://playwright.dev) (wallet + RPC are mocked so the flow runs headlessly).

---

## ✨ Features

- 🔌 **Connect** any injected EIP-1193 wallet (MetaMask, etc.)
- 💰 **Live balance** in a pixel thought-balloon, read straight from the USDC contract
- 📤 **Send** USDC with recipient/amount validation and live tx status (pending → confirmed)
- 📥 **Receive** tab that shows your address with one-click copy-to-clipboard
- 🌐 **Wrong-network guard** — warns and offers a one-click switch to Sepolia
- 🕹️ Fully **pixel-art** UI (`Press Start 2P`, hard shadows, custom SVG coin)

## 🚀 Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173/ in a browser with **MetaMask installed**, switch it to **Sepolia**, and grab some test ETH (for gas) and [test USDC](https://faucet.circle.com/) to try a transfer.

## 🧪 End-to-end test / demo recording

The Playwright test in [`e2e/demo.spec.ts`](e2e/demo.spec.ts) drives the whole flow with a mocked wallet and records a video:

```bash
npx playwright install chromium   # first time only
npm run test:e2e
```

The recorded video lands in `test-results/…/video.webm`. To regenerate the README GIF (requires `ffmpeg`):

```bash
VID=$(find test-results -name '*.webm' | head -1)
ffmpeg -y -i "$VID" -vf "fps=13,scale=480:-1:flags=lanczos,palettegen=stats_mode=diff" /tmp/pal.png
ffmpeg -y -i "$VID" -i /tmp/pal.png -lavfi "fps=13,scale=480:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3" docs/demo.gif
```

## 📦 Deploy for free

This is a static SPA, so any static host works. A few free options:

- **GitHub Pages (set up in this repo):** the workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds and deploys on every push to `main`. Enable it once in **Settings → Pages → Source: GitHub Actions**. Live at:
  **https://eudehh.github.io/usdc-transfer-app/**
- **Vercel:** `npm i -g vercel && vercel` — auto-detects Vite, zero config.
- **Netlify:** connect the repo, build command `npm run build`, publish directory `dist`.
- **Cloudflare Pages:** same build settings as Netlify.

## 🛠️ Tech

| | |
|---|---|
| Framework | React 19 + TypeScript |
| Bundler | Vite |
| Ethereum | viem 2 |
| Network | Sepolia testnet |
| USDC (Sepolia) | [`0x1c7D…7238`](https://sepolia.etherscan.io/address/0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238) |
| E2E | Playwright |

---

> ⚠️ Testnet only. Never send real mainnet funds with this demo.

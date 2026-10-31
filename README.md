# 🪲 PoisonBug — Collectible Card Shop

A trading card shop where the owner photographs and lists cards for sale at custom prices, buyers search for the cards they want at the top of the screen, scroll down a little bit to reveal all cards & prices, and purchase cards with a simple checkout!

## ✨ Features
- **Little Purple Bug at the Very Top**: Interactive purple poison bug mascot right at the crown of the screen.
- **Top Search Bar**: Instant live search across card names, rarities, and descriptions.
- **Scroll-Reveal Cards & Prices**: Hero showcase at the top — scroll down a little bit to reveal all cards for sale and their glowing sale price tags.
- **Owner PIN Protection**: Only the owner can list cards, edit prices, delete cards, or view orders & earnings.
  - **Initial Owner PIN**: `1234` (click **🔑 Change PIN** inside Owner Mode anytime to set your own secret PIN!).
- **Required Photo Upload**: Every listed card requires uploading a photo (automatically compressed for fast loading) with a live trading-card preview.
- **Simple Cart & Checkout**: Visitors can add cards to cart or click **Buy**, complete checkout, and mark cards as **SOLD**.

## 🚀 Run Locally
```bash
npm start
```
Then open `http://localhost:3000` in Google Chrome.

## 🌐 Free Internet Hosting & Custom Domain (`poisonbug.com`)

### Option 1: GitHub Pages (Instant Static Hosting)
Hosted directly from `public/` on GitHub Pages with browser `IndexedDB` persistence.
To attach a custom domain later: go to **Repo Settings → Pages → Custom domain** and enter `poisonbug.com`.

### Option 2: Cloudflare Workers + SQLite Cloud Database (Shared Across All Devices)
To share listed cards, uploaded photos, and orders across **all phones and computers** for free:
```bash
npm run deploy:cloud
```
1. Sign in with a free Cloudflare account when Chrome opens.
2. Cloudflare deploys both the frontend and a permanent SQLite database (`*.workers.dev`).
3. When you buy `poisonbug.com` (or any domain), go to **Cloudflare Dashboard → Workers & Pages → poisonbug → Settings → Domains & Routes → Add Custom Domain** and type `poisonbug.com`!

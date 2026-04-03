# 🧙 Sage Bulk Minting

Simple frontend-only bulk minting + bulk offer for Sage Wallet.

---

## ⚙️ Setup

You **must configure your mint settings** 

File:
```
/app/page.tsx
```
Inside:
```ts
const MINT_CONFIG = { ... }
```
### Required fields:

- `totalSupply`
- `batchSize` 
- `royaltyAddress`
- `royaltyPercent` 
- `did` 
- `baseImageUri`         
- `baseMetadataUri` 
- `licenseUri` 
- `spacescanBase` 

---

## 🔌 WalletConnect Setup

This project uses WalletConnect for Sage RPC.

File:
```
/hooks/use-rpc.ts
```

### Important config:

```ts
const PROJECT_ID = 'YOUR_PROJECT_ID';
const CHAIN_ID = 'chia:testnet';
```

### What to change:

- `PROJECT_ID`
  - You can use the default one OR create your own from WalletConnect
  - Recommended for production

- `CHAIN_ID`
  - `chia:testnet` → for testing
  - `chia:mainnet` → for production 

---

## 🖼️ IPFS Structure (IMPORTANT)

Your IPFS must follow this format:

### Images
```
CID/1.png
CID/2.png
CID/3.png
...
```

Example:
```
https://gateway.lighthouse.storage/ipfs/<CID>/1.png
```
```
https://gateway.pinata.cloud/ipfs/<CID>/1.png
```

### Metadata
```
CID/1.json
CID/2.json
CID/3.json
...
```

Example:
```
https://gateway.lighthouse.storage/ipfs/<CID>/1.json
```
```
https://gateway.pinata.cloud/ipfs/<CID>/1.json
```

⚠️ Make sure:
- Image + metadata numbers match (1 ↔ 1, 2 ↔ 2)
- Metadata contains correct image link
- Files are publicly accessible

---

## 🚀 Features

- Bulk mint NFTs (auto loop)
- Auto confirmation tracking
- Wallet connect (WalletConnect)
- Collection filtering
- Bulk offer creation

---

## 💰 Bulk Offers

- Set price in XCH only
- Creates offers for all minted NFTs
- Saved in browser (localStorage)
- Download as ZIP (`.offer` files)

---

## 🛠️ NFT Generator Tool

👉 [Click Here](https://generatenfts.vercel.app/)

Supported CHIP-0007 and ERC721 (EVM)

---

## 🧠 Notes

- This is **frontend-only** (no backend)
- Uses WalletConnect + Sage RPC
- Creating offer file need 1/1 sign wallet
- Works in Sage mobile or desktop
- This is not really perfect tools
---

## 📦 Usage

```bash
npm install
npm run dev
```

---

## ❤️

👉 [Support Me](https://mintgarden.io/profile/kirteria-%E2%9A%A1%EF%B8%8F-6ef2cb6c498cdff91dd4ff26d22216ca69773eb5cb6be5cdf3ddc7ff03f96a7b?tab=collections)

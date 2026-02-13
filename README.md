# SoundMint — Music NFT Platform for Artists

A complete dashboard for music artists to upload songs, convert them to NFTs, and sell them using custom tokens on the **Base** network (Coinbase L2). Built with **Thirdweb SDK v5**.

## Features

- **Upload & Mint Music NFTs** — Upload audio + cover art to IPFS, mint as ERC-1155 NFTs on Base
- **Custom Artist Token** — Deploy your own ERC-20 fan token on Base
- **Marketplace** — List NFTs for sale in ETH or your custom token
- **Sales Tracking** — Full history with on-chain transaction links
- **Audio Player** — Built-in player for previewing tracks
- **Token Airdrop** — Send tokens to fans/collaborators
- **Responsive Design** — Works on desktop, tablet, and mobile
- **WordPress Plugin** — Drop-in plugin with admin panel and shortcodes

## Versions

### 1. Standalone Dashboard (`standalone/`)

A single-page application that runs in any browser — no backend required.

```
standalone/
├── index.html          # Full SPA with 7 pages
├── css/dashboard.css   # Responsive dark theme with Base branding
└── js/app.js           # Complete engine (wallet, IPFS, minting, tokens, marketplace, player)
```

**Quick Start:**
```bash
# Just open in a browser
open standalone/index.html

# Or serve locally
npx serve standalone/
```

### 2. WordPress Plugin (`wordpress-plugin/`)

Full WordPress plugin with admin settings, database tables, and shortcodes.

```
wordpress-plugin/
├── soundmint.php                    # Main plugin file
├── templates/dashboard.php          # Frontend dashboard template
└── assets/
    ├── css/
    │   ├── admin.css                # WP admin styles
    │   └── dashboard.css            # Frontend styles (scoped)
    └── js/
        └── app.js                   # WP-adapted JS engine
```

**Installation:**
1. Download `soundmint.zip`
2. Go to **WordPress Admin → Plugins → Add New → Upload Plugin**
3. Upload the ZIP and activate
4. Go to **SoundMint → Settings** to configure:
   - Network (Base Mainnet or Sepolia testnet)
   - Thirdweb Client ID
   - Owner wallet address
   - Contract addresses (optional — can deploy from dashboard)

**Shortcodes:**
| Shortcode | Description |
|-----------|-------------|
| `[soundmint_dashboard]` | Full artist dashboard |
| `[soundmint_upload]` | Upload & mint form |
| `[soundmint_gallery]` | NFT gallery grid |
| `[soundmint_marketplace]` | Sell/list NFTs |
| `[soundmint_token]` | Token deploy/manage |
| `[soundmint_player]` | Audio player |

## Configuration

### Thirdweb Setup
1. Create an account at [thirdweb.com](https://thirdweb.com)
2. Create a project and get your **Client ID**
3. Enter it in Settings (standalone or WP admin)

### Smart Contracts
Deploy these on Base via [thirdweb.com/explore](https://thirdweb.com/explore):

| Contract | Type | Purpose |
|----------|------|---------|
| NFT Collection | ERC-1155 (TokenERC1155) | Store music NFTs |
| Marketplace | MarketplaceV3 | List & sell NFTs |
| Artist Token | ERC-20 (TokenERC20) | Custom fan token |

Or deploy directly from the dashboard (requires Thirdweb Client ID).

### Network
- **Base Mainnet** — Chain ID 8453, RPC: `https://mainnet.base.org`
- **Base Sepolia** — Chain ID 84532, RPC: `https://sepolia.base.org`

## Tech Stack

- **Blockchain**: Base (Coinbase L2) — EVM compatible
- **NFT Standard**: ERC-1155 (multi-edition)
- **Token Standard**: ERC-20
- **SDK**: Thirdweb v5 (CDN)
- **Storage**: IPFS via Thirdweb Storage
- **Wallet**: MetaMask / any injected Web3 wallet
- **Frontend**: Vanilla JS SPA, CSS3 with custom properties
- **WordPress**: PHP 7.4+, WP 5.8+, custom DB tables

## Owner Wallet

```
0xd46d5E0EBC17FAc1cb37e894A77F7d75A69Da944
```

## Project Structure

```
music-nft-platform/
├── README.md
├── standalone/
│   ├── index.html
│   ├── css/dashboard.css
│   └── js/app.js
└── wordpress-plugin/
    ├── soundmint.php
    ├── templates/dashboard.php
    └── assets/
        ├── css/
        │   ├── admin.css
        │   └── dashboard.css
        └── js/
            └── app.js
```

## License

MIT — Built by Digital Prophets

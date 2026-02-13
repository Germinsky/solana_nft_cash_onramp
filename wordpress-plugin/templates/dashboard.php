<?php
/**
 * SoundMint Full Dashboard Template
 * Used by [soundmint_dashboard] shortcode
 */
if (!defined('ABSPATH')) exit;

$network = get_option('soundmint_network', 'base-sepolia');
$primary = esc_attr(get_option('soundmint_primary_color', '#0052FF'));
$accent = esc_attr(get_option('soundmint_accent_color', '#8B5CF6'));
?>
<style>
    .soundmint-wp-wrap { --base-blue: <?php echo $primary; ?>; --accent-purple: <?php echo $accent; ?>; }
</style>

<div class="soundmint-wp-wrap" id="soundmint-app">
    <div class="toast-container" id="toastContainer"></div>

    <!-- Inline Sidebar Navigation -->
    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:24px; padding:12px; background:var(--bg-card, #1A1B23); border-radius:12px; border:1px solid var(--border-color, #2A2B35);">
        <button class="btn btn-primary btn-sm" data-page="dashboard">📊 Dashboard</button>
        <button class="btn btn-secondary btn-sm" data-page="upload">⬆️ Upload</button>
        <button class="btn btn-secondary btn-sm" data-page="my-nfts">💿 My NFTs</button>
        <button class="btn btn-secondary btn-sm" data-page="marketplace">🏪 Sell</button>
        <button class="btn btn-secondary btn-sm" data-page="sales">💰 Sales</button>
        <button class="btn btn-secondary btn-sm" data-page="token">🪙 Token</button>
        <button class="btn btn-secondary btn-sm" data-page="settings">⚙️ Settings</button>
        <div style="flex:1;"></div>
        <button class="btn btn-primary btn-sm" id="wp-connect-btn" onclick="MusicNFT.connectWallet()">Connect Wallet</button>
        <span class="btn btn-secondary btn-sm" style="pointer-events:none;">🔵 <?php echo esc_html($network === 'base' ? 'Base Mainnet' : 'Base Sepolia'); ?></span>
    </div>

    <!-- DASHBOARD PAGE -->
    <div class="page" id="page-dashboard">
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon blue">🎵</div>
                <div class="stat-value" id="statSongs">0</div>
                <div class="stat-label">Songs Uploaded</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon purple">💿</div>
                <div class="stat-value" id="statNFTs">0</div>
                <div class="stat-label">NFTs Minted</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon pink">💰</div>
                <div class="stat-value" id="statRevenue">0 ETH</div>
                <div class="stat-label">Total Revenue</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon green">🪙</div>
                <div class="stat-value" id="statTokenSupply">0</div>
                <div class="stat-label">Token Supply</div>
            </div>
        </div>

        <div class="grid-2">
            <div class="card">
                <div class="card-header"><h3>Recent Uploads</h3></div>
                <div class="card-body" id="recentUploads">
                    <p class="text-muted text-center" style="padding:40px 0;">No songs uploaded yet.</p>
                </div>
            </div>
            <div class="card">
                <div class="card-header"><h3>Recent Sales</h3></div>
                <div class="card-body" id="recentSales">
                    <p class="text-muted text-center" style="padding:40px 0;">No sales yet.</p>
                </div>
            </div>
        </div>
    </div>

    <!-- UPLOAD PAGE -->
    <div class="page hidden" id="page-upload">
        <div class="card">
            <div class="card-header"><h3>🎵 Upload & Mint Music NFT</h3></div>
            <div class="card-body">
                <div class="form-group">
                    <label class="form-label">Audio File <span class="required">*</span></label>
                    <div class="upload-zone" id="audioUploadZone">
                        <div class="upload-icon">🎶</div>
                        <div class="upload-text"><h4>Drop audio file here</h4><p>MP3, WAV, FLAC — Max 50MB</p></div>
                        <input type="file" id="audioFile" accept="audio/*">
                    </div>
                    <div id="audioPreview" class="hidden"></div>
                </div>
                <div class="form-group">
                    <label class="form-label">Cover Art <span class="required">*</span></label>
                    <div class="upload-zone" id="coverUploadZone">
                        <div class="upload-icon">🎨</div>
                        <div class="upload-text"><h4>Drop artwork here</h4><p>PNG, JPG — 1000x1000 recommended</p></div>
                        <input type="file" id="coverFile" accept="image/*">
                    </div>
                    <div id="coverPreview" class="hidden"></div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Song Title <span class="required">*</span></label>
                        <input type="text" class="form-input" id="songTitle" placeholder="Song title" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Artist Name <span class="required">*</span></label>
                        <input type="text" class="form-input" id="artistName" placeholder="Artist name" required>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Description</label>
                    <textarea class="form-textarea" id="songDescription" placeholder="Tell the story..."></textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Genre</label>
                        <select class="form-select" id="songGenre">
                            <option value="">Select</option>
                            <option value="hip-hop">Hip Hop</option>
                            <option value="rnb">R&B</option>
                            <option value="pop">Pop</option>
                            <option value="rock">Rock</option>
                            <option value="electronic">Electronic</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Editions</label>
                        <input type="number" class="form-input" id="editions" value="100" min="1">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Price (ETH)</label>
                        <input type="number" class="form-input" id="nftPrice" value="0.01" step="0.001">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Royalty %</label>
                        <input type="number" class="form-input" id="royaltyPercent" value="10" min="0" max="50">
                    </div>
                </div>
                <div class="form-group">
                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                        <input type="checkbox" id="enableTokenPayment"> Accept artist token payment
                    </label>
                </div>
                <div class="form-group hidden" id="tokenPriceGroup">
                    <label class="form-label">Token Price</label>
                    <input type="number" class="form-input" id="tokenPrice" value="100" min="1">
                </div>
                <div id="mintProgress" class="hidden" style="margin-bottom:20px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                        <span class="form-label" style="margin:0;">Progress</span>
                        <span id="mintProgressText">0%</span>
                    </div>
                    <div class="progress-bar"><div class="progress" id="mintProgressBar" style="width:0%;"></div></div>
                    <div class="form-hint" id="mintStatusText">Preparing...</div>
                </div>
                <div style="display:flex;gap:12px;">
                    <button class="btn btn-primary btn-lg" id="mintBtn" onclick="MusicNFT.mintNFT()">🎵 Mint Music NFT</button>
                    <button class="btn btn-secondary btn-lg" onclick="MusicNFT.previewNFT()">👁️ Preview</button>
                </div>
            </div>
        </div>
    </div>

    <!-- MY NFTs PAGE -->
    <div class="page hidden" id="page-my-nfts">
        <div class="section-header">
            <h3>My Music NFTs</h3>
            <button class="btn btn-primary" data-page="upload">+ Upload New</button>
        </div>
        <div class="nft-grid" id="nftGrid">
            <p class="text-muted text-center" style="grid-column:1/-1;padding:60px 0;">No NFTs yet.</p>
        </div>
    </div>

    <!-- MARKETPLACE PAGE -->
    <div class="page hidden" id="page-marketplace">
        <div class="card" style="margin-bottom:24px;">
            <div class="card-header"><h3>Create Listing</h3></div>
            <div class="card-body">
                <div class="form-group">
                    <label class="form-label">Select NFT</label>
                    <select class="form-select" id="listNftSelect"><option value="">Choose NFT...</option></select>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Currency</label>
                        <select class="form-select" id="saleCurrency">
                            <option value="eth">ETH (Base)</option>
                            <option value="custom">Artist Token</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Price</label>
                        <input type="number" class="form-input" id="listingPrice" value="0.01" step="0.001">
                    </div>
                </div>
                <input type="hidden" id="saleType" value="fixed">
                <div class="form-group">
                    <label class="form-label">Quantity</label>
                    <input type="number" class="form-input" id="listingQty" value="1" min="1">
                </div>
                <button class="btn btn-primary" onclick="MusicNFT.createListing()">🏷️ Create Listing</button>
            </div>
        </div>
        <div class="card">
            <div class="card-header"><h3>Active Listings</h3></div>
            <div class="card-body" id="activeListings">
                <p class="text-muted text-center" style="padding:40px;">No listings yet.</p>
            </div>
        </div>
    </div>

    <!-- SALES PAGE -->
    <div class="page hidden" id="page-sales">
        <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);">
            <div class="stat-card"><div class="stat-icon green">💰</div><div class="stat-value" id="totalSalesValue">0 ETH</div><div class="stat-label">Total Sales</div></div>
            <div class="stat-card"><div class="stat-icon blue">🛒</div><div class="stat-value" id="totalSalesCount">0</div><div class="stat-label">Items Sold</div></div>
            <div class="stat-card"><div class="stat-icon purple">👥</div><div class="stat-value" id="uniqueBuyers">0</div><div class="stat-label">Unique Buyers</div></div>
        </div>
        <div class="card">
            <div class="card-body">
                <table class="data-table">
                    <thead><tr><th>Song</th><th>Buyer</th><th>Price</th><th>Currency</th><th>Date</th><th>TX</th></tr></thead>
                    <tbody id="salesTableBody">
                        <tr><td colspan="6" class="text-center text-muted" style="padding:40px;">No sales yet</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- TOKEN PAGE -->
    <div class="page hidden" id="page-token">
        <div id="tokenInfo" class="hidden">
            <div class="token-card" style="margin-bottom:24px;">
                <div class="token-icon" id="tokenIconDisplay">🪙</div>
                <div class="token-details">
                    <div class="token-name" id="tokenNameDisplay">—</div>
                    <div class="token-symbol" id="tokenSymbolDisplay">—</div>
                    <div class="token-supply" id="tokenSupplyDisplay">Supply: —</div>
                </div>
                <div>
                    <div class="form-label">Contract</div>
                    <div id="tokenContractDisplay" style="font-size:12px;">—</div>
                </div>
            </div>
            <div class="grid-2">
                <div class="card">
                    <div class="card-header"><h3>Mint Tokens</h3></div>
                    <div class="card-body">
                        <div class="form-group">
                            <label class="form-label">Amount</label>
                            <input type="number" class="form-input" id="mintTokenAmount" value="1000" min="1">
                        </div>
                        <button class="btn btn-primary" onclick="MusicNFT.mintTokens()">🪙 Mint</button>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header"><h3>Airdrop</h3></div>
                    <div class="card-body">
                        <div class="form-group">
                            <label class="form-label">Recipient Address</label>
                            <input type="text" class="form-input" id="airdropAddress" placeholder="0x...">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Amount</label>
                            <input type="number" class="form-input" id="airdropAmount" value="100" min="1">
                        </div>
                        <button class="btn btn-accent" onclick="MusicNFT.airdropTokens()">🎁 Airdrop</button>
                    </div>
                </div>
            </div>
        </div>
        <div id="deployToken">
            <div class="card">
                <div class="card-header"><h3>Deploy Artist Token</h3></div>
                <div class="card-body">
                    <p class="text-muted" style="margin-bottom:24px;">Create your own ERC-20 token on Base. Fans use it to buy your music NFTs!</p>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Token Name</label>
                            <input type="text" class="form-input" id="tokenName" placeholder="e.g. Artist Coin">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Symbol</label>
                            <input type="text" class="form-input" id="tokenSymbol" placeholder="e.g. ART" maxlength="6" style="text-transform:uppercase;">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Initial Supply</label>
                            <input type="number" class="form-input" id="tokenInitialSupply" value="1000000" min="1">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Description</label>
                            <input type="text" class="form-input" id="tokenDescription" placeholder="My fanbase token">
                        </div>
                    </div>
                    <div id="deployProgress" class="hidden" style="margin-bottom:20px;">
                        <div class="progress-bar"><div class="progress" id="deployProgressBar" style="width:0%;"></div></div>
                        <div class="form-hint" id="deployStatusText">Deploying...</div>
                    </div>
                    <button class="btn btn-primary btn-lg" onclick="MusicNFT.deployToken()">🚀 Deploy on Base</button>
                </div>
            </div>
        </div>
    </div>

    <!-- SETTINGS PAGE -->
    <div class="page hidden" id="page-settings">
        <div class="card" style="margin-bottom:24px;">
            <div class="card-header"><h3>Artist Profile</h3></div>
            <div class="card-body">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Artist Name</label>
                        <input type="text" class="form-input" id="settingArtistName" placeholder="Your name">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Email</label>
                        <input type="email" class="form-input" id="settingEmail" placeholder="you@example.com">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Bio</label>
                    <textarea class="form-textarea" id="settingBio" placeholder="About you..."></textarea>
                </div>
                <button class="btn btn-primary" onclick="MusicNFT.saveSettings()">💾 Save</button>
            </div>
        </div>
        <div class="card">
            <div class="card-header"><h3>Thirdweb</h3></div>
            <div class="card-body">
                <div class="form-group">
                    <label class="form-label">Client ID</label>
                    <input type="text" class="form-input" id="settingClientId" placeholder="Thirdweb Client ID">
                </div>
                <button class="btn btn-primary" onclick="MusicNFT.saveThirdwebConfig()">💾 Save</button>
            </div>
        </div>
        <div class="card" style="margin-top:24px;">
            <div class="card-header"><h3>Contracts</h3></div>
            <div class="card-body">
                <div class="form-group">
                    <label class="form-label">NFT Collection (ERC-1155)</label>
                    <input type="text" class="form-input" id="settingNftContract" placeholder="0x...">
                </div>
                <div class="form-group">
                    <label class="form-label">Marketplace</label>
                    <input type="text" class="form-input" id="settingMarketplaceContract" placeholder="0x...">
                </div>
                <div class="form-group">
                    <label class="form-label">Artist Token (ERC-20)</label>
                    <input type="text" class="form-input" id="settingTokenContract" placeholder="0x...">
                </div>
                <button class="btn btn-primary" onclick="MusicNFT.saveContracts()">💾 Save</button>
            </div>
        </div>
    </div>

    <!-- Preview Modal -->
    <div class="modal-overlay" id="previewModal">
        <div class="modal">
            <div class="modal-header"><h3>NFT Preview</h3><button class="modal-close" onclick="MusicNFT.closeModal('previewModal')">✕</button></div>
            <div class="modal-body" id="previewContent"></div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="MusicNFT.closeModal('previewModal')">Close</button>
                <button class="btn btn-primary" onclick="MusicNFT.mintNFT()">🎵 Mint</button>
            </div>
        </div>
    </div>

    <!-- Audio Player -->
    <div class="audio-player" id="audioPlayer" style="position:relative;left:0;border-radius:12px;margin-top:24px;transform:none;">
        <div class="now-playing">
            <div class="thumb" id="playerThumb">🎵</div>
            <div><div style="font-weight:600;" id="playerTitle">—</div><div style="font-size:12px;color:var(--text-muted);" id="playerArtist">—</div></div>
        </div>
        <div class="controls">
            <button class="play-pause" id="playerPlayBtn" onclick="MusicNFT.playerToggle()">▶</button>
        </div>
        <div class="progress-container">
            <div class="progress-bar" onclick="MusicNFT.playerSeek(event)"><div class="progress" id="playerProgress"></div></div>
        </div>
        <div class="time" id="playerTime">0:00 / 0:00</div>
    </div>

    <audio id="audioElement"></audio>
</div>

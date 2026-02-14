/**
 * SoundMint — Music NFT Platform for Artists (WordPress Version)
 * Network: Base (Chain ID 8453) / Base Sepolia (Chain ID 84532)
 * Powered by Thirdweb SDK v5
 * Reads configuration from soundmintWPConfig (wp_localize_script)
 */

const MusicNFT = (() => {
    'use strict';

    // ===================== CONFIGURATION =====================
    // Merge WordPress config with defaults
    const wpCfg = (typeof soundmintWPConfig !== 'undefined') ? soundmintWPConfig : {};

    const CONFIG = {
        OWNER_WALLET: wpCfg.ownerWallet || '0xd46d5E0EBC17FAc1cb37e894A77F7d75A69Da944',
        BASE_CHAIN_ID: 8453,
        BASE_SEPOLIA_CHAIN_ID: 84532,
        BASE_RPC: 'https://mainnet.base.org',
        BASE_SEPOLIA_RPC: 'https://sepolia.base.org',
        BASE_EXPLORER: 'https://basescan.org',
        BASE_SEPOLIA_EXPLORER: 'https://sepolia.basescan.org',
        USE_TESTNET: (wpCfg.network === 'base-sepolia'),
        THIRDWEB_CLIENT_ID: wpCfg.thirdwebClientId || '',
        NFT_CONTRACT: wpCfg.nftContract || '',
        MARKETPLACE_CONTRACT: wpCfg.marketplaceContract || '',
        TOKEN_CONTRACT: wpCfg.tokenContract || '',
        AJAX_URL: wpCfg.ajaxUrl || '/wp-admin/admin-ajax.php',
        NONCE: wpCfg.nonce || '',
        SUPPORTED_AUDIO: ['.mp3', '.wav', '.flac', '.aac'],
        MAX_FILE_SIZE: 50 * 1024 * 1024,
        IPFS_GATEWAY: 'https://ipfs.io/ipfs/',
    };

    // ===================== STATE =====================
    const state = {
        wallet: null,
        signer: null,
        address: null,
        thirdwebSDK: null,
        nftContract: null,
        marketplaceContract: null,
        tokenContract: null,
        songs: JSON.parse(localStorage.getItem('soundmint_songs') || '[]'),
        listings: JSON.parse(localStorage.getItem('soundmint_listings') || '[]'),
        sales: JSON.parse(localStorage.getItem('soundmint_sales') || '[]'),
        tokenConfig: JSON.parse(localStorage.getItem('soundmint_token') || 'null'),
        settings: JSON.parse(localStorage.getItem('soundmint_settings') || '{}'),
        audioFile: null,
        coverFile: null,
        currentAudio: null,
        isPlaying: false,
    };

    // Populate settings from WP config
    if (CONFIG.THIRDWEB_CLIENT_ID) state.settings.thirdwebClientId = CONFIG.THIRDWEB_CLIENT_ID;
    if (CONFIG.NFT_CONTRACT) state.settings.nftContract = CONFIG.NFT_CONTRACT;
    if (CONFIG.MARKETPLACE_CONTRACT) state.settings.marketplaceContract = CONFIG.MARKETPLACE_CONTRACT;
    if (CONFIG.TOKEN_CONTRACT) state.settings.tokenContract = CONFIG.TOKEN_CONTRACT;

    // ===================== HELPERS =====================
    function getRoot() { return document.getElementById('soundmint-app'); }
    function $(sel) {
        const r = getRoot();
        return (r && r.querySelector(sel)) || document.querySelector(sel);
    }
    function $$(sel) {
        const r = getRoot();
        return r ? r.querySelectorAll(sel) : document.querySelectorAll(sel);
    }
    function byId(id) { return document.getElementById(id); }

    function getChainId() {
        return CONFIG.USE_TESTNET ? CONFIG.BASE_SEPOLIA_CHAIN_ID : CONFIG.BASE_CHAIN_ID;
    }

    function getRPC() {
        return CONFIG.USE_TESTNET ? CONFIG.BASE_SEPOLIA_RPC : CONFIG.BASE_RPC;
    }

    function getExplorer() {
        return CONFIG.USE_TESTNET ? CONFIG.BASE_SEPOLIA_EXPLORER : CONFIG.BASE_EXPLORER;
    }

    function shortAddr(addr) {
        if (!addr) return '—';
        return addr.slice(0, 6) + '...' + addr.slice(-4);
    }

    function formatDate(ts) {
        return new Date(ts).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function saveState() {
        localStorage.setItem('soundmint_songs', JSON.stringify(state.songs));
        localStorage.setItem('soundmint_listings', JSON.stringify(state.listings));
        localStorage.setItem('soundmint_sales', JSON.stringify(state.sales));
        if (state.tokenConfig) {
            localStorage.setItem('soundmint_token', JSON.stringify(state.tokenConfig));
        }
        localStorage.setItem('soundmint_settings', JSON.stringify(state.settings));
    }

    // WordPress AJAX helper
    async function wpAjax(action, data = {}) {
        if (!CONFIG.AJAX_URL) return null;
        const formData = new FormData();
        formData.append('action', action);
        formData.append('nonce', CONFIG.NONCE);
        Object.entries(data).forEach(([k, v]) => {
            formData.append(k, typeof v === 'object' ? JSON.stringify(v) : v);
        });
        try {
            const resp = await fetch(CONFIG.AJAX_URL, { method: 'POST', body: formData });
            return await resp.json();
        } catch (e) {
            console.warn('WP AJAX error:', e);
            return null;
        }
    }

    // ===================== TOAST NOTIFICATIONS =====================
    function toast(message, type = 'info') {
        const container = $('#toastContainer');
        if (!container) return;
        const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.innerHTML = `
            <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
            <span class="toast-message">${message}</span>
        `;
        container.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 5000);
    }

    // ===================== NAVIGATION =====================
    function initNavigation() {
        $$(  '[data-page]').forEach(el => {
            el.addEventListener('click', () => navigateTo(el.dataset.page));
        });
    }

    function navigateTo(page) {
        $$('.page').forEach(p => p.classList.add('hidden'));
        const target = $(`#page-${page}`);
        if (target) target.classList.remove('hidden');

        // Update nav button styles
        $$('[data-page]').forEach(b => {
            if (b.dataset.page === page) {
                b.classList.remove('btn-secondary');
                b.classList.add('btn-primary');
            } else {
                b.classList.remove('btn-primary');
                b.classList.add('btn-secondary');
            }
        });

        if (page === 'dashboard') refreshDashboard();
        if (page === 'my-nfts') renderNFTGrid();
        if (page === 'marketplace') refreshMarketplace();
        if (page === 'sales') renderSalesHistory();
        if (page === 'token') refreshTokenPage();
    }

    // ===================== WALLET CONNECTION =====================
    async function connectWallet() {
        try {
            if (!window.ethereum) {
                toast('Please install MetaMask or a Web3 wallet', 'error');
                window.open('https://metamask.io/', '_blank');
                return;
            }

            toast('Connecting wallet...', 'info');

            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            state.address = accounts[0];

            await switchToBase();

            const btn = $('#wp-connect-btn');
            if (btn) {
                btn.textContent = shortAddr(state.address);
                btn.classList.remove('btn-primary');
                btn.classList.add('btn-secondary');
            }

            toast(`Connected: ${shortAddr(state.address)}`, 'success');
            await initThirdweb();

            window.ethereum.on('accountsChanged', (accs) => {
                state.address = accs[0] || null;
                if (!state.address) {
                    if (btn) { btn.textContent = 'Connect Wallet'; btn.classList.add('btn-primary'); btn.classList.remove('btn-secondary'); }
                } else {
                    if (btn) btn.textContent = shortAddr(state.address);
                    toast(`Account changed: ${shortAddr(state.address)}`, 'info');
                }
            });

            window.ethereum.on('chainChanged', () => window.location.reload());
            refreshDashboard();
        } catch (err) {
            console.error('Wallet connection failed:', err);
            toast('Wallet connection failed: ' + err.message, 'error');
        }
    }

    async function switchToBase() {
        const chainId = '0x' + getChainId().toString(16);
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId }],
            });
        } catch (switchError) {
            if (switchError.code === 4902) {
                const isTestnet = CONFIG.USE_TESTNET;
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId,
                        chainName: isTestnet ? 'Base Sepolia' : 'Base',
                        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                        rpcUrls: [getRPC()],
                        blockExplorerUrls: [getExplorer()],
                    }],
                });
            } else {
                throw switchError;
            }
        }
    }

    // ===================== THIRDWEB SDK =====================
    async function initThirdweb() {
        try {
            const clientId = state.settings.thirdwebClientId || CONFIG.THIRDWEB_CLIENT_ID || localStorage.getItem('soundmint_tw_clientId');
            if (!clientId) {
                toast('Set your Thirdweb Client ID in Settings', 'warning');
                return;
            }

            if (typeof thirdweb !== 'undefined' && thirdweb.createThirdwebClient) {
                state.thirdwebSDK = thirdweb.createThirdwebClient({ clientId });
                console.log('Thirdweb SDK v5 initialized');
                await loadContracts();
            }
        } catch (err) {
            console.error('Thirdweb init error:', err);
        }
    }

    async function loadContracts() {
        const nftAddr = state.settings.nftContract;
        const marketAddr = state.settings.marketplaceContract;
        const tokenAddr = state.settings.tokenContract || (state.tokenConfig && state.tokenConfig.address);
        if (nftAddr) console.log('NFT contract:', nftAddr);
        if (marketAddr) console.log('Marketplace contract:', marketAddr);
        if (tokenAddr) console.log('Token contract:', tokenAddr);
    }

    // ===================== FILE UPLOADS =====================
    function initFileUploads() {
        const audioInput = $('#audioFile');
        const audioZone = $('#audioUploadZone');
        if (audioInput) {
            audioInput.addEventListener('change', (e) => handleFileSelect(e.target.files[0], 'audio'));
        }
        ['dragover', 'dragenter'].forEach(evt => {
            if (audioZone) audioZone.addEventListener(evt, (e) => { e.preventDefault(); audioZone.classList.add('drag-over'); });
        });
        ['dragleave', 'drop'].forEach(evt => {
            if (audioZone) audioZone.addEventListener(evt, (e) => { e.preventDefault(); audioZone.classList.remove('drag-over'); });
        });

        const coverInput = $('#coverFile');
        const coverZone = $('#coverUploadZone');
        if (coverInput) {
            coverInput.addEventListener('change', (e) => handleFileSelect(e.target.files[0], 'cover'));
        }
        ['dragover', 'dragenter'].forEach(evt => {
            if (coverZone) coverZone.addEventListener(evt, (e) => { e.preventDefault(); coverZone.classList.add('drag-over'); });
        });
        ['dragleave', 'drop'].forEach(evt => {
            if (coverZone) coverZone.addEventListener(evt, (e) => { e.preventDefault(); coverZone.classList.remove('drag-over'); });
        });

        const tokenPayCb = $('#enableTokenPayment');
        if (tokenPayCb) {
            tokenPayCb.addEventListener('change', () => {
                const group = $('#tokenPriceGroup');
                if (tokenPayCb.checked) group.classList.remove('hidden');
                else group.classList.add('hidden');
            });
        }
    }

    function handleFileSelect(file, type) {
        if (!file) return;
        if (file.size > CONFIG.MAX_FILE_SIZE) {
            toast(`File too large. Max ${formatFileSize(CONFIG.MAX_FILE_SIZE)}`, 'error');
            return;
        }

        if (type === 'audio') {
            state.audioFile = file;
            const preview = $('#audioPreview');
            if (preview) {
                preview.classList.remove('hidden');
                preview.innerHTML = `
                    <div class="upload-preview">
                        <div class="file-icon">🎵</div>
                        <div class="file-info">
                            <div class="file-name">${file.name}</div>
                            <div class="file-size">${formatFileSize(file.size)}</div>
                        </div>
                        <button class="remove-file" onclick="MusicNFT.removeFile('audio')">✕</button>
                    </div>
                `;
            }
            const zone = $('#audioUploadZone');
            if (zone) zone.classList.add('hidden');
        } else if (type === 'cover') {
            state.coverFile = file;
            const preview = $('#coverPreview');
            if (preview) {
                const url = URL.createObjectURL(file);
                preview.classList.remove('hidden');
                preview.innerHTML = `
                    <div class="upload-preview">
                        <img src="${url}" style="width:48px;height:48px;border-radius:8px;object-fit:cover;">
                        <div class="file-info">
                            <div class="file-name">${file.name}</div>
                            <div class="file-size">${formatFileSize(file.size)}</div>
                        </div>
                        <button class="remove-file" onclick="MusicNFT.removeFile('cover')">✕</button>
                    </div>
                `;
            }
            const zone = $('#coverUploadZone');
            if (zone) zone.classList.add('hidden');
        }
    }

    function removeFile(type) {
        if (type === 'audio') {
            state.audioFile = null;
            const p = $('#audioPreview'); if (p) { p.classList.add('hidden'); p.innerHTML = ''; }
            const z = $('#audioUploadZone'); if (z) z.classList.remove('hidden');
            const i = $('#audioFile'); if (i) i.value = '';
        } else {
            state.coverFile = null;
            const p = $('#coverPreview'); if (p) { p.classList.add('hidden'); p.innerHTML = ''; }
            const z = $('#coverUploadZone'); if (z) z.classList.remove('hidden');
            const i = $('#coverFile'); if (i) i.value = '';
        }
    }

    // ===================== IPFS UPLOAD =====================
    async function uploadToIPFS(file) {
        const clientId = state.settings.thirdwebClientId || CONFIG.THIRDWEB_CLIENT_ID || localStorage.getItem('soundmint_tw_clientId');
        if (!clientId) throw new Error('Thirdweb Client ID not configured. Go to Settings.');

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('https://storage.thirdweb.com/ipfs/upload', {
            method: 'POST',
            headers: { 'x-client-id': clientId },
            body: formData,
        });

        if (!response.ok) throw new Error('IPFS upload failed: ' + response.statusText);

        const data = await response.json();
        const hash = data.IpfsHash || data.ipfsHash || data.cid || (data.result && data.result[0]) || '';
        if (!hash) throw new Error('Could not parse IPFS hash from response');
        return `ipfs://${hash}`;
    }

    async function uploadMetadataToIPFS(metadata) {
        const clientId = state.settings.thirdwebClientId || CONFIG.THIRDWEB_CLIENT_ID || localStorage.getItem('soundmint_tw_clientId');
        if (!clientId) throw new Error('Thirdweb Client ID not configured');

        const blob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
        const formData = new FormData();
        formData.append('file', blob, 'metadata.json');

        const response = await fetch('https://storage.thirdweb.com/ipfs/upload', {
            method: 'POST',
            headers: { 'x-client-id': clientId },
            body: formData,
        });

        if (!response.ok) throw new Error('Metadata upload failed');
        const data = await response.json();
        const hash = data.IpfsHash || data.ipfsHash || data.cid || (data.result && data.result[0]) || '';
        return `ipfs://${hash}`;
    }

    // ===================== NFT MINTING =====================
    async function mintNFT() {
        if (!state.address) { toast('Connect your wallet first', 'error'); return; }

        const titleEl = byId('songTitle') || $('#songTitle');
        const artistEl = byId('artistName') || $('#artistName');
        const title = titleEl ? titleEl.value.trim() : '';
        const artist = artistEl ? artistEl.value.trim() : '';
        const descEl = byId('songDescription') || $('#songDescription');
        const description = descEl ? descEl.value.trim() : '';
        const genreEl = byId('songGenre') || $('#songGenre');
        const genre = genreEl ? genreEl.value : '';
        const editionsEl = byId('editions') || $('#editions');
        const editions = parseInt(editionsEl ? editionsEl.value : '100') || 100;
        const priceEl = byId('nftPrice') || $('#nftPrice');
        const price = parseFloat(priceEl ? priceEl.value : '0.01') || 0.01;
        const royaltyEl = byId('royaltyPercent') || $('#royaltyPercent');
        const royalty = parseInt(royaltyEl ? royaltyEl.value : '10') || 10;
        const tokenCb = byId('enableTokenPayment') || $('#enableTokenPayment');
        const acceptToken = tokenCb ? tokenCb.checked : false;
        const tokenPriceEl = byId('tokenPrice') || $('#tokenPrice');
        const tokenPrice = acceptToken ? parseFloat(tokenPriceEl ? tokenPriceEl.value : '0') : null;

        if (!title || !artist) {
            console.warn('[SoundMint] title="' + title + '" artist="' + artist + '" titleEl=', titleEl, 'artistEl=', artistEl);
            toast('Song title and artist name required', 'error');
            return;
        }
        if (!state.audioFile) { toast('Upload an audio file', 'error'); return; }
        if (!state.coverFile) { toast('Upload cover artwork', 'error'); return; }

        const mintBtn = $('#mintBtn');
        if (mintBtn) { mintBtn.disabled = true; mintBtn.innerHTML = '<div class="spinner"></div> Minting...'; }

        const progress = $('#mintProgress');
        if (progress) progress.classList.remove('hidden');

        try {
            updateMintProgress(10, 'Uploading audio to IPFS...');
            const audioURI = await uploadToIPFS(state.audioFile);
            updateMintProgress(30, 'Audio uploaded!');

            updateMintProgress(35, 'Uploading cover art to IPFS...');
            const coverURI = await uploadToIPFS(state.coverFile);
            updateMintProgress(50, 'Cover art uploaded!');

            updateMintProgress(55, 'Building NFT metadata...');
            const metadata = {
                name: title,
                description: description || `"${title}" by ${artist}`,
                image: coverURI,
                animation_url: audioURI,
                external_url: `https://soundmint.app/track/${Date.now()}`,
                attributes: [
                    { trait_type: 'Artist', value: artist },
                    { trait_type: 'Genre', value: genre || 'Unspecified' },
                    { trait_type: 'Type', value: 'Music' },
                    { trait_type: 'Editions', value: String(editions) },
                    { trait_type: 'Original Audio', value: 'true' },
                ],
                properties: {
                    audio: audioURI,
                    cover: coverURI,
                    artist: artist,
                    genre: genre,
                    royalty_bps: royalty * 100,
                },
            };

            updateMintProgress(60, 'Uploading metadata to IPFS...');
            const metadataURI = await uploadMetadataToIPFS(metadata);
            updateMintProgress(65, 'Metadata uploaded!');

            updateMintProgress(70, 'Minting NFT on Base...');
            let txHash = null;
            let nftContractAddr = state.settings.nftContract;
            let tokenId = state.songs.length;

            if (state.thirdwebSDK && nftContractAddr) {
                txHash = await mintWithThirdweb(nftContractAddr, metadataURI, editions);
            } else if (nftContractAddr) {
                txHash = await mintDirect(nftContractAddr, metadataURI, editions);
            } else {
                toast('Set NFT Collection contract in Settings, or deploy one at thirdweb.com/explore/erc-1155', 'warning');
                throw new Error('No NFT collection contract configured.');
            }

            updateMintProgress(90, 'Confirming transaction...');

            const song = {
                id: Date.now().toString(),
                title, artist, description, genre, editions, price, royalty,
                acceptToken, tokenPrice,
                audioURI, coverURI, metadataURI,
                contractAddress: nftContractAddr,
                tokenId, txHash,
                status: 'minted',
                createdAt: Date.now(),
            };

            state.songs.push(song);
            saveState();

            // Save to WordPress DB
            wpAjax('soundmint_save_nft', {
                title, artist, description,
                audio_ipfs: audioURI, cover_ipfs: coverURI, metadata_ipfs: metadataURI,
                contract_address: nftContractAddr, token_id: tokenId,
                editions, price, tx_hash: txHash,
            });

            updateMintProgress(100, 'NFT minted successfully!');
            toast(`"${title}" minted as NFT on Base!`, 'success');

            setTimeout(() => {
                resetUploadForm();
                navigateTo('my-nfts');
            }, 2000);

        } catch (err) {
            console.error('Mint error:', err);
            toast('Minting failed: ' + err.message, 'error');
        } finally {
            if (mintBtn) { mintBtn.disabled = false; mintBtn.innerHTML = '🎵 Mint Music NFT'; }
        }
    }

    function updateMintProgress(percent, text) {
        const bar = $('#mintProgressBar');
        const pctEl = $('#mintProgressText');
        const statusEl = $('#mintStatusText');
        if (bar) bar.style.width = percent + '%';
        if (pctEl) pctEl.textContent = percent + '%';
        if (text && statusEl) statusEl.textContent = text;
    }

    async function mintWithThirdweb(contractAddr, metadataURI, quantity) {
        const chain = CONFIG.USE_TESTNET
            ? thirdweb.defineChain(CONFIG.BASE_SEPOLIA_CHAIN_ID)
            : thirdweb.defineChain(CONFIG.BASE_CHAIN_ID);

        const contract = thirdweb.getContract({
            client: state.thirdwebSDK, chain, address: contractAddr,
        });

        const tx = await thirdweb.sendTransaction({
            contract,
            method: 'function mint(address to, uint256 id, uint256 amount, string memory uri)',
            params: [state.address, state.songs.length, quantity, metadataURI],
        });

        return tx.transactionHash;
    }

    async function mintDirect(contractAddr, metadataURI, quantity) {
        const tokenId = state.songs.length;
        const to = state.address.slice(2).padStart(64, '0');
        const id = tokenId.toString(16).padStart(64, '0');
        const amt = quantity.toString(16).padStart(64, '0');
        // mint(address,uint256,uint256,bytes) = 0x731133e9
        const dataOffset = '00000000000000000000000000000000000000000000000000000000000000a0';
        const dataLength = '0000000000000000000000000000000000000000000000000000000000000000';
        const calldata = '0x731133e9' + to + id + amt + dataOffset + dataLength;

        const txHash = await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [{
                from: state.address,
                to: contractAddr,
                data: calldata,
                chainId: '0x' + getChainId().toString(16),
            }],
        });

        return txHash;
    }

    function resetUploadForm() {
        const fields = ['songTitle', 'artistName', 'songDescription'];
        fields.forEach(id => { const el = $(`#${id}`); if (el) el.value = ''; });
        const selects = { songGenre: '', editions: '100', nftPrice: '0.01', royaltyPercent: '10' };
        Object.entries(selects).forEach(([id, val]) => { const el = $(`#${id}`); if (el) el.value = val; });
        const cb = $('#enableTokenPayment'); if (cb) cb.checked = false;
        const tp = $('#tokenPriceGroup'); if (tp) tp.classList.add('hidden');
        removeFile('audio');
        removeFile('cover');
        const progress = $('#mintProgress'); if (progress) progress.classList.add('hidden');
        updateMintProgress(0, '');
    }

    // ===================== NFT PREVIEW =====================
    function previewNFT() {
        const titleEl = byId('songTitle') || $('#songTitle');
        const artistEl = byId('artistName') || $('#artistName');
        const genreEl = byId('songGenre') || $('#songGenre');
        const priceEl = byId('nftPrice') || $('#nftPrice');
        const editionsEl = byId('editions') || $('#editions');
        const title = (titleEl ? titleEl.value.trim() : '') || 'Untitled Track';
        const artist = (artistEl ? artistEl.value.trim() : '') || 'Unknown Artist';
        const genre = (genreEl ? genreEl.value : '') || 'Music';
        const price = (priceEl ? priceEl.value : '') || '0.01';
        const editions = (editionsEl ? editionsEl.value : '') || '100';

        let coverHTML = '<div style="width:100%;aspect-ratio:1;background:var(--gradient-primary);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:80px;">🎵</div>';
        if (state.coverFile) {
            const url = URL.createObjectURL(state.coverFile);
            coverHTML = `<img src="${url}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px;">`;
        }

        const previewContent = $('#previewContent');
        if (previewContent) {
            previewContent.innerHTML = `
                ${coverHTML}
                <div style="padding:20px 0;">
                    <h3 style="font-size:22px;margin-bottom:4px;">${title}</h3>
                    <p style="color:var(--text-muted);margin-bottom:16px;">${artist} · ${genre}</p>
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <div style="font-size:13px;color:var(--text-muted);">Price</div>
                            <div style="font-size:20px;font-weight:700;color:var(--base-blue);">${price} ETH</div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:13px;color:var(--text-muted);">Editions</div>
                            <div style="font-size:20px;font-weight:700;">${editions}</div>
                        </div>
                    </div>
                    <div style="margin-top:12px;padding:12px;background:var(--bg-input);border-radius:8px;font-size:12px;color:var(--text-muted);">
                        🔵 Will be minted on Base Network
                    </div>
                </div>
            `;
        }
        openModal('previewModal');
    }

    // ===================== TOKEN DEPLOYMENT =====================
    async function deployToken() {
        if (!state.address) { toast('Connect wallet first', 'error'); return; }

        const name = ($('#tokenName') || {}).value?.trim();
        const symbol = ($('#tokenSymbol') || {}).value?.trim().toUpperCase();
        const supply = parseInt(($('#tokenInitialSupply') || {}).value) || 1000000;
        const description = ($('#tokenDescription') || {}).value?.trim() || '';

        if (!name || !symbol) { toast('Token name and symbol required', 'error'); return; }

        try {
            const progress = $('#deployProgress');
            if (progress) progress.classList.remove('hidden');
            const bar = $('#deployProgressBar');
            const status = $('#deployStatusText');

            if (bar) bar.style.width = '20%';
            if (status) status.textContent = 'Deploying ERC-20 on Base...';

            let tokenAddress = null;

            if (state.thirdwebSDK && typeof thirdweb !== 'undefined') {
                const chain = CONFIG.USE_TESTNET
                    ? thirdweb.defineChain(CONFIG.BASE_SEPOLIA_CHAIN_ID)
                    : thirdweb.defineChain(CONFIG.BASE_CHAIN_ID);

                if (bar) bar.style.width = '40%';
                if (status) status.textContent = 'Sending deployment tx...';

                tokenAddress = await thirdweb.deployPublishedContract({
                    client: state.thirdwebSDK, chain,
                    account: state.address,
                    contractId: 'TokenERC20',
                    constructorParams: {
                        defaultAdmin: state.address,
                        name, symbol,
                        contractURI: '',
                        trustedForwarders: [],
                        primarySaleRecipient: state.address,
                        platformFeeRecipient: state.address,
                        platformFeeBps: 0,
                    },
                });
            } else {
                toast('Configure Thirdweb Client ID first, or deploy at thirdweb.com/explore/erc-20', 'warning');
                throw new Error('Deploy ERC-20 at thirdweb.com/explore/erc-20 on Base, paste address in Settings.');
            }

            if (bar) bar.style.width = '80%';
            if (status) status.textContent = 'Token deployed!';

            state.tokenConfig = { name, symbol, description, address: tokenAddress, supply, deployedAt: Date.now() };
            state.settings.tokenContract = tokenAddress;
            saveState();

            if (bar) bar.style.width = '100%';
            if (status) status.textContent = 'Complete!';

            toast(`${symbol} deployed on Base! ${shortAddr(tokenAddress)}`, 'success');
            setTimeout(() => refreshTokenPage(), 1500);
        } catch (err) {
            console.error('Token deploy error:', err);
            toast('Deploy failed: ' + err.message, 'error');
            const p = $('#deployProgress'); if (p) p.classList.add('hidden');
        }
    }

    async function mintTokens() {
        if (!state.address || !state.tokenConfig) { toast('Connect wallet and deploy token first', 'error'); return; }

        const amount = parseInt(($('#mintTokenAmount') || {}).value) || 1000;

        try {
            toast('Minting tokens...', 'info');
            const amountWei = '0x' + (BigInt(amount) * BigInt(10 ** 18)).toString(16);
            const to = state.address.slice(2).padStart(64, '0');
            const value = amountWei.slice(2).padStart(64, '0');
            const calldata = '0x449a52f8' + to + value;

            await window.ethereum.request({
                method: 'eth_sendTransaction',
                params: [{ from: state.address, to: state.tokenConfig.address, data: calldata, chainId: '0x' + getChainId().toString(16) }],
            });

            state.tokenConfig.supply += amount;
            saveState();
            toast(`Minted ${amount.toLocaleString()} ${state.tokenConfig.symbol}!`, 'success');
            refreshTokenPage();
        } catch (err) {
            console.error('Mint tokens error:', err);
            toast('Token mint failed: ' + err.message, 'error');
        }
    }

    async function airdropTokens() {
        if (!state.address || !state.tokenConfig) { toast('Connect wallet and deploy token first', 'error'); return; }

        const recipient = ($('#airdropAddress') || {}).value?.trim();
        const amount = parseInt(($('#airdropAmount') || {}).value) || 100;

        if (!recipient || !recipient.startsWith('0x') || recipient.length !== 42) {
            toast('Enter a valid wallet address', 'error'); return;
        }

        try {
            toast('Sending airdrop...', 'info');
            const amountWei = '0x' + (BigInt(amount) * BigInt(10 ** 18)).toString(16);
            const to = recipient.slice(2).padStart(64, '0');
            const value = amountWei.slice(2).padStart(64, '0');
            const calldata = '0xa9059cbb' + to + value;

            await window.ethereum.request({
                method: 'eth_sendTransaction',
                params: [{ from: state.address, to: state.tokenConfig.address, data: calldata, chainId: '0x' + getChainId().toString(16) }],
            });

            toast(`Airdropped ${amount.toLocaleString()} ${state.tokenConfig.symbol} to ${shortAddr(recipient)}!`, 'success');
        } catch (err) {
            console.error('Airdrop error:', err);
            toast('Airdrop failed: ' + err.message, 'error');
        }
    }

    // ===================== MARKETPLACE =====================
    async function createListing() {
        if (!state.address) { toast('Connect wallet first', 'error'); return; }

        const nftId = ($('#listNftSelect') || {}).value;
        const currency = ($('#saleCurrency') || {}).value || 'eth';
        const price = parseFloat(($('#listingPrice') || {}).value) || 0.01;
        const qty = parseInt(($('#listingQty') || {}).value) || 1;

        if (!nftId) { toast('Select an NFT to list', 'error'); return; }

        const song = state.songs.find(s => s.id === nftId);
        if (!song) { toast('NFT not found', 'error'); return; }

        try {
            toast('Creating listing...', 'info');

            const marketAddr = state.settings.marketplaceContract;
            if (marketAddr) {
                toast('Approving NFT for marketplace...', 'info');
                const operatorPadded = marketAddr.slice(2).padStart(64, '0');
                const approveData = '0xa22cb465' + operatorPadded + '0000000000000000000000000000000000000000000000000000000000000001';

                await window.ethereum.request({
                    method: 'eth_sendTransaction',
                    params: [{ from: state.address, to: song.contractAddress, data: approveData, chainId: '0x' + getChainId().toString(16) }],
                });
            }

            const listing = {
                id: Date.now().toString(),
                songId: song.id, songTitle: song.title, artist: song.artist,
                coverURI: song.coverURI,
                saleType: 'fixed', currency, price,
                quantity: qty, remaining: qty,
                contractAddress: song.contractAddress,
                tokenId: song.tokenId,
                status: 'active',
                createdAt: Date.now(),
            };

            state.listings.push(listing);
            song.status = 'listed';
            saveState();

            wpAjax('soundmint_save_listing', {
                nft_id: song.id, price, currency, quantity: qty,
            });

            toast(`"${song.title}" listed for ${price} ${currency === 'eth' ? 'ETH' : state.tokenConfig?.symbol || 'tokens'}!`, 'success');
            refreshMarketplace();
        } catch (err) {
            console.error('Listing error:', err);
            toast('Listing failed: ' + err.message, 'error');
        }
    }

    function cancelListing(listingId) {
        const listing = state.listings.find(l => l.id === listingId);
        if (listing) {
            listing.status = 'cancelled';
            const song = state.songs.find(s => s.id === listing.songId);
            if (song) song.status = 'minted';
            saveState();
            toast('Listing cancelled', 'info');
            refreshMarketplace();
        }
    }

    function quickList(songId) {
        navigateTo('marketplace');
        setTimeout(() => {
            const sel = $('#listNftSelect');
            if (sel) sel.value = songId;
        }, 100);
    }

    // ===================== SETTINGS =====================
    function saveSettings() {
        state.settings.artistName = ($('#settingArtistName') || {}).value?.trim() || '';
        state.settings.email = ($('#settingEmail') || {}).value?.trim() || '';
        state.settings.bio = ($('#settingBio') || {}).value?.trim() || '';
        saveState();
        toast('Profile saved!', 'success');
    }

    function saveThirdwebConfig() {
        const clientId = ($('#settingClientId') || {}).value?.trim() || '';
        state.settings.thirdwebClientId = clientId;
        localStorage.setItem('soundmint_tw_clientId', clientId);
        saveState();
        toast('Thirdweb config saved!', 'success');
        if (state.address) initThirdweb();
    }

    function saveContracts() {
        state.settings.nftContract = ($('#settingNftContract') || {}).value?.trim() || '';
        state.settings.marketplaceContract = ($('#settingMarketplaceContract') || {}).value?.trim() || '';
        state.settings.tokenContract = ($('#settingTokenContract') || {}).value?.trim() || '';

        if (state.settings.tokenContract && !state.tokenConfig) {
            state.tokenConfig = { name: 'Artist Token', symbol: 'ART', address: state.settings.tokenContract, supply: 0, deployedAt: Date.now() };
        }
        saveState();
        toast('Contracts saved!', 'success');
        if (state.address) loadContracts();
    }

    // ===================== UI RENDERING =====================
    function refreshDashboard() {
        const el = (id) => $(`#${id}`);
        const set = (id, val) => { const e = el(id); if (e) e.textContent = val; };

        set('statSongs', state.songs.length);
        set('statNFTs', state.songs.filter(s => s.status !== 'pending').length);

        const totalRev = state.sales.reduce((sum, s) => sum + (s.price || 0), 0);
        set('statRevenue', totalRev.toFixed(4) + ' ETH');
        set('statTokenSupply', state.tokenConfig ? state.tokenConfig.supply.toLocaleString() : '0');

        const recent = state.songs.slice(-3).reverse();
        const recentEl = el('recentUploads');
        if (recentEl && recent.length > 0) {
            recentEl.innerHTML = recent.map(s => `
                <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border-color);">
                    <div style="width:40px;height:40px;border-radius:8px;background:var(--gradient-primary);display:flex;align-items:center;justify-content:center;">🎵</div>
                    <div style="flex:1;"><div style="font-weight:600;font-size:14px;">${s.title}</div><div style="font-size:12px;color:var(--text-muted);">${s.artist}</div></div>
                    <span class="nft-status-badge ${s.status}">${s.status}</span>
                </div>
            `).join('');
        }

        const recentSales = state.sales.slice(-3).reverse();
        const salesEl = el('recentSales');
        if (salesEl && recentSales.length > 0) {
            salesEl.innerHTML = recentSales.map(s => `
                <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border-color);">
                    <div style="width:40px;height:40px;border-radius:8px;background:var(--gradient-accent);display:flex;align-items:center;justify-content:center;">💰</div>
                    <div style="flex:1;"><div style="font-weight:600;font-size:14px;">${s.songTitle}</div><div style="font-size:12px;color:var(--text-muted);">${shortAddr(s.buyer)}</div></div>
                    <div style="font-weight:700;color:var(--base-blue);">${s.price} ETH</div>
                </div>
            `).join('');
        }
    }

    function renderNFTGrid(filter = 'all') {
        const filtered = filter === 'all' ? state.songs : state.songs.filter(s => s.status === filter);
        const grid = $('#nftGrid');
        if (!grid) return;

        if (filtered.length === 0) {
            grid.innerHTML = `<p class="text-muted text-center" style="grid-column:1/-1;padding:60px 0;">${filter === 'all' ? 'No NFTs yet. Upload your first song!' : `No ${filter} NFTs`}</p>`;
            return;
        }

        grid.innerHTML = filtered.map(song => `
            <div class="nft-card">
                <div class="cover">
                    ${song.coverURI ? `<img src="${song.coverURI.replace('ipfs://', CONFIG.IPFS_GATEWAY)}" alt="${song.title}">` : '🎵'}
                    <div class="play-overlay">
                        <button class="play-btn" onclick="MusicNFT.playSong('${song.id}')">▶</button>
                    </div>
                </div>
                <div class="nft-info">
                    <div class="nft-title">${song.title}</div>
                    <div class="nft-artist">${song.artist}</div>
                    <span class="nft-status-badge ${song.status}">${song.status}</span>
                    <div class="nft-meta">
                        <div class="nft-price">${song.price} ETH</div>
                        <div class="nft-editions">${song.editions} editions</div>
                    </div>
                    <div style="margin-top:12px;display:flex;gap:8px;">
                        ${song.status === 'minted' ? `<button class="btn btn-primary btn-sm" onclick="MusicNFT.quickList('${song.id}')">List for Sale</button>` : ''}
                        <a href="${getExplorer()}/tx/${song.txHash}" target="_blank" class="btn btn-secondary btn-sm">View TX</a>
                    </div>
                </div>
            </div>
        `).join('');
    }

    function refreshMarketplace() {
        const select = $('#listNftSelect');
        if (select) {
            const mintedSongs = state.songs.filter(s => s.status === 'minted');
            select.innerHTML = '<option value="">Choose an NFT...</option>' +
                mintedSongs.map(s => `<option value="${s.id}">${s.title} — ${s.artist}</option>`).join('');
        }

        const currSelect = $('#saleCurrency');
        if (currSelect) {
            currSelect.innerHTML = '<option value="eth">ETH (Base)</option>';
            if (state.tokenConfig) {
                currSelect.innerHTML += `<option value="custom">${state.tokenConfig.symbol}</option>`;
            }
        }

        const active = state.listings.filter(l => l.status === 'active');
        const listEl = $('#activeListings');
        if (listEl && active.length > 0) {
            listEl.innerHTML = `
                <table class="data-table">
                    <thead><tr><th>Song</th><th>Price</th><th>Currency</th><th>Qty</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                        ${active.map(l => `
                            <tr>
                                <td><strong>${l.songTitle}</strong><br><span style="font-size:12px;color:var(--text-muted);">${l.artist}</span></td>
                                <td>${l.price}</td>
                                <td>${l.currency === 'eth' ? 'ETH' : (state.tokenConfig?.symbol || 'Token')}</td>
                                <td>${l.remaining}/${l.quantity}</td>
                                <td><span class="nft-status-badge listed">Active</span></td>
                                <td><button class="btn btn-danger btn-sm" onclick="MusicNFT.cancelListing('${l.id}')">Cancel</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
    }

    function renderSalesHistory() {
        const set = (id, val) => { const e = $(`#${id}`); if (e) e.textContent = val; };
        set('totalSalesValue', state.sales.reduce((s, sale) => s + (sale.price || 0), 0).toFixed(4) + ' ETH');
        set('totalSalesCount', state.sales.length);
        const uniqueBuyers = new Set(state.sales.map(s => s.buyer));
        set('uniqueBuyers', uniqueBuyers.size);

        const tbody = $('#salesTableBody');
        if (tbody && state.sales.length > 0) {
            tbody.innerHTML = state.sales.slice().reverse().map(s => `
                <tr>
                    <td><strong>${s.songTitle}</strong></td>
                    <td>${shortAddr(s.buyer)}</td>
                    <td>${s.price}</td>
                    <td>${s.currency === 'eth' ? 'ETH' : (state.tokenConfig?.symbol || 'Token')}</td>
                    <td>${formatDate(s.date)}</td>
                    <td><a href="${getExplorer()}/tx/${s.txHash}" target="_blank" style="color:var(--base-blue);">View</a></td>
                </tr>
            `).join('');
        }
    }

    function refreshTokenPage() {
        if (state.tokenConfig && state.tokenConfig.address) {
            const dt = $('#deployToken'); if (dt) dt.classList.add('hidden');
            const ti = $('#tokenInfo'); if (ti) ti.classList.remove('hidden');
            const set = (id, val) => { const e = $(`#${id}`); if (e) e.textContent = val; };
            set('tokenNameDisplay', state.tokenConfig.name);
            set('tokenSymbolDisplay', state.tokenConfig.symbol);
            set('tokenSupplyDisplay', 'Supply: ' + (state.tokenConfig.supply || 0).toLocaleString());
            set('tokenContractDisplay', state.tokenConfig.address);
            set('tokenIconDisplay', state.tokenConfig.symbol.charAt(0));
        } else {
            const dt = $('#deployToken'); if (dt) dt.classList.remove('hidden');
            const ti = $('#tokenInfo'); if (ti) ti.classList.add('hidden');
        }
    }

    // ===================== AUDIO PLAYER =====================
    function playSong(songId) {
        const song = state.songs.find(s => s.id === songId);
        if (!song || !song.audioURI) { toast('Audio not available', 'error'); return; }

        const audioUrl = song.audioURI.replace('ipfs://', CONFIG.IPFS_GATEWAY);
        const audio = $('#audioElement');
        if (!audio) return;
        audio.src = audioUrl;
        audio.play();
        state.isPlaying = true;

        const set = (id, val) => { const e = $(`#${id}`); if (e) e.textContent = val; };
        set('playerTitle', song.title);
        set('playerArtist', song.artist);
        set('playerPlayBtn', '⏸');
        const player = $('#audioPlayer'); if (player) player.classList.add('visible');

        audio.addEventListener('timeupdate', () => {
            const pct = (audio.currentTime / audio.duration) * 100;
            const prog = $('#playerProgress'); if (prog) prog.style.width = pct + '%';
            const cur = formatTime(audio.currentTime);
            const dur = formatTime(audio.duration);
            set('playerTime', `${cur} / ${dur}`);
        });

        audio.addEventListener('ended', () => {
            state.isPlaying = false;
            set('playerPlayBtn', '▶');
        });
    }

    function playerToggle() {
        const audio = $('#audioElement');
        if (!audio) return;
        if (state.isPlaying) {
            audio.pause(); state.isPlaying = false;
            const btn = $('#playerPlayBtn'); if (btn) btn.textContent = '▶';
        } else {
            audio.play(); state.isPlaying = true;
            const btn = $('#playerPlayBtn'); if (btn) btn.textContent = '⏸';
        }
    }

    function playerSeek(event) {
        const audio = $('#audioElement');
        if (!audio) return;
        const bar = event.currentTarget;
        const rect = bar.getBoundingClientRect();
        const pct = (event.clientX - rect.left) / rect.width;
        audio.currentTime = pct * audio.duration;
    }

    function formatTime(sec) {
        if (isNaN(sec)) return '0:00';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    // ===================== MODALS =====================
    function openModal(id) { const el = $(`#${id}`); if (el) el.classList.add('active'); }
    function closeModal(id) { const el = $(`#${id}`); if (el) el.classList.remove('active'); }

    // ===================== INIT =====================
    function loadSettings() {
        const setVal = (id, key) => { const el = $(`#${id}`); if (el && state.settings[key]) el.value = state.settings[key]; };
        setVal('settingArtistName', 'artistName');
        setVal('settingEmail', 'email');
        setVal('settingBio', 'bio');
        setVal('settingClientId', 'thirdwebClientId');
        setVal('settingNftContract', 'nftContract');
        setVal('settingMarketplaceContract', 'marketplaceContract');
        setVal('settingTokenContract', 'tokenContract');
    }

    function init() {
        initNavigation();
        initFileUploads();
        loadSettings();
        refreshDashboard();
        refreshTokenPage();

        if (window.ethereum && window.ethereum.selectedAddress) {
            connectWallet();
        }

        console.log('%c🎵 SoundMint WP — Music NFT Platform', 'color: #0052FF; font-size: 18px; font-weight: bold;');
        console.log('%cNetwork: Base | WordPress Edition', 'color: #8B5CF6; font-size: 12px;');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ===================== PUBLIC API =====================
    return {
        connectWallet, mintNFT, previewNFT, deployToken, mintTokens, airdropTokens,
        createListing, cancelListing, quickList,
        saveSettings, saveThirdwebConfig, saveContracts,
        playSong, playerToggle, playerSeek, removeFile,
        openModal, closeModal,
    };
})();

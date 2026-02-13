/**
 * SoundMint — Music NFT Platform for Artists
 * Network: Base (Chain ID 8453) / Base Sepolia (Chain ID 84532)
 * Powered by Thirdweb SDK v5
 * Owner Wallet: 0xd46d5E0EBC17FAc1cb37e894A77F7d75A69Da944
 */

const MusicNFT = (() => {
    'use strict';

    // ===================== CONFIGURATION =====================
    const CONFIG = {
        OWNER_WALLET: '0xd46d5E0EBC17FAc1cb37e894A77F7d75A69Da944',
        BASE_CHAIN_ID: 8453,
        BASE_SEPOLIA_CHAIN_ID: 84532,
        BASE_RPC: 'https://mainnet.base.org',
        BASE_SEPOLIA_RPC: 'https://sepolia.base.org',
        BASE_EXPLORER: 'https://basescan.org',
        BASE_SEPOLIA_EXPLORER: 'https://sepolia.basescan.org',
        USE_TESTNET: true, // Toggle for devnet/mainnet
        SUPPORTED_AUDIO: ['.mp3', '.wav', '.flac', '.aac'],
        MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
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

    // ===================== HELPERS =====================
    function $(sel) { return document.querySelector(sel); }
    function $$(sel) { return document.querySelectorAll(sel); }

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

    // ===================== TOAST NOTIFICATIONS =====================
    function toast(message, type = 'info') {
        const container = $('#toastContainer');
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
        $$('[data-page]').forEach(el => {
            el.addEventListener('click', () => navigateTo(el.dataset.page));
        });

        $$('.tab[data-tab]').forEach(el => {
            el.addEventListener('click', () => {
                el.parentElement.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                el.classList.add('active');
                filterNFTs(el.dataset.tab);
            });
        });
    }

    function navigateTo(page) {
        $$('.page').forEach(p => p.classList.add('hidden'));
        const target = $(`#page-${page}`);
        if (target) target.classList.remove('hidden');

        $$('.nav-item').forEach(n => n.classList.remove('active'));
        const navItem = $(`.nav-item[data-page="${page}"]`);
        if (navItem) navItem.classList.add('active');

        const titles = {
            'dashboard': 'Dashboard',
            'upload': 'Upload Music',
            'my-nfts': 'My NFTs',
            'marketplace': 'Sell Music',
            'sales': 'Sales History',
            'token': 'Artist Token',
            'token-sales': 'Token Sales',
            'settings': 'Settings',
        };
        $('#pageTitle').textContent = titles[page] || 'Dashboard';

        // Refresh page-specific data
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

            // Request accounts
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            state.address = accounts[0];

            // Switch to Base network
            await switchToBase();

            // Update UI
            $('#walletDot').classList.add('connected');
            $('#walletAddress').textContent = shortAddr(state.address);
            $('#connectBtn').textContent = shortAddr(state.address);
            $('#connectBtn').classList.remove('btn-primary');
            $('#connectBtn').classList.add('btn-secondary');

            toast(`Connected: ${shortAddr(state.address)}`, 'success');

            // Initialize Thirdweb SDK
            await initThirdweb();

            // Listen for account/chain changes
            window.ethereum.on('accountsChanged', (accs) => {
                state.address = accs[0] || null;
                if (!state.address) {
                    disconnectWallet();
                } else {
                    $('#walletAddress').textContent = shortAddr(state.address);
                    $('#connectBtn').textContent = shortAddr(state.address);
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

    function disconnectWallet() {
        state.address = null;
        state.wallet = null;
        state.signer = null;
        $('#walletDot').classList.remove('connected');
        $('#walletAddress').textContent = 'Connect Wallet';
        $('#connectBtn').textContent = 'Connect Wallet';
        $('#connectBtn').classList.add('btn-primary');
        $('#connectBtn').classList.remove('btn-secondary');
        toast('Wallet disconnected', 'info');
    }

    async function switchToBase() {
        const chainId = '0x' + getChainId().toString(16);
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId }],
            });
        } catch (switchError) {
            // Chain not added, add it
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

    // ===================== THIRDWEB SDK INITIALIZATION =====================
    async function initThirdweb() {
        try {
            const clientId = state.settings.thirdwebClientId || localStorage.getItem('soundmint_tw_clientId');
            if (!clientId) {
                toast('Set your Thirdweb Client ID in Settings first', 'warning');
                return;
            }

            // Thirdweb v5 client
            if (typeof thirdweb !== 'undefined' && thirdweb.createThirdwebClient) {
                state.thirdwebSDK = thirdweb.createThirdwebClient({
                    clientId: clientId,
                });
                console.log('Thirdweb SDK v5 initialized');

                // Load existing contracts from settings
                await loadContracts();
            } else {
                console.warn('Thirdweb SDK not loaded from CDN, using direct contract interaction');
            }
        } catch (err) {
            console.error('Thirdweb init error:', err);
        }
    }

    async function loadContracts() {
        const nftAddr = state.settings.nftContract;
        const marketAddr = state.settings.marketplaceContract;
        const tokenAddr = state.settings.tokenContract || (state.tokenConfig && state.tokenConfig.address);

        if (nftAddr && state.thirdwebSDK) {
            console.log('NFT contract loaded:', nftAddr);
        }
        if (marketAddr && state.thirdwebSDK) {
            console.log('Marketplace contract loaded:', marketAddr);
        }
        if (tokenAddr && state.thirdwebSDK) {
            console.log('Token contract loaded:', tokenAddr);
        }
    }

    // ===================== FILE UPLOADS =====================
    function initFileUploads() {
        // Audio file upload
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

        // Cover file upload
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

        // Token payment toggle
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
            toast(`File too large. Max size is ${formatFileSize(CONFIG.MAX_FILE_SIZE)}`, 'error');
            return;
        }

        if (type === 'audio') {
            state.audioFile = file;
            const preview = $('#audioPreview');
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
            $('#audioUploadZone').classList.add('hidden');
        } else if (type === 'cover') {
            state.coverFile = file;
            const preview = $('#coverPreview');
            preview.classList.remove('hidden');
            const url = URL.createObjectURL(file);
            preview.innerHTML = `
                <div class="upload-preview">
                    <img src="${url}" style="width:48px; height:48px; border-radius:8px; object-fit:cover;">
                    <div class="file-info">
                        <div class="file-name">${file.name}</div>
                        <div class="file-size">${formatFileSize(file.size)}</div>
                    </div>
                    <button class="remove-file" onclick="MusicNFT.removeFile('cover')">✕</button>
                </div>
            `;
            $('#coverUploadZone').classList.add('hidden');
        }
    }

    function removeFile(type) {
        if (type === 'audio') {
            state.audioFile = null;
            $('#audioPreview').classList.add('hidden');
            $('#audioPreview').innerHTML = '';
            $('#audioUploadZone').classList.remove('hidden');
            $('#audioFile').value = '';
        } else {
            state.coverFile = null;
            $('#coverPreview').classList.add('hidden');
            $('#coverPreview').innerHTML = '';
            $('#coverUploadZone').classList.remove('hidden');
            $('#coverFile').value = '';
        }
    }

    // ===================== IPFS UPLOAD =====================
    async function uploadToIPFS(file) {
        const clientId = state.settings.thirdwebClientId || localStorage.getItem('soundmint_tw_clientId');
        if (!clientId) {
            throw new Error('Thirdweb Client ID not configured. Go to Settings.');
        }

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('https://storage.thirdweb.com/ipfs/upload', {
            method: 'POST',
            headers: {
                'x-client-id': clientId,
            },
            body: formData,
        });

        if (!response.ok) {
            throw new Error('IPFS upload failed: ' + response.statusText);
        }

        const data = await response.json();
        // Thirdweb returns { IpfsHash } or similar
        const hash = data.IpfsHash || data.ipfsHash || data.cid ||
                     (data.result && data.result[0]) || '';

        if (!hash) {
            // Try alternate response format
            console.log('IPFS response:', data);
            throw new Error('Could not parse IPFS hash from response');
        }

        return `ipfs://${hash}`;
    }

    async function uploadMetadataToIPFS(metadata) {
        const clientId = state.settings.thirdwebClientId || localStorage.getItem('soundmint_tw_clientId');
        if (!clientId) {
            throw new Error('Thirdweb Client ID not configured');
        }

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
        const hash = data.IpfsHash || data.ipfsHash || data.cid ||
                     (data.result && data.result[0]) || '';
        return `ipfs://${hash}`;
    }

    // ===================== NFT MINTING =====================
    async function mintNFT() {
        if (!state.address) {
            toast('Connect your wallet first', 'error');
            return;
        }

        const title = $('#songTitle').value.trim();
        const artist = $('#artistName').value.trim();
        const description = $('#songDescription').value.trim();
        const genre = $('#songGenre').value;
        const editions = parseInt($('#editions').value) || 100;
        const price = parseFloat($('#nftPrice').value) || 0.01;
        const royalty = parseInt($('#royaltyPercent').value) || 10;
        const acceptToken = $('#enableTokenPayment').checked;
        const tokenPrice = acceptToken ? parseFloat($('#tokenPrice').value) : null;

        if (!title || !artist) {
            toast('Song title and artist name are required', 'error');
            return;
        }
        if (!state.audioFile) {
            toast('Please upload an audio file', 'error');
            return;
        }
        if (!state.coverFile) {
            toast('Please upload cover artwork', 'error');
            return;
        }

        const mintBtn = $('#mintBtn');
        mintBtn.disabled = true;
        mintBtn.innerHTML = '<div class="spinner"></div> Minting...';

        const progress = $('#mintProgress');
        progress.classList.remove('hidden');

        try {
            // Step 1: Upload audio to IPFS (30%)
            updateMintProgress(10, 'Uploading audio to IPFS...');
            const audioURI = await uploadToIPFS(state.audioFile);
            updateMintProgress(30, 'Audio uploaded!');

            // Step 2: Upload cover art to IPFS (50%)
            updateMintProgress(35, 'Uploading cover art to IPFS...');
            const coverURI = await uploadToIPFS(state.coverFile);
            updateMintProgress(50, 'Cover art uploaded!');

            // Step 3: Build metadata
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

            // Upload metadata to IPFS (65%)
            updateMintProgress(60, 'Uploading metadata to IPFS...');
            const metadataURI = await uploadMetadataToIPFS(metadata);
            updateMintProgress(65, 'Metadata uploaded!');

            // Step 4: Mint NFT on Base via Thirdweb or direct contract
            updateMintProgress(70, 'Minting NFT on Base...');
            let txHash = null;
            let nftContractAddr = state.settings.nftContract;
            let tokenId = state.songs.length;

            if (state.thirdwebSDK && nftContractAddr) {
                // Use Thirdweb SDK to call mint on existing ERC-1155
                txHash = await mintWithThirdweb(nftContractAddr, metadataURI, editions);
            } else if (nftContractAddr) {
                // Direct contract interaction
                txHash = await mintDirect(nftContractAddr, metadataURI, editions);
            } else {
                // Deploy new ERC-1155 contract first
                updateMintProgress(72, 'Deploying NFT collection contract...');
                const deployResult = await deployNFTCollection(artist);
                nftContractAddr = deployResult.address;
                state.settings.nftContract = nftContractAddr;
                saveState();

                updateMintProgress(80, 'Minting NFT...');
                txHash = await mintDirect(nftContractAddr, metadataURI, editions);
            }

            updateMintProgress(90, 'Confirming transaction...');

            // Step 5: Record locally
            const song = {
                id: Date.now().toString(),
                title,
                artist,
                description,
                genre,
                editions,
                price,
                royalty,
                acceptToken,
                tokenPrice,
                audioURI,
                coverURI,
                metadataURI,
                contractAddress: nftContractAddr,
                tokenId,
                txHash,
                status: 'minted',
                createdAt: Date.now(),
            };

            state.songs.push(song);
            saveState();

            updateMintProgress(100, 'NFT minted successfully!');
            toast(`"${title}" minted as NFT on Base!`, 'success');

            // Reset form
            setTimeout(() => {
                resetUploadForm();
                navigateTo('my-nfts');
            }, 2000);

        } catch (err) {
            console.error('Mint error:', err);
            toast('Minting failed: ' + err.message, 'error');
        } finally {
            mintBtn.disabled = false;
            mintBtn.innerHTML = '🎵 Mint Music NFT';
        }
    }

    function updateMintProgress(percent, text) {
        $('#mintProgressBar').style.width = percent + '%';
        $('#mintProgressText').textContent = percent + '%';
        if (text) $('#mintStatusText').textContent = text;
    }

    async function mintWithThirdweb(contractAddr, metadataURI, quantity) {
        // Thirdweb v5 contract interaction
        const chain = CONFIG.USE_TESTNET
            ? thirdweb.defineChain(CONFIG.BASE_SEPOLIA_CHAIN_ID)
            : thirdweb.defineChain(CONFIG.BASE_CHAIN_ID);

        const contract = thirdweb.getContract({
            client: state.thirdwebSDK,
            chain,
            address: contractAddr,
        });

        // ERC-1155 mint via Thirdweb
        const tx = await thirdweb.sendTransaction({
            contract,
            method: 'function mint(address to, uint256 id, uint256 amount, string memory uri)',
            params: [state.address, state.songs.length, quantity, metadataURI],
        });

        return tx.transactionHash;
    }

    async function mintDirect(contractAddr, metadataURI, quantity) {
        // Build ERC-1155 mint calldata manually
        // mint(address to, uint256 id, uint256 amount, bytes data)
        const tokenId = state.songs.length;

        // Simple ERC-1155 mint function selector: mint(address,uint256,uint256,bytes)
        // keccak256("mint(address,uint256,uint256,bytes)") = 0x731133e9
        const iface = new ethers.Interface([
            'function mint(address to, uint256 id, uint256 amount, bytes data)',
        ]);
        const calldata = iface.encodeFunctionData('mint', [
            state.address,
            tokenId,
            quantity,
            '0x',
        ]);

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

    async function deployNFTCollection(name) {
        if (!state.thirdwebSDK) {
            // Manual deployment using CREATE2 or bytecode is complex
            // For now, prompt user to deploy via Thirdweb dashboard
            toast('Set up your NFT Collection contract address in Settings, or configure Thirdweb Client ID', 'warning');
            throw new Error('No NFT collection contract. Deploy one at thirdweb.com/explore/erc-1155 on Base, then paste the address in Settings.');
        }

        const chain = CONFIG.USE_TESTNET
            ? thirdweb.defineChain(CONFIG.BASE_SEPOLIA_CHAIN_ID)
            : thirdweb.defineChain(CONFIG.BASE_CHAIN_ID);

        // Use Thirdweb deployContract
        const contractAddress = await thirdweb.deployPublishedContract({
            client: state.thirdwebSDK,
            chain,
            account: state.address,
            contractId: 'TokenERC1155',
            constructorParams: {
                defaultAdmin: state.address,
                name: name + ' Music Collection',
                symbol: 'MUSIC',
                contractURI: '',
                trustedForwarders: [],
                saleRecipient: state.address,
                royaltyRecipient: state.address,
                royaltyBps: 1000, // 10%
                platformFeeBps: 0,
                platformFeeRecipient: state.address,
            },
        });

        return { address: contractAddress };
    }

    function resetUploadForm() {
        $('#songTitle').value = '';
        $('#artistName').value = '';
        $('#songDescription').value = '';
        $('#songGenre').value = '';
        $('#editions').value = '100';
        $('#nftPrice').value = '0.01';
        $('#royaltyPercent').value = '10';
        $('#enableTokenPayment').checked = false;
        $('#tokenPriceGroup').classList.add('hidden');
        removeFile('audio');
        removeFile('cover');
        $('#mintProgress').classList.add('hidden');
        updateMintProgress(0, '');
    }

    // ===================== NFT PREVIEW =====================
    function previewNFT() {
        const title = $('#songTitle').value.trim() || 'Untitled Track';
        const artist = $('#artistName').value.trim() || 'Unknown Artist';
        const genre = $('#songGenre').value || 'Music';
        const price = $('#nftPrice').value || '0.01';
        const editions = $('#editions').value || '100';

        let coverHTML = '<div style="width:100%;aspect-ratio:1;background:var(--gradient-primary);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:80px;">🎵</div>';
        if (state.coverFile) {
            const url = URL.createObjectURL(state.coverFile);
            coverHTML = `<img src="${url}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px;">`;
        }

        $('#previewContent').innerHTML = `
            ${coverHTML}
            <div style="padding: 20px 0;">
                <h3 style="font-size: 22px; margin-bottom: 4px;">${title}</h3>
                <p style="color: var(--text-muted); margin-bottom: 16px;">${artist} · ${genre}</p>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-size: 13px; color: var(--text-muted);">Price</div>
                        <div style="font-size: 20px; font-weight: 700; color: var(--base-blue);">${price} ETH</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 13px; color: var(--text-muted);">Editions</div>
                        <div style="font-size: 20px; font-weight: 700;">${editions}</div>
                    </div>
                </div>
                <div style="margin-top: 12px; padding: 12px; background: var(--bg-input); border-radius: 8px; font-size: 12px; color: var(--text-muted);">
                    🔵 Will be minted on Base Network
                </div>
            </div>
        `;
        openModal('previewModal');
    }

    // ===================== TOKEN DEPLOYMENT =====================
    async function deployToken() {
        if (!state.address) {
            toast('Connect your wallet first', 'error');
            return;
        }

        const name = $('#tokenName').value.trim();
        const symbol = $('#tokenSymbol').value.trim().toUpperCase();
        const supply = parseInt($('#tokenInitialSupply').value) || 1000000;
        const description = $('#tokenDescription').value.trim();

        if (!name || !symbol) {
            toast('Token name and symbol are required', 'error');
            return;
        }

        try {
            const progress = $('#deployProgress');
            progress.classList.remove('hidden');
            $('#deployProgressBar').style.width = '20%';
            $('#deployStatusText').textContent = 'Deploying ERC-20 token contract on Base...';

            let tokenAddress = null;

            if (state.thirdwebSDK && typeof thirdweb !== 'undefined') {
                // Deploy via Thirdweb
                const chain = CONFIG.USE_TESTNET
                    ? thirdweb.defineChain(CONFIG.BASE_SEPOLIA_CHAIN_ID)
                    : thirdweb.defineChain(CONFIG.BASE_CHAIN_ID);

                $('#deployProgressBar').style.width = '40%';
                $('#deployStatusText').textContent = 'Sending deployment transaction...';

                tokenAddress = await thirdweb.deployPublishedContract({
                    client: state.thirdwebSDK,
                    chain,
                    account: state.address,
                    contractId: 'TokenERC20',
                    constructorParams: {
                        defaultAdmin: state.address,
                        name: name,
                        symbol: symbol,
                        contractURI: '',
                        trustedForwarders: [],
                        primarySaleRecipient: state.address,
                        platformFeeRecipient: state.address,
                        platformFeeBps: 0,
                    },
                });
            } else {
                // Deploy using raw bytecode (minimal ERC-20)
                // In production, use Thirdweb dashboard or pre-compiled bytecode
                toast('Configure Thirdweb Client ID in Settings, or deploy at thirdweb.com/explore/erc-20', 'warning');
                throw new Error('Deploy your ERC-20 token at thirdweb.com/explore/erc-20 on Base network, then paste the address in Settings.');
            }

            $('#deployProgressBar').style.width = '80%';
            $('#deployStatusText').textContent = 'Minting initial supply...';

            state.tokenConfig = {
                name,
                symbol,
                description,
                address: tokenAddress,
                supply: supply,
                deployedAt: Date.now(),
            };

            state.settings.tokenContract = tokenAddress;
            saveState();

            $('#deployProgressBar').style.width = '100%';
            $('#deployStatusText').textContent = 'Token deployed successfully!';

            toast(`${symbol} token deployed on Base! Address: ${shortAddr(tokenAddress)}`, 'success');

            setTimeout(() => refreshTokenPage(), 1500);

        } catch (err) {
            console.error('Token deployment error:', err);
            toast('Token deployment failed: ' + err.message, 'error');
            $('#deployProgress').classList.add('hidden');
        }
    }

    async function mintTokens() {
        if (!state.address || !state.tokenConfig) {
            toast('Connect wallet and deploy token first', 'error');
            return;
        }

        const amount = parseInt($('#mintTokenAmount').value) || 1000;

        try {
            toast('Minting tokens...', 'info');

            // Call mint on the ERC-20 contract
            const amountWei = '0x' + (BigInt(amount) * BigInt(10 ** 18)).toString(16);

            // mintTo(address, uint256) = 0x449a52f8
            const to = state.address.slice(2).padStart(64, '0');
            const value = amountWei.slice(2).padStart(64, '0');
            const calldata = '0x449a52f8' + to + value;

            const txHash = await window.ethereum.request({
                method: 'eth_sendTransaction',
                params: [{
                    from: state.address,
                    to: state.tokenConfig.address,
                    data: calldata,
                    chainId: '0x' + getChainId().toString(16),
                }],
            });

            state.tokenConfig.supply += amount;
            saveState();

            toast(`Minted ${amount.toLocaleString()} ${state.tokenConfig.symbol} tokens!`, 'success');
            refreshTokenPage();
        } catch (err) {
            console.error('Mint tokens error:', err);
            toast('Token mint failed: ' + err.message, 'error');
        }
    }

    async function airdropTokens() {
        if (!state.address || !state.tokenConfig) {
            toast('Connect wallet and deploy token first', 'error');
            return;
        }

        const recipient = $('#airdropAddress').value.trim();
        const amount = parseInt($('#airdropAmount').value) || 100;

        if (!recipient || !recipient.startsWith('0x') || recipient.length !== 42) {
            toast('Enter a valid wallet address', 'error');
            return;
        }

        try {
            toast('Sending airdrop...', 'info');

            const amountWei = '0x' + (BigInt(amount) * BigInt(10 ** 18)).toString(16);

            // transfer(address, uint256) = 0xa9059cbb
            const to = recipient.slice(2).padStart(64, '0');
            const value = amountWei.slice(2).padStart(64, '0');
            const calldata = '0xa9059cbb' + to + value;

            const txHash = await window.ethereum.request({
                method: 'eth_sendTransaction',
                params: [{
                    from: state.address,
                    to: state.tokenConfig.address,
                    data: calldata,
                    chainId: '0x' + getChainId().toString(16),
                }],
            });

            toast(`Airdropped ${amount.toLocaleString()} ${state.tokenConfig.symbol} to ${shortAddr(recipient)}!`, 'success');
        } catch (err) {
            console.error('Airdrop error:', err);
            toast('Airdrop failed: ' + err.message, 'error');
        }
    }

    // ===================== MARKETPLACE =====================
    async function createListing() {
        if (!state.address) {
            toast('Connect your wallet first', 'error');
            return;
        }

        const nftId = $('#listNftSelect').value;
        const saleType = $('#saleType').value;
        const currency = $('#saleCurrency').value;
        const price = parseFloat($('#listingPrice').value) || 0.01;
        const qty = parseInt($('#listingQty').value) || 1;

        if (!nftId) {
            toast('Select an NFT to list', 'error');
            return;
        }

        const song = state.songs.find(s => s.id === nftId);
        if (!song) {
            toast('NFT not found', 'error');
            return;
        }

        try {
            toast('Creating listing on Base marketplace...', 'info');

            // If we have a marketplace contract, call createListing
            const marketAddr = state.settings.marketplaceContract;

            if (marketAddr) {
                // Approve NFT transfer first
                // Then call createListing on marketplace
                toast('Approving NFT for marketplace...', 'info');

                // setApprovalForAll(address operator, bool approved)
                const operatorPadded = marketAddr.slice(2).padStart(64, '0');
                const approveData = '0xa22cb465' + operatorPadded + '0000000000000000000000000000000000000000000000000000000000000001';

                await window.ethereum.request({
                    method: 'eth_sendTransaction',
                    params: [{
                        from: state.address,
                        to: song.contractAddress,
                        data: approveData,
                        chainId: '0x' + getChainId().toString(16),
                    }],
                });
            }

            const listing = {
                id: Date.now().toString(),
                songId: song.id,
                songTitle: song.title,
                artist: song.artist,
                coverURI: song.coverURI,
                saleType,
                currency,
                price,
                quantity: qty,
                remaining: qty,
                contractAddress: song.contractAddress,
                tokenId: song.tokenId,
                status: 'active',
                createdAt: Date.now(),
            };

            state.listings.push(listing);
            song.status = 'listed';
            saveState();

            toast(`"${song.title}" listed for ${price} ${currency === 'eth' ? 'ETH' : state.tokenConfig?.symbol || 'tokens'}!`, 'success');
            refreshMarketplace();

        } catch (err) {
            console.error('Listing error:', err);
            toast('Listing failed: ' + err.message, 'error');
        }
    }

    // ===================== SETTINGS =====================
    function saveSettings() {
        state.settings.artistName = $('#settingArtistName').value.trim();
        state.settings.email = $('#settingEmail').value.trim();
        state.settings.bio = $('#settingBio').value.trim();
        saveState();
        toast('Profile saved!', 'success');
    }

    function saveThirdwebConfig() {
        const clientId = $('#settingClientId').value.trim();
        const secretKey = $('#settingSecretKey').value.trim();
        state.settings.thirdwebClientId = clientId;
        state.settings.thirdwebSecretKey = secretKey;
        localStorage.setItem('soundmint_tw_clientId', clientId);
        saveState();
        toast('Thirdweb configuration saved!', 'success');

        // Reinitialize SDK
        if (state.address) initThirdweb();
    }

    function saveContracts() {
        state.settings.nftContract = $('#settingNftContract').value.trim();
        state.settings.marketplaceContract = $('#settingMarketplaceContract').value.trim();
        state.settings.tokenContract = $('#settingTokenContract').value.trim();

        if (state.settings.tokenContract && !state.tokenConfig) {
            state.tokenConfig = {
                name: 'Artist Token',
                symbol: 'ART',
                address: state.settings.tokenContract,
                supply: 0,
                deployedAt: Date.now(),
            };
        }

        saveState();
        toast('Contract addresses saved!', 'success');
        if (state.address) loadContracts();
    }

    function saveTokenGating() {
        state.settings.minTokenDiscount = parseInt($('#minTokenDiscount').value) || 100;
        state.settings.tokenDiscountPercent = parseInt($('#tokenDiscountPercent').value) || 20;
        saveState();
        toast('Token gate settings saved!', 'success');
    }

    // ===================== UI RENDERING =====================
    function refreshDashboard() {
        $('#statSongs').textContent = state.songs.length;
        $('#statNFTs').textContent = state.songs.filter(s => s.status !== 'pending').length;

        const totalRev = state.sales.reduce((sum, s) => sum + (s.price || 0), 0);
        $('#statRevenue').textContent = totalRev.toFixed(4) + ' ETH';

        const tokenSupply = state.tokenConfig ? state.tokenConfig.supply.toLocaleString() : '0';
        $('#statTokenSupply').textContent = tokenSupply;

        $('#nftCountBadge').textContent = state.songs.length;

        // Recent uploads
        const recent = state.songs.slice(-3).reverse();
        if (recent.length > 0) {
            $('#recentUploads').innerHTML = recent.map(s => `
                <div style="display:flex; align-items:center; gap:12px; padding:12px 0; border-bottom:1px solid var(--border-color);">
                    <div style="width:40px;height:40px;border-radius:8px;background:var(--gradient-primary);display:flex;align-items:center;justify-content:center;">🎵</div>
                    <div style="flex:1;">
                        <div style="font-weight:600;font-size:14px;">${s.title}</div>
                        <div style="font-size:12px;color:var(--text-muted);">${s.artist}</div>
                    </div>
                    <span class="nft-status-badge ${s.status}">${s.status}</span>
                </div>
            `).join('');
        }

        // Recent sales
        const recentSales = state.sales.slice(-3).reverse();
        if (recentSales.length > 0) {
            $('#recentSales').innerHTML = recentSales.map(s => `
                <div style="display:flex; align-items:center; gap:12px; padding:12px 0; border-bottom:1px solid var(--border-color);">
                    <div style="width:40px;height:40px;border-radius:8px;background:var(--gradient-accent);display:flex;align-items:center;justify-content:center;">💰</div>
                    <div style="flex:1;">
                        <div style="font-weight:600;font-size:14px;">${s.songTitle}</div>
                        <div style="font-size:12px;color:var(--text-muted);">${shortAddr(s.buyer)}</div>
                    </div>
                    <div style="font-weight:700;color:var(--base-blue);">${s.price} ETH</div>
                </div>
            `).join('');
        }
    }

    function renderNFTGrid(filter = 'all') {
        const filtered = filter === 'all' ? state.songs :
            state.songs.filter(s => s.status === filter);

        if (filtered.length === 0) {
            $('#nftGrid').innerHTML = `
                <p class="text-muted text-center" style="grid-column: 1/-1; padding: 60px 0;">
                    ${filter === 'all' ? 'No NFTs yet. Upload and mint your first song!' : `No ${filter} NFTs`}
                </p>
            `;
            return;
        }

        $('#nftGrid').innerHTML = filtered.map(song => `
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
                    <div style="margin-top:12px; display:flex; gap:8px;">
                        ${song.status === 'minted' ? `<button class="btn btn-primary btn-sm" onclick="MusicNFT.quickList('${song.id}')">List for Sale</button>` : ''}
                        <a href="${getExplorer()}/tx/${song.txHash}" target="_blank" class="btn btn-secondary btn-sm">View TX</a>
                    </div>
                </div>
            </div>
        `).join('');
    }

    function filterNFTs(filter) {
        renderNFTGrid(filter);
    }

    function refreshMarketplace() {
        // Populate NFT select
        const select = $('#listNftSelect');
        const mintedSongs = state.songs.filter(s => s.status === 'minted');
        select.innerHTML = '<option value="">Choose an NFT...</option>' +
            mintedSongs.map(s => `<option value="${s.id}">${s.title} — ${s.artist}</option>`).join('');

        // Currency options
        const currSelect = $('#saleCurrency');
        currSelect.innerHTML = '<option value="eth">ETH (Base)</option>';
        if (state.tokenConfig) {
            currSelect.innerHTML += `<option value="custom">${state.tokenConfig.symbol}</option>`;
        }

        // Active listings
        const active = state.listings.filter(l => l.status === 'active');
        if (active.length > 0) {
            $('#activeListings').innerHTML = `
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
        $('#totalSalesValue').textContent = state.sales.reduce((s, sale) => s + (sale.price || 0), 0).toFixed(4) + ' ETH';
        $('#totalSalesCount').textContent = state.sales.length;
        const uniqueBuyerSet = new Set(state.sales.map(s => s.buyer));
        $('#uniqueBuyers').textContent = uniqueBuyerSet.size;

        if (state.sales.length > 0) {
            $('#salesTableBody').innerHTML = state.sales.reverse().map(s => `
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
            $('#deployToken').classList.add('hidden');
            $('#tokenInfo').classList.remove('hidden');
            $('#tokenNameDisplay').textContent = state.tokenConfig.name;
            $('#tokenSymbolDisplay').textContent = state.tokenConfig.symbol;
            $('#tokenSupplyDisplay').textContent = 'Supply: ' + (state.tokenConfig.supply || 0).toLocaleString();
            $('#tokenContractDisplay').textContent = state.tokenConfig.address;
            $('#tokenIconDisplay').textContent = state.tokenConfig.symbol.charAt(0);
        } else {
            $('#deployToken').classList.remove('hidden');
            $('#tokenInfo').classList.add('hidden');
        }
    }

    function quickList(songId) {
        navigateTo('marketplace');
        setTimeout(() => {
            $('#listNftSelect').value = songId;
        }, 100);
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

    // ===================== AUDIO PLAYER =====================
    function playSong(songId) {
        const song = state.songs.find(s => s.id === songId);
        if (!song || !song.audioURI) {
            toast('Audio not available', 'error');
            return;
        }

        const audioUrl = song.audioURI.replace('ipfs://', CONFIG.IPFS_GATEWAY);
        const audio = $('#audioElement');
        audio.src = audioUrl;
        audio.play();
        state.isPlaying = true;

        $('#playerTitle').textContent = song.title;
        $('#playerArtist').textContent = song.artist;
        $('#playerPlayBtn').textContent = '⏸';
        $('#audioPlayer').classList.add('visible');

        audio.addEventListener('timeupdate', () => {
            const pct = (audio.currentTime / audio.duration) * 100;
            $('#playerProgress').style.width = pct + '%';

            const cur = formatTime(audio.currentTime);
            const dur = formatTime(audio.duration);
            $('#playerTime').textContent = `${cur} / ${dur}`;
        });

        audio.addEventListener('ended', () => {
            state.isPlaying = false;
            $('#playerPlayBtn').textContent = '▶';
        });
    }

    function playerToggle() {
        const audio = $('#audioElement');
        if (state.isPlaying) {
            audio.pause();
            state.isPlaying = false;
            $('#playerPlayBtn').textContent = '▶';
        } else {
            audio.play();
            state.isPlaying = true;
            $('#playerPlayBtn').textContent = '⏸';
        }
    }

    function playerSeek(event) {
        const audio = $('#audioElement');
        const bar = event.currentTarget;
        const rect = bar.getBoundingClientRect();
        const pct = (event.clientX - rect.left) / rect.width;
        audio.currentTime = pct * audio.duration;
    }

    function playerPrev() { /* Implement playlist logic */ }
    function playerNext() { /* Implement playlist logic */ }

    function formatTime(sec) {
        if (isNaN(sec)) return '0:00';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    // ===================== MODALS =====================
    function openModal(id) {
        $(`#${id}`).classList.add('active');
    }

    function closeModal(id) {
        $(`#${id}`).classList.remove('active');
    }

    // ===================== INIT =====================
    function loadSettings() {
        if (state.settings.artistName) {
            if ($('#settingArtistName')) $('#settingArtistName').value = state.settings.artistName;
        }
        if (state.settings.email) {
            if ($('#settingEmail')) $('#settingEmail').value = state.settings.email;
        }
        if (state.settings.bio) {
            if ($('#settingBio')) $('#settingBio').value = state.settings.bio;
        }
        if (state.settings.thirdwebClientId) {
            if ($('#settingClientId')) $('#settingClientId').value = state.settings.thirdwebClientId;
        }
        if (state.settings.nftContract) {
            if ($('#settingNftContract')) $('#settingNftContract').value = state.settings.nftContract;
        }
        if (state.settings.marketplaceContract) {
            if ($('#settingMarketplaceContract')) $('#settingMarketplaceContract').value = state.settings.marketplaceContract;
        }
        if (state.settings.tokenContract) {
            if ($('#settingTokenContract')) $('#settingTokenContract').value = state.settings.tokenContract;
        }
    }

    function init() {
        initNavigation();
        initFileUploads();
        loadSettings();
        refreshDashboard();
        refreshTokenPage();

        // Auto-connect wallet if previously connected
        if (window.ethereum && window.ethereum.selectedAddress) {
            connectWallet();
        }

        console.log('%c🎵 SoundMint — Music NFT Platform', 'color: #0052FF; font-size: 20px; font-weight: bold;');
        console.log('%cNetwork: Base | Owner: ' + CONFIG.OWNER_WALLET, 'color: #8B5CF6; font-size: 12px;');
    }

    // Boot
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ===================== PUBLIC API =====================
    return {
        connectWallet,
        mintNFT,
        previewNFT,
        deployToken,
        mintTokens,
        airdropTokens,
        createListing,
        cancelListing,
        quickList,
        saveSettings,
        saveThirdwebConfig,
        saveContracts,
        saveTokenGating,
        playSong,
        playerToggle,
        playerPrev,
        playerNext,
        playerSeek,
        removeFile,
        openModal,
        closeModal,
    };
})();

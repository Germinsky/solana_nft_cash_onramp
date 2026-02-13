<?php
/**
 * Plugin Name: SoundMint — Music NFT Platform
 * Plugin URI: https://github.com/Germinsky/music-nft-platform
 * Description: Music NFT dashboard for artists — upload songs, mint NFTs, deploy custom ERC-20 tokens, and sell on Base network using Thirdweb SDK
 * Version: 1.0.0
 * Author: Digital Prophets
 * Author URI: https://digitalprophets.blog
 * License: MIT
 * Text Domain: soundmint
 * Requires at least: 5.8
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) exit;

define('SOUNDMINT_VERSION', '1.0.0');
define('SOUNDMINT_DIR', plugin_dir_path(__FILE__));
define('SOUNDMINT_URL', plugin_dir_url(__FILE__));
define('SOUNDMINT_OWNER_WALLET', '0xd46d5E0EBC17FAc1cb37e894A77F7d75A69Da944');

// ============================================================
// MAIN PLUGIN CLASS
// ============================================================
class SoundMint_Plugin {

    private static $instance = null;

    public static function instance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        register_activation_hook(__FILE__, [$this, 'activate']);
        register_deactivation_hook(__FILE__, [$this, 'deactivate']);

        // Admin
        add_action('admin_menu', [$this, 'admin_menu']);
        add_action('admin_init', [$this, 'register_settings']);
        add_action('admin_enqueue_scripts', [$this, 'admin_assets']);

        // Frontend
        add_action('wp_enqueue_scripts', [$this, 'frontend_assets']);

        // Shortcodes
        add_shortcode('soundmint_dashboard', [$this, 'shortcode_dashboard']);
        add_shortcode('soundmint_upload', [$this, 'shortcode_upload']);
        add_shortcode('soundmint_gallery', [$this, 'shortcode_gallery']);
        add_shortcode('soundmint_marketplace', [$this, 'shortcode_marketplace']);
        add_shortcode('soundmint_token', [$this, 'shortcode_token']);
        add_shortcode('soundmint_player', [$this, 'shortcode_player']);

        // AJAX endpoints
        add_action('wp_ajax_soundmint_save_nft', [$this, 'ajax_save_nft']);
        add_action('wp_ajax_soundmint_get_nfts', [$this, 'ajax_get_nfts']);
        add_action('wp_ajax_soundmint_save_listing', [$this, 'ajax_save_listing']);
        add_action('wp_ajax_soundmint_get_listings', [$this, 'ajax_get_listings']);
        add_action('wp_ajax_soundmint_record_sale', [$this, 'ajax_record_sale']);
        add_action('wp_ajax_nopriv_soundmint_get_listings', [$this, 'ajax_get_listings']);
        add_action('wp_ajax_nopriv_soundmint_get_nfts', [$this, 'ajax_get_nfts']);

        // REST API
        add_action('rest_api_init', [$this, 'register_rest_routes']);
    }

    // ----------------------------------------------------------------
    // ACTIVATION & DB
    // ----------------------------------------------------------------
    public function activate() {
        global $wpdb;
        $charset = $wpdb->get_charset_collate();

        // NFTs table
        $wpdb->query("CREATE TABLE IF NOT EXISTS {$wpdb->prefix}soundmint_nfts (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            wallet_address VARCHAR(42) NOT NULL,
            title VARCHAR(255) NOT NULL,
            artist VARCHAR(255) NOT NULL,
            description TEXT,
            genre VARCHAR(50),
            editions INT DEFAULT 100,
            price DECIMAL(18,8) DEFAULT 0,
            royalty INT DEFAULT 10,
            audio_uri TEXT,
            cover_uri TEXT,
            metadata_uri TEXT,
            contract_address VARCHAR(42),
            token_id BIGINT UNSIGNED DEFAULT 0,
            tx_hash VARCHAR(66),
            status VARCHAR(20) DEFAULT 'minted',
            accept_token TINYINT(1) DEFAULT 0,
            token_price DECIMAL(18,8) DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_wallet (wallet_address),
            INDEX idx_status (status)
        ) $charset;");

        // Listings table
        $wpdb->query("CREATE TABLE IF NOT EXISTS {$wpdb->prefix}soundmint_listings (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            nft_id BIGINT UNSIGNED NOT NULL,
            seller_address VARCHAR(42) NOT NULL,
            sale_type VARCHAR(20) DEFAULT 'fixed',
            currency VARCHAR(20) DEFAULT 'eth',
            price DECIMAL(18,8) DEFAULT 0,
            quantity INT DEFAULT 1,
            remaining INT DEFAULT 1,
            status VARCHAR(20) DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_status (status),
            INDEX idx_seller (seller_address)
        ) $charset;");

        // Sales table
        $wpdb->query("CREATE TABLE IF NOT EXISTS {$wpdb->prefix}soundmint_sales (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            nft_id BIGINT UNSIGNED NOT NULL,
            listing_id BIGINT UNSIGNED,
            buyer_address VARCHAR(42) NOT NULL,
            seller_address VARCHAR(42) NOT NULL,
            price DECIMAL(18,8) DEFAULT 0,
            currency VARCHAR(20) DEFAULT 'eth',
            tx_hash VARCHAR(66),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_seller (seller_address),
            INDEX idx_buyer (buyer_address)
        ) $charset;");

        // Tokens table
        $wpdb->query("CREATE TABLE IF NOT EXISTS {$wpdb->prefix}soundmint_tokens (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            wallet_address VARCHAR(42) NOT NULL,
            name VARCHAR(100) NOT NULL,
            symbol VARCHAR(10) NOT NULL,
            contract_address VARCHAR(42),
            initial_supply BIGINT UNSIGNED DEFAULT 0,
            description TEXT,
            deployed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_wallet (wallet_address)
        ) $charset;");

        // Default options
        $defaults = [
            'soundmint_network'           => 'base-sepolia',
            'soundmint_thirdweb_client_id'=> '',
            'soundmint_owner_wallet'      => SOUNDMINT_OWNER_WALLET,
            'soundmint_nft_contract'      => '',
            'soundmint_marketplace_contract' => '',
            'soundmint_token_contract'    => '',
            'soundmint_primary_color'     => '#0052FF',
            'soundmint_accent_color'      => '#8B5CF6',
        ];

        foreach ($defaults as $key => $val) {
            if (get_option($key) === false) {
                add_option($key, $val);
            }
        }

        flush_rewrite_rules();
    }

    public function deactivate() {
        flush_rewrite_rules();
    }

    // ----------------------------------------------------------------
    // ADMIN MENU & SETTINGS
    // ----------------------------------------------------------------
    public function admin_menu() {
        add_menu_page(
            'SoundMint',
            'SoundMint',
            'manage_options',
            'soundmint',
            [$this, 'admin_dashboard_page'],
            'dashicons-format-audio',
            30
        );

        add_submenu_page('soundmint', 'Settings', 'Settings', 'manage_options', 'soundmint-settings', [$this, 'admin_settings_page']);
        add_submenu_page('soundmint', 'NFTs', 'NFTs', 'manage_options', 'soundmint-nfts', [$this, 'admin_nfts_page']);
        add_submenu_page('soundmint', 'Sales', 'Sales', 'manage_options', 'soundmint-sales', [$this, 'admin_sales_page']);
    }

    public function register_settings() {
        $fields = [
            'soundmint_network',
            'soundmint_thirdweb_client_id',
            'soundmint_owner_wallet',
            'soundmint_nft_contract',
            'soundmint_marketplace_contract',
            'soundmint_token_contract',
            'soundmint_primary_color',
            'soundmint_accent_color',
        ];
        foreach ($fields as $field) {
            register_setting('soundmint_settings', $field);
        }
    }

    public function admin_assets($hook) {
        if (strpos($hook, 'soundmint') === false) return;
        wp_enqueue_style('soundmint-admin', SOUNDMINT_URL . 'assets/css/admin.css', [], SOUNDMINT_VERSION);
    }

    // ----------------------------------------------------------------
    // ADMIN PAGES
    // ----------------------------------------------------------------
    public function admin_dashboard_page() {
        global $wpdb;
        $nft_count = $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}soundmint_nfts");
        $sale_count = $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}soundmint_sales");
        $total_rev = $wpdb->get_var("SELECT COALESCE(SUM(price), 0) FROM {$wpdb->prefix}soundmint_sales WHERE currency='eth'") ?: 0;
        $listing_count = $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}soundmint_listings WHERE status='active'");
        ?>
        <div class="wrap">
            <h1>🎵 SoundMint Dashboard</h1>
            <p>Music NFT Platform on Base Network — Powered by Thirdweb SDK</p>

            <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:20px; margin:24px 0;">
                <div class="soundmint-stat-card">
                    <h3><?php echo esc_html($nft_count); ?></h3>
                    <p>NFTs Minted</p>
                </div>
                <div class="soundmint-stat-card">
                    <h3><?php echo esc_html($listing_count); ?></h3>
                    <p>Active Listings</p>
                </div>
                <div class="soundmint-stat-card">
                    <h3><?php echo esc_html($sale_count); ?></h3>
                    <p>Total Sales</p>
                </div>
                <div class="soundmint-stat-card">
                    <h3><?php echo number_format((float)$total_rev, 4); ?> ETH</h3>
                    <p>Revenue</p>
                </div>
            </div>

            <h2>Shortcodes</h2>
            <table class="widefat" style="max-width:800px;">
                <thead><tr><th>Shortcode</th><th>Description</th></tr></thead>
                <tbody>
                    <tr><td><code>[soundmint_dashboard]</code></td><td>Full artist dashboard (upload, mint, sell, token, player)</td></tr>
                    <tr><td><code>[soundmint_upload]</code></td><td>Song upload & NFT minting form</td></tr>
                    <tr><td><code>[soundmint_gallery]</code></td><td>NFT gallery grid</td></tr>
                    <tr><td><code>[soundmint_marketplace]</code></td><td>Marketplace listings</td></tr>
                    <tr><td><code>[soundmint_token]</code></td><td>Artist token deploy/manage</td></tr>
                    <tr><td><code>[soundmint_player]</code></td><td>Audio player widget</td></tr>
                </tbody>
            </table>

            <h2 style="margin-top: 24px;">Quick Setup</h2>
            <ol>
                <li>Go to <strong>SoundMint → Settings</strong> and enter your Thirdweb Client ID</li>
                <li>Deploy NFT (ERC-1155) and Marketplace contracts at <a href="https://thirdweb.com/explore" target="_blank">thirdweb.com/explore</a> on Base</li>
                <li>Paste contract addresses in Settings</li>
                <li>Add <code>[soundmint_dashboard]</code> to any page</li>
                <li>Connect wallet, upload music, and mint NFTs!</li>
            </ol>
        </div>
        <?php
    }

    public function admin_settings_page() {
        ?>
        <div class="wrap">
            <h1>⚙️ SoundMint Settings</h1>
            <form method="post" action="options.php">
                <?php settings_fields('soundmint_settings'); ?>

                <h2>🔗 Network Configuration</h2>
                <table class="form-table">
                    <tr>
                        <th>Network</th>
                        <td>
                            <select name="soundmint_network">
                                <option value="base-sepolia" <?php selected(get_option('soundmint_network'), 'base-sepolia'); ?>>Base Sepolia (Testnet)</option>
                                <option value="base" <?php selected(get_option('soundmint_network'), 'base'); ?>>Base (Mainnet)</option>
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <th>Owner Wallet</th>
                        <td><input type="text" name="soundmint_owner_wallet" value="<?php echo esc_attr(get_option('soundmint_owner_wallet')); ?>" class="regular-text" placeholder="0x..."></td>
                    </tr>
                </table>

                <h2>🔑 Thirdweb SDK</h2>
                <table class="form-table">
                    <tr>
                        <th>Client ID</th>
                        <td>
                            <input type="text" name="soundmint_thirdweb_client_id" value="<?php echo esc_attr(get_option('soundmint_thirdweb_client_id')); ?>" class="regular-text" placeholder="Your Thirdweb Client ID">
                            <p class="description">Get one free at <a href="https://thirdweb.com/dashboard" target="_blank">thirdweb.com/dashboard</a></p>
                        </td>
                    </tr>
                </table>

                <h2>📄 Smart Contracts (Base Network)</h2>
                <table class="form-table">
                    <tr>
                        <th>NFT Collection (ERC-1155)</th>
                        <td><input type="text" name="soundmint_nft_contract" value="<?php echo esc_attr(get_option('soundmint_nft_contract')); ?>" class="regular-text" placeholder="0x..."></td>
                    </tr>
                    <tr>
                        <th>Marketplace Contract</th>
                        <td><input type="text" name="soundmint_marketplace_contract" value="<?php echo esc_attr(get_option('soundmint_marketplace_contract')); ?>" class="regular-text" placeholder="0x..."></td>
                    </tr>
                    <tr>
                        <th>Artist Token (ERC-20)</th>
                        <td><input type="text" name="soundmint_token_contract" value="<?php echo esc_attr(get_option('soundmint_token_contract')); ?>" class="regular-text" placeholder="0x..."></td>
                    </tr>
                </table>

                <h2>🎨 Appearance</h2>
                <table class="form-table">
                    <tr>
                        <th>Primary Color</th>
                        <td><input type="color" name="soundmint_primary_color" value="<?php echo esc_attr(get_option('soundmint_primary_color', '#0052FF')); ?>"></td>
                    </tr>
                    <tr>
                        <th>Accent Color</th>
                        <td><input type="color" name="soundmint_accent_color" value="<?php echo esc_attr(get_option('soundmint_accent_color', '#8B5CF6')); ?>"></td>
                    </tr>
                </table>

                <?php submit_button('Save Settings'); ?>
            </form>
        </div>
        <?php
    }

    public function admin_nfts_page() {
        global $wpdb;
        $nfts = $wpdb->get_results("SELECT * FROM {$wpdb->prefix}soundmint_nfts ORDER BY created_at DESC LIMIT 100");
        ?>
        <div class="wrap">
            <h1>💿 Minted NFTs</h1>
            <table class="widefat striped">
                <thead><tr><th>ID</th><th>Title</th><th>Artist</th><th>Price</th><th>Editions</th><th>Status</th><th>Wallet</th><th>Date</th></tr></thead>
                <tbody>
                    <?php if (empty($nfts)): ?>
                        <tr><td colspan="8">No NFTs minted yet.</td></tr>
                    <?php else: foreach ($nfts as $nft): ?>
                        <tr>
                            <td><?php echo esc_html($nft->id); ?></td>
                            <td><strong><?php echo esc_html($nft->title); ?></strong></td>
                            <td><?php echo esc_html($nft->artist); ?></td>
                            <td><?php echo esc_html($nft->price); ?> ETH</td>
                            <td><?php echo esc_html($nft->editions); ?></td>
                            <td><?php echo esc_html($nft->status); ?></td>
                            <td><code><?php echo esc_html(substr($nft->wallet_address, 0, 6) . '...' . substr($nft->wallet_address, -4)); ?></code></td>
                            <td><?php echo esc_html($nft->created_at); ?></td>
                        </tr>
                    <?php endforeach; endif; ?>
                </tbody>
            </table>
        </div>
        <?php
    }

    public function admin_sales_page() {
        global $wpdb;
        $sales = $wpdb->get_results("SELECT s.*, n.title, n.artist FROM {$wpdb->prefix}soundmint_sales s LEFT JOIN {$wpdb->prefix}soundmint_nfts n ON s.nft_id = n.id ORDER BY s.created_at DESC LIMIT 100");
        ?>
        <div class="wrap">
            <h1>💰 Sales History</h1>
            <table class="widefat striped">
                <thead><tr><th>ID</th><th>Song</th><th>Buyer</th><th>Seller</th><th>Price</th><th>Currency</th><th>TX</th><th>Date</th></tr></thead>
                <tbody>
                    <?php if (empty($sales)): ?>
                        <tr><td colspan="8">No sales recorded yet.</td></tr>
                    <?php else: foreach ($sales as $sale): ?>
                        <tr>
                            <td><?php echo esc_html($sale->id); ?></td>
                            <td><?php echo esc_html($sale->title ?? 'Unknown'); ?></td>
                            <td><code><?php echo esc_html(substr($sale->buyer_address, 0, 6) . '...' . substr($sale->buyer_address, -4)); ?></code></td>
                            <td><code><?php echo esc_html(substr($sale->seller_address, 0, 6) . '...' . substr($sale->seller_address, -4)); ?></code></td>
                            <td><?php echo esc_html($sale->price); ?></td>
                            <td><?php echo esc_html(strtoupper($sale->currency)); ?></td>
                            <td><code><?php echo esc_html(substr($sale->tx_hash ?? '', 0, 10) . '...'); ?></code></td>
                            <td><?php echo esc_html($sale->created_at); ?></td>
                        </tr>
                    <?php endforeach; endif; ?>
                </tbody>
            </table>
        </div>
        <?php
    }

    // ----------------------------------------------------------------
    // FRONTEND ASSETS
    // ----------------------------------------------------------------
    public function frontend_assets() {
        // Only load on pages with our shortcodes
        global $post;
        if (!$post || !has_shortcode($post->post_content, 'soundmint_dashboard') &&
            !has_shortcode($post->post_content, 'soundmint_upload') &&
            !has_shortcode($post->post_content, 'soundmint_gallery') &&
            !has_shortcode($post->post_content, 'soundmint_marketplace') &&
            !has_shortcode($post->post_content, 'soundmint_token') &&
            !has_shortcode($post->post_content, 'soundmint_player')) {
            return;
        }

        wp_enqueue_style('soundmint-dashboard', SOUNDMINT_URL . 'assets/css/dashboard.css', [], SOUNDMINT_VERSION);
        wp_enqueue_script('thirdweb-sdk', 'https://cdn.thirdweb.com/sdk/v5/latest/thirdweb.js', [], null, true);
        wp_enqueue_script('soundmint-app', SOUNDMINT_URL . 'assets/js/app.js', ['thirdweb-sdk'], SOUNDMINT_VERSION, true);

        $network = get_option('soundmint_network', 'base-sepolia');
        $is_testnet = ($network === 'base-sepolia');

        wp_localize_script('soundmint-app', 'soundmintWPConfig', [
            'ajaxUrl'           => admin_url('admin-ajax.php'),
            'restUrl'           => rest_url('soundmint/v1/'),
            'nonce'             => wp_create_nonce('soundmint_nonce'),
            'network'           => $network,
            'isTestnet'         => $is_testnet,
            'chainId'           => $is_testnet ? 84532 : 8453,
            'rpcUrl'            => $is_testnet ? 'https://sepolia.base.org' : 'https://mainnet.base.org',
            'explorer'          => $is_testnet ? 'https://sepolia.basescan.org' : 'https://basescan.org',
            'ownerWallet'       => get_option('soundmint_owner_wallet', SOUNDMINT_OWNER_WALLET),
            'thirdwebClientId'  => get_option('soundmint_thirdweb_client_id', ''),
            'nftContract'       => get_option('soundmint_nft_contract', ''),
            'marketplaceContract' => get_option('soundmint_marketplace_contract', ''),
            'tokenContract'     => get_option('soundmint_token_contract', ''),
            'primaryColor'      => get_option('soundmint_primary_color', '#0052FF'),
            'accentColor'       => get_option('soundmint_accent_color', '#8B5CF6'),
        ]);
    }

    // ----------------------------------------------------------------
    // SHORTCODES
    // ----------------------------------------------------------------
    public function shortcode_dashboard($atts) {
        ob_start();
        include SOUNDMINT_DIR . 'templates/dashboard.php';
        return ob_get_clean();
    }

    public function shortcode_upload($atts) {
        $a = shortcode_atts(['artist' => ''], $atts);
        ob_start();
        ?>
        <div class="soundmint-embed" id="soundmint-upload-widget">
            <div class="card">
                <div class="card-header"><h3>🎵 Upload & Mint Music NFT</h3></div>
                <div class="card-body">
                    <div class="form-group">
                        <label class="form-label">Audio File</label>
                        <div class="upload-zone" id="sm-audio-zone">
                            <div class="upload-icon">🎶</div>
                            <div class="upload-text"><h4>Drop audio here</h4><p>MP3, WAV, FLAC — Max 50MB</p></div>
                            <input type="file" id="sm-audio-file" accept="audio/*">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Cover Art</label>
                        <div class="upload-zone" id="sm-cover-zone">
                            <div class="upload-icon">🎨</div>
                            <div class="upload-text"><h4>Drop artwork here</h4><p>PNG, JPG — 1000x1000 recommended</p></div>
                            <input type="file" id="sm-cover-file" accept="image/*">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Song Title</label>
                            <input type="text" class="form-input" id="sm-title" placeholder="Song title">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Artist</label>
                            <input type="text" class="form-input" id="sm-artist" value="<?php echo esc_attr($a['artist']); ?>" placeholder="Artist name">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Price (ETH)</label>
                            <input type="number" class="form-input" id="sm-price" value="0.01" step="0.001" min="0">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Editions</label>
                            <input type="number" class="form-input" id="sm-editions" value="100" min="1">
                        </div>
                    </div>
                    <button class="btn btn-primary btn-lg" onclick="MusicNFT.mintNFT()">🎵 Mint Music NFT</button>
                </div>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    public function shortcode_gallery($atts) {
        $a = shortcode_atts(['columns' => 3, 'limit' => 12], $atts);
        ob_start();
        ?>
        <div class="soundmint-embed">
            <div class="nft-grid" id="soundmint-gallery" style="grid-template-columns: repeat(<?php echo (int)$a['columns']; ?>, 1fr);">
                <p class="text-muted text-center" style="grid-column:1/-1; padding:40px;">Loading NFTs...</p>
            </div>
        </div>
        <script>
        document.addEventListener('DOMContentLoaded', function() {
            fetch(soundmintWPConfig.ajaxUrl + '?action=soundmint_get_nfts&limit=<?php echo (int)$a['limit']; ?>')
            .then(r => r.json())
            .then(data => {
                if (data.success && data.data.length) {
                    const grid = document.getElementById('soundmint-gallery');
                    grid.innerHTML = data.data.map(nft => `
                        <div class="nft-card">
                            <div class="cover">
                                ${nft.cover_uri ? '<img src="' + nft.cover_uri.replace('ipfs://', 'https://ipfs.io/ipfs/') + '" alt="">' : '🎵'}
                            </div>
                            <div class="nft-info">
                                <div class="nft-title">${nft.title}</div>
                                <div class="nft-artist">${nft.artist}</div>
                                <div class="nft-meta">
                                    <div class="nft-price">${nft.price} ETH</div>
                                    <div class="nft-editions">${nft.editions} ed.</div>
                                </div>
                            </div>
                        </div>
                    `).join('');
                }
            });
        });
        </script>
        <?php
        return ob_get_clean();
    }

    public function shortcode_marketplace($atts) {
        ob_start();
        ?>
        <div class="soundmint-embed">
            <div class="section-header">
                <h3>🏪 Music NFT Marketplace</h3>
            </div>
            <div class="nft-grid" id="soundmint-marketplace-grid">
                <p class="text-muted text-center" style="grid-column:1/-1; padding:40px;">Loading listings...</p>
            </div>
        </div>
        <script>
        document.addEventListener('DOMContentLoaded', function() {
            fetch(soundmintWPConfig.ajaxUrl + '?action=soundmint_get_listings&status=active')
            .then(r => r.json())
            .then(data => {
                if (data.success && data.data.length) {
                    const grid = document.getElementById('soundmint-marketplace-grid');
                    grid.innerHTML = data.data.map(item => `
                        <div class="nft-card">
                            <div class="cover">
                                ${item.cover_uri ? '<img src="' + item.cover_uri.replace('ipfs://', 'https://ipfs.io/ipfs/') + '">' : '🎵'}
                            </div>
                            <div class="nft-info">
                                <div class="nft-title">${item.title}</div>
                                <div class="nft-artist">${item.artist}</div>
                                <div class="nft-meta">
                                    <div class="nft-price">${item.price} ${item.currency === 'eth' ? 'ETH' : 'Token'}</div>
                                    <div class="nft-editions">${item.remaining} left</div>
                                </div>
                                <button class="btn btn-primary btn-sm" style="margin-top:12px;width:100%;" onclick="MusicNFT.buyNFT(${item.listing_id})">
                                    Buy Now
                                </button>
                            </div>
                        </div>
                    `).join('');
                }
            });
        });
        </script>
        <?php
        return ob_get_clean();
    }

    public function shortcode_token($atts) {
        ob_start();
        $token_contract = get_option('soundmint_token_contract', '');
        ?>
        <div class="soundmint-embed">
            <div class="card">
                <div class="card-header"><h3>🪙 Artist Token</h3></div>
                <div class="card-body">
                    <?php if ($token_contract): ?>
                        <div class="token-card">
                            <div class="token-icon">🪙</div>
                            <div class="token-details">
                                <div class="token-name">Artist Token</div>
                                <div class="token-symbol" style="word-break:break-all;"><?php echo esc_html($token_contract); ?></div>
                                <div class="token-supply">On Base Network</div>
                            </div>
                        </div>
                    <?php else: ?>
                        <p class="text-muted">No artist token deployed yet. Deploy one in the dashboard!</p>
                    <?php endif; ?>
                </div>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    public function shortcode_player($atts) {
        ob_start();
        ?>
        <div class="soundmint-embed">
            <div class="audio-player" id="sm-player" style="position:relative; left:0; transform:none;">
                <div class="now-playing">
                    <div class="thumb" id="sm-player-thumb">🎵</div>
                    <div>
                        <div style="font-weight:600;" id="sm-player-title">Select a track</div>
                        <div style="font-size:12px;color:var(--text-muted);" id="sm-player-artist">—</div>
                    </div>
                </div>
                <div class="controls">
                    <button class="play-pause" id="sm-play-btn" onclick="MusicNFT.playerToggle()">▶</button>
                </div>
                <div class="progress-container">
                    <div class="progress-bar"><div class="progress" id="sm-player-progress"></div></div>
                </div>
                <div class="time" id="sm-player-time">0:00 / 0:00</div>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    // ----------------------------------------------------------------
    // AJAX HANDLERS
    // ----------------------------------------------------------------
    public function ajax_save_nft() {
        check_ajax_referer('soundmint_nonce', 'nonce');

        global $wpdb;
        $data = [
            'wallet_address'  => sanitize_text_field($_POST['wallet_address'] ?? ''),
            'title'           => sanitize_text_field($_POST['title'] ?? ''),
            'artist'          => sanitize_text_field($_POST['artist'] ?? ''),
            'description'     => sanitize_textarea_field($_POST['description'] ?? ''),
            'genre'           => sanitize_text_field($_POST['genre'] ?? ''),
            'editions'        => intval($_POST['editions'] ?? 100),
            'price'           => floatval($_POST['price'] ?? 0),
            'royalty'         => intval($_POST['royalty'] ?? 10),
            'audio_uri'       => esc_url_raw($_POST['audio_uri'] ?? ''),
            'cover_uri'       => esc_url_raw($_POST['cover_uri'] ?? ''),
            'metadata_uri'    => esc_url_raw($_POST['metadata_uri'] ?? ''),
            'contract_address'=> sanitize_text_field($_POST['contract_address'] ?? ''),
            'token_id'        => intval($_POST['token_id'] ?? 0),
            'tx_hash'         => sanitize_text_field($_POST['tx_hash'] ?? ''),
            'status'          => sanitize_text_field($_POST['status'] ?? 'minted'),
            'accept_token'    => intval($_POST['accept_token'] ?? 0),
            'token_price'     => floatval($_POST['token_price'] ?? 0),
        ];

        $wpdb->insert("{$wpdb->prefix}soundmint_nfts", $data);
        wp_send_json_success(['id' => $wpdb->insert_id]);
    }

    public function ajax_get_nfts() {
        global $wpdb;
        $limit = intval($_GET['limit'] ?? 50);
        $wallet = sanitize_text_field($_GET['wallet'] ?? '');

        $where = $wallet ? $wpdb->prepare("WHERE wallet_address = %s", $wallet) : '';
        $nfts = $wpdb->get_results("SELECT * FROM {$wpdb->prefix}soundmint_nfts $where ORDER BY created_at DESC LIMIT $limit");

        wp_send_json_success($nfts);
    }

    public function ajax_save_listing() {
        check_ajax_referer('soundmint_nonce', 'nonce');

        global $wpdb;
        $data = [
            'nft_id'         => intval($_POST['nft_id'] ?? 0),
            'seller_address' => sanitize_text_field($_POST['seller_address'] ?? ''),
            'sale_type'      => sanitize_text_field($_POST['sale_type'] ?? 'fixed'),
            'currency'       => sanitize_text_field($_POST['currency'] ?? 'eth'),
            'price'          => floatval($_POST['price'] ?? 0),
            'quantity'       => intval($_POST['quantity'] ?? 1),
            'remaining'      => intval($_POST['quantity'] ?? 1),
            'status'         => 'active',
        ];

        $wpdb->insert("{$wpdb->prefix}soundmint_listings", $data);
        wp_send_json_success(['id' => $wpdb->insert_id]);
    }

    public function ajax_get_listings() {
        global $wpdb;
        $status = sanitize_text_field($_GET['status'] ?? 'active');

        $listings = $wpdb->get_results($wpdb->prepare(
            "SELECT l.*, l.id as listing_id, n.title, n.artist, n.cover_uri, n.audio_uri
             FROM {$wpdb->prefix}soundmint_listings l
             LEFT JOIN {$wpdb->prefix}soundmint_nfts n ON l.nft_id = n.id
             WHERE l.status = %s
             ORDER BY l.created_at DESC",
            $status
        ));

        wp_send_json_success($listings);
    }

    public function ajax_record_sale() {
        check_ajax_referer('soundmint_nonce', 'nonce');

        global $wpdb;
        $data = [
            'nft_id'         => intval($_POST['nft_id'] ?? 0),
            'listing_id'     => intval($_POST['listing_id'] ?? 0),
            'buyer_address'  => sanitize_text_field($_POST['buyer_address'] ?? ''),
            'seller_address' => sanitize_text_field($_POST['seller_address'] ?? ''),
            'price'          => floatval($_POST['price'] ?? 0),
            'currency'       => sanitize_text_field($_POST['currency'] ?? 'eth'),
            'tx_hash'        => sanitize_text_field($_POST['tx_hash'] ?? ''),
        ];

        $wpdb->insert("{$wpdb->prefix}soundmint_sales", $data);

        // Update listing remaining
        if ($data['listing_id']) {
            $wpdb->query($wpdb->prepare(
                "UPDATE {$wpdb->prefix}soundmint_listings SET remaining = remaining - 1 WHERE id = %d",
                $data['listing_id']
            ));
            $remaining = $wpdb->get_var($wpdb->prepare(
                "SELECT remaining FROM {$wpdb->prefix}soundmint_listings WHERE id = %d",
                $data['listing_id']
            ));
            if ($remaining <= 0) {
                $wpdb->update("{$wpdb->prefix}soundmint_listings", ['status' => 'sold'], ['id' => $data['listing_id']]);
            }
        }

        wp_send_json_success(['id' => $wpdb->insert_id]);
    }

    // ----------------------------------------------------------------
    // REST API
    // ----------------------------------------------------------------
    public function register_rest_routes() {
        register_rest_route('soundmint/v1', '/nfts', [
            'methods' => 'GET',
            'callback' => function ($req) {
                global $wpdb;
                $limit = intval($req->get_param('limit') ?: 50);
                $nfts = $wpdb->get_results("SELECT * FROM {$wpdb->prefix}soundmint_nfts ORDER BY created_at DESC LIMIT $limit");
                return rest_ensure_response($nfts);
            },
            'permission_callback' => '__return_true',
        ]);

        register_rest_route('soundmint/v1', '/listings', [
            'methods' => 'GET',
            'callback' => function ($req) {
                global $wpdb;
                $listings = $wpdb->get_results(
                    "SELECT l.*, n.title, n.artist, n.cover_uri FROM {$wpdb->prefix}soundmint_listings l
                     LEFT JOIN {$wpdb->prefix}soundmint_nfts n ON l.nft_id = n.id
                     WHERE l.status = 'active' ORDER BY l.created_at DESC"
                );
                return rest_ensure_response($listings);
            },
            'permission_callback' => '__return_true',
        ]);
    }
}

SoundMint_Plugin::instance();

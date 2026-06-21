import { ErrorCodes } from '@moonshot-ai/kimi-code-sdk';

export const PRODUCT_NAME = 'Spectre';
export const CLI_COMMAND_NAME = 'spectre';
export const PROCESS_NAME = 'spectre';

// Used in telemetry app names and HTTP User-Agent headers.
// Identifies as the official Spectre CLI product so Kimi's backend allows
// tool-call access for coding agents via the managed endpoint allowlist.
export const CLI_USER_AGENT_PRODUCT = 'kimi-code-cli';
export const CLI_UI_MODE = 'shell';
// Telemetry ui_mode for the `kimi web` / `kimi server run` host. Same product
// as the CLI (CLI_USER_AGENT_PRODUCT); the surface is distinguished by ui_mode.
export const WEB_UI_MODE = 'web';

// Give telemetry a short flush window without making CLI exit feel stuck.
export const CLI_SHUTDOWN_TIMEOUT_MS = 3000;

// Published npm package name; this can differ from the executable command.
export const NPM_PACKAGE_NAME = '@abelcondev/spectre';

// App-owned data paths. SDK/core runtime config is intentionally not routed here.
export const SPECTRE_HOME_ENV = 'SPECTRE_HOME';
export const SPECTRE_DATA_DIR_NAME = '.spectre';
export const SPECTRE_LOG_DIR_NAME = 'logs';
export const SPECTRE_CACHE_DIR_NAME = 'cache';
export const SPECTRE_UPDATE_DIR_NAME = 'updates';
export const SPECTRE_BIN_DIR_NAME = 'bin';
export const SPECTRE_UPDATE_STATE_FILE_NAME = 'latest.json';
export const SPECTRE_UPDATE_INSTALL_STATE_FILE_NAME = 'install.json';
export const SPECTRE_UPDATE_INSTALL_LOCK_FILE_NAME = 'install.lock';
export const SPECTRE_UPDATE_ROLLOUT_LOG_FILE_NAME = 'rollout.log';
export const SPECTRE_INPUT_HISTORY_DIR_NAME = 'user-history';
export const SPECTRE_BANNER_DIR_NAME = 'banner';
export const SPECTRE_BANNER_STATE_FILE_NAME = 'state.json';

// Legacy aliases for internal packages that still reference the old names.
// These are safe to remove once no internal import uses them.
export const KIMI_CODE_HOME_ENV = SPECTRE_HOME_ENV;
export const KIMI_CODE_DATA_DIR_NAME = SPECTRE_DATA_DIR_NAME;
export const KIMI_CODE_LOG_DIR_NAME = SPECTRE_LOG_DIR_NAME;
export const KIMI_CODE_CACHE_DIR_NAME = SPECTRE_CACHE_DIR_NAME;
export const KIMI_CODE_UPDATE_DIR_NAME = SPECTRE_UPDATE_DIR_NAME;
export const KIMI_CODE_BIN_DIR_NAME = SPECTRE_BIN_DIR_NAME;
export const KIMI_CODE_UPDATE_STATE_FILE_NAME = SPECTRE_UPDATE_STATE_FILE_NAME;
export const KIMI_CODE_UPDATE_INSTALL_STATE_FILE_NAME = SPECTRE_UPDATE_INSTALL_STATE_FILE_NAME;
export const KIMI_CODE_UPDATE_INSTALL_LOCK_FILE_NAME = SPECTRE_UPDATE_INSTALL_LOCK_FILE_NAME;
export const KIMI_CODE_UPDATE_ROLLOUT_LOG_FILE_NAME = SPECTRE_UPDATE_ROLLOUT_LOG_FILE_NAME;
export const KIMI_CODE_INPUT_HISTORY_DIR_NAME = SPECTRE_INPUT_HISTORY_DIR_NAME;
export const KIMI_CODE_BANNER_DIR_NAME = SPECTRE_BANNER_DIR_NAME;
export const KIMI_CODE_BANNER_STATE_FILE_NAME = SPECTRE_BANNER_STATE_FILE_NAME;

// Managed Kimi auth provider key shared with OAuth/SDK config.
// Keep as 'managed:kimi-code' so Spectre continues to use your existing Kimi login/subscription.
export const DEFAULT_OAUTH_PROVIDER_NAME = 'managed:kimi-code';

// SDK/core error code that tells the TUI to show a login-required startup
// notice. Derived from sdk's ErrorCodes so a future rename in core
// auto-propagates instead of silently breaking the startup recovery path.
export const OAUTH_LOGIN_REQUIRED_CODE = ErrorCodes.AUTH_LOGIN_REQUIRED;

export const FEEDBACK_ISSUE_URL = 'https://github.com/abelcondev/spectre/issues';

// Sent in the feedback `version` field so the backend can distinguish this
// TypeScript client from clients that send a bare version.
export const FEEDBACK_VERSION_PREFIX = 'spectre-';

// Telemetry event name; keep stable for dashboard queries.
export const FEEDBACK_TELEMETRY_EVENT = 'feedback_submitted';

// Spectre release asset source of truth: version checks and native install scripts pull from here.
export const SPECTRE_RELEASE_BASE = 'https://github.com/abelcondev/spectre/releases/latest/download';
export const SPECTRE_CDN_LATEST_URL = `${SPECTRE_RELEASE_BASE}/latest`;
// Rollout manifest consumed by update checks; the plain-text `/latest` above
// stays unchanged forever — already-shipped clients hard-fail on non-semver
// bodies, and the install scripts read it for fresh installs.
export const SPECTRE_CDN_LATEST_JSON_URL = `${SPECTRE_RELEASE_BASE}/latest.json`;
export const SPECTRE_PLUGIN_MARKETPLACE_URL = `${SPECTRE_RELEASE_BASE}/marketplace.json`;
export const SPECTRE_PLUGIN_MARKETPLACE_URL_ENV = 'SPECTRE_PLUGIN_MARKETPLACE_URL';
export const SPECTRE_INSTALL_SH_URL = `${SPECTRE_RELEASE_BASE}/install.sh`;
export const SPECTRE_INSTALL_PS1_URL = `${SPECTRE_RELEASE_BASE}/install.ps1`;

// Legacy aliases consumed by updater/install code.
export const KIMI_CODE_CDN_BASE = SPECTRE_RELEASE_BASE;
export const KIMI_CODE_CDN_LATEST_URL = SPECTRE_CDN_LATEST_URL;
export const KIMI_CODE_CDN_LATEST_JSON_URL = SPECTRE_CDN_LATEST_JSON_URL;
export const KIMI_CODE_PLUGIN_MARKETPLACE_URL = SPECTRE_PLUGIN_MARKETPLACE_URL;
export const KIMI_CODE_PLUGIN_MARKETPLACE_URL_ENV = SPECTRE_PLUGIN_MARKETPLACE_URL_ENV;
export const KIMI_CODE_INSTALL_SH_URL = SPECTRE_INSTALL_SH_URL;
export const KIMI_CODE_INSTALL_PS1_URL = SPECTRE_INSTALL_PS1_URL;

// Tips banner feed. Kept pointing to Kimi until Spectre hosts its own.
export const KIMI_CODE_TIPS_BANNER_URL = 'https://cdn.kimi.com/kimi-code-tips/tips.json';

// Managed `fd` binary download source.
// TODO: migrate to Spectre's own release assets or to the official sharkdp/fd releases.
export const SPECTRE_FD_DOWNLOAD_BASE_URL = 'https://code.kimi.com/kimi-code/fd';
export const KIMI_CODE_FD_DOWNLOAD_BASE_URL = SPECTRE_FD_DOWNLOAD_BASE_URL;

// Native install commands, split by platform. Use these for prompt copy and spawn calls only; do not assemble the strings elsewhere.
export const NATIVE_INSTALL_COMMAND_UNIX = `curl -fsSL ${SPECTRE_INSTALL_SH_URL} | bash`;
export const NATIVE_INSTALL_COMMAND_WIN = `irm ${SPECTRE_INSTALL_PS1_URL} | iex`;

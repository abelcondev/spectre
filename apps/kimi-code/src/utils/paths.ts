/**
 * CLI-owned data path helpers.
 *
 * These paths are for local app data such as logs and input history. Config
 * files are owned by Core/SDK and intentionally do not live behind this module.
 */

import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';

import {
  SPECTRE_BANNER_DIR_NAME,
  SPECTRE_BANNER_STATE_FILE_NAME,
  SPECTRE_BIN_DIR_NAME,
  SPECTRE_CACHE_DIR_NAME,
  SPECTRE_DATA_DIR_NAME,
  SPECTRE_HOME_ENV,
  SPECTRE_INPUT_HISTORY_DIR_NAME,
  SPECTRE_LOG_DIR_NAME,
  SPECTRE_UPDATE_INSTALL_LOCK_FILE_NAME,
  SPECTRE_UPDATE_INSTALL_STATE_FILE_NAME,
  SPECTRE_UPDATE_DIR_NAME,
  SPECTRE_UPDATE_ROLLOUT_LOG_FILE_NAME,
  SPECTRE_UPDATE_STATE_FILE_NAME,
} from '#/constant/app';

/**
 * Return the root data directory for Spectre.
 *
 * Priority: `SPECTRE_HOME` env var > `~/.spectre`.
 */
export function getDataDir(): string {
  const envDir = process.env[SPECTRE_HOME_ENV];
  if (envDir) {
    return envDir;
  }
  return join(homedir(), SPECTRE_DATA_DIR_NAME);
}

/**
 * Return the diagnostic log directory: `<dataDir>/logs/`.
 */
export function getLogDir(): string {
  return join(getDataDir(), SPECTRE_LOG_DIR_NAME);
}

/**
 * Return the CLI cache directory: `<dataDir>/cache/`.
 */
export function getCacheDir(): string {
  return join(getDataDir(), SPECTRE_CACHE_DIR_NAME);
}

/**
 * Return the managed tools directory: `<dataDir>/bin/`.
 */
export function getBinDir(): string {
  return join(getDataDir(), SPECTRE_BIN_DIR_NAME);
}

/**
 * Return the update cache file: `<dataDir>/updates/latest.json`.
 */
export function getUpdateStateFile(): string {
  return join(getDataDir(), SPECTRE_UPDATE_DIR_NAME, SPECTRE_UPDATE_STATE_FILE_NAME);
}

/**
 * Return the update install state file: `<dataDir>/updates/install.json`.
 */
export function getUpdateInstallStateFile(): string {
  return join(getDataDir(), SPECTRE_UPDATE_DIR_NAME, SPECTRE_UPDATE_INSTALL_STATE_FILE_NAME);
}

/**
 * Return the update install lock file: `<dataDir>/updates/install.lock`.
 */
export function getUpdateInstallLockFile(): string {
  return join(getDataDir(), SPECTRE_UPDATE_DIR_NAME, SPECTRE_UPDATE_INSTALL_LOCK_FILE_NAME);
}

/**
 * Return the rollout decision log: `<dataDir>/updates/rollout.log`.
 */
export function getUpdateRolloutLogFile(): string {
  return join(getDataDir(), SPECTRE_UPDATE_DIR_NAME, SPECTRE_UPDATE_ROLLOUT_LOG_FILE_NAME);
}

/**
 * Return the banner display state file: `<dataDir>/cache/banner/state.json`.
 */
export function getBannerStateFile(): string {
  return join(getCacheDir(), SPECTRE_BANNER_DIR_NAME, SPECTRE_BANNER_STATE_FILE_NAME);
}

/**
 * Return the user input history file for a given working directory.
 * Layout: `<share_dir>/user-history/<md5(cwd)>.jsonl`.
 */
export function getInputHistoryFile(workDir: string): string {
  const hash = createHash('md5').update(workDir, 'utf-8').digest('hex');
  return join(getDataDir(), SPECTRE_INPUT_HISTORY_DIR_NAME, `${hash}.jsonl`);
}

/**
 * Spectre build metadata injected by the native bundle step.
 *
 * In non-native (dev / npm) builds these globals are undefined, so the
 * helpers fall back to `package.json` or platform defaults.
 */
declare const __SPECTRE_VERSION__: string | undefined;
declare const __SPECTRE_CHANNEL__: string | undefined;
declare const __SPECTRE_COMMIT__: string | undefined;
declare const __SPECTRE_BUILD_TARGET__: string | undefined;

export interface SpectreBuildInfo {
  readonly version?: string;
  readonly channel?: string;
  readonly commit?: string;
  readonly buildTarget?: string;
}

function optionalBuildString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export const SPECTRE_BUILD_INFO: SpectreBuildInfo = {
  version:
    typeof __SPECTRE_VERSION__ === 'string'
      ? optionalBuildString(__SPECTRE_VERSION__)
      : undefined,
  channel:
    typeof __SPECTRE_CHANNEL__ === 'string'
      ? optionalBuildString(__SPECTRE_CHANNEL__)
      : undefined,
  commit:
    typeof __SPECTRE_COMMIT__ === 'string'
      ? optionalBuildString(__SPECTRE_COMMIT__)
      : undefined,
  buildTarget:
    typeof __SPECTRE_BUILD_TARGET__ === 'string'
      ? optionalBuildString(__SPECTRE_BUILD_TARGET__)
      : undefined,
};

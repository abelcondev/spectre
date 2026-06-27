/**
 * Validate-then-repair layer for tool call arguments.
 *
 * When AJV rejects a tool call's parsed JSON arguments, this module walks the
 * validator's own error list and applies a small catalogue of targeted fixes.
 * Valid inputs never enter this path — the fast path is zero-overhead.
 *
 * The four repairs handle the most common LLM malformations observed across
 * open models (DeepSeek, Qwen, GLM, etc.):
 *
 * 1. Stringified JSON where a structured type is expected
 *    `'["a","b"]'` → `["a","b"]`
 * 2. Bare string where an array is expected
 *    `"foo"` → `["foo"]`
 * 3. Plain object with integer keys where an array is expected
 *    `{"0":"a","1":"b"}` → `["a","b"]`
 * 4. `null` for an optional field instead of omitting it
 *    `{ path: "/foo", mode: null }` → `{ path: "/foo" }`
 *
 * Repair order matters: stringified-JSON parse must run before bare-string
 * wrap, or `'["a","b"]'` becomes `['["a","b"]']`.
 *
 * All repairs operate on a deep clone of the args so the original is never
 * mutated. Only the paths the validator complained about are touched — a
 * valid string value at a different path is never rewritten, which is the
 * key safety invariant (e.g. Write tool content that happens to be
 * JSON-shaped is left alone).
 */

import type { ErrorObject } from 'ajv';

/**
 * Walk an AJV `instancePath` (e.g. `/questions/0/options`) into the args
 * tree and return the parent container, the final key, and the value at
 * that path. Returns `undefined` if the path cannot be navigated.
 */
function navigateToPath(
  root: unknown,
  instancePath: string,
): { parent: Record<string, unknown> | unknown[]; key: string | number; value: unknown } | undefined {
  if (instancePath.length === 0) return undefined;

  const segments = instancePath.split('/').filter((s) => s.length > 0);
  if (segments.length === 0) return undefined;

  let current: unknown = root;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]!;
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    const container = current as Record<string, unknown>;
    const key = Array.isArray(container) ? Number(seg) : seg;
    current = container[key as string];
  }

  if (current === null || current === undefined || typeof current !== 'object') return undefined;
  const parent = current as Record<string, unknown> | unknown[];
  const lastSeg = segments[segments.length - 1]!;
  const key: string | number = Array.isArray(parent) ? Number(lastSeg) : lastSeg;
  const value = (parent as Record<string, unknown>)[key as string];
  return { parent, key, value };
}

/**
 * Deep-clone a JSON-compatible value. Only handles the JSON subset that
 * tool arguments can contain (objects, arrays, strings, numbers, booleans,
 * null). Falls back to structuredClone for anything unexpected.
 */
function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(deepClone) as unknown as T;
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    result[k] = deepClone(v);
  }
  return result as T;
}

/**
 * Check whether an object's keys are sequential integers starting from 0
 * (e.g. `{"0":"a","1":"b","2":"c"}`). These are objects the LLM emitted
 * when it meant to produce an array.
 */
function hasSequentialIntegerKeys(obj: Record<string, unknown>): boolean {
  const keys = Object.keys(obj);
  if (keys.length === 0) return false;
  for (let i = 0; i < keys.length; i++) {
    if (keys[i] !== String(i)) return false;
  }
  return true;
}

/**
 * Try to apply repairs to the given args based on AJV validation errors.
 *
 * @param args - The parsed (but invalid) tool arguments.
 * @param errors - The AJV error list from the failed validation.
 * @returns A deep-cloned repaired args object, or `null` if no repair
 *          could be applied.
 */
export function repairToolArgs(args: unknown, errors: readonly ErrorObject[]): unknown | null {
  if (args === null || args === undefined || typeof args !== 'object') return null;
  if (errors.length === 0) return null;

  const cloned = deepClone(args);
  let repaired = false;

  for (const error of errors) {
    const nav = navigateToPath(cloned, error.instancePath);

    // stripNullOptionals: `null` where the field should have been omitted
    if (nav !== undefined && nav.value === null) {
      if (Array.isArray(nav.parent)) {
        // Don't splice from arrays — only strip null keys from objects
      } else {
        delete (nav.parent as Record<string, unknown>)[nav.key as string];
        repaired = true;
        continue;
      }
    }

    // parseStringifiedJson: string that is valid JSON for an array/object
    if (nav !== undefined && typeof nav.value === 'string') {
      const str = nav.value;
      if (str.startsWith('[') || str.startsWith('{')) {
        try {
          const parsed: unknown = JSON.parse(str);
          if (typeof parsed !== 'string') {
            (nav.parent as Record<string, unknown>)[nav.key as string] = parsed;
            repaired = true;
            continue;
          }
        } catch {
          // not valid JSON — fall through to other repairs
        }
      }
    }

    // wrapBareStringToArray: string where array is expected
    if (
      nav !== undefined &&
      typeof nav.value === 'string' &&
      error.keyword === 'type' &&
      (error.params as Record<string, unknown>)['type'] === 'array'
    ) {
      (nav.parent as Record<string, unknown>)[nav.key as string] = [nav.value];
      repaired = true;
      continue;
    }

    // unwrapObjectToArray: object with integer keys where array expected
    if (
      nav !== undefined &&
      typeof nav.value === 'object' &&
      nav.value !== null &&
      !Array.isArray(nav.value) &&
      hasSequentialIntegerKeys(nav.value as Record<string, unknown>)
    ) {
      const obj = nav.value as Record<string, unknown>;
      const arr = Object.keys(obj)
        .map((k) => obj[k])
        .filter((v): v is unknown => v !== undefined);
      (nav.parent as Record<string, unknown>)[nav.key as string] = arr;
      repaired = true;
      continue;
    }

    // If we reach here for any error, no repair was applicable for this
    // particular error — but others may still apply.
  }

  return repaired ? cloned : null;
}

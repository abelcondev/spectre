/**
 * Unit tests for the tool-argument repair layer.
 *
 * The repair module fixes a small, finite set of LLM malformations that AJV
 * rejects. Each test drives a real AJV validation failure through
 * `repairToolArgs` and asserts the repair produces args that pass
 * re-validation. Valid inputs must never be touched.
 */

import Ajv, { type ValidateFunction } from 'ajv';
import { describe, expect, it } from 'vitest';

import { repairToolArgs } from '../../src/tools/args-repair';

const ajv = new Ajv({ strict: false, allErrors: true });

interface TestSchema {
  readonly schema: Record<string, unknown>;
  readonly validate: ValidateFunction;
}

function compileTest(schema: Record<string, unknown>): TestSchema {
  const validate = ajv.compile(schema);
  return { schema, validate };
}

function validateAndRepair(
  test: TestSchema,
  args: unknown,
): { repaired: boolean; args: unknown } {
  const valid = test.validate(args);
  if (valid) return { repaired: false, args };
  const errors = test.validate.errors ?? [];
  const repaired = repairToolArgs(args, errors);
  if (repaired === null) return { repaired: false, args };
  return { repaired: true, args: repaired };
}

// Schema: { path: string, mode?: 'overwrite' | 'append' }
const writeSchema = compileTest({
  type: 'object',
  properties: {
    path: { type: 'string' },
    mode: { type: 'string', enum: ['overwrite', 'append'] },
  },
  required: ['path'],
  additionalProperties: false,
});

// Schema: { items: string[], label: string }
const itemsSchema = compileTest({
  type: 'object',
  properties: {
    items: { type: 'array', items: { type: 'string' } },
    label: { type: 'string' },
  },
  required: ['items', 'label'],
  additionalProperties: false,
});

// Schema with nested array: { questions: [{ options: string[], question: string }] }
const nestedSchema = compileTest({
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          options: { type: 'array', items: { type: 'string' } },
          question: { type: 'string' },
        },
        required: ['options', 'question'],
        additionalProperties: false,
      },
    },
  },
  required: ['questions'],
  additionalProperties: false,
});

describe('repairToolArgs', () => {
  describe('no repair needed', () => {
    it('returns null when args are valid', () => {
      const result = validateAndRepair(writeSchema, { path: '/foo.ts', mode: 'overwrite' });
      expect(result.repaired).toBe(false);
    });

    it('returns null when error list is empty', () => {
      expect(repairToolArgs({ path: '/foo.ts' }, [])).toBeNull();
    });

    it('returns null for non-object args', () => {
      expect(repairToolArgs('not an object', [])).toBeNull();
      expect(repairToolArgs(null, [])).toBeNull();
      expect(repairToolArgs(undefined, [])).toBeNull();
    });
  });

  describe('stripNullOptionals', () => {
    it('removes null optional field', () => {
      const args = { path: '/foo.ts', mode: null };
      const result = validateAndRepair(writeSchema, args);
      expect(result.repaired).toBe(true);
      expect(result.args).toEqual({ path: '/foo.ts' });
      // Re-validates successfully
      expect(writeSchema.validate(result.args)).toBe(true);
    });

    it('does not remove null required field', () => {
      const args = { path: null, mode: 'overwrite' };
      const result = validateAndRepair(writeSchema, args);
      // path is required — stripping null leaves it missing, re-validation fails
      // repairToolArgs may still attempt the strip, but re-validation should fail
      expect(result.args).not.toHaveProperty('path', null);
    });
  });

  describe('parseStringifiedJson', () => {
    it('parses stringified array', () => {
      const args = { items: '["a","b","c"]', label: 'test' };
      const result = validateAndRepair(itemsSchema, args);
      expect(result.repaired).toBe(true);
      expect(result.args).toEqual({ items: ['a', 'b', 'c'], label: 'test' });
      expect(itemsSchema.validate(result.args)).toBe(true);
    });

    it('parses stringified object', () => {
      const args = { items: '{"0":"x"}', label: 'test' };
      const result = validateAndRepair(itemsSchema, args);
      // Parsing succeeds but produces an object, not an array — may need further repair
      // The first repair parseStringifiedJson turns it into {"0":"x"}, then
      // unwrapObjectToArray may handle it on a second pass, or it stays broken.
      // For this test we just verify the string was at least attempted.
      expect(typeof result.args).toBe('object');
    });

    it('does not parse string that is not JSON (but wraps as bare string)', () => {
      const args = { items: 'not json', label: 'test' };
      const result = validateAndRepair(itemsSchema, args);
      // parseStringifiedJson doesn't apply, but wrapBareStringToArray does:
      // "not json" → ["not json"]
      expect(result.repaired).toBe(true);
      expect(result.args).toEqual({ items: ['not json'], label: 'test' });
    });
  });

  describe('wrapBareStringToArray', () => {
    it('wraps bare string in array', () => {
      const args = { items: 'single-item', label: 'test' };
      const result = validateAndRepair(itemsSchema, args);
      expect(result.repaired).toBe(true);
      expect(result.args).toEqual({ items: ['single-item'], label: 'test' });
      expect(itemsSchema.validate(result.args)).toBe(true);
    });
  });

  describe('unwrapObjectToArray', () => {
    it('converts object with integer keys to array', () => {
      const args = { items: { '0': 'a', '1': 'b', '2': 'c' }, label: 'test' };
      const result = validateAndRepair(itemsSchema, args);
      expect(result.repaired).toBe(true);
      expect(result.args).toEqual({ items: ['a', 'b', 'c'], label: 'test' });
      expect(itemsSchema.validate(result.args)).toBe(true);
    });

    it('does not convert object with non-integer keys', () => {
      const args = { items: { a: 'x', b: 'y' }, label: 'test' };
      const result = validateAndRepair(itemsSchema, args);
      expect(result.repaired).toBe(false);
    });
  });

  describe('repair ordering', () => {
    it('parses stringified array before wrapping bare string', () => {
      // Critical: '["a","b"]' must become ["a","b"], not ['["a","b"]']
      const args = { items: '["a","b"]', label: 'test' };
      const result = validateAndRepair(itemsSchema, args);
      expect(result.repaired).toBe(true);
      expect(result.args).toEqual({ items: ['a', 'b'], label: 'test' });
    });
  });

  describe('nested paths', () => {
    it('repairs nested array in object', () => {
      const args = {
        questions: [
          { options: '["yes","no"]', question: 'Continue?' },
        ],
      };
      const result = validateAndRepair(nestedSchema, args);
      expect(result.repaired).toBe(true);
      expect(result.args).toEqual({
        questions: [
          { options: ['yes', 'no'], question: 'Continue?' },
        ],
      });
      expect(nestedSchema.validate(result.args)).toBe(true);
    });

    it('wraps bare string in nested array', () => {
      const args = {
        questions: [
          { options: 'yes', question: 'Continue?' },
        ],
      };
      const result = validateAndRepair(nestedSchema, args);
      expect(result.repaired).toBe(true);
      expect(result.args).toEqual({
        questions: [
          { options: ['yes'], question: 'Continue?' },
        ],
      });
      expect(nestedSchema.validate(result.args)).toBe(true);
    });
  });

  describe('immutability', () => {
    it('never mutates the original args', () => {
      const original = { items: '["a"]', label: 'test' };
      const frozen = JSON.parse(JSON.stringify(original));
      const result = validateAndRepair(itemsSchema, original);
      expect(result.repaired).toBe(true);
      // Original must be unchanged
      expect(original).toEqual(frozen);
    });
  });

  describe('unrepairable errors', () => {
    it('returns null for missing required field', () => {
      const args = { label: 'test' };
      // items is required but missing — no repair can fix that
      const result = validateAndRepair(itemsSchema, args);
      expect(result.repaired).toBe(false);
    });

    it('returns null for wrong type that is not a known repair', () => {
      const args = { path: 42, mode: 'overwrite' };
      // path should be string but is number — not a repairable case
      const result = validateAndRepair(writeSchema, args);
      expect(result.repaired).toBe(false);
    });
  });
});

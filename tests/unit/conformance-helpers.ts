import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');
export const CONFORMANCE_DIR = path.join(ROOT, 'tests', 'conformance');
export const dataDir = path.join(ROOT, 'data');

export interface RangeCase {
  id: string;
  dict?: unknown[];
  dictRef?: string;
  text: string;
  expected: [number, number, string][];
}
export interface VariantCase {
  id: string;
  text: string;
  reading: string;
  expected: unknown;
}

export function readJsonl<T>(name: string): T[] {
  return fs
    .readFileSync(path.join(CONFORMANCE_DIR, name), 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as T);
}

const packCache = new Map<string, unknown[]>();
/** data/<name> の rubyDictionary を読む（同じ名前は 1 回だけ） */
export function loadPack(name: string): unknown[] {
  let dict = packCache.get(name);
  if (!dict) {
    dict = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', name), 'utf8')).rubyDictionary as unknown[];
    packCache.set(name, dict);
  }
  return dict;
}

/** ケースの辞書（dict の直書き、または dictRef のパック） */
export function dictOf(c: RangeCase): unknown[] {
  return c.dict ?? loadPack(c.dictRef as string);
}

export function toTuples(ranges: { start: number; end: number; reading: string }[]): [number, number, string][] {
  return ranges.map((r) => [r.start, r.end, r.reading]);
}

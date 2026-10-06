import { resolveVariants } from './core/notation';
import type { DictEntry } from './core/types';

/**
 * 辞書（パックの JSON・語の配列）を重ねて読み、照合に使える語の並びにする。
 * - 同じ対象文字列（text）の語は、先に読んだ辞書のものを残す。
 * - 空・文字列でない・enabled: false・記法が不正（resolveVariants が null）の語は落とす。
 * - 残す欄は text・reading と、数値の priority だけ。
 */
export function loadDictionary(sources: unknown[]): DictEntry[] {
  const out: DictEntry[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    const list = Array.isArray(source)
      ? source
      : source && typeof source === 'object' && Array.isArray((source as { rubyDictionary?: unknown }).rubyDictionary)
        ? (source as { rubyDictionary: unknown[] }).rubyDictionary
        : null;
    if (!list) continue;
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const { text, reading, enabled, priority } = item as Record<string, unknown>;
      if (typeof text !== 'string' || typeof reading !== 'string' || !text || !reading) continue;
      if (enabled === false || seen.has(text)) continue;
      if (!resolveVariants(text, reading)) continue;
      seen.add(text);
      out.push(typeof priority === 'number' ? { text, reading, priority } : { text, reading });
    }
  }
  return out;
}

/** 「+直前○○」の種類（漢字・ひらがな・カタカナ・英数字）。RUBY-027 */
export type BeforeKind = 'kanji' | 'hira' | 'kata' | 'alnum';
/** 辞書の 1 語（記法で書いた対象文字列と読み） */
export interface DictEntry { text: string; reading: string; enabled?: boolean; priority?: number }
/** 照合形の中で振り仮名を付ける区間 */
export interface Segment { offset: number; length: number; reading: string }
/** resolveVariants の 1 形（本文と照合する文字列とルビ区間、照合の条件） */
export interface Variant { matchText: string; segments: Segment[]; particle?: true; standalone?: true; leftStandalone?: true; before?: BeforeKind }
/** 本文に付ける振り仮名（UTF-16 の添字。end は含まない） */
export interface RubyRange { start: number; end: number; reading: string }
/** 照合単位の中の 1 形 */
export interface MatchForm { segments: Segment[]; particle: boolean; standalone: boolean; leftStandalone: boolean; before: string }
/** 照合単位（同じ照合形・同じ priority の形をまとめたもの）。matchText は全角半角を畳んだ後のもの */
export interface MatchGroup { matchText: string; priority: number; order: number; forms: MatchForm[] }
/**
 * buildMatcher の結果。groups は照合の順（長い照合形 → priority の高い順 → 登録順）に並ぶ。
 * byChar は照合の索引（indexMatcherGroups）。無くても照合できる（全部たどる）
 */
export interface Matcher { groups: MatchGroup[]; byChar?: Map<number, Int32Array> }

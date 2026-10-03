// 照合の部品だけの入口（Scenario Snip の同期スクリプトはここを束ねる）
export { parseParenAlternation, parseSegmentedReading, resolveVariants } from './notation';
export { buildMatcher, matchRanges, computeRubyRanges, matcherFromCompiled, indexMatcherGroups } from './matcher';
export type { BeforeKind, DictEntry, MatchForm, MatchGroup, Matcher, RubyRange, Segment, Variant } from './types';

export const categories = {
  reference: ['Reference', '照應', '#dceaff', '#234e84'],
  ellipsis: ['Ellipsis & substitution', '省略與替代', '#fce1ec', '#863359'],
  marker: ['Discourse markers', '篇章標記', '#ffebc8', '#774714'],
  lexical: ['Lexical cohesion', '詞彙銜接', '#d7eee5', '#185d4e'],
  theme: ['Theme & rheme', '主位與述位', '#e8e0ff', '#583b8e'],
  relation: ['Clause relations', '子句關係', '#f9dece', '#8b4123'],
  pattern: ['Discourse patterns', '篇章模式', '#d9edfa', '#205976'],
  rhetoric: ['Rhetorical organization', '修辭組織', '#edf0c9', '#4c591d'],
} as const;
export type Category = keyof typeof categories;
export type Span = { start: number; end: number; text: string };
export type Annotation = Span & {
  id: string; category: Category; subtype: string; explanation: string; contribution: string;
  related: Span[]; confidence: 'high' | 'medium' | 'low'; alternative: string;
  signal: 'explicit' | 'inferred'; origin: 'rules' | 'ai' | 'manual';
};
export const sampleTitle = 'Making feedback usable in academic writing';
export const sample = `University writing courses often ask students to revise a draft after receiving feedback. Yet students may correct surface errors while leaving the central argument unchanged. This problem becomes especially visible when comments identify a weakness but offer no opportunity to discuss it.

For example, a tutor may write “develop this claim” beside a paragraph without specifying what counts as adequate evidence. Some students ask for clarification, and others do so after rereading the prompt. However, students who interpret the comment as a request for more detail may add examples without explaining how they support the claim.

To address this problem, a writing course can pair feedback with a short revision plan. This plan asks students to connect each proposed change to a specific claim. As a result, the revision plan can make the relation between evidence and argument easier to discuss.

What should instructors look for in the revised draft? One answer is a clearer connection between the claim and its evidence. In summary, the purpose of the revision plan is to make the reasoning behind a change visible to both writer and reader.`;

export function span(text: string, start: number, end: number): Span {
  return {start, end, text: text.slice(start, end)};
}

export function paragraphs(text: string): Span[] {
  return [...text.matchAll(/\S[\s\S]*?(?=\r?\n[ \t]*\r?\n|$)/g)]
    .map(m => span(text, m.index, m.index + m[0].trimEnd().length));
}

export function sentences(text: string): Span[] {
  const segmenter = new Intl.Segmenter('en', {granularity: 'sentence'});
  return paragraphs(text).flatMap(p => [...segmenter.segment(p.text)].map(s => {
    const start = p.start + s.index + s.segment.length - s.segment.trimStart().length;
    return span(text, start, p.start + s.index + s.segment.trimEnd().length);
  }).filter(s => s.end > s.start));
}

const markers: Record<string, string> = {
  'however':'Contrast', 'yet':'Contrast', 'nevertheless':'Contrast', 'in contrast':'Contrast',
  'by contrast':'Contrast', 'on the other hand':'Contrast', 'as a result':'Result',
  'therefore':'Result', 'consequently':'Result', 'for this reason':'Result',
  'for example':'Exemplification', 'for instance':'Exemplification', 'in addition':'Addition',
  'moreover':'Addition', 'furthermore':'Addition', 'because':'Cause', 'although':'Contrast',
};
const markerPattern = new RegExp('^(' + Object.keys(markers).filter(m => !['because','although'].includes(m)).join('|') + ')\\b(?=,|\\s)', 'i');
const relationMeaning: Record<string,string> = {
  Contrast:'qualifies or contrasts with', Result:'presents a consequence of', Exemplification:'illustrates',
  Addition:'adds a point to', Cause:'gives a reason for',
};
const stop = new Set('about after again against also another because before being between could during each every first from have however into leaving might more most other should some such than that their them then there these they this those through under until very what when where which while will with within without would your'.split(' '));
const lexicalGroups = [
  ['draft','revision','revise','revised','rewriting'],
  ['claim','argument','thesis','position'],
  ['evidence','examples','illustration','data'],
  ['feedback','comments','comment','response'],
];

export function analyze(text: string): Annotation[] {
  const rows = sentences(text);
  const results: Annotation[] = [];
  const add = (anchor: Span, category: Category, subtype: string, explanation: string,
    contribution: string, related: Span[] = [], confidence: Annotation['confidence'] = 'medium',
    signal: Annotation['signal'] = 'inferred', alternative = '') => {
    if (results.length >= 400 || results.some(a => a.start === anchor.start && a.end === anchor.end && a.category === category && a.subtype === subtype)) return;
    results.push({...anchor, id: 'r' + results.length, category, subtype, explanation, contribution, related,
      confidence, signal, alternative, origin: 'rules'});
  };
  const seen = new Map<string, {token: Span; row: Span}>();
  const chains = new Map<number, {token: Span; row: Span}>();
  rows.forEach((row, i) => {
    const prev = rows[i - 1];
    const next = rows[i + 1];
    const local = (m: RegExpMatchArray, length = m[0].length) => span(text, row.start + (m.index ?? 0), row.start + (m.index ?? 0) + length);
    const marker = row.text.match(markerPattern);
    if (prev && marker) {
      const type = markers[marker[0].toLowerCase()];
      add(local(marker), 'marker', type + ' signal', '“' + marker[0] + '” explicitly invites the reader to relate this sentence to the preceding passage.',
        'It makes a ' + type.toLowerCase() + ' reading available before the reader reaches the rest of the sentence.', [prev], 'high', 'explicit');
      add(row, 'relation', type, 'With “' + marker[0] + '” as its cue, this sentence ' + relationMeaning[type] + ' the linked passage.',
        'The relation explains how the new proposition fits into the developing argument.', [prev], 'medium', 'explicit',
        'The marker may apply to a wider stretch than the immediately preceding sentence.');
    }
    const embedded = row.text.match(/\b(because|although)\s+(?=\S)/i);
    if (embedded && embedded.index && /\w+\s+\w+/.test(row.text.slice(0, embedded.index))) {
      const type = embedded[1].toLowerCase() === 'because' ? 'Cause' : 'Contrast';
      const following = span(text, row.start + embedded.index, row.end);
      const preceding = span(text, row.start, row.start + row.text.slice(0, embedded.index).trimEnd().length);
      add(local(embedded, embedded[1].length), 'marker', type + ' conjunction', 'The conjunction introduces a dependent clause.', 'It explicitly signals how the clauses should be read together.', [preceding, following], 'high', 'explicit');
      add(following, 'relation', type, 'The clause introduced by “' + embedded[1] + '” ' + relationMeaning[type] + ' the preceding proposition.',
        'The dependency makes the connection between the propositions explicit.', [preceding], 'medium', 'explicit');
    }
    const ref = row.text.match(/^(?:However,\s+)?((?:This|These|That|Such)\s+(?:problem|challenge|plan|approach|finding|findings|result|results|improvement|change|changes|argument|question|process|difference|evidence|pattern|patterns))\b/i);
    if (prev && ref) {
      const start = row.start + ref[0].lastIndexOf(ref[1]);
      const anchor = span(text, start, start + ref[1].length);
      const head = ref[1].split(' ').at(-1)!.toLowerCase();
      const candidate = rows.slice(Math.max(0, i - 3), i).reverse().find(s =>
        [...s.text.matchAll(/[A-Za-z]+/g)].some(m => m[0].toLowerCase() === head)) ?? prev;
      add(anchor, 'reference', 'Demonstrative anaphora', '“' + anchor.text + '” asks readers to recover an entity or idea from the linked passage.',
        'The demonstrative packages earlier information as a point of departure.', [candidate], 'medium', 'inferred',
        'The intended referent may extend across multiple sentences.');
      if (start === row.start && row.end > anchor.end) {
        const rhemeStart = anchor.end + (text.slice(anchor.end, row.end).match(/^\s*/)?.[0].length ?? 0);
        add(anchor, 'theme', 'Given theme → new rheme', 'The opening “' + anchor.text + '” is a plausible topical theme. The linked remainder develops what the writer says about it.',
          'Reusing earlier information at the clause opening supports thematic progression.', [span(text, rhemeStart, row.end), candidate], 'medium');
      }
    }
    const substitute = row.text.match(/\b(?:do(?:es)?|did|done)\s+so\b/i);
    const verbPhrase = row.text.slice(0, substitute?.index).match(/\b(?:ask(?:s|ed)? for|revise(?:s|d)?|compare(?:s|d)?|review(?:s|ed)?|submit(?:s|ted)?|choose(?:s)?|check(?:s|ed)?)\s+[^,;.!?]{2,50}(?=[,;])/i);
    const priorAction = prev?.text.match(/\b(?:ask(?:s|ed)? for|revise(?:s|d)?|compare(?:s|d)?|review(?:s|ed)?|submit(?:s|ted)?|choose(?:s)?|check(?:s|ed)?)\s+[^,;.!?]{2,50}(?=[,;.!?]|$)/i);
    if (substitute && (verbPhrase || priorAction)) {
      const action = verbPhrase ? local(verbPhrase) : span(text, prev.start + priorAction!.index!, prev.start + priorAction!.index! + priorAction![0].length);
      add(local(substitute), 'ellipsis', 'Verbal substitution', '“' + substitute[0] + '” substitutes for the action expressed in the linked wording.',
        'Readers recover the process across clauses without requiring it to be repeated.', [action], 'high', 'explicit');
    }
    const ellipsis = row.text.match(/\b(?:but|and)\s+(?:\w+\s+){1,3}((?:did|does|could|would|can|will)(?:\s+too| not|n’t|n't)?)\s*[.!?]$/i);
    if (ellipsis && ellipsis.index && /\b(?:revise|review|read|write|respond|submit|complete|attend)\w*\b/i.test(row.text.slice(0, ellipsis.index))) {
      const pos = row.start + ellipsis.index + ellipsis[0].lastIndexOf(ellipsis[1]);
      add(span(text, pos, pos + ellipsis[1].length), 'ellipsis', 'Verb phrase ellipsis',
        'The auxiliary is followed by no overt lexical verb. The earlier clause supplies a candidate for the missing predicate.',
        'The omitted wording creates a dependency between the coordinated clauses.', [span(text, row.start, row.start + ellipsis.index)], 'medium');
    }
    let lexicalCount = 0;
    for (const m of row.text.matchAll(/\b[A-Za-z]{4,}\b/g)) {
      const key = m[0].toLowerCase();
      if (stop.has(key)) continue;
      const token = local(m);
      const earlier = seen.get(key);
      const group = lexicalGroups.findIndex(words => words.includes(key));
      const chain = chains.get(group);
      if (lexicalCount < 2 && earlier && earlier.row !== row) {
        add(token, 'lexical', 'Repetition', '“' + token.text + '” recurs across sentences.',
          'The recurrence keeps a lexical item available as the text develops its topic.', [earlier.token], 'high', 'explicit');
        lexicalCount++;
      } else if (lexicalCount < 2 && group >= 0 && chain && chain.row !== row && chain.token.text.toLowerCase() !== key) {
        add(token, 'lexical', 'Candidate lexical chain', '“' + token.text + '” and “' + chain.token.text + '” may belong to the same field of activity in this passage.',
          'A reader may connect related concepts across sentence boundaries.', [chain.token], 'low', 'inferred',
          'The words may have distinct roles or senses in context.');
        lexicalCount++;
      }
      seen.set(key, {token, row});
      if (group >= 0) chains.set(group, {token, row});
    }
    const move = row.text.match(/^(in summary|in conclusion|to sum up|this (?:article|paper|study) (?:examines|argues|investigates)|the aim of this (?:study|article) is)\b/i);
    if (move) {
      const closing = /summary|conclusion|sum up/i.test(move[0]);
      add(local(move), 'rhetoric', closing ? 'Synthesis cue' : 'Purpose statement',
        'The opening wording sets up an expectation of ' + (closing ? 'a synthesis of earlier points.' : 'an inquiry or claim to be developed.'),
        'It helps readers anticipate the function of this passage.', (closing ? rows.slice(Math.max(0, i - 3), i) : rows.slice(i + 1, i + 3)), 'high', 'explicit');
    }
    const response = row.text.match(/^(?:To (?:address|solve|overcome|tackle) (?:this|these|the) (?:problem|problems|issue|issues|challenge|challenges)|One solution is)\b/i);
    const problem = rows.slice(Math.max(0, i - 8), i).reverse().find(s => /\b(problem|challenge|difficulty|obstacle|weakness|struggle)\b/i.test(s.text));
    if (response && problem) {
      add(row, 'pattern', 'Problem–solution', 'The wording “' + response[0] + '” frames this proposal as a response to the linked difficulty.',
        'The problem prepares readers to evaluate the proposal in terms of what it addresses.', [problem], 'medium', 'explicit');
    }
    if (prev && /^(?:however|nevertheless|yet)\b/i.test(row.text) && /\b(?:argues?|claims?|contends?|maintains?|according to)\b/i.test(prev.text)) {
      add(row, 'pattern', 'Claim–counterclaim', 'The contrast cue follows an attributed claim and introduces a possible opposing position.',
        'The sequence invites the reader to compare positions.', [prev], 'medium', 'inferred', 'This move may qualify the earlier claim without rejecting it.');
    }
    if (next && row.text.endsWith('?') && /^(?:one answer|the answer|yes\b|no\b|because\b|it depends)\b/i.test(next.text)) {
      add(next, 'pattern', 'Question–answer', 'The previous sentence poses a question that this passage explicitly takes up.',
        'The question establishes an expectation that the answer fulfills or develops.', [row], 'high', 'explicit');
    }
    if (prev && /^(?:then|later|afterwards|the next (?:day|week|morning)|finally)\b/i.test(row.text) &&
      /\b(?:had|was|were|went|began|arrived|decided|returned|\w+ed)\b/i.test(prev.text) &&
      /\b(?:had|was|were|went|began|arrived|decided|returned|\w+ed)\b/i.test(row.text)) {
      add(row, 'pattern', 'Narrative sequence', 'The temporal opening orders this event after the preceding passage.',
        'Temporal sequencing helps the reader build an event timeline.', [prev], 'medium', 'inferred', 'The passage could describe a procedure or a historical sequence.');
    }
  });
  return results.sort((a,b) => a.start - b.start || a.end - b.end);
}

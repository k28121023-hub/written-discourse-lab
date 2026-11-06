import {paragraphs, sentences, type Annotation, type Span} from './analysis';

export function Structure({text, annotations, onInspect, onSelect, zh, name}:{
  text:string;annotations:Annotation[];onInspect:(s:Span)=>void;onSelect:(id:string)=>void;zh:boolean;name:(a:Annotation)=>string;
}) {
  const ps = paragraphs(text);
  const rows = sentences(text);
  const edges = annotations.filter(a => a.related.length && ['relation','pattern','rhetoric','reference','theme','lexical','ellipsis'].includes(a.category));
  const node = (s:Span) => {
    const p = ps.findIndex(row => row.start <= s.start && row.end > s.start);
    const r = rows.findIndex(row => row.start <= s.start && row.end > s.start);
    return '¶' + (p + 1) + ' · S' + (r + 1);
  };
  return <div className="structure">
    <p className="muted">{zh ? '點選段落或關係，回到原文檢視證據。' : 'Select a paragraph or follow a relationship back to its textual evidence.'}</p>
    <div className="nodes">{ps.map((p,i) => {
      const moves = annotations.filter(a => ['pattern','rhetoric'].includes(a.category) && a.start >= p.start && a.start < p.end);
      return <button key={p.start} onClick={()=>onInspect(p)}><small>{zh ? '段落' : 'PARAGRAPH'} {String(i+1).padStart(2,'0')}</small>
        <strong>{moves.map(name).join(' · ') || (zh ? '閱讀段落' : 'Read paragraph')}</strong>
        <span>{p.text.slice(0,112)}{p.text.length > 112 ? '…' : ''}</span></button>;
    })}</div>
    <h3>{zh ? '關係連線' : 'Relationship edges'}</h3>
    <p className="muted">{zh ? '實線為明示線索，虛線為推論關係。' : 'Solid arrows indicate overt signals. Dashed arrows indicate inferred links.'}</p>
    {!edges.length && <p>{zh ? '目前沒有可顯示的關係。' : 'No relationships to display for the current filters.'}</p>}
    <div className="edges">{edges.flatMap(a => a.related.map((r,i) =>
      <button key={a.id + '-' + i} onClick={()=>onSelect(a.id)} aria-label={node(a) + ' → ' + node(r) + ', ' + name(a) + ', ' + (zh ? a.signal === 'explicit' ? '明示' : '推論' : a.signal)}>
        <span>{node(a)}</span><svg aria-hidden="true" width="44" height="15" viewBox="0 0 44 15"><path d="M1 7.5h39" stroke="currentColor" strokeWidth="1.5" strokeDasharray={a.signal === 'inferred' ? '4 3' : undefined}/><path d="m35 2 6 5.5-6 5.5" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg><span>{node(r)}</span>
        <strong>{name(a)}</strong>
      </button>))}</div>
  </div>;
}

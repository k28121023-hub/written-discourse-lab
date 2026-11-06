import {type CSSProperties} from 'react';
import {categories, paragraphs, type Annotation, type Span} from './analysis';

export function color(category: Annotation['category']): CSSProperties {
  const [, , bg, ink] = categories[category];
  return {'--mark':bg,'--ink':ink} as CSSProperties;
}

export function Reading({text, annotations, active, related, onSelect, label, focus, prefix = ''}: {
  text:string; annotations:Annotation[]; active?:string; related:Span[];
  onSelect:(id:string)=>void; label:(a:Annotation)=>string; focus?:Span; prefix?:string;
}) {
  const ps = paragraphs(text);
  return <div className="reading" lang="en">{ps.map((p, i) => {
    const intersects = (s: Span) => s.start < p.end && s.end > p.start;
    const marks = annotations.filter(intersects);
    const links = related.filter(intersects);
    const boundaries = [...new Set([p.start,p.end,...[...marks,...links].flatMap(a => [Math.max(a.start,p.start),Math.min(a.end,p.end)])])].sort((a,b)=>a-b);
    return <div className="paragraph" key={p.start} id={prefix + 'paragraph-' + i}>
      <span className="para-number" aria-hidden="true">{String(i + 1).padStart(2,'0')}</span>
      <p>{boundaries.slice(0,-1).map((start,j) => {
        const end = boundaries[j+1];
        const stack = marks.filter(a => a.start <= start && a.end >= end).sort((a,b) =>
          Number(b.id === active) - Number(a.id === active) || (a.end-a.start) - (b.end-b.start));
        const mark = stack[0];
        const linked = links.some(a => a.start <= start && a.end >= end);
        const content = text.slice(start,end);
        return mark ? <span key={start} role="button" tabIndex={0}
          className={'mark' + (mark.id === active ? ' selected' : '') + (linked ? ' linked' : '')}
          aria-label={content + ' · ' + label(mark)} aria-pressed={mark.id === active} style={color(mark.category)}
          onKeyDown={event=>{
            if (event.key === 'Enter' || event.code === 'Space') {event.preventDefault();event.stopPropagation();onSelect(mark.id);}
          }} onClick={()=>onSelect(mark.id)}>{content}</span> :
          <span key={start} className={linked ? 'linked' : undefined}>{content}</span>;
      })}</p>
      {focus && intersects(focus) && <span className="sr-only">Selected structure</span>}
    </div>;
  })}</div>;
}

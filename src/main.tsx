import {useEffect, useRef, useState, type FormEvent} from 'react';
import {createRoot} from 'react-dom/client';
import {analyze, categories, paragraphs, sample, sampleTitle, span, type Annotation, type Category, type Span} from './analysis';
import {Reading, color} from './Reading';
import {Structure} from './Structure';
import {importArticle} from './import';
import './style.css';

const keys = Object.keys(categories) as Category[];
const tr = {
  'Demonstrative anaphora':'指示語回指','Given theme → new rheme':'已知主位 → 新述位','Verbal substitution':'動詞替代',
  'Verb phrase ellipsis':'動詞片語省略','Repetition':'詞彙重複','Candidate lexical chain':'候選詞彙鏈',
  'Contrast signal':'對比標記','Cause conjunction':'原因連接詞','Contrast conjunction':'對比連接詞','Result signal':'結果標記',
  'Exemplification signal':'舉例標記','Addition signal':'增補標記','Contrast':'對比','Cause':'原因','Result':'結果',
  'Addition':'增補','Exemplification':'舉例','Synthesis cue':'總結線索','Purpose statement':'目的陳述',
  'Problem–solution':'問題與解決','Claim–counterclaim':'主張與反主張','Question–answer':'問答','Narrative sequence':'敘事序列',
};
const limits = 80_000;
type Article = {text:string;title:string;annotations:Annotation[];engine:'rules'|'ai'};
const initial = {text:sample,title:sampleTitle,annotations:analyze(sample),engine:'rules'} as const;

function App() {
  const [zh,setZh] = useState(false);
  const t = (en:string, cn:string) => zh ? cn : en;
  const name = (a:Annotation) => zh ? tr[a.subtype as keyof typeof tr] ?? a.subtype : a.subtype;
  const cat = (k:Category) => categories[k][zh ? 1 : 0];
  const [article,setArticle] = useState<Article>(initial);
  const [draft,setDraft] = useState(sample);
  const [title,setTitle] = useState(sampleTitle);
  const [tab,setTab] = useState<'reading'|'structure'>('reading');
  const [filters,setFilters] = useState<Category[]>(keys);
  const [selected,setSelected] = useState<string>();
  const [focused,setFocused] = useState<Span>();
  const [editor,setEditor] = useState<Annotation>();
  const [notice,setNotice] = useState('');
  const [busy,setBusy] = useState(false);
  const [step,setStep] = useState<number>();
  const [show,setShow] = useState(false);
  const [prediction,setPrediction] = useState(false);
  const [notesOpen,setNotesOpen] = useState(false);
  const [notes,setNotes] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const detail = useRef<HTMLElement>(null);
  const stage = useRef<HTMLElement>(null);
  const presentButton = useRef<HTMLButtonElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const visible = article.annotations.filter(a=>filters.includes(a.category));
  const active = visible.find(a=>a.id===selected);
  const current = step === undefined || step < 0 ? undefined : visible[step];
  const select = (id:string) => {setFocused(undefined);setSelected(id);setEditor(undefined);setTab('reading');};
  const inspect = (s:Span) => {setSelected(undefined);setFocused(s);setEditor(undefined);setTab('reading');};
  const scroll = (s:Span) => {
    const p = paragraphs(article.text).findIndex(p=>s.start < p.end && s.end > p.start);
    if (p >= 0) document.getElementById((step === undefined ? '' : 'stage-') + 'paragraph-' + p)?.scrollIntoView({block:'nearest'});
  };
  useEffect(()=>{document.documentElement.lang=zh?'zh-Hant':'en';},[zh]);
  useEffect(()=>{if (tab==='reading' && step===undefined && (focused || active)) scroll((focused || active)!);},[focused,active,tab,step]);
  useEffect(()=>{if(current) scroll(current);},[current]);
  useEffect(()=>{
    if (step !== undefined) {
      const prior = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {document.body.style.overflow = prior;};
    }
  },[step === undefined]);
  const close = () => {
    setStep(undefined);
    if (document.fullscreenElement) void document.exitFullscreen().catch(()=>{});
    presentButton.current?.focus();
  };
  const next = (n:number) => {
    setShow(false);
    setStep(s => Math.min(visible.length-1,Math.max(-1,(s ?? -1)+n)));
  };
  useEffect(()=>{
    if(step===undefined) return;
    const keyboard = (event:KeyboardEvent) => {
      if(event.key==='Escape') {close();return;}
      if (event.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT|BUTTON/.test(event.target.tagName)) return;
      if (event.key==='ArrowRight' || event.key==='ArrowLeft') {event.preventDefault();next(event.key==='ArrowRight'?1:-1);}
      if (event.code==='Space' && step>=0) {event.preventDefault();setShow(v=>!v);}
    };
    window.addEventListener('keydown',keyboard);
    return ()=>window.removeEventListener('keydown',keyboard);
  },[step,visible.length]);

  function reset(text:string,heading:string,annotations:Annotation[],engine:Article['engine']='rules') {
    setArticle({text,title:heading,annotations,engine});
    setSelected(undefined);setFocused(undefined);setEditor(undefined);setFilters(keys);setTab('reading');
  }
  async function run(ai:boolean) {
    if(!draft.trim() || draft.length>limits) {setNotice(t('Enter between 1 and 80,000 characters.','請輸入 1 到 80,000 個字元。'));return;}
    const heading = title.trim() || t('Untitled article','未命名文章');
    setNotice('');
    if (!ai) {reset(draft,heading,analyze(draft));return;}
    setBusy(true);
    try {
      const res = await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({text:draft,locale:zh?'zh-Hant':'en'}),signal:AbortSignal.timeout(45_000)});
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (!Array.isArray(data.annotations)) throw new Error();
      reset(draft,heading,data.annotations,'ai');
    } catch {
      reset(draft,heading,analyze(draft));
      setNotice(t('AI is unavailable. Local analysis was used.','AI 目前無法使用，已改用本機規則分析。'));
    } finally {setBusy(false);}
  }
  async function upload(f?:File) {
    if (!f) return;
    setBusy(true);setNotice('');
    try {
      const text = (await importArticle(f)).replace(/\r\n?/g,'\n');
      if(!text.trim() || text.length>limits) throw new Error(t('The file must contain 1 to 80,000 characters of readable text.','檔案須包含 1 到 80,000 個可讀字元。'));
      const heading = f.name.replace(/\.[^.]+$/,'');
      setDraft(text);setTitle(heading);reset(text,heading,analyze(text));
    } catch (e) {setNotice(t('Import failed. Use a readable TXT, DOCX, or text-based PDF.','匯入失敗。請使用可讀取的 TXT、DOCX 或含文字的 PDF。') + (e instanceof Error && !zh ? ' ' + e.message : ''));}
    finally {setBusy(false);if(file.current) file.current.value='';}
  }
  function exportFile(format:'json'|'txt') {
    const content = format === 'json' ? JSON.stringify({...article,offsetConvention:'UTF-16, zero-based, end-exclusive'},null,2) :
      [article.title,article.text,t('Annotations','標註'),...article.annotations.map((a,i)=>
        [String(i+1)+'. '+cat(a.category)+' · '+name(a)+' ['+a.start+', '+a.end+')',a.text,a.explanation,a.contribution,
          ...a.related.map(r=>'→ ['+r.start+', '+r.end+') '+r.text),a.alternative].filter(Boolean).join('\n'))].join('\n\n');
    const url = URL.createObjectURL(new Blob([content],{type:format==='json'?'application/json':'text/plain;charset=utf-8'}));
    const link = document.createElement('a');link.href=url;link.download='discourse-analysis.'+format;link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function newAnnotation() {
    const selection = textarea.current;
    const start = draft===article.text ? selection?.selectionStart ?? 0 : 0;
    const end = draft===article.text && selection && selection.selectionEnd>start ? selection.selectionEnd : Math.min(start+1,article.text.length);
    const fallback = end>start ? start : 0;
    setSelected(undefined);setFocused(undefined);setEditor({...span(article.text,fallback,end>start?end:1),
      id:crypto.randomUUID(),category:'reference',subtype:'',explanation:'',contribution:'',related:[],confidence:'medium',alternative:'',origin:'manual',signal:'inferred'});
    setTimeout(()=>detail.current?.scrollIntoView({block:'nearest'}),0);
  }
  function save(e:FormEvent) {
    e.preventDefault();
    if(!editor) return;
    if(editor.start<0 || editor.end>article.text.length || editor.end<=editor.start || !article.text.slice(editor.start,editor.end).trim()) {
      setNotice(t('Choose valid offsets that select text.','請輸入有效的字元位置。'));return;
    }
    const a = {...editor,...span(article.text,editor.start,editor.end),origin:'manual' as const};
    setArticle({...article,annotations:[...article.annotations.filter(row=>row.id!==a.id),a].sort((a,b)=>a.start-b.start||a.end-b.end)});
    setFilters(f=>f.includes(a.category)?f:[...f,a.category]);select(a.id);setNotice('');
  }
  const explain = (a:Annotation, links:boolean) => <div className="explanation">
    <span className="badge" style={color(a.category)}>{cat(a.category)}</span>
    <h3>{name(a)}</h3>
    <blockquote>{a.text}</blockquote>
    <div className="metadata"><span>{t('Confidence','信心')} · {t(a.confidence,{high:'高',medium:'中',low:'低'}[a.confidence])}</span><span>{a.signal==='explicit'?t('Overt cue','明示線索'):t('Inferred','推論')}</span><span>[{a.start}, {a.end})</span></div>
    <h4>{t('Interpretation','詮釋')}</h4><p>{a.explanation}</p>
    <h4>{t('Contribution','篇章功能')}</h4><p>{a.contribution}</p>
    {a.alternative && <><h4>{t('Alternative reading','其他解讀')}</h4><p>{a.alternative}</p></>}
    {links && a.related.length>0 && <><h4>{t('Linked evidence','關聯證據')}</h4>{a.related.map((r,i)=>
      <button className="evidence" key={i} onClick={()=>scroll(r)}>↗ {r.text}</button>)}</>}
  </div>;

  return <>
    <div inert={step!==undefined}>
    <header className="topbar"><a className="brand" href="./"><span className="logo" aria-hidden="true">¶</span><span>{t('Discourse Lab','篇章分析實驗室')}<small>{t('WRITTEN DISCOURSE TOOLKIT','書面篇章分析工具')}</small></span></a>
      <div className="row"><button className="quiet" onClick={()=>setZh(!zh)} aria-label={t('Switch to Traditional Chinese','切換成英文')}>{t('繁體中文','English')}</button>
      <button className="primary" ref={presentButton} onClick={()=>{
        setStep(-1);setShow(false);
        requestAnimationFrame(()=>{stage.current?.focus();void stage.current?.requestFullscreen?.().catch(()=>{});});
      }}>▷ {t('Present','簡報模式')}</button></div>
    </header>
    <main className="shell">
      <section className="intro"><p className="eyebrow"><span className="line"/> {t('THE DISCOURSE WORKBENCH','篇章分析工作臺')}</p>
        <h1>{t('Written Discourse Analyzer','書面篇章分析工具')}</h1>
        <p>{t('Explore how a text holds together, develops an argument, and guides its reader.','探索文本如何建立銜接、發展論述並引導讀者。')}</p>
        <div className="framework"><span>¶</span>{t('Michael McCarthy · Written language, Ch. 6 · Grammar & vocabulary, Ch. 2–3','Michael McCarthy · 第 6 章書面語言 · 第 2–3 章語法與詞彙')}</div>
      </section>
      <div className="workbench">
        <aside className="side">
          <section className="card source">
            <div className="section-heading"><span className="index">01</span><h2>{t('Article input','文章輸入')}</h2></div>
            <label htmlFor="title">{t('Article title','文章標題')}</label><input id="title" value={title} disabled={busy} onChange={e=>setTitle(e.target.value)}/>
            <label htmlFor="draft">{t('English text','英文原文')}</label><textarea id="draft" ref={textarea} rows={7} value={draft} disabled={busy} onChange={e=>setDraft(e.target.value)} spellCheck={false}/>
            <input ref={file} type="file" accept=".txt,.docx,.pdf" hidden onChange={e=>void upload(e.target.files?.[0])}/>
            <button className="upload" disabled={busy} onClick={()=>file.current?.click()}><span>↑</span> {t('Upload file','上傳檔案')} <small>TXT · DOCX · PDF</small></button>
            <div className="row actions"><button className="primary" disabled={busy} onClick={()=>void run(false)}>{t('Analyze text','分析文本')}</button><button disabled={busy} onClick={()=>void run(true)}>{t('Try AI','使用 AI')}</button></div>
            <p className="help">{t('Try AI sends the current text to the configured provider.','使用 AI 會將目前文字傳送至已設定的服務。')}</p>
            <button className="text-btn" disabled={busy} onClick={()=>{setDraft(sample);setTitle(sampleTitle);setNotice('');reset(sample,sampleTitle,analyze(sample));}}>{t('↺ Load sample article','↺ 載入示範文章')}</button>
            {busy && <p role="status" className="help">{t('Processing…','處理中…')}</p>}
          </section>
          <section className="card filters">
            <div className="section-heading"><span className="index">02</span><h2>{t('Annotation layers','標註圖層')}</h2></div>
            <button className="text-btn" onClick={()=>{setFilters(filters.length===keys.length?[]:keys);setEditor(undefined);}}>{filters.length===keys.length?t('Hide all','隱藏全部'):t('Show all','顯示全部')}</button>
            {keys.map(k=><label className="filter" key={k} style={color(k)}><input type="checkbox" checked={filters.includes(k)} onChange={e=>setFilters(f=>e.target.checked?[...f,k]:f.filter(x=>x!==k))}/><i/>{cat(k)}<small>{article.annotations.filter(a=>a.category===k).length}</small></label>)}
          </section>
        </aside>
        <section className="card article">
          <div className="tabs" aria-label={t('Article views','文章檢視')}><button aria-pressed={tab==='reading'} onClick={()=>setTab('reading')}>{t('Reading view','閱讀檢視')}</button><button aria-pressed={tab==='structure'} onClick={()=>setTab('structure')}>{t('Structure map','結構圖')}</button></div>
          <div className="article-body">
            <div className="article-meta"><span className="mode">{article.engine==='ai'?t('AI analysis','AI 分析'):t('Local analysis','本機分析')}</span><span>{paragraphs(article.text).length} {t('paragraphs','段落')} · {visible.length}/{article.annotations.length} {t('annotations','標註')}</span></div>
            <h2 lang="en">{article.title}</h2>
            {notice && <div className="notice" role="status">{notice}</div>}
            {draft!==article.text && <p className="notice">{t('The input has changed. Analyze it to update this view.','輸入內容已變更。重新分析即可更新檢視。')}</p>}
            {tab==='reading' ? <Reading text={article.text} annotations={visible} active={active?.id} related={focused?[focused]:active?.related??[]}
              onSelect={select} label={a=>cat(a.category)} focus={focused}/> :
              <Structure text={article.text} annotations={visible} onInspect={inspect} onSelect={select} zh={zh} name={name}/>}
          </div>
          <div className="article-footer"><span>{t('Suggested readings for discussion','供討論的分析建議')}</span><div className="row"><button onClick={()=>exportFile('txt')}>{t('Export TXT','匯出 TXT')}</button><button onClick={()=>exportFile('json')}>{t('Export JSON','匯出 JSON')}</button></div></div>
        </section>
        <aside className="card inspector" ref={detail}>
          <div className="section-heading"><span className="index">03</span><h2>{t('Evidence & interpretation','證據與詮釋')}</h2></div>
          {editor ? <form className="edit" onSubmit={save}>
            <h3>{t('Edit annotation','編輯標註')}</h3>
            <label>{t('Category','類別')}<select value={editor.category} onChange={e=>setEditor({...editor,category:e.target.value as Category})}>{keys.map(k=><option key={k} value={k}>{cat(k)}</option>)}</select></label>
            <label>{t('Subtype','子類型')}<input required value={editor.subtype} onChange={e=>setEditor({...editor,subtype:e.target.value})}/></label>
            <div className="row offset">{(['start','end'] as const).map(k=><label key={k}>{k==='start'?t('Start','起始'):t('End','結束')}<input type="number" required min={0} max={article.text.length} value={editor[k]} onChange={e=>setEditor({...editor,[k]:e.target.valueAsNumber})}/></label>)}</div>
            <blockquote>{article.text.slice(editor.start,editor.end)}</blockquote>
            {(['explanation','contribution','alternative'] as const).map((k,i)=><label key={k}>{[t('Interpretation','詮釋'),t('Contribution','篇章功能'),t('Alternative reading','其他解讀')][i]}<textarea rows={2} required={i<2} value={editor[k]} onChange={e=>setEditor({...editor,[k]:e.target.value})}/></label>)}
            <label>{t('Confidence','信心')}<select value={editor.confidence} onChange={e=>setEditor({...editor,confidence:e.target.value as Annotation['confidence']})}>{['low','medium','high'].map((x,i)=><option value={x} key={x}>{t(x,['低','中','高'][i])}</option>)}</select></label>
            <label>{t('Signal','線索')}<select value={editor.signal} onChange={e=>setEditor({...editor,signal:e.target.value as Annotation['signal']})}><option value="inferred">{t('Inferred','推論')}</option><option value="explicit">{t('Overt cue','明示線索')}</option></select></label>
            <label>{t('Related spans, one start:end pair per line','關聯片段，每行一組起始:結束位置')}<textarea key={editor.id} rows={2} defaultValue={editor.related.map(r=>r.start+':'+r.end).join('\n')} onChange={e=>{
              const input=e.currentTarget;
              const pairs=input.value.trim()?input.value.trim().split(/\r?\n/).map(l=>l.match(/^\s*(\d+)\s*:\s*(\d+)\s*$/)):[];
              if(pairs.some(p=>!p||+p[1]>=+p[2]||+p[2]>article.text.length)) {input.setCustomValidity(t('Enter valid start:end pairs.','請輸入有效的起始:結束位置。'));return;}
              input.setCustomValidity('');setEditor({...editor,related:pairs.map(p=>span(article.text,+p![1],+p![2]))});
            }}/></label>
            <div className="row"><button className="primary" type="submit">{t('Save','儲存')}</button><button type="button" onClick={()=>setEditor(undefined)}>{t('Cancel','取消')}</button></div>
          </form> : active ? <>{explain(active,true)}<div className="row actions"><button onClick={()=>setEditor({...active})}>{t('Edit','編輯')}</button><button className="danger" onClick={()=>{setArticle({...article,annotations:article.annotations.filter(a=>a.id!==active.id)});setSelected(undefined);}}>{t('Delete','刪除')}</button></div></> :
            focused ? <blockquote>{focused.text}</blockquote> :
              <div className="empty"><span aria-hidden="true">“ ”</span><p>{t('Choose a highlight to examine its evidence and role in the text.','選擇醒目標註，查看其證據與篇章功能。')}</p></div>}
          <div className="annotation-index">
            <div className="row between"><h3>{t('Annotation index','標註索引')}</h3><button className="text-btn" onClick={newAnnotation}>{t('+ Add','＋新增')}</button></div>
            <div className="annotation-list">{visible.map(a=><button key={a.id} aria-pressed={a.id===active?.id} onClick={()=>select(a.id)} style={color(a.category)}><i/><span>{name(a)}<small>{a.text}</small></span></button>)}</div>
            {!visible.length && <p className="help">{t('No visible annotations.','沒有可見標註。')}</p>}
          </div>
        </aside>
      </div>
      <footer>{t('Written Discourse Lab · Classroom analysis workspace','篇章分析實驗室 · 課堂分析工作臺')}<a href="https://shop.cambridge.org/english/product/2700034562" target="_blank" rel="noreferrer">{t('McCarthy (1991) ↗','McCarthy（1991）↗')}</a></footer>
    </main>
    </div>
    {step!==undefined && <section className="stage" role="dialog" aria-modal="true" aria-label={t('Classroom presentation','課堂簡報')} ref={stage} tabIndex={-1}>
      <header className="stage-bar"><strong>¶ {t('Presentation mode','簡報模式')}</strong><div className="row"><button aria-pressed={prediction} onClick={()=>setPrediction(!prediction)}>{t('Prediction','預測活動')}</button><button aria-pressed={notesOpen} onClick={()=>setNotesOpen(!notesOpen)}>{t('Notes','講者筆記')}</button><button onClick={close}>{t('Exit','離開')}</button></div></header>
      <div className="stage-layout">
        <div className="stage-text"><h1>{article.title}</h1>
          <Reading prefix="stage-" text={article.text} annotations={current?[current]:[]} active={current?.id} related={show?current?.related??[]:[]}
            onSelect={()=>setShow(true)} label={a=>show?cat(a.category):t('Highlighted passage','醒目片段')}/></div>
        <aside className="stage-side">
          <span className="eyebrow">{t('CLASSROOM DISCUSSION','課堂討論')}</span>
          {!current ? <p>{t('Read the text, then advance to the first highlight.','先閱讀文本，再前往第一個標註。')}</p> :
            show ? explain(current,false) : <p>{prediction?t('What role might this passage play? Find a cue or a linked passage before revealing the interpretation.','這段文字可能有何功能？揭示詮釋前，先找出線索或關聯片段。'):t('Discuss the highlighted passage before revealing the interpretation.','揭示詮釋前，先討論醒目片段。')}</p>}
          {notesOpen && <label>{t('Presenter notes · visible on this screen','講者筆記 · 此畫面可見')}<textarea rows={5} value={notes} onChange={e=>setNotes(e.target.value)}/></label>}
        </aside>
      </div>
      <div className="stage-controls"><small>← / → {t('Navigate','切換')} · Space {t('Reveal','揭示')} · Esc {t('Exit','離開')}</small><div className="row"><button disabled={step<0} onClick={()=>next(-1)}>← {t('Previous','上一項')}</button><span aria-live="polite">{step+1} / {visible.length}</span><button disabled={!current} onClick={()=>setShow(!show)}>{show?t('Hide interpretation','隱藏詮釋'):t('Reveal interpretation','揭示詮釋')}</button><button className="primary" disabled={step>=visible.length-1} onClick={()=>next(1)}>{t('Next','下一項')} →</button></div></div>
    </section>}
  </>;
}

createRoot(document.getElementById('root')!).render(<App/>);

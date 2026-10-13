/* QQ Mail handoff: fills a new draft only. Never clicks Send or saves over a draft. */
(()=>{
 if(window!==window.top||window.__jobMailAssistantLoaded)return;
 window.__jobMailAssistantLoaded=true;
 let payload=null,filledId=null,attachmentId=null,composeClicked=false,stopped=false,banner=null,activeTimer=null,pickedTo=null,preserveExisting=false,savedRecipient=null;
 const visible=el=>!!el&&!el.disabled&&!!(el.getClientRects().length)&&getComputedStyle(el).visibility!=='hidden';
 function docs(){const found=[document];for(let i=0;i<found.length&&i<15;i++)for(const f of found[i].querySelectorAll('iframe')){try{if(f.contentDocument&&!found.includes(f.contentDocument))found.push(f.contentDocument)}catch{}}return found;}
 function find(selectors){for(const d of docs())for(const selector of selectors){const el=[...d.querySelectorAll(selector)].find(visible);if(el)return el;}return null;}
 function fieldByLabel(label){
  for(const d of docs())for(const node of d.querySelectorAll('label,span,div')){
   if(!visible(node)||node.children.length>1||!label.test(node.textContent.replace(/\s/g,'')))continue;
   if(node.tagName==='LABEL'&&node.htmlFor){const input=d.getElementById(node.htmlFor);if(visible(input)&&input.matches('input,textarea,[contenteditable="true"],[contenteditable="plaintext-only"]'))return input;}
   let row=node.parentElement;
   for(let depth=0;depth<3&&row;depth++,row=row.parentElement){
    const candidates=[...row.querySelectorAll('input:not([type="hidden"]),textarea,[contenteditable="true"],[contenteditable="plaintext-only"]')].filter(el=>visible(el)&&!el.closest('#job-mail-helper-banner')&&Math.abs(el.getBoundingClientRect().top-node.getBoundingClientRect().top)<45);
    if(candidates.length===1)return candidates[0];
   }
  }return null;
 }
 function findBody(){
  const specific=find(['textarea[name="content"]','textarea[name="body"]','[contenteditable="true"][aria-label*="正文"]','[contenteditable="true"][data-placeholder*="正文"]','.qmEditor[contenteditable="true"]','.qmEditor [contenteditable="true"]','.tiptap.ProseMirror','.rich_editor[contenteditable="true"]','[contenteditable="true"][role="textbox"][aria-multiline="true"]','.ProseMirror[contenteditable="true"]','.ql-editor[contenteditable="true"]','[contenteditable="true"][data-placeholder*="邮件"]']);if(specific)return specific;
  for(const d of docs()){if(d!==document&&(d.designMode==='on'||d.body?.isContentEditable))return d.body;}
  return null;
 }
 function linkedLine(doc,line){
  const div=doc.createElement('div');
  const text=line.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'$2');
  const pattern=/https?:\/\/[^\s<>"，。；！？、）】]+/g;let cursor=0;
  for(const match of text.matchAll(pattern)){
   const url=match[0].replace(/[.,;!?)]+$/,'');
   if(!url)continue;
   div.append(doc.createTextNode(text.slice(cursor,match.index)));
   const a=doc.createElement('a');a.textContent=url;a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.style.color='#1769c2';a.style.textDecoration='underline';div.append(a);
   cursor=match.index+url.length;
  }
  div.append(doc.createTextNode(text.slice(cursor)||(!text?'\u00a0':'')));return div;
 }
 async function rememberRecipient(el){
  const d=el.ownerDocument,selectors=[];
  if(el.id)selectors.push('#'+CSS.escape(el.id));
  const classes=[...el.classList].filter(c=>c.length<80);
  if(classes.length)selectors.push(el.localName+classes.map(c=>'.'+CSS.escape(c)).join(''));
  let path='',node=el;
  for(let depth=0;node&&node!==d.documentElement&&depth<9;depth++,node=node.parentElement){
   const siblings=[...node.parentElement.children].filter(x=>x.localName===node.localName);
   const piece=node.localName+':nth-of-type('+(siblings.indexOf(node)+1)+')';path=piece+(path?' > '+path:'');
   if(d.querySelectorAll(path).length===1){selectors.push(path);break;}
  }
  savedRecipient={host:location.hostname,selectors:selectors.filter(q=>{try{return d.querySelectorAll(q).length===1}catch{return false}}),tag:el.localName,type:el.getAttribute('type')||'',classes};
  try{await chrome.storage.local.set({qqRecipientLocator:savedRecipient})}catch{}
 }
 function rememberedRecipient(subject){
  if(!savedRecipient||savedRecipient.host!==location.hostname||!subject)return null;
  for(const d of docs())for(const selector of savedRecipient.selectors){
   let matches;try{matches=[...d.querySelectorAll(selector)].filter(visible)}catch{continue}
   if(matches.length!==1)continue;const el=matches[0];
   if(el===subject||el===findBody()||el.localName!==savedRecipient.tag||(el.getAttribute('type')||'')!==savedRecipient.type||!savedRecipient.classes.every(c=>el.classList.contains(c)))continue;
   if(!el.matches('input,textarea,[contenteditable="true"],[contenteditable="plaintext-only"]')||/search/i.test(el.type+' '+el.name+' '+el.getAttribute('placeholder')))continue;
   const distance=subject.getBoundingClientRect().top-el.getBoundingClientRect().top;
   if(el.ownerDocument===subject.ownerDocument&&distance>0&&distance<160&&el.getBoundingClientRect().height<90)return el;
  }
  return null;
 }
 function setField(el,value){
  el.focus();if(el.tagName==='INPUT'||el.tagName==='TEXTAREA'){
   const win=el.ownerDocument.defaultView;const proto=el.tagName==='INPUT'?win.HTMLInputElement.prototype:win.HTMLTextAreaElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);
  }else {el.replaceChildren(...value.split('\n').map(line=>linkedLine(el.ownerDocument,line)));}
  const win=el.ownerDocument.defaultView;el.dispatchEvent(new win.Event('input',{bubbles:true}));el.dispatchEvent(new win.Event('change',{bubbles:true}));
 }
 function message(s){if(banner)banner.querySelector('[data-message]').textContent=s;chrome.runtime.sendMessage({type:'QQ_RESULT',status:{message:s}}).catch(()=>{});}
 function ui(){
  if(banner)return;banner=document.createElement('div');banner.id='job-mail-helper-banner';Object.assign(banner.style,{position:'fixed',bottom:'18px',right:'18px',zIndex:'2147483647',width:'340px',background:'#f4f7ff',color:'#263743',border:'1px solid #bcc8ef',borderRadius:'12px',padding:'16px',boxShadow:'0 8px 30px #20335a25',font:'13px/1.7 Microsoft YaHei, sans-serif'});
  const title=document.createElement('strong');title.textContent='求职邮件助手 · 请在发送前审核';const p=document.createElement('p');p.dataset.message='';p.textContent='请登录 QQ 邮箱。扩展会进入空白写信页并填入草稿，不会发送。';p.style.margin='8px 0';
  for(const [label,value] of [['复制收件人',payload.draft.to],['复制主题',payload.draft.subject],['复制正文',payload.draft.body]]){
   const copy=document.createElement('button');copy.textContent=label;
   copy.onclick=async()=>{try{await navigator.clipboard.writeText(value);message(label+'成功。可粘贴到写信页对应位置。')}catch{message('复制失败，请返回扩展复制。')}};
   Object.assign(copy.style,{margin:'4px',padding:'5px',cursor:'pointer'});banner.append(copy);
  }
  const retry=document.createElement('button');retry.textContent='填入当前空白写信页';retry.onclick=()=>{stopped=false;tryFill(true)};
  const pick=document.createElement('button');pick.textContent='点选收件人输入框';
  pick.onclick=()=>{
   stopped=true;message('请点击页面“收件人”右侧可以输入邮箱的位置。选中后会自动填入，无需粘贴。');
   const documents=docs();
   const select=e=>{
    if(banner?.contains(e.target))return;
    const selector='input:not([type="hidden"]),textarea,[contenteditable="true"],[contenteditable="plaintext-only"]';
    let el=e.target.closest(selector);
    if(!el){const inputs=[...e.target.querySelectorAll(selector)].filter(visible);if(inputs.length===1)el=inputs[0];}
    if(!el||!visible(el)){message('此处不是输入框，请点击收件人栏内可以输入文字的位置。');return;}
    const subj=find(['input[name="subject"]','#subject','input[placeholder*="主题"]'])||fieldByLabel(/^(主题|邮件主题)[:：]?$/);
    if(el===subj||el===findBody()||/search/i.test(el.type+' '+el.name+' '+el.getAttribute('placeholder'))){message('这不是收件人输入框，请点击收件人栏。');return;}
    e.preventDefault();e.stopPropagation();documents.forEach(d=>d.removeEventListener('click',select,true));
    pickedTo=el;rememberRecipient(el);stopped=false;tryFill(true).catch(()=>message('填入失败，请检查输入框是否选对。'));
   };
   documents.forEach(d=>d.addEventListener('click',select,true));
  };
  const keep=document.createElement('label');keep.style.display='block';
  const check=document.createElement('input');check.type='checkbox';check.onchange=()=>{preserveExisting=check.checked;};
  keep.append(check,document.createTextNode('保留现有签名，在其前面插入邮件正文'));
  const close=document.createElement('button');close.textContent='关闭';close.onclick=()=>{stopped=true;banner.remove();banner=null;};
  for(const b of [retry,pick,close])Object.assign(b.style,{padding:'5px 9px',marginRight:'7px',border:'1px solid #c2cdea',borderRadius:'6px',background:'white',cursor:'pointer',color:'#4d60a1'});
  banner.append(title,p,keep,retry,pick,close);document.documentElement.append(banner);
 }
 async function attach(){
  if(!payload.attachment||attachmentId===payload.id)return attachmentId===payload.id;
  let input=null;
  for(const d of docs()){
   const candidates=[...d.querySelectorAll('input[type="file"]')].filter(el=>!el.accept||/pdf|\*|application|\.doc/i.test(el.accept));
   input=candidates.find(el=>!/image|picture|avatar|超大|截图/i.test([el.id,el.name,el.getAttribute('aria-label')].join(' ')));if(input)break;
  }
  if(!input)return false;
  const a=payload.attachment;const raw=atob(a.base64);const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));const win=input.ownerDocument.defaultView;const transfer=new win.DataTransfer();transfer.items.add(new win.File([bytes],a.name,{type:'application/pdf'}));input.files=transfer.files;input.dispatchEvent(new win.Event('change',{bubbles:true}));attachmentId=payload.id;return true;
 }
 function stringValue(el){return (el.value??el.innerText??'').replace(/\u00a0/g,' ').trim();}
 async function tryFill(manual=false){
  if(stopped||!payload)return false;
  if(filledId===payload.id){message('本次草稿已填入。请检查收件人和附件上传状态，再手动发送；不会重复覆盖。');return true;}
  let to=(pickedTo?.isConnected&&visible(pickedTo)?pickedTo:null)||find(['[contenteditable="true"][aria-label*="收件人"]','[contenteditable="plaintext-only"][aria-label*="收件人"]','[contenteditable="true"][data-placeholder*="收件人"]','[contenteditable="true"][data-placeholder*="邮箱"]','textarea[placeholder*="收件人"]','input[name="to"]','textarea[name="to"]','input#to','textarea#to','#to input','#to textarea','input[placeholder*="邮箱地址"]','input[placeholder*="添加收件人"]','#toArea input','input[aria-label*="收件人"]','input[placeholder*="收件人"]','input[aria-label="To"]'])||fieldByLabel(/^收件人\s*[:：]?$/);
  const subject=find(['input[name="subject"]','input#subjectInput','input[placeholder*="邮件标题"]','input[placeholder*="输入主题"]','#subject','input[placeholder*="主题"]','input[aria-label*="主题"]'])||fieldByLabel(/^(主题|邮件主题)\s*[:：]?$/);
  if(!to)to=rememberedRecipient(subject);
  let body=findBody();
  if(!body&&to&&subject){
   const editors=docs().flatMap(d=>[...d.querySelectorAll('[contenteditable="true"],[contenteditable="plaintext-only"]')]).filter(e=>visible(e)&&!e.closest('#job-mail-helper-banner')&&e!==to&&e.getBoundingClientRect().height>=80);
   if(editors.length===1)body=editors[0];
  }
  if(!to||!subject||!body){
   if(!composeClicked){const compose=find(['a[title="写信"]','button[title="写信"]','[aria-label="写信"]']);const candidate=compose||docs().flatMap(d=>[...d.querySelectorAll('a,button,[role="button"],li,span,div')]).find(el=>visible(el)&&el.children.length<3&&/^(写信|写邮件|新建邮件|撰写)$/.test(el.textContent.replace(/\s/g,'')));if(candidate){composeClicked=true;candidate.click();return false;}}
   message('尚未识别到：'+[!to?'收件人栏':'',!subject?'主题栏':'',!body?'正文编辑器':''].filter(Boolean).join('、')+'。请点击 QQ 邮箱的“写信”，再点“填入当前空白写信页”。');return false;
  }
  if([to,subject].some(el=>stringValue(el))){stopped=true;message('收件人或主题已有内容，已停止以避免覆盖。请使用空白写信页。');return false;}
  let prepend=false;
  if(stringValue(body)){
   const clone=body.cloneNode(true);
   const signatures=clone.querySelectorAll('[class*="signature"],[id*="signature"],[data-signature],.qqmail_sign');
   const signatureFound=signatures.length>0;signatures.forEach(el=>el.remove());
   const onlySignature=signatureFound&&!clone.textContent.replace(/\u00a0/g,' ').trim();
   prepend=onlySignature||(manual&&preserveExisting);
   if(!prepend){stopped=true;message('正文区已有内容。如果仅是默认签名，请勾选“保留现有签名”，再点填入；已有邮件请先新建空白草稿。');return false;}
  }
  setField(to,payload.draft.to);const win=to.ownerDocument.defaultView;to.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}));to.dispatchEvent(new win.KeyboardEvent('keyup',{key:'Enter',code:'Enter',bubbles:true}));to.blur();
  setField(subject,payload.draft.subject);
  if(prepend&&body.isContentEditable){
   const fragment=body.ownerDocument.createDocumentFragment();
   for(const line of (payload.draft.body+'\n\n').split('\n')){fragment.append(linkedLine(body.ownerDocument,line));}
   body.prepend(fragment);const view=body.ownerDocument.defaultView;body.dispatchEvent(new view.Event('input',{bubbles:true}));body.dispatchEvent(new view.Event('change',{bubbles:true}));
  }else setField(body,prepend?payload.draft.body+'\n\n'+stringValue(body):payload.draft.body);
  filledId=payload.id;
  const attachment=await attach();
  message(attachment?'收件人、主题、正文已填入，附件已选择。请核对收件人并等待 QQ 显示上传成功，再亲自点击发送。':'收件人、主题、正文已填入。未找到附件上传控件，请从扩展下载简历并手动添加，再审核发送。');
  return true;
 }
 async function begin(){
  clearInterval(activeTimer);
  try{savedRecipient=(await chrome.storage.local.get("qqRecipientLocator")).qqRecipientLocator||null;}catch{}
  // The tab can finish loading before the background saves its handoff.
  for(let n=0;n<60&&!stopped;n++){
   try{const result=await chrome.runtime.sendMessage({type:'QQ_PENDING'});payload=result?.value;if(payload)break;}catch{}
   await new Promise(resolve=>setTimeout(resolve,1000));
  }
  if(!payload||stopped)return;
  ui();let attempts=0,inFlight=false;
  const timer=activeTimer=setInterval(async()=>{
   if(inFlight)return;inFlight=true;attempts++;
   try{if(await tryFill()||attempts>=180||stopped){clearInterval(timer);if(attempts>=180&&!filledId)message('等待写信页超时。登录后请点击“写信”，再点“填入当前空白写信页”。');}}
   catch{clearInterval(timer);message('自动填入失败。可使用这里的复制按钮；请把尚未识别的栏目告诉我以继续适配。没有发送邮件。');}
   finally{inFlight=false}
  },1000);
 }
 chrome.runtime.onMessage?.addListener((m,sender,reply)=>{
  if(m.type!=='QQ_REFRESH'||sender.id!==chrome.runtime.id)return;
  stopped=false;composeClicked=false;if(banner){banner.remove();banner=null;}
  begin();reply({ok:true});
 });
 begin();
})();

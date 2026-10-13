const fs=require('node:fs');const path=require('node:path');const http=require('node:http');const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');const ext=path.join(root,'extension');
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.wasm':'application/wasm','.gz':'application/octet-stream','.pdf':'application/pdf'};
const server=http.createServer((req,res)=>{const file=path.resolve(ext,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(ext+path.sep)){res.writeHead(403);return res.end()}try{res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).on('error',()=>{res.statusCode=404;res.end()}).pipe(res)}catch{res.writeHead(404);res.end()}});
let browser;const results=[];
const stub=()=>{
 const local={},session={},listeners=[];window.__calls=[];
 function store(area){const values=area==='local'?local:session;return {async get(keys){if(typeof keys==='string')keys=[keys];return Object.fromEntries(keys.map(k=>[k,values[k]]))},async set(data){const changes={};for(const [k,v]of Object.entries(data)){changes[k]={newValue:v};values[k]=v}listeners.forEach(f=>f(changes,area))},async remove(keys){for(const k of [].concat(keys))delete values[k]}}}
 window.chrome={storage:{local:store('local'),session:store('session'),onChanged:{addListener:f=>listeners.push(f)}},permissions:{request:async()=>true},downloads:{download:async x=>window.__calls.push({type:'download',value:x})},runtime:{getURL:s=>location.origin+'/'+s,sendMessage:async m=>{window.__calls.push(m);if(m.type==='READ')return {ok:true,value:{title:'示例公司 招聘',text:'投递 recruiter@example.com，产品运营实习，每周5天，6个月',images:[]}};if(m.type==='GENERATE')return {ok:true,value:{to:'recruiter@example.com',subject:'测试AI主题',body:'尊敬的招聘负责人：\n\n您好！测试AI草稿。',warnings:['核对原帖'],mode:'AI 定制草稿'}};if(m.type==='HANDOFF')return {ok:true,value:{tabId:5}};return {ok:false,error:'未模拟此操作'}}}};
};
(async()=>{
 await new Promise(r=>server.listen(4182,'127.0.0.1',r));browser=await chromium.launch({...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{}),headless:true});
 const context=await browser.newContext();await context.addInitScript(stub);const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4182/panel.html');await page.waitForSelector('#p-name',{state:'attached'});
 await page.evaluate(()=>{document.querySelector('#p-name').value='示例同学';document.querySelector('#p-school').value='示例大学';for(const [key,value] of Object.entries({major:'示例专业',graduation:'2028届',days:'5',months:'6',startDate:'2027-01-01'}))document.querySelector('#p-'+key).value=value;document.querySelector('#p-facts')?.remove();document.querySelector('#facts').value='独立完成示例项目需求梳理与原型。';});
 await page.locator('#resumeFile').setInputFiles({name:'synthetic-resume.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n'+' '.repeat(12000))});
 await page.waitForFunction(()=>document.querySelector('#attachmentName').textContent==='synthetic-resume.pdf');

 await page.locator('#read').click();await page.locator('#basic').click();await page.waitForFunction(()=>document.querySelector('#to').value==='recruiter@example.com');
 assert.match(await page.locator('#body').inputValue(),/示例同学/);
 await page.locator('#handoff').click();assert.match(await page.locator('#status').textContent(),/先勾选/);
 await page.locator('#reviewed').check();await page.locator('#handoff').click();await page.waitForFunction(()=>window.__calls.some(x=>x.type==='HANDOFF'));
 const handoff=await page.evaluate(()=>window.__calls.find(x=>x.type==='HANDOFF'));assert.equal(handoff.draft.to,'recruiter@example.com');assert.equal(handoff.attachment.type,'application/pdf');assert.ok(handoff.attachment.base64.length>10000);
 results.push('Panel reads source, builds editable draft, enforces review, and hands off selected PDF');
 await page.locator('#jd').fill('同时投递 a@example.com 与 b@example.com');await page.locator('#basic').click();assert.equal(await page.locator('#to').inputValue(),'');assert.equal(await page.locator('#emailChoices').isVisible(),true);await page.locator('#emailChoices').selectOption('b@example.com');assert.equal(await page.locator('#to').inputValue(),'b@example.com');
 results.push('Multiple recipients require manual selection');
 await page.locator('#jd').fill('示例公司互联网商业化产运实习，投递recruiter@example.com，每周5天，至少6个月。');await page.evaluate(()=>chrome.storage.session.set({aiKey:'synthetic-test-only',provider:'openai'}));await page.locator('#generate').click();await page.waitForFunction(()=>document.querySelector('#subject').value==='测试AI主题');results.push('AI result rendering verified with stub response (no live API call)');
 await page.setViewportSize({width:430,height:1000});await page.screenshot({path:path.join(root,'tests/panel-preview.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 // Real packaged OCR assets. No model API and no remote OCR.
 const sample=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=900;c.height=180;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,900,180);x.fillStyle='black';x.font='36px Microsoft YaHei';x.fillText('产品运营实习 示例公司',24,55);x.fillText('recruiter@example.com',24,120);return c.toDataURL()});
 await page.locator('#ocrFile').setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from(sample.split(',')[1],'base64')});await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('识别完成')||document.querySelector('#status').classList.contains('error'),{},{timeout:120000});const ocrStatus=await page.locator('#status').textContent();assert.match(ocrStatus,/识别完成/);assert.match(await page.locator('#jd').inputValue(),/recruiter/);results.push('Packaged Chinese/English OCR recognizes a recruitment image locally');
 assert.deepEqual(errors,[]);
 // QQ adapters tested against controlled legacy and modern forms. No real mail service accessed.
 for(const mode of ['modern','legacy','occupied']){
  const mail=await context.newPage();await mail.setContent(mode==='legacy'?'<a title="写信">写信</a><input name="to"><input name="subject"><iframe id="editor"></iframe><input type="file"><button id="send">发送</button>':'<input aria-label="收件人"><input aria-label="主题"><div contenteditable="true" aria-label="正文"></div><input type="file"><button id="send">发送</button>');
  if(mode==='legacy')await mail.evaluate(()=>{const d=document.querySelector('iframe').contentDocument;d.designMode='on';d.body.innerHTML='';});
  await mail.evaluate(mode=>{window.__sent=0;document.querySelector('#send').onclick=()=>window.__sent++;if(mode==='occupied')document.querySelector('[aria-label="主题"]').value='原有草稿';chrome.runtime.sendMessage=async m=>{if(m.type==='QQ_PENDING')return {ok:true,value:{id:'test',draft:{to:'recruit@example.com',subject:'岗位申请',body:'您好！\n示例同学'},attachment:{name:'resume.pdf',base64:btoa('%PDF-1.4 test'),type:'application/pdf'}}};return {ok:true}};},mode);
  await mail.addScriptTag({path:path.join(ext,'qq-compose.js')});await mail.waitForTimeout(2600);
  assert.equal(await mail.evaluate(()=>window.__sent),0);
  if(mode==='occupied'){assert.equal(await mail.locator('[aria-label="主题"]').inputValue(),'原有草稿');assert.match(await mail.locator('#job-mail-helper-banner').textContent(),/已有内容/)}
  else{assert.equal(await mail.locator(mode==='legacy'?'input[name="subject"]':'input[aria-label="主题"]').inputValue(),'岗位申请');assert.equal(await mail.locator('input[type="file"]').evaluate(el=>el.files[0]?.name),'resume.pdf')}
  await mail.close();results.push('QQ '+mode+' fixture: '+(mode==='occupied'?'preserves existing draft':'fills text and attachment')+', never sends');
 }
 console.log(JSON.stringify(results,null,2));fs.writeFileSync(path.join(root,'tests/browser-results.json'),JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();server.close()});

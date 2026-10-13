import {emailsFrom} from './core.js';
export function parseMail(raw,jd='',currentTo=''){
 if(typeof raw!=='string'||!raw.trim())throw new Error('请先粘贴 ChatGPT 生成的完整邮件。');
 if(raw.length>24000)throw new Error('内容过长，请只粘贴一封邮件。');
 const text=raw.replace(/\r\n?/g,'\n').trim().replace(/^```[^\n]*\n/,'').replace(/\n```$/,'');
 const lines=text.split('\n');
 const clean=s=>s.trim().replace(/^#{1,6}\s*/,'').replace(/\*\*|__/g,'').trim();
 const subjectPattern=/^(?:邮件主题|邮件标题|主题|标题|Subject)\s*[:：]\s*(.*)$/i;
 let index=-1,subject='';
 for(let i=0;i<lines.length;i++){const m=clean(lines[i]).match(subjectPattern);if(m){if(index!==-1)throw new Error('识别到多个邮件主题，请只保留一封邮件再导入。');index=i;subject=m[1].trim();}}
 if(index<0)throw new Error('未找到邮件主题。请在标题前加“邮件主题：”，然后重新导入。');
 let start=index+1;
 if(!subject){while(start<lines.length&&!lines[start].trim())start++;subject=clean(lines[start++]||'');}
 if(!subject||subject.length>240||/^(尊敬|您好|正文|邮件正文)/.test(subject))throw new Error('主题未识别完整，请使用“邮件主题：你的标题”的格式。');
 while(start<lines.length&&(!lines[start].trim()||/^(?:邮件正文|正文|Body)\s*[:：]?$/i.test(clean(lines[start]))||/^[-—]{3,}$/.test(clean(lines[start]))))start++;
 let body=lines.slice(start).join('\n').trim();
 body=body.replace(/^(?:邮件正文|正文|Body)\s*[:：]\s*/i,'');
 if(!body)throw new Error('没有找到正文，请粘贴完整邮件。');
 const pool=emailsFrom(jd),warnings=[];
 let to=pool.length===1?pool[0]:pool.includes(currentTo)?currentTo:'';
 if(pool.length>1)warnings.push('招聘原文有多个邮箱，请选择收件人。');
 if(!pool.length)warnings.push('招聘原文没有邮箱，请依据原帖手动填写。不会把署名中的个人邮箱当成收件人。');
 return {subject,body,to,warnings,mode:'ChatGPT 回复导入（本地拆分，未调用 API）'};
}

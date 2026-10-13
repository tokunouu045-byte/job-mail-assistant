export async function openAI({key,model,instructions,input,json=false},fetcher=fetch){
 const body={model:model||'gpt-4.1-mini',instructions,input,store:false,max_output_tokens:5000};
 if(json)body.text={format:{type:'json_object'}};
 let r;
 try{r=await fetcher('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});}catch{throw new Error('无法连接 OpenAI。请检查网络和服务可用性，或改用复制到 ChatGPT。');}
 if(!r.ok){
  let detail={};try{detail=(await r.json()).error||{}}catch{}
  const clean=value=>{
   let text=typeof value==='string'?value:'';
   if(key)text=text.split(key).join('[密钥已隐藏]');
   return text.replace(/sk-[A-Za-z0-9_-]+/g,'[密钥已隐藏]').replace(/Bearer\s+\S+/gi,'Bearer [已隐藏]').replace(/[\r\n]+/g,' ').slice(0,600);
  };
  const hints={400:'请求参数被拒绝，请查看下方接口原因',401:'请检查 API 密钥',403:'账户、项目权限或服务可用性受限',404:'模型不存在或当前项目无权访问',429:'请检查 API 余额和调用限额'};
  const message=clean(detail.message),code=clean(detail.code),param=clean(detail.param);
  throw new Error('OpenAI 返回 '+r.status+'：'+(hints[r.status]||'服务暂时异常，请稍后重试')+'。\n模型：'+clean(body.model)+(code?'\n错误代码：'+code:'')+(param?'\n参数：'+param:'')+(message?'\n接口原因：'+message:'\n接口没有提供可读取的错误详情。'));
 }
 const data=await r.json();
 if(data.status==='incomplete')throw new Error('AI 输出未完成，请缩短招聘内容后重试。');
 const result=(data.output||[]).filter(x=>x.type==='message').flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n');
 if(!result.trim())throw new Error('OpenAI 未返回文本，请重试或更换模型。');
 return result;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {openAI} from '../extension/openai.js';
import {joinOCR} from '../extension/image-prep.js';
test('Responses API extracts text after reasoning and requests JSON without storing output',async()=>{
 let request;
 const result=await openAI({key:'test-only',instructions:'JSON',input:'synthetic JD',json:true},async(url,options)=>{
  request={url,...options};return {ok:true,json:async()=>({output:[{type:'reasoning'},{type:'message',content:[{type:'output_text',text:'{"body":"test"}'}]}]})};
 });
 assert.equal(request.url,'https://api.openai.com/v1/responses');
 assert.equal(JSON.parse(request.body).store,false);assert.equal(JSON.parse(request.body).text.format.type,'json_object');assert.match(result,/test/);
});
test('Incomplete and rate-limited output is not treated as a finished draft',async()=>{
 await assert.rejects(openAI({key:'test'},async()=>({ok:true,json:async()=>({status:'incomplete'})})),/未完成/);
 await assert.rejects(openAI({key:'test'},async()=>({ok:false,status:429})),/余额和调用限额/);
});
test('Overlapping OCR strips retain all content and remove duplicated boundary lines',()=>{
 assert.equal(joinOCR(['招聘\n邮箱 a@example.com\n6个月','邮箱 a@example.com\n6个月\n岗位要求']), '招聘\n邮箱 a@example.com\n6个月\n岗位要求');
});

test('400 shows the rejected parameter and redacts credentials',async()=>{
 try{await openAI({key:'sk-secret123',model:'example'},async()=>({ok:false,status:400,json:async()=>({error:{code:'unsupported_parameter',param:'text.format',message:'Invalid text.format sk-secret123 Bearer other-secret'}})}));assert.fail('should reject')}
 catch(e){assert.match(e.message,/400/);assert.match(e.message,/text.format/);assert.match(e.message,/unsupported_parameter/);assert.doesNotMatch(e.message,/sk-secret123|other-secret/);}
});

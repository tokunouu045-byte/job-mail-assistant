import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMail} from '../extension/import-mail.js';
test('imports actual reply and obtains recruiter email only from JD',()=>{
 const r=parseMail('邮件主题：2026年10月19日到岗+6个月+每周5天\n\n尊敬的招聘负责人：\n\n您好！\n邮箱：me@example.org','投递recruiter\\@example.com');
 assert.equal(r.to,'recruiter@example.com');assert.match(r.subject,/10月19日/);assert.match(r.body,/尊敬/);
});
test('accepts Markdown headings and next-line subject',()=>{
 const r=parseMail('## 邮件主题：\n产品运营申请\n\n**正文：**\n尊敬的招聘负责人：\n正文');assert.equal(r.subject,'产品运营申请');assert.equal(r.body,'尊敬的招聘负责人：\n正文');assert.equal(r.to,'');
});
test('never imports generated or signature addresses as recipients',()=>{
 const r=parseMail('收件人：wrong@example.com\n主题：求职\n正文：您好\n邮箱：self@example.com','a@example.com b@example.com');assert.equal(r.to,'');
 assert.equal(parseMail('主题：求职\n您好','a@example.com b@example.com','b@example.com').to,'b@example.com');
});
test('rejects missing or ambiguous subject without partial import',()=>{
 assert.throws(()=>parseMail('您好\n正文'),/未找到/);assert.throws(()=>parseMail('主题：一\n正文\n主题：二\n正文'),/多个/);
});

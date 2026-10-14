import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readdirSync,readFileSync } from 'node:fs';
import { submitForm,exportSubmissions } from '../lib/forms-api.ts';
function database(){const sqlite=new DatabaseSync(':memory:');for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+name,'utf8'));
  return {close:()=>sqlite.close(),prepare(sql){let values=[];const query=sqlite.prepare(sql);return{bind(...input){values=input;return this;},async first(){return query.get(...values)||null;},async run(){return{meta:{last_row_id:Number(query.run(...values).lastInsertRowid)}};},async all(){return{results:query.all(...values)};}};}};}
const origin='https://gram.example',token='test-only-organizer-token-not-a-secret';
const payload={name:'Test Member',email:'TEST@example.com',category:'Volunteering',message:'Hello',consent:true};
const request=(data=payload,source=origin)=>new Request(origin+'/api/interest',{method:'POST',headers:{origin:source,'content-type':'application/json'},body:JSON.stringify(data)});
test('hosted form adapter saves validated input and protects export',async()=>{const db=database();try{
  assert.equal((await submitForm(request(),db,'interest')).status,201);assert.equal((await exportSubmissions(new Request(origin),db,token)).status,401);
  const response=await exportSubmissions(new Request(origin,{headers:{authorization:'Bearer '+token}}),db,token);assert.equal((await response.json()).submissions[0].email,'test@example.com');
}finally{db.close();}});
test('origin, consent, and email validation reject invalid submissions',async()=>{const db=database();try{
  assert.equal((await submitForm(request(payload,'https://other.example'),db,'interest')).status,403);
  assert.equal((await submitForm(request({...payload,consent:false}),db,'interest')).status,400);
  assert.equal((await submitForm(request({...payload,email:'bad'}),db,'interest')).status,400);
}finally{db.close();}});
test('body limits, persistent rate limits, and honeypot work',async()=>{const db=database();try{
  assert.equal((await submitForm(request({...payload,message:'x'.repeat(20000)}),db,'interest')).status,413);
  assert.equal((await submitForm(request({...payload,website:'bot'}),db,'interest')).status,201);
  for(let i=0;i<7;i++)assert.equal((await submitForm(request(),db,'interest')).status,201);
  assert.equal((await submitForm(request(),db,'interest')).status,429);assert.equal((await db.prepare('select * from submissions').all()).results.length,7);
}finally{db.close();}});
test('contact saves Unicode and SQL text as literal data',async()=>{const db=database();try{
  const data={...payload,category:'General question',message:"Bonjour 日本語 '); drop table submissions;--"};
  assert.equal((await submitForm(request(data),db,'contact')).status,201);assert.equal((await db.prepare('select * from submissions').all()).results[0].message,data.message);
}finally{db.close();}});

export const securityHeaders = {
  'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY',
  'Referrer-Policy':'strict-origin-when-cross-origin',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};
export interface Statement {
  bind(...values:(string|number)[]):Statement;
  first<T>():Promise<T|null>;
  run():Promise<{meta:{last_row_id:number}}>;
  all<T>():Promise<{results:T[]}>;
}
export interface Database { prepare(sql:string):Statement }
export class FormError extends Error {
  status:number;
  constructor(status:number,message:string){super(message);this.status=status;}
}
function field(data:Record<string,unknown>,key:string,max:number,required=true){
  if(typeof data[key]!=='string')throw new FormError(400,`Enter a valid ${key}.`);
  const value=(data[key] as string).trim();
  if((required&&!value)||value.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value))throw new FormError(400,`${key} must be ${required?1:0}–${max} characters.`);
  return value;
}
function validate(raw:unknown,kind:string){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new FormError(400,'Enter valid form data.');
  const data=raw as Record<string,unknown>;
  if(data.consent!==true)throw new FormError(400,'Please agree to the submission privacy notice.');
  const name=field(data,'name',100),email=field(data,'email',254).toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new FormError(400,'Enter a valid email address.');
  const category=field(data,'category',50);
  const allowed=kind==='interest'?['General membership','Events','Volunteering','Partnerships']:['General question','Event inquiry','Community partnership'];
  if(!allowed.includes(category))throw new FormError(400,'Choose a valid category.');
  return {name,email,category,message:field(data,'message',2000,kind==='contact')};
}
function json(status:number,body:unknown,extra:Record<string,string>={}){return Response.json(body,{status,headers:{...securityHeaders,...extra}});}
async function readJson(request:Request){
  const maximum=16*1024;
  if(Number(request.headers.get('content-length'))>maximum)throw new FormError(413,'The submission is too large.');
  const reader=request.body?.getReader();if(!reader)throw new FormError(400,'The submission could not be read.');
  const parts:Uint8Array[]=[];let length=0;
  for(;;){const value=await reader.read();if(value.done)break;length+=value.value.byteLength;
    if(length>maximum){await reader.cancel();throw new FormError(413,'The submission is too large.');}parts.push(value.value);}
  const body=new Uint8Array(length);let offset=0;for(const part of parts){body.set(part,offset);offset+=part.length;}
  try{return JSON.parse(new TextDecoder().decode(body)) as unknown;}catch{throw new FormError(400,'The submission could not be read.');}
}
export async function submitForm(request:Request,db:Database,kind:string,origin=new URL(request.url).origin){
  try{
    if(!['interest','contact'].includes(kind))throw new FormError(404,'Page not found.');
    if(request.headers.get('origin')!==origin)throw new FormError(403,'Submit this form from the organization website.');
    if((request.headers.get('content-type')||'').split(';')[0].trim()!=='application/json')throw new FormError(415,'Use JSON form data.');
    const raw=await readJson(request);
    const identity=request.headers.get('oai-authenticated-user-id')||request.headers.get('cf-connecting-ip')||'unknown';
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(origin+':'+identity));
    const key=Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
    const window=Math.floor(Date.now()/3600000);
    await db.prepare('delete from submission_limits where "window" < ?').bind(window-24).run();
    const limit=await db.prepare('insert into submission_limits("key","window","count") values(?,?,1) on conflict("key") do update set "count"=case when "window"=excluded."window" then "count"+1 else 1 end,"window"=excluded."window" returning "count"').bind(key,window).first<{count:number}>();
    if(!limit||limit.count>8)return json(429,{error:'Too many submissions. Please try again in an hour.'},{'Retry-After':'3600'});
    if(raw&&typeof raw==='object'&&'website' in raw&&raw.website)return json(201,{message:'Submission received.'});
    const value=validate(raw,kind);
    const result=await db.prepare('insert into submissions(kind,name,email,category,message) values(?,?,?,?,?)').bind(kind,value.name,value.email,value.category,value.message).run();
    return json(201,{id:result.meta.last_row_id,message:'Saved for organizer review. This form does not send email.'});
  }catch(error){return json(error instanceof FormError?error.status:500,{error:error instanceof FormError?error.message:'The submission could not be saved. Please try again later.'});}
}
export async function exportSubmissions(request:Request,db:Database,token:string){
  const supplied=(request.headers.get('authorization')||'').replace(/^Bearer /,'');
  if(!token||token.length<32||supplied!==token)return json(401,{error:'Unauthorized.'});
  try{return json(200,{submissions:(await db.prepare('select * from submissions order by id desc limit 500').all()).results});}
  catch{return json(500,{error:'Submissions could not be loaded.'});}
}

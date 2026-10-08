const TEMPLATES=new Set(['blank','salah','ohtani']);
const MAX_BODY=85000;
const headers={'Cache-Control':'no-store','Content-Type':'application/json'};
function reply(res,status,obj){res.writeHead(status,headers);res.end(JSON.stringify(obj))}
function env(name){const v=process.env[name];if(!v)throw new Error('Server configuration missing: '+name);return v}
async function googleToken(){
 const params=new URLSearchParams({client_id:env('GOOGLE_CLIENT_ID'),client_secret:env('GOOGLE_CLIENT_SECRET'),refresh_token:env('GOOGLE_REFRESH_TOKEN'),grant_type:'refresh_token'});
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:params});
 const o=await r.json();if(!r.ok||!o.access_token)throw new Error('Google Drive authorization failed');
 return o.access_token;
}
async function drive(token,url,opts={}){
 const r=await fetch('https://www.googleapis.com/drive/v3/'+url,{...opts,headers:{Authorization:'Bearer '+token,...opts.headers}});
 if(!r.ok){const detail=(await r.text()).slice(0,500);throw new Error('Drive API error '+r.status+' '+detail)}
 return r.status===204?null:r.json();
}
async function driveFile(token,owner,template){
 const q=`trashed = false and appProperties has { key='mandalaOwner' and value='${owner}' } and appProperties has { key='mandalaTemplate' and value='${template}' }`;
 const params=new URLSearchParams({q,fields:'nextPageToken,files(id,name,appProperties)',page_size:'100'});
 const r=await drive(token,'files?'+params.toString());
 if(r.files?.length>1)throw new Error('Duplicate chart files found; contact administrator');
 return r.files?.[0]||null;
}
function validChart(o){
 return !!o && Array.isArray(o.grid)&&o.grid.length===9&&o.grid.every(row=>Array.isArray(row)&&row.length===9&&row.every(v=>typeof v==='string'&&v.length<=500))&&o.checks&&typeof o.checks==='object'&&typeof o.reflection==='string'&&o.reflection.length<=3000;
}
async function auth(req){
 const authorization=req.headers.authorization||'';
 if(!/^Bearer [A-Za-z0-9._~-]+$/.test(authorization))return null;
 const base=env('SUPABASE_URL').replace(/\/$/,'');
 const key=env('SUPABASE_ANON_KEY');
 const r=await fetch(base+'/auth/v1/user',{headers:{apikey:key,authorization}});
 if(!r.ok)return null;
 const user=await r.json();
 if(!/^[0-9a-f-]{36}$/i.test(user.id||'')||!user.email_confirmed_at)return null;
 // Only adult tester accounts issued through our sign-up flow.
 if(user.user_metadata?.age_group!=='adult')return null;
 return user;
}
async function bodyJSON(req){
 let size=0,body='';
 for await(const c of req){size+=c.length;if(size>MAX_BODY)throw Object.assign(new Error('Chart too large'),{status:413});body+=c}
 try{return JSON.parse(body)}catch{throw Object.assign(new Error('Invalid JSON'),{status:400})}
}
export default async function handler(req,res){
 try{
  if(!['GET','PUT','DELETE'].includes(req.method))return reply(res,405,{error:'Method not allowed'});
  const template=req.query?.template;
  if(typeof template!=='string'||!TEMPLATES.has(template))return reply(res,400,{error:'Invalid template'});
  const user=await auth(req);if(!user)return reply(res,401,{error:'Authenticated and verified adult account required'});
  const token=await googleToken();
  const file=await driveFile(token,user.id,template);
  if(req.method==='GET'){
   if(!file)return reply(res,200,{content:null});
   const r=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(file.id)+'?alt=media',{headers:{Authorization:'Bearer '+token}});
   if(!r.ok)throw new Error('Unable to load Drive chart');
   const doc=await r.json();return reply(res,200,{content:validChart(doc.content)?doc.content:null});
  }
  if(req.method==='DELETE'){
   if(file)await drive(token,'files/'+encodeURIComponent(file.id),{method:'DELETE'});
   return reply(res,200,{deleted:true});
  }
  const input=await bodyJSON(req);
  if(!validChart(input.content))return reply(res,400,{error:'Invalid chart content'});
  const payload=JSON.stringify({version:1,content:input.content});
  if(file){
   await drive(token,'files/'+encodeURIComponent(file.id)+'?uploadType=media',{method:'PATCH',headers:{'Content-Type':'application/json'},body:payload});
  }else{
   const boundary='mandala_boundary';
   const meta=JSON.stringify({name:'mandala-'+user.id+'-'+template+'.json',mimeType:'application/json',appProperties:{mandalaOwner:user.id,mandalaTemplate:template}});
   const multipart='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+meta+'\r\n--'+boundary+'\r\nContent-Type: application/json\r\n\r\n'+payload+'\r\n--'+boundary+'--';
   const r=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'multipart/related; boundary='+boundary},body:multipart});
   if(!r.ok)throw new Error('Unable to create Google Drive chart');
  }
  return reply(res,200,{saved:true});
 }catch(e){
  console.error('Mandala API error:',e.message);
  return reply(res,e.status||500,{error:e.status?e.message:'Unable to complete secure Google Drive operation'});
 }
}

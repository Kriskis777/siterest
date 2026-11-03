import {readFileSync,existsSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {strict as assert} from 'node:assert';
import vm from 'node:vm';
const manifest=JSON.parse(readFileSync('page-manifest.json','utf8'));
const pages=new Map(manifest.map(p=>[p.path,readFileSync(join('dist',p.path,'index.html'),'utf8')]));
let links=0;
for(const [path,html] of pages){
 assert.equal((html.match(/<h1[ >]/g)||[]).length,1,`${path}: one h1`);
 assert.match(html,/<html lang="ru">/);assert.match(html,/noindex,nofollow/);
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,`${path}: unique IDs`);
 for(const m of html.matchAll(/(?:href|src)="([^"]*)"/g)){
  const raw=m[1];assert.ok(raw,`${path}: empty link`);const u=new URL(raw,'https://local.test'+path);if(u.origin!=='https://local.test')continue;links++;
  const file=u.pathname.startsWith('/assets/')?join('dist',u.pathname):join('dist',u.pathname,'index.html');assert.ok(existsSync(file),`${path}: missing ${raw}`);
  if(u.hash){const target=readFileSync(file,'utf8');assert.ok(target.includes(`id="${decodeURIComponent(u.hash.slice(1))}"`),`${path}: broken anchor ${raw}`)}
 }
 assert.ok(!html.includes('mailto:')&&!html.includes('tel:'),'No invented live contacts');
 if(html.includes('brief-form')){assert.ok(html.includes('<fieldset disabled'),'form inert without JS');assert.ok(html.includes('type="submit" disabled'),'no accidental submission without JS')}
}
assert.ok(existsSync('dist/404.html'));assert.ok(readFileSync('dist/robots.txt','utf8').includes('Disallow: /'));
const script=readFileSync('dist/assets/app.js','utf8');new vm.Script(script);
assert.ok(!/localStorage|sessionStorage|sendBeacon|XMLHttpRequest/.test(script),'No storage or background submission');
class Element{
 constructor(){this.attrs={};this.dataset={};this.listeners={};this.innerHTML='';this.textContent='';this.value='';this.hidden=false;this.disabled=false;this.checked=false;this.focused=false;this.children=[];this.className='';this.classList={toggle:(n,v)=>{this.attrs['class:'+n]=v},add:n=>{this.attrs['class:'+n]=true}}}
 setAttribute(k,v){this.attrs[k]=String(v)}getAttribute(k){return this.attrs[k]??null}removeAttribute(k){delete this.attrs[k]}addEventListener(n,fn){(this.listeners[n]??=[]).push(fn)}querySelector(s){return this.selectors?.[s]??null}querySelectorAll(s){return this.lists?.[s]??[]}focus(){this.focused=true}append(){}remove(){}click(){return this.fire('click')}async fire(n,props={}){for(const fn of this.listeners[n]??[])await fn({preventDefault(){},...props})}}
function env({hasForm=true,hasFilters=false}={}){
 const make=()=>new Element();const contact=make(),name=make(),task=make(),details=make(),simulate=make(),error=make(),feedback=make(),submit=make(),fieldset=make(),form=make();submit.disabled=true;fieldset.disabled=true;form.dataset.context='Общая задача';task.value='Пока не знаю';
 form.selectors={'[name=contact]':contact,'[name=name]':name,'[name=task]':task,'[name=details]':details,'[name=simulate-error]':simulate,'#contact-error':error,'#form-feedback':feedback,'[type=submit]':submit,'fieldset':fieldset};
 const menu=make(),nav=make(),main=make(),title=make(),result=make(),copy=make(),download=make(),status=make(),filterStatus=make();menu.setAttribute('aria-expanded','false');nav.lists={'a':[]};
 const buttons=['all','leps','agro'].map(v=>{const e=make();e.dataset.filter=v;return e});const cards=['leps','agro'].map(v=>{const e=make();e.selectors={['.project-art.'+v]:make()};return e});
 const doc=make();doc.body=make();doc.title='Главная';doc.selectors={'.menu-toggle':menu,'#main-nav':nav,'.brief-form':hasForm?form:null,'main':main,'main h1':title,'#brief-result':result,'#copy-brief':copy,'#download-brief':download,'#copy-status':status,'#filter-status':filterStatus};doc.lists={'.project-filters .filter':hasFilters?buttons:[],'.projects-section .project-card':cards};doc.createElement=make;
 const requests=[],history=[],clipboard=[];let fail=false,hold;
 const mockPage={title:'Черновик обращения',querySelector:s=>s==='main'?{innerHTML:pages.get('/request-ready/')}:null};
 const context={document:doc,window:{addEventListener(){},scrollTo(){}},location:{reload(){}},history:{pushState:(state,_,url)=>history.push({state,url})},navigator:{clipboard:{writeText:async s=>clipboard.push(s)}},DOMParser:class{parseFromString(){return mockPage}},fetch:async(...args)=>{requests.push(args);if(fail)throw Error('network');if(hold)await hold;return{ok:true,text:async()=>pages.get('/request-ready/')}},URL,Blob,setTimeout,console};
 vm.runInNewContext(script,context);
 return{contact,name,task,details,simulate,error,feedback,submit,fieldset,form,menu,nav,doc,main,title,result,copy,download,status,buttons,cards,filterStatus,requests,history,clipboard,fail:()=>{fail=true},hold:p=>{hold=p}};
}
const e=env();assert.equal(e.submit.disabled,false);assert.equal(e.fieldset.disabled,false);
await e.form.fire('submit');assert.equal(e.requests.length,0);assert.equal(e.contact.getAttribute('aria-invalid'),'true');assert.equal(e.error.hidden,false);
e.contact.value='wrong';await e.form.fire('submit');assert.equal(e.requests.length,0);
e.contact.value='test@example.com';e.details.value='<img src=x onerror=alert(1)>';e.simulate.checked=true;await e.form.fire('submit');assert.equal(e.requests.length,0);assert.equal(e.contact.value,'test@example.com');assert.match(e.feedback.textContent,/сохранены/);
e.simulate.checked=false;await e.form.fire('submit');assert.equal(e.requests.length,1);assert.equal(e.requests[0][0],'/request-ready/');assert.equal(e.requests[0][1].body,undefined);assert.equal(e.history.at(-1).url,'/request-ready/');assert.ok(e.result.innerHTML.includes('&lt;img'));assert.ok(!e.result.innerHTML.includes('<img'));assert.equal(e.title.focused,true);await e.copy.fire('click');assert.match(e.clipboard[0],/Не отправлено/);
const bad=env();bad.contact.value='+7 (999) 123-45-67';bad.fail();await bad.form.fire('submit');assert.equal(bad.submit.disabled,false);assert.equal(bad.contact.value,'+7 (999) 123-45-67');assert.match(bad.feedback.textContent,/остаются/);
const double=env();double.contact.value='@test_user';let release;double.hold(new Promise(r=>{release=r}));const pending=double.form.fire('submit');await Promise.resolve();await double.form.fire('submit');release();await pending;assert.equal(double.requests.length,1,'No duplicate request');
const filter=env({hasForm:false,hasFilters:true});await filter.buttons[1].fire('click');assert.equal(filter.cards[0].hidden,false);assert.equal(filter.cards[1].hidden,true);assert.equal(filter.buttons[1].getAttribute('aria-pressed'),'true');await filter.buttons[0].fire('click');assert.equal(filter.cards.every(c=>!c.hidden),true);
await filter.menu.fire('click');assert.equal(filter.menu.getAttribute('aria-expanded'),'true');await filter.doc.fire('keydown',{key:'Escape'});assert.equal(filter.menu.getAttribute('aria-expanded'),'false');assert.equal(filter.menu.focused,true);
const report={routes:pages.size,internalLinksAndAssets:links,staticChecks:'passed',interactionChecks:['invalid contact','simulated failure retains input','no fields sent over fetch','success route and focus','XSS escaped','copy draft','network failure retains input and re-enables form','duplicate prevention','project filters','mobile menu and Escape'],browserQA:'not performed: Work browser disabled, Mac locked'};
writeFileSync('qa-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));

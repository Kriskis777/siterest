import {cpSync,rmSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const repoName=process.env.GITHUB_REPOSITORY?.split('/')[1]||'siterest';
const base='/'+repoName;
const origin='https://'+(process.env.GITHUB_REPOSITORY_OWNER||'Kriskis777').toLowerCase()+'.github.io';
rmSync('docs',{recursive:true,force:true});cpSync('dist','docs',{recursive:true});
const files=[];function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){const path=join(dir,e.name);if(e.isDirectory())walk(path);else files.push(path)}}walk('docs');
for(const p of files){if(p.endsWith('.html')){let s=readFileSync(p,'utf8');s=s.replace(/(href|src)="\/(?!\/)/g,(_,attr)=>`${attr}="${base}/`);s=s.replace(/https:\/\/siterest-ux-prototype-20261103\.kristinadesign\.chatgpt\.site/g,origin+base);writeFileSync(p,s)}}
const jsPath='docs/assets/app.js';let js=readFileSync(jsPath,'utf8');js=js.replaceAll("'/request-ready/'",JSON.stringify(base+'/request-ready/'));writeFileSync(jsPath,js);
writeFileSync('docs/.nojekyll','');writeFileSync('docs/robots.txt','User-agent: *\nDisallow: /\n');
writeFileSync('pages-config.json',JSON.stringify({repo:repoName,base,url:origin+base+'/',source:{branch:'main',path:'/docs'}},null,2));
console.log('GitHub Pages files ready for '+base+'/');

const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'../source'),files=fs.readdirSync(root).filter(p=>p.endsWith('.js'));
for(const p of files){const source=fs.readFileSync(path.join(root,p),'utf8').replace('{{CONTENT_JSON}}',fs.readFileSync(path.join(root,'content.json'),'utf8')).replace('{{TYPE_TEAMS_JSON}}',fs.readFileSync(path.join(root,'type-teams.json'),'utf8')).replace('{{TYPE_LOGOS_JSON}}',fs.readFileSync(path.join(root,'type-logos.json'),'utf8'));new vm.Script(source,{filename:p});}
console.log(JSON.stringify({status:'pass',scripts:files.length}));

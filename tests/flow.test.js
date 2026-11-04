const {JSDOM,VirtualConsole}=require("jsdom");
const fs=require("fs");
const html=fs.readFileSync(process.argv[2]||"www/index.html","utf8");
const errs=[];
const vc=new VirtualConsole();
vc.on("jsdomError",e=>errs.push("JSDOM: "+(e.detail&&e.detail.stack||e.message)));
vc.on("error",(...a)=>errs.push("console.error: "+a.join(" ")));
const dom=new JSDOM(html.replace(/<link[^>]*fonts.googleapis[^>]*>/g,""),{runScripts:"dangerously",pretendToBeVisual:true,virtualConsole:vc,url:"http://localhost/",
 beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{},set:()=>true});}});
const w=dom.window;
w.addEventListener("error",e=>errs.push("window error: "+e.message));
setTimeout(()=>{
 const res=w.eval(`(function(){
  const log=[];const T0=T;
  const step=(n,f)=>{try{f();log.push("ok "+n)}catch(e){log.push("FALLO "+n+": "+e.stack.split("\\n").slice(0,3).join(" | "))}};
  step("welcome",()=>{document.body.innerHTML.length});
  step("hi/sn",()=>{S.name="";hi();const i=$("#nmI");i.value="Sergio";sn(false)});
  for(const lang of ["es","en","nl"])for(const dif of [0,1,2])for(const tr of Object.keys(T)){
   step("play "+lang+dif+tr,()=>{S.lang=lang;S.dif=dif;pick(tr);
    // jugar niveles 0,1 y boss, ganando
    const idxs=[0,1,T[tr].L.findIndex(l=>l[2])];
    for(const i of idxs){ if(i<0)continue; go(i);let g=0;
      while(L&&g++<60){ if(!$("#cb"))break;
        const it=L.qs[0];
        if(typeof it=="string"){L.w.forEach(x=>{const k=L.bank.findIndex((b,j)=>b[0]==x&&!ans.includes(j));ad(k)})}
        else{const k=L.o.findIndex(o=>o==it[1]);pk(k)}
        check();nx();
      }
      if(!document.querySelector(".fin"))throw new Error("no llego a fin nivel "+i);
    }
    // jugar fallando
    go(0);let g=0;while(g++<40&&$("#cb")){const it=L.qs[0];if(typeof it=="string"){ad(0)}else{pk(L.o.findIndex(o=>o!=it[1]))}if($("#cb").disabled){ L.w&&L.w.forEach((x,j)=>ad(j))}check();nx()}
    home();tab="s";home();tab="p";home();tab="r";home();
   });
  }
  step("especiales",()=>{for(let i=0;i<SP.length;i++){goS(i);let g=0;while(L&&g++<60&&$("#cb")){const it=L.qs[0];if(typeof it=="string"){L.w.forEach(x=>{const k=L.bank.findIndex((b,j)=>b[0]==x&&!ans.includes(j));ad(k)})}else pk(L.o.findIndex(o=>o==it[1]));check();nx()}}});
  step("retos",()=>{for(const k of ["d","w"]){for(const tr of Object.keys(T)){S.track=tr;S.ch={};chGo(k);let g=0;while(L&&g++<10&&$("#cb")){const it=L.qs[0];if(typeof it=="string"){L.w.forEach(x=>{const k2=L.bank.findIndex((b,j)=>b[0]==x&&!ans.includes(j));ad(k2)})}else pk(L.o.findIndex(o=>o==it[1]));check();nx()}}}});
  step("perfil rename",()=>{tab="p";home();const i=$("#nmP");if(i){i.value="Ana";rn()}});
  step("cleanS corrupto",()=>{const r=cleanS({xp:"x",done:null,streak:-5,hist:"a",lang:"zz",track:"nope"});});
  return {log,SP:SP.length,ls:localStorage.getItem("bitty").length};
 })()`);
 console.log(res.log.filter(x=>!x.startsWith("ok")).join("\n")||"todos los pasos OK ("+res.log.length+")");
 console.log("SP:",res.SP,"localStorage bytes:",res.ls);
 console.log("ERRORES:",errs.length);errs.slice(0,20).forEach(e=>console.log(e));
 process.exit(res.log.some(x=>!x.startsWith("ok"))||errs.length?1:0);
},1500);

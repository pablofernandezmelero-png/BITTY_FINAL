const {JSDOM,VirtualConsole}=require("jsdom");
const fs=require("fs");
const file=process.argv[2]||"www/index.html";
const html=fs.readFileSync(file,"utf8");
const errs=[];
const vc=new VirtualConsole();
vc.on("jsdomError",e=>errs.push("JSDOM: "+(e.detail&&e.detail.stack||e.message)));
vc.on("error",(...a)=>errs.push("console.error: "+a.join(" ")));
const dom=new JSDOM(html.replace(/<link[^>]*fonts.googleapis[^>]*>/g,""),{runScripts:"dangerously",pretendToBeVisual:true,virtualConsole:vc,url:"http://localhost/",
 beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{},set:()=>true});w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){}}));}});
const w=dom.window;
w.addEventListener("error",e=>errs.push("window error: "+e.message));
setTimeout(()=>{
 const res=w.eval(`(function(){
  const out=[];const bad=(m)=>{if(out.length<80)out.push(m)};
  S.name="Test";let cnt=0;
  for(const lang of ["es","en","nl"]){S.lang=lang;
   for(const dif of [0,1,2]){S.dif=dif;
    for(const k of Object.keys(T)){S.track=k;
     T[k].L.forEach((l,i)=>{
      try{BOSS=!!l[2];const f=l[1];const qs=f();
       if(!qs.length)bad("vacio "+k+" L"+i);
       for(const it of qs){cnt++;
        if(typeof it=="string"){const p=it.split("\\u00a7");if(p.length!=2||p[1].split("|").length<2)bad("orden malo "+k+i+": "+it);}
        else{if(!Array.isArray(it)||it.length<3){bad("item malo "+k+i);continue}
          const s=it.map(String);if(s.some(x=>x==""||x.includes("[object")||x.includes("undefined undefined")||((k!="js")&&(x=="undefined"||x=="NaN"||/\bNaN\b/.test(x)))))bad(lang+" "+k+" L"+i+" undef/NaN: "+JSON.stringify(it));
          if(new Set(s.slice(1)).size!=s.length-1)bad(lang+" "+k+" L"+i+" opciones duplicadas: "+JSON.stringify(it));}
       }
      }catch(e){bad("EXC "+lang+" d"+dif+" "+k+" L"+i+": "+e.message)}
     });
    }}}
  return {cnt,out,langs:Object.keys(T).map(k=>k+":"+T[k].L.length)};
 })()`);
 console.log(JSON.stringify(res,null,1));
 console.log("ERRORES CARGA:",errs.length);errs.slice(0,30).forEach(e=>console.log(e));
 process.exit(res.out.length||errs.length?1:0);
},1500);


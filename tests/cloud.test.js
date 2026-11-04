const {JSDOM,VirtualConsole}=require("jsdom");
const fs=require("fs");
const html=fs.readFileSync(process.argv[2]||"www/index.html","utf8").replace(/const SB={[^}]*};/,"const SB={url:\"https://abc.supabase.co\",key:\"k\".repeat(30)};");
const errs=[];const vc=new VirtualConsole();
vc.on("jsdomError",e=>errs.push("JSDOM: "+(e.detail&&e.detail.stack||e.message)));
vc.on("error",(...a)=>errs.push("console.error: "+a.join(" ")));
const db={rows:{},users:{"a@b.com":{id:"u1",pw:"password1"}}};
const dom=new JSDOM(html.replace(/<link[^>]*fonts.googleapis[^>]*>/g,""),{runScripts:"dangerously",pretendToBeVisual:true,virtualConsole:vc,url:"http://localhost/",
 beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{},set:()=>true});
  w.fetch=async(url,o={})=>{const u=new URL(url),b=o.body?JSON.parse(o.body):null;
   const R=(s,j)=>({ok:s<300,status:s,json:async()=>j});
   if(u.pathname=="/auth/v1/token"&&u.searchParams.get("grant_type")=="password"){const x=db.users[b.email];return x&&x.pw==b.password?R(200,{access_token:"T",refresh_token:"R",expires_in:3600,user:{id:x.id,email:b.email}}):R(400,{error_description:"Invalid login credentials"})}
   if(u.pathname=="/auth/v1/signup")return R(200,{id:"u2",email:b.email});
   if(u.pathname=="/auth/v1/otp")return R(200,{});
   if(u.pathname=="/auth/v1/logout")return R(204,null);
   if(u.pathname=="/auth/v1/recover"){db.rec=b.email;return R(200,{})}
   if(u.pathname=="/auth/v1/user"&&o.method=="PUT"){db.newpw=b.password;return R(200,{})}
   if(u.pathname=="/rest/v1/stats"||u.pathname=="/rest/v1/profiles"){db[u.pathname.split("/").pop()]=b;return R(201,null)}
   if(u.pathname=="/rest/v1/progress"){if(o.method=="POST"){db.rows[b.user_id]=b;return R(201,null)}
     const id=u.searchParams.get("user_id").replace("eq.","");return R(200,db.rows[id]?[{data:db.rows[id].data}]:[])}
   return R(404,{message:"x"})}}});
const w=dom.window;w.addEventListener("error",e=>errs.push("window error: "+e.message));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const out=[];const ok=(n,c)=>out.push((c?"ok  ":"FALLO ")+n);
const T=()=>w.document.body.textContent;
const ev=s=>w.eval(s);
const setf=(e,p)=>ev(`document.querySelector("#cE").value=${JSON.stringify(e)};${p!=null?`document.querySelector("#cP").value=${JSON.stringify(p)};`:""}`);
(async()=>{await sleep(800);
 ok("arranca con pantalla de bienvenida",/Bienvenido a Bitty/.test(T())&&!!w.document.querySelector("#cE"));
 ok("hay boton invitado",/invitado/i.test(T()));
 setf("x","");ev(`cgo("i")`);await sleep(50);ok("email invalido rechazado",/email válido/.test(T())&&/Bienvenido/.test(T()));
 ev(`amd("s")`);ok("pestaña crear cuenta",/Crear mi cuenta/.test(T()));
 ev(`amd("i")`);setf("a@b.com","incorrecta1");ev(`cgo("i")`);await sleep(100);ok("login erroneo muestra error en bienvenida",/Invalid login/.test(T())&&!!w.document.querySelector("#cE"));
 ev(`sl("en")`);ok("cambiar idioma mantiene bienvenida",/Welcome to Bitty/.test(T()));ev(`sl("es")`);
 ev(`S.name="Ana";S.xp=100;S.done={"g:1":3};save()`);
 db.rows.u1={user_id:"u1",data:{v:2,name:"Otro",xp:300,done:{"g:1":1,"py:1":5},sp:["1:1"],streak:4,last:"2026-11-04",hist:["h1"],hd:{"g:1":["h1"]},lang:"es"}};
 setf("a@b.com","password1");ev(`cgo("i")`);await sleep(250);
 const s=JSON.parse(ev(`JSON.stringify(S)`));
 ok("tras login sale de la bienvenida",!w.document.querySelector("#cE")&&ev(`AS`)===0);
 ok("fusion xp=max",s.xp==300);ok("fusion done",s.done["g:1"]==3&&s.done["py:1"]==5);ok("nombre local conservado",s.name=="Ana");ok("subio a la nube",db.rows.u1.data.xp==300);
 ev(`S.xp=450;save()`);await sleep(3300);ok("sube tras 3s",db.rows.u1.data.xp==450);
 ok("stats subidas (xp, racha, niveles)",db.stats&&db.stats.xp==450&&db.stats.streak==4&&db.stats.levels_done==8&&db.stats.last_day=="2026-11-04");
 ok("perfil subido (nombre)",db.profiles&&db.profiles.id=="u1"&&db.profiles.display_name=="Ana");
 ev(`tab="p";home()`);ok("perfil muestra sesion",/a@b\.com/.test(T()));
 await ev(`cout()`);await sleep(100);ok("logout vuelve a la bienvenida",!!w.document.querySelector("#cE")&&/Bienvenido/.test(T())&&ev(`AU`)===null);
 db.users["c@d.com"]={id:"u3",pw:"password3"};db.rows.u3={user_id:"u3",data:{v:2,name:"Otra",xp:5,done:{},sp:[],hist:[],hd:{},lang:"es"}};
 setf("c@d.com","password3");ev(`cgo("i")`);await sleep(250);
 ok("otra cuenta NO hereda progreso ajeno",ev(`S.xp`)==5&&ev(`S.name`)=="Otra"&&db.rows.u3.data.xp==5&&db.rows.u1.data.xp==450);
 await ev(`cout()`);await sleep(100);
 ev(`gst()`);await sleep(50);ok("invitado entra a la app",!w.document.querySelector("#cE")&&w.localStorage.getItem("bitty_guest")=="1");
 ev(`S.name="Inv";save();tab="p";home()`);ok("invitado ve tarjeta de cuenta en perfil",/Cuenta y nube/.test(T()));
 setf("n@b.com","password1");ev(`cgo("s")`);await sleep(150);ok("signup pide confirmar email",/Revisa tu email/.test(T()));
 setf("n@b.com");ev(`cgo("m")`);await sleep(100);ok("magic link",/mágico/.test(T()));
 ev(`AS=1;wl()`);ok("enlace olvidé contraseña visible",/Olvidaste tu contraseña/.test(T()));
 setf("","");ev(`bforgot()`);await sleep(50);ok("recuperar sin email pide email",/Escribe tu email/.test(T())&&!db.rec);
 setf("a@b.com","");ev(`bforgot()`);await sleep(100);ok("recuperar envía petición",db.rec=="a@b.com"&&/enlace para restablecer/.test(T()));
 setf("a@b.com","password1");ev(`cgo("i")`);await sleep(250);
 ev(`BRC=1;bwnp()`);ok("pantalla nueva contraseña",/Nueva contraseña/.test(T()));
 ev(`document.querySelector("#cN1").value="corta";document.querySelector("#cN2").value="corta";bnpw()`);await sleep(50);ok("pass nueva corta rechazada",/al menos 8/.test(T())&&!db.newpw);
 ev(`document.querySelector("#cN1").value="nuevapass1";document.querySelector("#cN2").value="distinta22";bnpw()`);await sleep(50);ok("no coinciden rechazada",/no coinciden/.test(T())&&!db.newpw);
 ev(`document.querySelector("#cN1").value="nuevapass1";document.querySelector("#cN2").value="nuevapass1";bnpw()`);await sleep(300);ok("cambia contraseña y vuelve a la app",db.newpw=="nuevapass1"&&!w.document.querySelector("#cN1"));
 ev("cEm='\"><img src=x onerror=alert(1)>';AS=1;wl()");ok("email escapado en bienvenida",!w.document.querySelector("#cE img")&&w.document.querySelector("#cE").value.includes("<img"));
 console.log(out.join("\n"));console.log("ERRORES JS:",errs.length);errs.forEach(e=>console.log(e));process.exit(out.some(x=>x.startsWith("FALLO"))||errs.length?1:0)})();

const {JSDOM,VirtualConsole}=require("jsdom");
const fs=require("fs");
const html=fs.readFileSync(process.argv[2]||"www/index.html","utf8").replace(/const SB={[^}]*};/,"const SB={url:\"https://abc.supabase.co\",key:\"k\".repeat(30)};");
const crypto=require("crypto");
const b32=s=>{const A="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";let bits="";for(const c of s)bits+=A.indexOf(c).toString(2).padStart(5,"0");const o=[];for(let i=0;i+8<=bits.length;i+=8)o.push(parseInt(bits.slice(i,i+8),2));return Buffer.from(o)};
const totp=(sec,t=Date.now(),d=6)=>{const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(Math.floor(t/30000)));const h=crypto.createHmac("sha1",b32(sec)).update(b).digest(),o=h[19]&15;return String((((h[o]&0x7f)<<24|h[o+1]<<16|h[o+2]<<8|h[o+3])%10**d)).padStart(d,"0")};
const jwt=aal=>"h."+Buffer.from(JSON.stringify({aal})).toString("base64url")+".s";
const errs=[];const vc=new VirtualConsole();
vc.on("jsdomError",e=>errs.push("JSDOM: "+(e.detail&&e.detail.stack||e.message)));
vc.on("error",(...a)=>errs.push("console.error: "+a.join(" ")));
const db={rows:{},st:{},cur:"",fac:{},sec:{},chal:{},nf:0,users:{"a@b.com":{id:"u1",pw:"password1"},"m@f.com":{id:"u9",pw:"password9"}}};
const dom=new JSDOM(html.replace(/<link[^>]*fonts.googleapis[^>]*>/g,""),{runScripts:"dangerously",pretendToBeVisual:true,virtualConsole:vc,url:"http://localhost/",
 beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{},set:()=>true});
  w.fetch=async(url,o={})=>{const u=new URL(url),b=o.body?JSON.parse(o.body):null;
   const R=(s,j)=>({ok:s<300,status:s,json:async()=>j});
   if(u.pathname=="/auth/v1/token"&&u.searchParams.get("grant_type")=="password"){const x=db.users[b.email];if(x&&x.pw==b.password)db.cur=x.id;return x&&x.pw==b.password?R(200,{access_token:(db.fac[x.id]||[]).some(f=>f.status=="verified")?jwt("aal1"):"T",refresh_token:"R",expires_in:3600,user:{id:x.id,email:b.email,factors:db.fac[x.id]||[]}}):R(400,{error_description:"Invalid login credentials"})}
   if(u.pathname=="/auth/v1/user"&&(o.method||"GET")=="GET")return R(200,{id:db.cur,email:"x@y.z",factors:db.fac[db.cur]||[]});
   if(u.pathname=="/auth/v1/factors"&&o.method=="POST"){const id="00000000-0000-4000-8000-"+String(++db.nf).padStart(12,"0");db.sec[id]="JBSWY3DPEHPK3PXP";db.enr=b;
     (db.fac[db.cur]=db.fac[db.cur]||[]).push({id,factor_type:"totp",status:"unverified",friendly_name:b.friendly_name});
     return R(200,{id,type:"totp",totp:{qr_code:"data:image/svg+xml;utf-8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'/>",secret:db.sec[id],uri:"otpauth://totp/Bitty:x?secret="+db.sec[id]+"&issuer=Bitty"}})}
   {const m=u.pathname.match(/^\/auth\/v1\/factors\/([0-9a-f-]{36})(\/challenge|\/verify)?$/);if(m){const id=m[1],f=(db.fac[db.cur]||[]).find(x=>x.id==id);if(!f)return R(404,{message:"factor not found"});
     if(m[2]=="/challenge"){db.chal["c"+id]=id;return R(200,{id:"c"+id})}
     if(m[2]=="/verify"){if(db.chal[b.challenge_id]!=id||b.code!=totp(db.sec[id]))return R(400,{message:"Invalid TOTP code entered"});f.status="verified";db.aal2=(db.aal2||0)+1;return R(200,{access_token:jwt("aal2"),refresh_token:"R2",expires_in:3600,user:{id:db.cur,email:"x@y.z"}})}
     if(o.method=="DELETE"){db.fac[db.cur]=db.fac[db.cur].filter(x=>x.id!=id);return R(200,{id})}}}
   if(u.pathname=="/rest/v1/rpc/delete_my_account"){db.del=(db.del||0)+1;if(db.delFail)return R(400,{message:"mfa_required"});db.deleted=db.cur;return R(200,null)}
   if(u.pathname=="/auth/v1/signup")return R(200,{id:"u2",email:b.email});
   if(u.pathname=="/auth/v1/otp"){db.otpRedir=u.searchParams.get("redirect_to");return R(200,{})}
   if(u.pathname=="/auth/v1/logout")return R(204,null);
   if(u.pathname=="/auth/v1/recover"){db.rec=b.email;db.redir=u.searchParams.get("redirect_to");return R(200,{})}
   if(u.pathname=="/auth/v1/user"&&o.method=="PUT"){db.newpw=b.password;return R(200,{})}
   if(u.pathname=="/rest/v1/profiles"){db.profiles=b;return R(201,null)}
   if(u.pathname=="/rest/v1/stats"){if(o.method=="POST"){db.statsWrites=(db.statsWrites||0)+1;return R(403,{message:"permission denied for table stats"})}
     const id=u.searchParams.get("user_id").replace("eq.","");return R(200,db.st[id]?[{xp:db.st[id].xp}]:[])}
   if(u.pathname=="/rest/v1/rpc/import_legacy_stats"){db.imp=(db.imp||[]).concat([b]);if(!db.st[db.cur])db.st[db.cur]={xp:Math.min(b.p_xp,20000)};return R(200,{})}
   if(u.pathname=="/rest/v1/rpc/award_xp"){db.aw=(db.aw||[]).concat([b]);const s=db.st[db.cur]||(db.st[db.cur]={xp:0});db.seen=db.seen||{};
     if(db.seen[b.p_event_id])return R(200,{awarded:0,duplicate:true,xp:s.xp});if(db.reject)return R(400,{message:"invalid_reward"});if(db.rejKind&&b.p_kind==db.rejKind)return R(400,{message:db.rejKind+"_cap"});if(db.rate){db.rate=0;return R(400,{message:"rate_limited"})}
     db.seen[b.p_event_id]=1;s.xp+=b.p_xp;return R(200,{awarded:b.p_xp,duplicate:false,xp:s.xp,streak:1})}
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
 ok("el cliente ya NO escribe en stats",!db.statsWrites);
 ok("cuenta sin stats: importa el progreso local una sola vez",db.imp&&db.imp.length==1&&db.imp[0].p_xp==300&&db.imp[0].p_streak==4&&db.imp[0].p_levels==8&&db.imp[0].p_last=="2026-11-04");
 ok("XP local = XP del servidor tras sincronizar",db.st.u1.xp==300);
 // evento de XP: se envía a award_xp, y el servidor manda
 ev(`S.track="g";S.xp+=10;xqAdd({lv:2,boss:false},true,10)`);await sleep(3400);
 const aw=(db.aw||[])[0];
 ok("evento de nivel enviado a award_xp con tipo/ref/xp/día",aw&&aw.p_kind=="level"&&aw.p_ref=="lv:g:1:2"&&aw.p_xp==10&&/^\d{4}-\d{2}-\d{2}$/.test(aw.p_day)&&/^[0-9a-f-]{36}$/.test(aw.p_event_id));
 ok("la cola queda vacía y S.xp = servidor",JSON.parse(w.localStorage.getItem("bitty_xq")||"[]").length==0&&ev(`S.xp`)==310&&db.st.u1.xp==310);
 ev(`S.xp=450;save()`);
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
 ok("los enlaces del correo apuntan a la web publicada (no a localhost)",db.redir=="https://pablofernandezmelero-png.github.io/BITTY_FINAL/"&&db.otpRedir=="https://pablofernandezmelero-png.github.io/BITTY_FINAL/");
 setf("a@b.com","password1");ev(`cgo("i")`);await sleep(250);
 ev(`BRC=1;bwnp()`);ok("pantalla nueva contraseña",/Nueva contraseña/.test(T()));
 ev(`document.querySelector("#cN1").value="corta";document.querySelector("#cN2").value="corta";bnpw()`);await sleep(50);ok("pass nueva corta rechazada",/al menos 8/.test(T())&&!db.newpw);
 ev(`document.querySelector("#cN1").value="nuevapass1";document.querySelector("#cN2").value="distinta22";bnpw()`);await sleep(50);ok("no coinciden rechazada",/no coinciden/.test(T())&&!db.newpw);
 ev(`document.querySelector("#cN1").value="nuevapass1";document.querySelector("#cN2").value="nuevapass1";bnpw()`);await sleep(300);ok("cambia contraseña y vuelve a la app",db.newpw=="nuevapass1"&&!w.document.querySelector("#cN1"));
 ev("cEm='\"><img src=x onerror=alert(1)>';AS=1;wl()");ok("email escapado en bienvenida",!w.document.querySelector("#cE img")&&w.document.querySelector("#cE").value.includes("<img"));
 // ===== 2FA (simulación de GoTrue-MFA con TOTP real) =====
 ok("TOTP cumple el vector de prueba RFC 6238",totp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",59000,8)=="94287082");
 w.confirm=()=>true;
 await ev(`cout()`);await sleep(100);
 // a) cuenta SIN 2FA: entra directo
 setf("a@b.com","password1");ev(`cgo("i")`);await sleep(300);
 ok("cuenta sin 2FA entra sin pedir código",!w.document.querySelector("#cM")&&ev(`AU`)&&ev(`AU.id`)=="u1");
 ev(`tab="p";home()`);await sleep(300);
 ok("perfil ofrece activar 2FA",/Activar 2FA/.test(T()));
 ev(`mfaEnroll()`);await sleep(300);
 ok("inscripción muestra QR, clave y campo de código",!!w.document.querySelector("img[alt=QR]")&&/JBSWY3DPEHPK3PXP/.test(T())&&!!w.document.querySelector("#cM")&&db.enr&&db.enr.factor_type=="totp"&&db.enr.issuer=="Bitty");
 ev(`document.querySelector("#cM").value="000000";mfaEnrollVerify()`);await sleep(200);
 ok("código erróneo en la activación se rechaza y sigue sin activar",/incorrecto/.test(T())&&!(db.fac.u1||[]).some(f=>f.status=="verified"));
 ev(`document.querySelector("#cM").value=${JSON.stringify(totp("JBSWY3DPEHPK3PXP"))};mfaEnrollVerify()`);await sleep(400);
 ok("código correcto activa el factor y la sesión pasa a AAL2",(db.fac.u1||[]).some(f=>f.status=="verified")&&ev(`jaal(AU.a)`)=="aal2"&&/Activado|2FA activado/.test(T()));
 ev(`tab="p";home()`);await sleep(200);
 ok("perfil lista el dispositivo y permite añadir otro",/Quitar/.test(T())&&/otro dispositivo/.test(T()));
 // b) login con 2FA activo
 await ev(`cout()`);await sleep(100);
 setf("a@b.com","password1");ev(`cgo("i")`);await sleep(300);
 ok("con 2FA activo, la contraseña sola NO inicia sesión (pide código)",!!w.document.querySelector("#cM")&&ev(`AU`)===null&&/dos pasos/.test(T()));
 ev(`document.querySelector("#cM").value="12";mfaGo()`);await sleep(50);
 ok("código incompleto rechazado",/6 dígitos/.test(T())&&ev(`AU`)===null);
 ev(`document.querySelector("#cM").value="000000";mfaGo()`);await sleep(200);
 ok("código erróneo rechazado, sigue sin sesión",/incorrecto/.test(T())&&ev(`AU`)===null);
 ev(`document.querySelector("#cM").value=${JSON.stringify(totp("JBSWY3DPEHPK3PXP"))};mfaGo()`);await sleep(500);
 ok("código correcto: sesión AAL2 y vuelta a la app",ev(`AU`)!==null&&ev(`jaal(AU.a)`)=="aal2"&&!w.document.querySelector("#cM")&&ev(`AS`)===0);
 await ev(`cout()`);await sleep(100);
 setf("a@b.com","password1");ev(`cgo("i")`);await sleep(300);ev(`mfaCancel()`);
 ok("cancelar el 2FA vuelve al login sin sesión",ev(`AU`)===null&&!!w.document.querySelector("#cE"));
 // c) desactivar
 setf("a@b.com","password1");ev(`cgo("i")`);await sleep(300);
 ev(`document.querySelector("#cM").value=${JSON.stringify(totp("JBSWY3DPEHPK3PXP"))};mfaGo()`);await sleep(500);
 ev(`tab="p";home()`);await sleep(300);
 ev(`mfaRemove(${JSON.stringify((db.fac.u1||[]).find(f=>f.status=="verified").id)})`);await sleep(400);
 ok("quitar el factor lo elimina",!(db.fac.u1||[]).some(f=>f.status=="verified"));
 await ev(`cout()`);await sleep(100);
 setf("a@b.com","password1");ev(`cgo("i")`);await sleep(300);
 ok("sin factor vuelve a entrar solo con contraseña",!w.document.querySelector("#cM")&&ev(`AU`)!==null);
 // ===== límite de tamaño de progress (2 MB en el servidor) =====
 ev(`S.hist=Array.from({length:40000},(_,i)=>"pregunta de relleno número "+i+" "+"x".repeat(60));HSs.clear();S.hist.forEach(k=>HSs.add(k));HIm=null;S.hd={"g:1":S.hist.slice()}`);
 const big=JSON.stringify(JSON.parse(ev(`JSON.stringify(S)`))).length;
 const pushed=await ev(`cpush()`);
 const size=JSON.stringify(db.rows.u1.data).length;
 ok("progreso enorme ("+Math.round(big/1e6*10)/10+" MB): la copia que se sube cabe en 2 MB",big>2e6&&pushed===true&&size<2e6&&size>1000);
 ok("lo local no se recorta, solo la copia subida",ev(`S.hist.length`)==40000&&db.rows.u1.data.hist.length<40000&&db.rows.u1.data.hist.length>=500);
 // ===== un rechazo definitivo (tope de 24 h) no bloquea el resto de la cola =====
 await ev(`cout()`);await sleep(100);setf("a@b.com","password1");ev(`cgo("i")`);await sleep(300);
 db.rejKind="replay";db.aw=[];const day=ev(`S.last`)||new Date().toISOString().slice(0,10);
 w.localStorage.setItem("bitty_xq",JSON.stringify([{id:"11111111-1111-4111-8111-111111111111",kind:"replay",ref:"re:11111111-1111-4111-8111-111111111111",xp:5,day},{id:"22222222-2222-4222-8222-222222222222",kind:"level",ref:"lv:g:0:3",xp:10,day}]));
 await ev(`xflush(null)`);await sleep(100);
 ok("un evento rechazado por tope (replay_cap) se descarta y el siguiente SÍ se envía",db.aw.length==2&&db.aw[1].p_kind=="level"&&JSON.parse(w.localStorage.getItem("bitty_xq")||"[]").length==0);
 db.rejKind=null;
 // ===== eliminar cuenta =====
 await ev(`cout()`);await sleep(100);setf("a@b.com","password1");ev(`cgo("i")`);await sleep(300);
 ev(`tab="p";home()`);await sleep(200);
 ok("el perfil ofrece eliminar la cuenta",/Eliminar mi cuenta/.test(T()));
 w.confirm=()=>false;await ev(`cdel()`);ok("si no confirma, no se elimina nada",!db.del&&ev(`AU`)!==null);
 w.confirm=()=>true;w.prompt=()=>"no";await ev(`cdel()`);ok("si escribe otra palabra, no se elimina",!db.del&&ev(`AU`)!==null);
 w.prompt=()=>"eliminar";db.delFail=1;await ev(`cdel()`);await sleep(100);ok("si el servidor lo rechaza, se avisa y la sesión sigue",db.del==1&&ev(`AU`)!==null&&/No se pudo eliminar/.test(T()));
 db.delFail=0;ev(`S.xp=123;save()`);await ev(`cdel()`);await sleep(200);
 ok("confirmando: llama al servidor, cierra sesión y vuelve al login",db.del==2&&db.deleted=="u1"&&ev(`AU`)===null&&!!w.document.querySelector("#cE")&&/Cuenta eliminada/.test(T()));
 ok("el progreso local no se borra",ev(`S.xp`)==123);
 console.log(out.join("\n"));console.log("ERRORES JS:",errs.length);errs.forEach(e=>console.log(e));process.exit(out.some(x=>x.startsWith("FALLO"))||errs.length?1:0)})();

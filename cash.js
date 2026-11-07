import { auth, db, onAuthStateChanged, collection, addDoc, getDocs, doc, query, orderBy, serverTimestamp } from "./firebase.js";
const OWNER_EMAIL="1987zinwaimin@gmail.com";
const $=id=>document.getElementById(id);
let allowed=false, banks=[];
const fmt=(n,c)=>Number(n||0).toLocaleString("en-US",{maximumFractionDigits:2})+" "+c;
function msg(t,err=false){$("cashMessage").textContent=t;$("cashMessage").style.color=err?"#b42318":"#397f79";}
function isOwner(u){return !!u&&u.email?.toLowerCase()===OWNER_EMAIL&&u.emailVerified===true;}
async function loadBanks(){
 const snap=await getDocs(query(collection(db,"ownerBankAccounts")));
 banks=snap.docs.map(d=>({id:d.id,...d.data()}));
 const select=$("cashBankId"),currency=$("cashCurrency").value;
 select.innerHTML='<option value="">Cash (လက်ထဲငွေ)</option>';
 banks.filter(b=>b.currency===currency).forEach(b=>{const o=document.createElement("option");o.value=b.id;o.textContent=(b.bankName||b.name||"Bank")+" · "+(b.accountNumber||"");select.append(o);});
 $("cashAccountType").value="CASH"; select.disabled=true;
}
function syncBank(){const isBank=$("cashAccountType").value==="BANK";$("cashBankId").disabled=!isBank;if(isBank&&!$("cashBankId").value&&banks.length){const match=banks.find(b=>b.currency===$("cashCurrency").value);if(match)$("cashBankId").value=match.id;}}
async function refresh(){
 const [movSnap,bankSnap]=await Promise.all([
  getDocs(query(collection(db,"cashMovements"),orderBy("createdAt","desc"))),
  getDocs(query(collection(db,"ownerBankAccounts")))
 ]);
 banks=bankSnap.docs.map(d=>({id:d.id,...d.data()}));
 const movements=movSnap.docs.map(d=>({id:d.id,...d.data()}));
 const sums={THB:{CASH:0,BANK:0},MMK:{CASH:0,BANK:0}}, byAccount={};
 banks.forEach(b=>{const cur=b.currency==="MMK"?"MMK":"THB";const opening=Number(b.openingBalance||0);byAccount[b.id]={name:b.bankName||"Bank",currency:cur,balance:opening};sums[cur].BANK+=opening;});
 movements.forEach(m=>{
  const amount=Number(m.amount||0)*(m.entryType==="OUT"?-1:1);
  const c=m.currency==="MMK"?"MMK":"THB",type=m.accountType==="BANK"?"BANK":"CASH";
  sums[c][type]+=amount;
  if(type==="BANK"&&byAccount[m.bankId])byAccount[m.bankId].balance+=amount;
 });
 $("cashThb").textContent=fmt(sums.THB.CASH,"THB");$("cashMmk").textContent=fmt(sums.MMK.CASH,"MMK");
 $("bankThb").textContent=fmt(sums.THB.BANK,"THB");$("bankMmk").textContent=fmt(sums.MMK.BANK,"MMK");
 const rows=Object.values(byAccount).map(b=>({name:b.name,currency:b.currency,balance:b.balance}));
 $("cashBreakdown").innerHTML="";
 if(!rows.length){$("cashBreakdown").textContent="Bank Account မရှိသေးပါ။ Cash movement များကို အထက်မှ စာရင်းသွင်းနိုင်ပါသည်။";}
 else rows.forEach(b=>{const p=document.createElement("p");p.textContent=b.name+" · "+fmt(b.balance,b.currency);$("cashBreakdown").append(p);});
 const table=document.createElement("table");table.className="table";
 table.innerHTML="<thead><tr><th>အချိန်</th><th>အမျိုးအစား</th><th>ငွေကြေး</th><th>ပမာဏ</th><th>မှတ်ချက်</th></tr></thead>";
 const body=document.createElement("tbody");
 movements.slice(0,30).forEach(m=>{const tr=document.createElement("tr");const vals=[m.createdAt?.toDate?m.createdAt.toDate().toLocaleString():"—",m.entryType==="OPENING"?"အဖွင့်လက်ကျန်":m.entryType==="IN"?"ငွေဝင်":"ငွေထွက်",m.currency,fmt(m.amount,m.currency),m.note||"—"];vals.forEach(v=>{const td=document.createElement("td");td.textContent=v;tr.append(td);});body.append(tr);});
 table.append(body);$("cashHistory").innerHTML="";$("cashHistory").append(table);
 await loadBanks();
}
$("cashCurrency").addEventListener("change",loadBanks);
$("cashAccountType").addEventListener("change",syncBank);
$("cashForm").addEventListener("submit",async e=>{
 e.preventDefault();
 if(!allowed){msg("Verified Owner Login ဝင်ပြီးမှ စာရင်းသွင်းနိုင်ပါသည်။",true);return;}
 const currency=$("cashCurrency").value,accountType=$("cashAccountType").value,bankId=$("cashBankId").value;
 const amount=Number($("cashAmount").value),entryType=$("cashEntryType").value;
 if(!Number.isFinite(amount)||amount<=0){msg("ပမာဏကို မှန်ကန်စွာ ဖြည့်ပါ။",true);return;}
 if(accountType==="BANK"&&!bankId){msg("ဘဏ်အကောင့်ကို ရွေးချယ်ပါ။",true);return;}
 const btn=$("cashSave");btn.disabled=true;
 try{
  await addDoc(collection(db,"cashMovements"),{currency,accountType,bankId:accountType==="BANK"?bankId:"",entryType,amount,note:$("cashNote").value.trim(),createdAt:serverTimestamp(),createdBy:auth.currentUser.email});
  $("cashForm").reset();$("cashAccountType").value="CASH";msg("ငွေစာရင်း သိမ်းဆည်းပြီးပါပြီ။");await refresh();
 }catch(err){msg("သိမ်းဆည်းမရပါ: "+err.message,true);}
 finally{btn.disabled=false;}
});
window.addEventListener("mkexchange:cash-updated",()=>{if(allowed)refresh().catch(err=>msg("လက်ကျန် ပြန်ဖတ်မရပါ: "+err.message,true));});
onAuthStateChanged(auth,async user=>{
 allowed=isOwner(user);
 ["cashCurrency","cashAccountType","cashBankId","cashEntryType","cashAmount","cashNote","cashSave"].forEach(id=>$(id).disabled=!allowed);
 if(allowed){try{await refresh();syncBank();msg("Owner အတည်ပြုပြီးပါပြီ။ THB / MMK လက်ကျန်ကို သီးခြားစီ စီမံနိုင်ပါသည်။");}catch(err){msg("စာရင်းဖတ်မရပါ: "+err.message,true);}}
 else {msg("Verified Owner Login ဝင်ပြီးမှ အသုံးပြုနိုင်ပါသည်။",true);}
});

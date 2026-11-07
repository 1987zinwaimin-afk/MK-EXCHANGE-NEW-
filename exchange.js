import { auth, db, onAuthStateChanged, collection, getDocs, getDoc, doc, addDoc, query, orderBy, serverTimestamp, writeBatch } from "./firebase.js";
const OWNER_EMAIL="1987zinwaimin@gmail.com";
const $=id=>document.getElementById(id);
let ownerReady=false,banks=[],rates={};
const fmt=n=>Number(n).toLocaleString("en-US",{maximumFractionDigits:2});
const say=(text,bad=false)=>{ $("exMessage").textContent=text; $("exMessage").style.color=bad?"#b42318":"#397f79"; };
const owner=u=>!!u&&u.email?.toLowerCase()===OWNER_EMAIL&&u.emailVerified===true;
function accountOptions(currency,selected="CASH"){
 const list=[{value:"CASH",label:"Cash (လက်ထဲငွေ)"},...banks.filter(b=>b.currency===currency).map(b=>({value:b.id,label:(b.bankName||"Bank")+" · "+(b.accountNumber||"")}))];
 return list.map(x=>'<option value="'+x.value+'">'+x.label.replaceAll("&","&amp;").replaceAll("<","&lt;")+'</option>').join("");
}
function fillAccounts(){
 $("exReceiveAccount").innerHTML=accountOptions($("exReceiveCurrency").textContent);
 $("exPayAccount").innerHTML=accountOptions($("exPayCurrency").textContent);
}
function getFlow(){
 const a=$("exType").value==="a";
 $("exReceiveCurrency").textContent=a?"THB":"MMK";
 $("exPayCurrency").textContent=a?"MMK":"THB";
 $("exReceiveLabel").textContent=a?"Owner လက်ခံမည့် THB အကောင့်":"Owner လက်ခံမည့် MMK အကောင့်";
 $("exPayLabel").textContent=a?"Customer ကိုပေးမည့် MMK အကောင့်":"Customer ကိုပေးမည့် THB အကောင့်";
 fillAccounts();calc();
}
function calc(){
 const a=$("exType").value==="a";
 const key=a?"rateA_buy":"rateB_buy",rate=Number(rates[key]||0),amount=Number($("exAmount").value||0);
 $("exRate").value=rate||"";
 const out=rate&&amount>0?(a?amount*rate:amount/rate):0;
 $("exResult").textContent=out?(a?fmt(amount)+" THB → "+fmt(out)+" MMK":fmt(amount)+" MMK → "+fmt(out)+" THB"):"Rate နှင့် ပမာဏ ထည့်ပါ။";
 $("exSave").disabled=!ownerReady||!out;
 return {a,rate,amount,out};
}
async function loadSetup(){
 const [bs,rs]=await Promise.all([getDocs(query(collection(db,"ownerBankAccounts"))),getDoc(doc(db,"exchangeSettings","current"))]);
 banks=bs.docs.map(d=>({id:d.id,...d.data()}));
 rates=rs.exists()?rs.data():{};
 getFlow();
}
["exType"].forEach(id=>$(id).addEventListener("change",getFlow));
$("exAmount").addEventListener("input",calc);
$("exReceiveCurrency").textContent="THB";$("exPayCurrency").textContent="MMK";
$("exForm").addEventListener("submit",async e=>{
 e.preventDefault();
 if(!ownerReady){say("Verified Owner Login ဝင်ပြီးမှ Transaction သိမ်းနိုင်ပါသည်။",true);return;}
 const {a,rate,amount,out}=calc();
 const customer=$("exCustomer").value.trim();
 if(!customer){say("Customer အမည် ဖြည့်ပါ။",true);return;}
 if(!(rate>0&&amount>0&&out>0)){say("Rate နှင့် ပမာဏကို စစ်ဆေးပါ။",true);return;}
 const receiveCurrency=a?"THB":"MMK",payCurrency=a?"MMK":"THB";
 const receiveAccount=$("exReceiveAccount").value,payAccount=$("exPayAccount").value;
 const btn=$("exSave");btn.disabled=true;
 try{
  const transactionRef=doc(collection(db,"exchangeTransactions"));
  const batch=writeBatch(db);
  const common={transactionId:transactionRef.id,customerName:customer,direction:a?"THB_TO_MMK":"MMK_TO_THB",rateKey:a?"rateA_buy":"rateB_buy",rate,inputAmount:amount,outputAmount:out,note:$("exNote").value.trim(),status:"COMPLETED",createdAt:serverTimestamp(),createdBy:auth.currentUser.email};
  batch.set(transactionRef,common);
  const movement=(currency,account,entryType,value,note)=>batch.set(doc(collection(db,"cashMovements")),{currency,accountType:account==="CASH"?"CASH":"BANK",bankId:account==="CASH"?"":account,entryType,amount:value,note,source:"EXCHANGE",transactionId:transactionRef.id,createdAt:serverTimestamp(),createdBy:auth.currentUser.email});
  movement(receiveCurrency,receiveAccount,"IN",amount,"Exchange လက်ခံငွေ · "+customer);
  movement(payCurrency,payAccount,"OUT",out,"Exchange ပေးငွေ · "+customer);
  batch.set(doc(collection(db,"auditLogs")),{action:"EXCHANGE_CREATED",transactionId:transactionRef.id,description:"Exchange completed for "+customer,createdAt:serverTimestamp(),createdBy:auth.currentUser.email});
  await batch.commit();
  $("exReceiptId").textContent="Receipt ID: "+transactionRef.id;
  $("exForm").reset();getFlow();calc();
  say("Transaction သိမ်းဆည်းပြီးပါပြီ။ Cash & Bank လက်ကျန်ကို အလိုအလျောက် ပြင်ဆင်ထားပါသည်။");
  window.dispatchEvent(new CustomEvent("mkexchange:cash-updated"));
 }catch(err){say("Transaction သိမ်းဆည်းမရပါ: "+err.message,true);}
 finally{btn.disabled=false;calc();}
});
onAuthStateChanged(auth,async user=>{
 ownerReady=owner(user);
 ["exType","exCustomer","exAmount","exReceiveAccount","exPayAccount","exNote"].forEach(id=>$(id).disabled=!ownerReady);
 $("exSave").disabled=!ownerReady;
 if(ownerReady){try{await loadSetup();say("Owner အတည်ပြုပြီးပါပြီ။ Transaction အသစ် သိမ်းနိုင်ပါသည်။");}catch(err){say("Rate/Bank အချက်အလက် ဖတ်မရပါ: "+err.message,true);}}
 else say("Verified Owner Login ဝင်ပြီးမှ Transaction အသုံးပြုနိုင်ပါသည်။",true);
});

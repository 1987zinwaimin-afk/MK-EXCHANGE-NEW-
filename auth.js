import { auth, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut } from "./firebase.js";
const OWNER_EMAIL = ""; // Set only after the business owner confirms the exact owner email.
const byId = (id) => document.getElementById(id);
const status = byId("authStatus");
const modal = byId("authModal");
const message = byId("authMessage");
function setMessage(text, error=false){message.textContent=text;message.style.color=error?"#b42318":"#397f79";}
function openAuth(){modal.classList.add("open");modal.setAttribute("aria-hidden","false");}
function closeAuth(){modal.classList.remove("open");modal.setAttribute("aria-hidden","true");}
byId("ownerLoginBtn").addEventListener("click",openAuth);
byId("authClose").addEventListener("click",closeAuth);
byId("authBackdrop").addEventListener("click",closeAuth);
{
 const fb={auth,onAuthStateChanged,signInWithEmailAndPassword,signInWithPopup,GoogleAuthProvider,signOut};
 fb.onAuthStateChanged(fb.auth,user=>{
   if(!user){status.textContent="OWNER LOGIN";byId("ownerLoginBtn").textContent="Owner Login";return;}
   const isOwner=!!OWNER_EMAIL && user.email?.toLowerCase()===OWNER_EMAIL.toLowerCase();
   status.textContent=isOwner?"OWNER VERIFIED":"ACCESS PENDING";
   byId("ownerLoginBtn").textContent=isOwner?"Sign out":(user.email||"Signed in");
   setMessage(isOwner?"Owner account verified.":"Signed in, but owner permission is not configured yet.",!isOwner);
   if(isOwner) closeAuth();
 });
 byId("emailLogin").addEventListener("click",async()=>{
   const email=byId("ownerEmail").value.trim(),password=byId("ownerPassword").value;
   if(!email||!password){setMessage("Email နဲ့ Password ထည့်ပါ။",true);return;}
   try{await fb.signInWithEmailAndPassword(fb.auth,email,password);}catch(e){setMessage("Login မအောင်မြင်ပါ: "+e.message,true);}
 });
 byId("googleLogin").addEventListener("click",async()=>{
   try{await fb.signInWithPopup(fb.auth,new fb.GoogleAuthProvider());}catch(e){setMessage("Google Login မအောင်မြင်ပါ: "+e.message,true);}
 });
 byId("ownerLoginBtn").addEventListener("dblclick",async()=>{if(fb.auth.currentUser){await fb.signOut(fb.auth);setMessage("Signed out.");}});
 setMessage("Firebase ချိတ်ဆက်ပြီးပါပြီ။ Owner email ကို သတ်မှတ်ရန် လိုအပ်သည်။");
}
window.addEventListener("error",e=>{if(e.message?.includes("Firebase"))setMessage(e.message,true);});

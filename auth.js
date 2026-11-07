import {
  auth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendEmailVerification,
  signInWithPopup, GoogleAuthProvider, signOut
} from "./firebase.js";

const OWNER_EMAIL = "1987zinwaimin@gmail.com";
const $ = (id) => document.getElementById(id);
const status = $("authStatus");
const modal = $("authModal");
const message = $("authMessage");
let ownerVerified = false;

function setMessage(text, error = false) {
  message.textContent = text;
  message.style.color = error ? "#b42318" : "#397f79";
}
function openAuth() {
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}
function closeAuth() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}
function isOwner(user) {
  return !!user &&
    user.email?.toLowerCase() === OWNER_EMAIL &&
    user.emailVerified === true;
}

$("ownerLoginBtn").addEventListener("click", async () => {
  if (auth.currentUser && ownerVerified) {
    await signOut(auth);
    return;
  }
  openAuth();
});
$("authClose").addEventListener("click", closeAuth);
$("authBackdrop").addEventListener("click", closeAuth);

onAuthStateChanged(auth, async (user) => {
  ownerVerified = isOwner(user);
  if (!user) {
    status.textContent = "OWNER PREVIEW";
    $("ownerLoginBtn").textContent = "Owner Login";
    return;
  }
  if (!ownerVerified) {
    const correctEmail = user.email?.toLowerCase() === OWNER_EMAIL;
    status.textContent = correctEmail ? "EMAIL NOT VERIFIED" : "OWNER PREVIEW";
    $("ownerLoginBtn").textContent = "Owner Login";
    setMessage(
      correctEmail
        ? "Email မ Verify ရသေးပါ။ Sign in with Email ကို ထပ်နှိပ်ပါက Verification Email ပြန်ပို့ပေးပါမည်။"
        : "ဒီ Google Account ကို Owner အဖြစ် ခွင့်မပြုထားပါ။",
      true
    );
    openAuth();
    return;
  }
  status.textContent = "OWNER VERIFIED";
  $("ownerLoginBtn").textContent = "Sign out";
  setMessage("Owner Account အတည်ပြုပြီးပါပြီ။");
  closeAuth();
});

$("emailLogin").addEventListener("click", async () => {
  const email = $("ownerEmail").value.trim().toLowerCase();
  const password = $("ownerPassword").value;
  if (email !== OWNER_EMAIL) {
    setMessage("Owner Gmail မှန်ကန်စွာ ထည့်ပါ။", true);
    return;
  }
  if (!password) {
    setMessage("Password ထည့်ပါ။", true);
    return;
  }
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    if (!credential.user.emailVerified) {
      try {
        await sendEmailVerification(credential.user);
        setMessage("Verification Email ကို " + email + " သို့ ပြန်ပို့ပြီးပါပြီ။ Gmail Inbox / Spam ထဲစစ်ပြီး Verify လုပ်ပါ။");
      } catch (sendError) {
        setMessage("Email ပို့မရပါ။ " + sendError.message + " — ခဏစောင့်ပြီး ထပ်စမ်းပါ။", true);
      }
      await signOut(auth);
      openAuth();
      return;
    }
    setMessage("Owner Login အောင်မြင်ပါသည်။");
  } catch (error) {
    setMessage("Login မအောင်မြင်ပါ။ " + error.message, true);
  }
});

$("ownerRegister").addEventListener("click", async () => {
  const email = $("ownerEmail").value.trim().toLowerCase();
  const password = $("ownerPassword").value;
  if (email !== OWNER_EMAIL) {
    setMessage("Owner Gmail တစ်ခုတည်းဖြင့်သာ Register လုပ်နိုင်ပါတယ်။", true);
    return;
  }
  if (password.length < 8) {
    setMessage("Password အနည်းဆုံး ၈ လုံး ထည့်ပါ။", true);
    return;
  }
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(credential.user);
    await signOut(auth);
    setMessage("Verification Email ပို့ပြီးပါပြီ။ Gmail ထဲက Link ကိုနှိပ်ပြီးမှ Login ဝင်ပါ။");
  } catch (error) {
    setMessage("Register မအောင်မြင်ပါ။ " + error.message, true);
  }
});

$("googleLogin").addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (error) {
    setMessage("Google Login မအောင်မြင်ပါ။ " + error.message, true);
  }
});

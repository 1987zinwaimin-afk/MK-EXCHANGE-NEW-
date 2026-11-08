import { auth, db, onAuthStateChanged, doc, getDoc, setDoc, serverTimestamp } from "./firebase.js";

const OWNER_EMAIL = "1987zinwaimin@gmail.com";
const $ = (id) => document.getElementById(id);
const ids = ["rateA_buy", "rateA_sell", "rateB_buy", "rateB_sell"];
let ownerReady = false;
let currentRates = { rateA_buy: 0, rateA_sell: 0, rateB_buy: 0, rateB_sell: 0 };

function isOwner(user) {
  return !!user && user.email?.toLowerCase() === OWNER_EMAIL && user.emailVerified === true;
}
function number(id) { return Number($(id)?.value || 0); }
function fmt(value) { return Number(value).toLocaleString("en-US", { maximumFractionDigits: 4 }); }
function message(text, error = false) {
  $("rateMessage").textContent = text;
  $("rateMessage").style.color = error ? "#b42318" : "#397f79";
}
function renderSummary() {
  const aBuy = currentRates.rateA_buy, aSell = currentRates.rateA_sell;
  const bBuy = currentRates.rateB_buy, bSell = currentRates.rateB_sell;
  $("rateSummary").textContent =
    "ဘတ်ပေး ကျပ်ယူ — ဝယ်ဈေး: " + (aBuy ? fmt(aBuy) : "မသတ်မှတ်ရသေး") +
    " MMK · ရောင်းဈေး: " + (aSell ? fmt(aSell) : "မသတ်မှတ်ရသေး") +
    " MMK | ကျပ်ပေး ဘတ်ယူ — ဝယ်ဈေး: " + (bBuy ? fmt(bBuy) : "မသတ်မှတ်ရသေး") +
    " MMK · ရောင်းဈေး: " + (bSell ? fmt(bSell) : "မသတ်မှတ်ရသေး") + " MMK";
  $("dashA").textContent = aBuy || aSell ? "ဝယ် " + fmt(aBuy) + " / ရောင်း " + fmt(aSell) + " MMK" : "—";
  $("dashB").textContent = bBuy || bSell ? "ဝယ် " + fmt(bBuy) + " / ရောင်း " + fmt(bSell) + " MMK" : "—";
}
async function loadRates() {
  try {
    const snap = await getDoc(doc(db, "exchangeSettings", "current"));
    if (snap.exists()) {
      currentRates = { ...currentRates, ...snap.data() };
      ids.forEach(id => { $(id).value = currentRates[id] || ""; });
    }
    renderSummary();
    calculate();
  } catch (error) {
    message("Rate ဖတ်မရပါ: " + error.message, true);
  }
}
function calculate() {
  const direction = $("calcDirection").value;
  const amount = Number($("calcAmount").value || 0);
  const rate = Number(currentRates[direction === "a" ? "rateA_buy" : "rateB_buy"] || 0);
  const receiveCurrency = direction === "a" ? "THB" : "MMK";
  const enteredCurrency = $("calcInputCurrency").value;
  const inputIsReceive = enteredCurrency === receiveCurrency;
  if (!amount || !rate) {
    $("calcResult").textContent = "Rate သတ်မှတ်ပြီး ပမာဏထည့်ပါ။";
    return;
  }
  const result = inputIsReceive ? amount * rate : amount / rate;
  const outputCurrency = inputIsReceive ? (direction === "a" ? "MMK" : "THB") : receiveCurrency;
  $("calcResult").textContent = fmt(amount) + " " + enteredCurrency + " → " + fmt(result) + " " + outputCurrency;
}
$("saveRates").addEventListener("click", async () => {
  if (!ownerReady) { message("Verified Owner Login ဝင်ပြီးမှ Rate သိမ်းနိုင်ပါသည်။", true); return; }
  const values = Object.fromEntries(ids.map(id => [id, number(id)]));
  if (ids.some(id => !Number.isFinite(values[id]) || values[id] <= 0)) {
    message("ဝယ်ဈေးနှင့် ရောင်းဈေး လေးခုလုံးကို သုညထက်ကြီးသော ကိန်းဂဏန်းဖြင့် ဖြည့်ပါ။", true);
    return;
  }
  const button = $("saveRates");
  button.disabled = true;
  try {
    await setDoc(doc(db, "exchangeSettings", "current"), {
      ...values,
      note: $("rateNote").value.trim(),
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser.email
    });
    currentRates = values;
    renderSummary();
    calculate();
    message("ဝယ်ဈေးနှင့် ရောင်းဈေး လေးမျိုးလုံး သိမ်းဆည်းပြီးပါပြီ။");
  } catch (error) {
    message("သိမ်းဆည်းမရပါ: " + error.message, true);
  } finally {
    button.disabled = false;
  }
});
["calcDirection", "calcInputCurrency", "calcAmount"].forEach(id => $(id).addEventListener("input", calculate));
["calcDirection", "calcInputCurrency"].forEach(id => $(id).addEventListener("change", calculate));
onAuthStateChanged(auth, async user => {
  ownerReady = isOwner(user);
  ids.forEach(id => { $(id).disabled = !ownerReady; });
  $("rateNote").disabled = !ownerReady;
  $("saveRates").disabled = !ownerReady;
  await loadRates();
  if (!ownerReady) message("Owner Login ဝင်ပြီးမှ Rate ပြောင်းလဲနိုင်ပါသည်။", true);
  else message("Owner အတည်ပြုပြီးပါပြီ။ Rate များကို ပြင်ဆင်နိုင်ပါသည်။");
});

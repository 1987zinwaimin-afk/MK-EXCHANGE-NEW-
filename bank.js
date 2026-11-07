import {
  auth, db, onAuthStateChanged,
  collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp
} from "./firebase.js";

const OWNER_EMAIL = "1987zinwaimin@gmail.com";
const $ = (id) => document.getElementById(id);
const form = $("bankForm");
const list = $("bankAccountsList");
const message = $("bankMessage");
const saveButton = $("bankSave");
const cancelButton = $("bankCancel");
let ownerReady = false;
let editingId = null;
let selectedQrFile = null;
let previewObjectUrl = null;

function say(text, error = false) {
  message.textContent = text;
  message.style.color = error ? "#b42318" : "#397f79";
}
function isOwner(user) {
  return !!user && user.email?.toLowerCase() === OWNER_EMAIL && user.emailVerified === true;
}
function safeQrUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}
function fieldValue(id) {
  return $(id).value.trim();
}
function resetForm() {
  form.reset();
  clearQrSelection();
  editingId = null;
  $("bankFormTitle").textContent = "＋ ဘဏ်အကောင့်အသစ် ထည့်ရန်";
  saveButton.textContent = "အကောင့် သိမ်းဆည်းရန်";
  cancelButton.hidden = true;
}
function clearQrSelection() {
  selectedQrFile = null;
  const input = $("bankQrFile");
  if (input) input.value = "";
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = null;
  $("bankQrPreview").style.display = "none";
  $("bankQrPreviewImg").removeAttribute("src");
}
async function compressQrImage(file) {
  const image = await createImageBitmap(file);
  const scale = Math.min(1, 480 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height); image.close();
  return canvas.toDataURL("image/png");
}
function showQrPreview(file) {
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = URL.createObjectURL(file);
  $("bankQrPreviewImg").src = previewObjectUrl;
  $("bankQrPreview").style.display = "block";
}
function makeText(tag, className, value) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.textContent = value;
  return el;
}
function renderAccounts(accounts) {
  list.replaceChildren();
  if (!accounts.length) {
    list.append(makeText("div", "empty", "ဘဏ်အကောင့် မရှိသေးပါ။ အပေါ်က Form မှ အကောင့်အသစ် ထည့်နိုင်ပါသည်။"));
    return;
  }
  for (const account of accounts) {
    const card = document.createElement("article");
    card.className = "panel";
    const heading = document.createElement("div");
    heading.style.cssText = "display:flex;justify-content:space-between;align-items:center;gap:8px";
    heading.append(makeText("h2", "", account.bankName || "Bank Account"));
    heading.append(makeText("span", "tag", account.currency || ""));
    card.append(heading);
    card.append(makeText("p", "sub", "Account Holder: " + (account.holderName || "—")));
    card.append(makeText("p", "sub", "Account Number: " + (account.accountNumber || "—")));
    card.append(makeText("p", "sub", "Type: " + (account.accountType || "—") + (account.branch ? " · Branch: " + account.branch : "")));
    if (account.note) card.append(makeText("p", "sub", "မှတ်ချက်: " + account.note));
    const qrUrl = safeQrUrl(account.qrUrl);
    const qrImage = account.qrDataUrl || qrUrl;
    if (qrImage) {
      const qr = document.createElement("img");
      qr.src = qrImage;
      qr.alt = account.bankName + " payment QR";
      qr.loading = "lazy";
      qr.referrerPolicy = "no-referrer";
      qr.style.cssText = "display:block;width:min(180px,100%);height:auto;object-fit:contain;border:1px solid var(--line);border-radius:10px;margin:10px 0";
      card.append(qr);
    }
    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin-top:12px";
    const edit = makeText("button", "btn secondary", "ပြင်ဆင်ရန်");
    edit.type = "button";
    edit.addEventListener("click", () => beginEdit(account));
    const remove = makeText("button", "btn secondary", "ဖျက်ရန်");
    remove.type = "button";
    remove.addEventListener("click", () => removeAccount(account.id, account.bankName));
    actions.append(edit, remove);
    card.append(actions);
    list.append(card);
  }
}
async function loadAccounts() {
  if (!ownerReady) {
    list.replaceChildren(makeText("div", "empty", "Owner Login ဝင်ပြီးမှ အကောင့်များကို ကြည့်နိုင်ပါမည်။"));
    return;
  }
  list.replaceChildren(makeText("div", "empty", "ဘဏ်အကောင့်များကို ဖတ်ရှုနေပါသည်…"));
  try {
    const q = query(collection(db, "ownerBankAccounts"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    renderAccounts(snapshot.docs.map(item => ({ id: item.id, ...item.data() })));
  } catch (error) {
    list.replaceChildren(makeText("div", "empty", "အကောင့်များ ဖတ်မရပါ။ Firestore Rules ကို Publish လုပ်ထားခြင်း ရှိ/မရှိ စစ်ဆေးပါ။"));
    say("ဖတ်ရှုမှု မအောင်မြင်ပါ: " + error.message, true);
  }
}
function beginEdit(account) {
  if (!ownerReady) return;
  editingId = account.id;
  $("bankName").value = account.bankName || "";
  $("bankCurrency").value = account.currency || "THB";
  $("bankHolder").value = account.holderName || "";
  $("bankNumber").value = account.accountNumber || "";
  $("bankType").value = account.accountType || "Saving";
  $("bankBranch").value = account.branch || "";
  clearQrSelection();
  if (account.qrDataUrl || account.qrUrl) {
    $("bankQrPreviewImg").src = account.qrDataUrl || account.qrUrl;
    $("bankQrPreview").style.display = "block";
  }
  $("bankNote").value = account.note || "";
  $("bankFormTitle").textContent = "ဘဏ်အကောင့် ပြင်ဆင်ရန်";
  saveButton.textContent = "ပြင်ဆင်ချက် သိမ်းရန်";
  cancelButton.hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}
async function removeAccount(id, name) {
  if (!ownerReady || !confirm((name || "ဤအကောင့်") + " ကို ဖျက်မှာ သေချာပါသလား။")) return;
  try {
    await deleteDoc(doc(db, "ownerBankAccounts", id));
    say("ဘဏ်အကောင့်ကို ဖျက်ပြီးပါပြီ။");
    await loadAccounts();
  } catch (error) {
    say("ဖျက်မရပါ: " + error.message, true);
  }
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!ownerReady) {
    say("Verified Owner Login ဝင်ပြီးမှ သိမ်းဆည်းနိုင်ပါသည်။", true);
    return;
  }
  const bankName = fieldValue("bankName");
  const holderName = fieldValue("bankHolder");
  const accountNumber = fieldValue("bankNumber");
  const qrFile = selectedQrFile;
  if (qrFile && (!qrFile.type.startsWith("image/") || qrFile.size > 5 * 1024 * 1024)) {
    say("QR ပုံသည် Image ဖြစ်ရမည်၊ 5MB ထက်မကျော်ရပါ။", true);
    return;
  }
  if (!bankName || !holderName || !accountNumber) {
    say("ဘဏ်အမည်၊ Account Holder နှင့် Account Number ဖြည့်ပါ။", true);
    return;
  }
  const data = {
    bankName,
    currency: $("bankCurrency").value,
    holderName,
    accountNumber,
    accountType: $("bankType").value,
    branch: fieldValue("bankBranch"),
    qrUrl: "",
    note: fieldValue("bankNote"),
    updatedAt: serverTimestamp()
  };
  saveButton.disabled = true;
  try {
    let qrDataUrl = "";
    if (qrFile) {
      qrDataUrl = await compressQrImage(qrFile);
      if (qrDataUrl.length > 780000) {
        say("QR ပုံဖိုင်အရွယ်အစား ကြီးနေပါသည်။ ပိုသေးသော QR ပုံကို ရွေးပါ။", true);
        return;
      }
    }
    const saveData = { ...data };
    delete saveData.qrUrl;
    if (qrDataUrl) { saveData.qrDataUrl = qrDataUrl; saveData.qrUrl = ""; }
    if (editingId) {
      await updateDoc(doc(db, "ownerBankAccounts", editingId), saveData);
      say("ဘဏ်အကောင့် ပြင်ဆင်ပြီးပါပြီ။");
    } else {
      await addDoc(collection(db, "ownerBankAccounts"), { ...saveData, createdAt: serverTimestamp() });
      say("ဘဏ်အကောင့် အသစ် သိမ်းဆည်းပြီးပါပြီ။");
    }
    resetForm();
    await loadAccounts();
  } catch (error) {
    say("သိမ်းဆည်းမရပါ: " + error.message, true);
  } finally {
    saveButton.disabled = false;
  }
});
cancelButton.addEventListener("click", resetForm);
$("bankQrFile").addEventListener("change", () => {
  const file = $("bankQrFile").files?.[0] || null;
  selectedQrFile = file;
  if (!file) { $("bankQrPreview").style.display = "none"; return; }
  if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
    selectedQrFile = null;
    $("bankQrFile").value = "";
    say("Image ဖိုင်သာရွေးပါ။ အများဆုံး 5MB ဖြစ်ရပါမည်။", true);
    return;
  }
  showQrPreview(file);
  say("QR ပုံရွေးပြီးပါပြီ။ သိမ်းဆည်းရန် နှိပ်ပါ။");
});
$("bankQrRemove").addEventListener("click", clearQrSelection);

onAuthStateChanged(auth, async (user) => {
  ownerReady = isOwner(user);
  form.querySelectorAll("input,select,button").forEach(control => {
    control.disabled = !ownerReady;
  });
  if (!ownerReady) {
    say("Verified Owner Login ဝင်ပြီးမှ Bank Account များကို စီမံနိုင်ပါသည်။", true);
    list.replaceChildren(makeText("div", "empty", "Owner Login ဝင်ပြီးမှ အကောင့်များကို ကြည့်နိုင်ပါမည်။"));
    return;
  }
  say("Owner အတည်ပြုပြီးပါပြီ။ Bank Account များကို စီမံနိုင်ပါသည်။");
  await loadAccounts();
});

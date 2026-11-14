import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider,
  linkWithPopup, EmailAuthProvider, linkWithCredential, signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getDatabase, ref, get, set, onValue, query, orderByChild,
  equalTo, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Development branch: never treat browser-selected roles as authorization.
// Backend RTDB rules must validate every approval before enabling this for workers.
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const GOOGLE = new GoogleAuthProvider();
const TIMEZONE = "America/Los_Angeles"; // Confirm actual facility timezone before launch.
const HOUR = 60 * 60 * 1000;
const SHIFTS = {
  "front-days": "Front Half Days", "front-nights": "Front Half Nights",
  "back-days": "Back Half Days", "back-nights": "Back Half Nights"
};
const ROLES = {
  "admin": "Administrator", "senior-operations-manager": "Senior Operations Manager",
  "manager": "Manager", "pa-clerk": "PA Clerk", "pa": "PA",
  "tier1-clerk": "Tier 1 Clerk", "tier1": "Tier 1"
};
const TABS = {
  lives: ["Lives", "The editable Lives pillar will live here."],
  drops: ["Drops", "The editable Drops pillar will live here."],
  transships: ["Transships", "The editable Transships pillar will live here."],
  cuts: ["CUTs & Dwells", "Time-critical CUT and dwell calculations will be read-only unless a role is explicitly granted a field override."],
  fifo: ["FIFO & Hot List", "Prioritized FIFO queues and hot lists will be derived from shift records."],
  reports: ["Reports", "Reports will summarize the shift's operational records, not hardcoded metrics."],
  yard: ["Yard", "Yard tracking will be scoped to your active shift."],
  communication: ["Communication", "Community updates will be connected after message permissions are audited."]
};
const WIDGETS = {
  lives: "Lives tracker", drops: "Drops tracker", transships: "Transships tracker",
  dwells: "Dwell watch", fifo: "FIFO watch", reports: "Reports summary"
};
const $ = (id) => document.getElementById(id);
let user = null, member = null, homeRequest = null, profile = null, isAdmin = false;
let currentShift = null, activeScreen = "loading", authMode = "signin";
let widgets = [], stopListeners = [], renderVersion = 0;
let currentTab = "overview";

function show(screen) {
  activeScreen = screen;
  document.querySelectorAll("main > section").forEach((section) => {
    section.hidden = section.id !== "screen-" + screen;
  });
  $("account-bar").hidden = !user;
  $("account-name").textContent = user?.displayName || user?.email || "";
}
function notice(message) {
  $("notice").textContent = message || "";
  $("notice").hidden = !message;
}
function errorMessage(error) {
  if (error?.code === "PERMISSION_DENIED" || error?.code === "permission_denied") {
    return "Firebase database access is still locked. The secure role rules must be reviewed, installed, and tested before access requests can be saved.";
  }
  if (error?.code === "auth/account-exists-with-different-credential") {
    return "This email already uses another sign-in method. Sign in using that method first, then link Google or a password under Settings. Vulcan will not create a second role profile.";
  }
  if (error?.code === "auth/popup-blocked") return "Your browser blocked the sign-in popup. Allow popups for Vulcan and retry.";
  if (error?.code === "auth/unauthorized-domain") return "This website domain still needs approval in Firebase Authentication → Authorized domains.";
  return error?.message || String(error);
}
async function attempt(callback) {
  notice("");
  try { await callback(); } catch (error) { notice(errorMessage(error)); }
}
function cleanup() {
  stopListeners.forEach((stop) => stop());
  stopListeners = [];
}
function watch(path, callback) {
  const unsub = onValue(ref(db, path), (snapshot) => callback(snapshot.val()), (err) => notice(errorMessage(err)));
  stopListeners.push(unsub);
}
function approved() { return member?.active === true; }
function canApprove() {
  return isAdmin || (approved() && ["manager", "pa-clerk", "tier1-clerk"].includes(member.role));
}
function canApproveRole(role) {
  if (isAdmin) return true;
  if (!canApprove() || role === "admin") return false;
  if (member.role === "tier1-clerk") return ["tier1", "tier1-clerk", "pa", "pa-clerk"].includes(role);
  return true;
}

// Evaluate schedules in the configured facility timezone. Both halves can
// legitimately overlap on Wednesday; never silently guess which one to use.
export function scheduledShifts(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE, weekday: "short", hour: "2-digit",
    minute: "2-digit", hourCycle: "h23"
  }).formatToParts(date).map((x) => [x.type, x.value]));
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  if (day < 0) return [];
  const minute = Number(parts.hour) * 60 + Number(parts.minute);
  const result = new Set();
  const covers = (start) => {
    if ([0, 1, 2, 3].includes(start)) result.add("front-" + (minute < 330 ? "nights" : "days"));
    if ([3, 4, 5, 6].includes(start)) result.add("back-" + (minute < 330 ? "nights" : "days"));
  };
  if (minute >= 270 && minute < 1050) {
    if (day <= 3) result.add("front-days");
    if (day >= 3) result.add("back-days");
  }
  if (minute >= 990) {
    if (day <= 3) result.add("front-nights");
    if (day >= 3) result.add("back-nights");
  }
  if (minute < 300) covers((day + 6) % 7);
  // 04:30–05:00 is a deliberate handoff overlap: day AND preceding night.
  if (minute >= 270 && minute < 300) covers((day + 6) % 7);
  // Day shifts end at 17:30, nights start 16:30 (another overlap).
  return Array.from(result);
}
async function startForSignedIn(nextUser) {
  cleanup();
  renderVersion++;
  user = nextUser;
  member = null; homeRequest = null; profile = null; isAdmin = false;
  currentShift = null; widgets = [];
  if (!user) { show("auth"); return; }
  show("loading");
  $("account-name").textContent = user.displayName || user.email || "Signed in";
  try {
    // Admin bootstrap is backend-only; no client can write its own admins entry.
    isAdmin = (await get(ref(db, "admins/" + user.uid))).val() === true;
  } catch (error) {
    notice(errorMessage(error));
  }
  watch("homeRequests/" + user.uid, (value) => { homeRequest = value; route(); });
  watch("memberships/" + user.uid, (value) => { member = value; route(); });
  watch("profiles/" + user.uid, (value) => { profile = value; route(); });
}
async function route() {
  const version = ++renderVersion;
  if (!user) return show("auth");
  if (!approved()) {
    if (!homeRequest) return show("request");
    $("pending-shift").textContent = SHIFTS[homeRequest.homeShift] || "Unknown shift";
    $("pending-role").textContent = ROLES[homeRequest.role] || "Unknown role";
    return show("pending");
  }
  if (!profile?.setupComplete) {
    $("profile-name").value = profile?.displayName || user.displayName || "";
    return show("profile");
  }
  const possible = scheduledShifts();
  let nextShift = null;
  if (isAdmin) nextShift = member.homeShift;
  else if (possible.includes(member.homeShift)) nextShift = member.homeShift;
  else {
    for (const shift of possible) {
      try {
        const grant = (await get(ref(db, "otGrants/" + shift + "/" + user.uid))).val();
        if (version !== renderVersion) return;
        if (grant?.expiresAt > Date.now()) { nextShift = shift; break; }
      } catch (error) { notice(errorMessage(error)); }
    }
  }
  if (version !== renderVersion) return;
  if (nextShift) return enterDashboard(nextShift);
  currentShift = null;
  $("access-title").textContent = possible.length ? "Helping another shift?" : "It's time to recharge.";
  $("access-explainer").textContent = possible.length
    ? "You are outside your home-shift schedule. Request 24-hour access from an authorized clerk on the shift you're covering."
    : "No shift is currently within the configured working-hours window. Get some well-deserved rest until your shift starts.";
  $("ot-message").textContent = "";
  $("ot-form").hidden = !possible.length;
  $("ot-shift").replaceChildren();
  possible.filter((id) => id !== member.homeShift).forEach((shift) => {
    const option = new Option(SHIFTS[shift], shift);
    $("ot-shift").add(option);
  });
  if (!$("ot-shift").options.length) $("ot-form").hidden = true;
  show("access");
}
async function enterDashboard(shift) {
  currentShift = shift;
  $("dashboard-name").textContent = profile?.displayName || user.displayName || "Clerk";
  $("dashboard-shift").textContent = SHIFTS[shift] + " · " + (ROLES[member.role] || member.role);
  document.documentElement.style.setProperty("--accent", /^#[0-9a-f]{6}$/i.test(profile?.color || "") ? profile.color : "#f5a451");
  $("open-approvals").hidden = !canApprove();
  try {
    const saved = (await get(ref(db, "preferences/" + user.uid + "/widgets"))).val();
    widgets = Array.isArray(saved) ? saved.filter((id) => WIDGETS[id]) : [];
  } catch (error) { widgets = []; notice(errorMessage(error)); }
  renderWidgets();
  switchTab("overview");
  show("dashboard");
}
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll("#workspace-nav button").forEach((button) => {
    button.setAttribute("aria-current", button.dataset.tab === tab ? "page" : "false");
  });
  $("tab-overview").hidden = tab !== "overview";
  $("tab-detail").hidden = tab === "overview";
  if (TABS[tab]) {
    $("detail-title").textContent = TABS[tab][0];
    $("detail-copy").textContent = TABS[tab][1];
  }
}
function renderWidgets() {
  const board = $("widget-board");
  board.replaceChildren();
  $("empty-board").hidden = widgets.length > 0;
  widgets.forEach((id) => {
    const card = document.createElement("article");
    card.className = "widget";
    const header = document.createElement("div");
    header.className = "widget-head";
    const title = document.createElement("h3");
    title.textContent = WIDGETS[id];
    const remove = document.createElement("button");
    remove.className = "subtle";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => saveWidgets(widgets.filter((x) => x !== id)));
    header.append(title, remove);
    const description = document.createElement("p");
    description.textContent = "Pinned shortcut · Live metrics will appear when the data pillars are connected.";
    card.append(header, description);
    board.append(card);
  });
}
async function saveWidgets(next) {
  await attempt(async () => {
    await set(ref(db, "preferences/" + user.uid + "/widgets"), next);
    widgets = next;
    renderWidgets();
    $("widget-catalog").hidden = true;
  });
}
function requestCard(text, secondary, callback) {
  const card = document.createElement("article");
  card.className = "request";
  const header = document.createElement("header");
  header.textContent = text;
  const detail = document.createElement("p");
  detail.className = "muted";
  detail.textContent = secondary;
  const actions = document.createElement("div");
  actions.className = "actions";
  const approve = document.createElement("button");
  approve.className = "primary";
  approve.textContent = "Approve";
  approve.addEventListener("click", () => attempt(async () => {
    approve.disabled = true;
    try { await callback(); notice("Access approved."); card.remove(); }
    finally { approve.disabled = false; }
  }));
  actions.append(approve);
  card.append(header, detail, actions);
  return card;
}
async function showApprovals() {
  if (!canApprove() || !currentShift) return;
  show("approvals");
  const list = $("approval-list");
  list.replaceChildren();
  const loading = document.createElement("p");
  loading.textContent = "Loading requests…";
  list.append(loading);
  try {
    const [homes, ots] = await Promise.all([
      get(query(ref(db, "homeRequests"), orderByChild("homeShift"), equalTo(currentShift))),
      get(ref(db, "otRequestsByShift/" + currentShift))
    ]);
    list.replaceChildren();
    const requests = homes.val() || {};
    for (const [uid, request] of Object.entries(requests)) {
      if (!request || !canApproveRole(request.role)) continue;
      const existing = (await get(ref(db, "memberships/" + uid))).val();
      if (existing?.active === true) continue;
      list.append(requestCard("Home shift · " + (ROLES[request.role] || request.role),
        SHIFTS[request.homeShift] + " · " + (request.requesterName || "User " + uid.slice(0, 10) + "…"), async () => {
          await set(ref(db, "memberships/" + uid), {
            homeShift: request.homeShift, role: request.role,
            active: true, approvedBy: user.uid, approvedAt: serverTimestamp()
          });
        }));
    }
    const requestsOt = ots.val() || {};
    for (const [uid, request] of Object.entries(requestsOt)) {
      if (!request) continue;
      const existing = (await get(ref(db, "otGrants/" + currentShift + "/" + uid))).val();
      if (existing?.expiresAt > Date.now()) continue;
      list.append(requestCard("24-hour shift coverage", SHIFTS[currentShift] + " · User " + uid.slice(0, 10) + "…", async () => {
        await set(ref(db, "otGrants/" + currentShift + "/" + uid), {
          approvedBy: user.uid, issuedAt: serverTimestamp(), expiresAt: Date.now() + 24 * HOUR
        });
      }));
    }
    if (!list.children.length) {
      const empty = document.createElement("p");
      empty.textContent = "No new requests for this shift.";
      list.append(empty);
    }
  } catch (error) { list.replaceChildren(); notice(errorMessage(error)); }
}
$("auth-mode").addEventListener("click", () => {
  authMode = authMode === "signin" ? "signup" : "signin";
  $("auth-submit").textContent = authMode === "signup" ? "Create account" : "Sign in with email";
  $("auth-mode").textContent = authMode === "signup" ? "Already have an account? Sign in" : "New here? Create an account";
  $("password").setAttribute("autocomplete", authMode === "signup" ? "new-password" : "current-password");
});
$("auth-form").addEventListener("submit", (event) => {
  event.preventDefault();
  attempt(() => authMode === "signup"
    ? createUserWithEmailAndPassword(auth, $("email").value.trim(), $("password").value)
    : signInWithEmailAndPassword(auth, $("email").value.trim(), $("password").value));
});
$("google-login").addEventListener("click", () => attempt(() => signInWithPopup(auth, GOOGLE)));
$("signout").addEventListener("click", () => attempt(() => signOut(auth)));
$("home-form").addEventListener("submit", (event) => {
  event.preventDefault();
  attempt(async () => {
    if (!user) return;
    const homeShift = $("home-shift").value;
    const role = $("home-role").value;
    if (!SHIFTS[homeShift] || !ROLES[role]) throw Error("Choose a valid shift and role.");
    await set(ref(db, "homeRequests/" + user.uid), {
      uid: user.uid, homeShift, role, requesterName: $("requester-name").value.trim(), status: "pending", createdAt: serverTimestamp()
    });
  });
});
$("profile-form").addEventListener("submit", (event) => {
  event.preventDefault();
  saveProfile(false);
});
$("skip-profile").addEventListener("click", () => saveProfile(true));
async function saveProfile(skipped) {
  await attempt(async () => {
    await set(ref(db, "profiles/" + user.uid), {
      setupComplete: true,
      displayName: skipped ? (user.displayName || "Clerk") : ($("profile-name").value.trim() || "Clerk"),
      pronunciation: skipped ? "" : $("profile-pronunciation").value.trim(),
      about: skipped ? "" : $("profile-about").value.trim(),
      color: skipped ? "#f5a451" : $("profile-color").value,
      status: skipped ? "private" : $("profile-status").value
    });
  });
}
$("ot-form").addEventListener("submit", (event) => {
  event.preventDefault();
  attempt(async () => {
    const shift = $("ot-shift").value;
    if (!scheduledShifts().includes(shift) || shift === member?.homeShift) throw Error("Choose an active shift you're covering.");
    await set(ref(db, "otRequestsByShift/" + shift + "/" + user.uid), {
      uid: user.uid, targetShift: shift, createdAt: serverTimestamp()
    });
    $("ot-message").textContent = "Request sent. This screen will open your dashboard when an authorized clerk approves.";
    const stop = onValue(ref(db, "otGrants/" + shift + "/" + user.uid), (snapshot) => {
      if (snapshot.val()?.expiresAt > Date.now()) { stop(); route(); }
    }, (error) => notice(errorMessage(error)));
    stopListeners.push(stop);
  });
});
$("workspace-nav").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-tab]");
  if (button) switchTab(button.dataset.tab);
});
$("add-widget").addEventListener("click", () => { $("widget-catalog").hidden = !$("widget-catalog").hidden; });
$("widget-catalog").addEventListener("click", (event) => {
  const widget = event.target.closest("button[data-widget]")?.dataset.widget;
  if (widget && !widgets.includes(widget)) saveWidgets([...widgets, widget]);
});
$("open-approvals").addEventListener("click", () => attempt(showApprovals));
$("open-settings").addEventListener("click", () => show("settings"));
document.querySelectorAll(".back-dashboard").forEach((button) => button.addEventListener("click", () => show("dashboard")));
$("link-google").addEventListener("click", () => attempt(async () => {
  await linkWithPopup(auth.currentUser, GOOGLE);
  notice("Google is now linked to the same account.");
}));
$("link-password-form").addEventListener("submit", (event) => {
  event.preventDefault();
  attempt(async () => {
    const credential = EmailAuthProvider.credential($("link-email").value.trim(), $("link-password").value);
    await linkWithCredential(auth.currentUser, credential);
    notice("Email/password is now linked to the same account.");
  });
});
onAuthStateChanged(auth, (nextUser) => attempt(() => startForSignedIn(nextUser)));
setInterval(() => {
  if (user && approved() && activeScreen !== "approvals" && activeScreen !== "settings") route();
}, 60000);

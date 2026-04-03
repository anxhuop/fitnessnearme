/* ═══════════════════════════════════════════════════
   FitnessNearMe.in — auth.js
   Auth system using localStorage (demo/prototype)
   Replace with real backend calls (Firebase / Supabase)
   for production use.
═══════════════════════════════════════════════════ */

"use strict";

// ─── STORAGE KEYS ─────────────────────────────────────────────────────────────
const KEY_USERS     = "fnm_users";
const KEY_SESSION   = "fnm_session";
const KEY_SAVED     = "fnm_saved_places";
const KEY_ACTIVITY  = "fnm_activity";

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/** Get all users from storage */
function getUsers() {
  try { return JSON.parse(localStorage.getItem(KEY_USERS) || "[]"); }
  catch { return []; }
}

/** Save all users to storage */
function saveUsers(users) {
  localStorage.setItem(KEY_USERS, JSON.stringify(users));
}

/** Get current logged-in user object (or null) */
function getCurrentUser() {
  try {
    const id = localStorage.getItem(KEY_SESSION);
    if (!id) return null;
    return getUsers().find((u) => u.id === id) || null;
  } catch { return null; }
}

/** Set session (log in) */
function setSession(userId) {
  localStorage.setItem(KEY_SESSION, userId);
}

/** Clear session (log out) */
function clearSession() {
  localStorage.removeItem(KEY_SESSION);
}

/** Update a user's data in storage */
function updateUser(updated) {
  const users = getUsers();
  const idx = users.findIndex((u) => u.id === updated.id);
  if (idx >= 0) {
    users[idx] = updated;
    saveUsers(users);
  }
}

/** Generate a simple unique ID */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Get saved places for current user */
function getSavedPlaces() {
  const user = getCurrentUser();
  if (!user) return [];
  try {
    const all = JSON.parse(localStorage.getItem(KEY_SAVED) || "{}");
    return all[user.id] || [];
  } catch { return []; }
}

/** Save a place for current user */
function savePlaceForUser(place) {
  const user = getCurrentUser();
  if (!user) return;
  const all = JSON.parse(localStorage.getItem(KEY_SAVED) || "{}");
  const existing = all[user.id] || [];
  if (!existing.find((p) => p.id === place.id)) {
    existing.push({ ...place, savedAt: new Date().toISOString() });
    all[user.id] = existing;
    localStorage.setItem(KEY_SAVED, JSON.stringify(all));
    addActivity("❤️", `Saved <strong>${place.name}</strong>`);
    // Update search count
    user.savedCount = (user.savedCount || 0) + 1;
    updateUser(user);
  }
}

/** Remove a saved place */
function unsavePlaceForUser(placeId) {
  const user = getCurrentUser();
  if (!user) return;
  const all = JSON.parse(localStorage.getItem(KEY_SAVED) || "{}");
  all[user.id] = (all[user.id] || []).filter((p) => p.id !== placeId);
  localStorage.setItem(KEY_SAVED, JSON.stringify(all));
  user.savedCount = Math.max(0, (user.savedCount || 1) - 1);
  updateUser(user);
}

/** Add an activity log entry */
function addActivity(icon, text) {
  const user = getCurrentUser();
  if (!user) return;
  const all = JSON.parse(localStorage.getItem(KEY_ACTIVITY) || "{}");
  const list = all[user.id] || [];
  list.unshift({ icon, text, time: new Date().toISOString() });
  all[user.id] = list.slice(0, 20); // Keep last 20
  localStorage.setItem(KEY_ACTIVITY, JSON.stringify(all));
}

/** Get activity for current user */
function getActivity() {
  const user = getCurrentUser();
  if (!user) return [];
  try {
    const all = JSON.parse(localStorage.getItem(KEY_ACTIVITY) || "{}");
    return all[user.id] || [];
  } catch { return []; }
}

/** Increment search count */
function bumpSearchCount() {
  const user = getCurrentUser();
  if (!user) return;
  user.searchCount = (user.searchCount || 0) + 1;
  updateUser(user);
}

/** Simple email validator */
function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

/** Format a relative time string */
function relativeTime(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── PASSWORD STRENGTH ────────────────────────────────────────────────────────
function getPasswordStrength(pw) {
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score; // 0–5
}

function renderStrength(score, fillId, labelId) {
  const fill = document.getElementById(fillId);
  const label = document.getElementById(labelId);
  if (!fill || !label) return;
  const levels = [
    { pct: 0,   color: "transparent", text: "Type a password" },
    { pct: 20,  color: "#ef4444",     text: "Very weak" },
    { pct: 40,  color: "#f97316",     text: "Weak" },
    { pct: 60,  color: "#eab308",     text: "Fair" },
    { pct: 80,  color: "#84cc16",     text: "Strong" },
    { pct: 100, color: "#c8ff00",     text: "Very strong" },
  ];
  const lvl = levels[score];
  fill.style.width = lvl.pct + "%";
  fill.style.background = lvl.color;
  label.textContent = lvl.text;
  label.style.color = lvl.color;
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg, type = "") {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.className = "show" + (type ? " toast-" + type : "");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { toast.className = ""; }, 3500);
}

// ─── TOGGLE PASSWORD VISIBILITY ───────────────────────────────────────────────
function bindPasswordToggles() {
  document.querySelectorAll(".toggle-pw").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      input.type = input.type === "password" ? "text" : "password";
      btn.textContent = input.type === "password" ? "👁" : "🙈";
    });
  });
}

// ─── REDIRECT ─────────────────────────────────────────────────────────────────
function requireAuth(redirectTo = "login.html") {
  if (!getCurrentUser()) {
    window.location.href = redirectTo;
  }
}

function redirectIfLoggedIn(redirectTo = "profile.html") {
  if (getCurrentUser()) {
    window.location.href = redirectTo;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//   LOGIN PAGE INIT
// ══════════════════════════════════════════════════════════════════════════════
function initAuthPage() {
  // Redirect if already logged in
  redirectIfLoggedIn();

  bindPasswordToggles();

  const formLogin    = document.getElementById("form-login");
  const formRegister = document.getElementById("form-register");
  const panelForgot  = document.getElementById("panel-forgot");
  const tabs         = document.querySelectorAll(".auth-tab");

  // ── Tab switching ──
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const t = tab.dataset.tab;
      formLogin.style.display    = t === "login"    ? "flex" : "none";
      formRegister.style.display = t === "register" ? "flex" : "none";
      panelForgot.style.display  = "none";
    });
  });

  // ── Switch buttons inside forms ──
  document.querySelectorAll("[data-switch]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.switch;
      formLogin.style.display    = target === "login"    ? "flex" : "none";
      formRegister.style.display = target === "register" ? "flex" : "none";
      panelForgot.style.display  = target === "forgot"   ? "flex" : "none";
      tabs.forEach((t) => {
        t.classList.toggle("active", t.dataset.tab === target);
      });
    });
  });

  // ── Forgot password link ──
  document.getElementById("forgot-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    formLogin.style.display = "none";
    panelForgot.style.display = "flex";
    tabs.forEach((t) => t.classList.remove("active"));
  });

  // ── Password strength on register ──
  document.getElementById("reg-password")?.addEventListener("input", function () {
    renderStrength(getPasswordStrength(this.value), "pw-fill", "pw-label");
  });

  // ── LOGIN SUBMIT ──
  formLogin?.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim().toLowerCase();
    const pw    = document.getElementById("login-password").value;

    // Clear errors
    document.getElementById("err-login-email").textContent = "";
    document.getElementById("err-login-password").textContent = "";

    let valid = true;
    if (!isValidEmail(email)) {
      document.getElementById("err-login-email").textContent = "Enter a valid email.";
      valid = false;
    }
    if (!pw) {
      document.getElementById("err-login-password").textContent = "Password is required.";
      valid = false;
    }
    if (!valid) return;

    setButtonLoading("btn-login", true);

    // Simulate async (replace with real API call)
    setTimeout(() => {
      const users = getUsers();
      const user  = users.find((u) => u.email === email && u.password === btoa(pw));

      setButtonLoading("btn-login", false);

      if (!user) {
        document.getElementById("err-login-password").textContent =
          "Incorrect email or password.";
        showToast("❌ Login failed. Check your credentials.", "error");
        return;
      }

      const remember = document.getElementById("remember-me")?.checked;
      if (!remember) {
        // Store session only for this tab session
        sessionStorage.setItem(KEY_SESSION, user.id);
      }
      setSession(user.id);
      addActivity("🔑", "Logged in");
      showToast("✅ Welcome back, " + user.firstName + "!", "success");
      setTimeout(() => { window.location.href = "profile.html"; }, 700);
    }, 900);
  });

  // ── REGISTER SUBMIT ──
  formRegister?.addEventListener("submit", (e) => {
    e.preventDefault();

    const fname  = document.getElementById("reg-fname").value.trim();
    const lname  = document.getElementById("reg-lname").value.trim();
    const email  = document.getElementById("reg-email").value.trim().toLowerCase();
    const phone  = document.getElementById("reg-phone").value.trim();
    const pw     = document.getElementById("reg-password").value;
    const agreed = document.getElementById("agree-terms").checked;
    const interests = [...document.querySelectorAll('.interests-grid input:checked')].map(i => i.value);

    // Clear errors
    ["err-reg-fname", "err-reg-email", "err-reg-phone", "err-reg-password", "err-terms"].forEach(
      (id) => { const el = document.getElementById(id); if (el) el.textContent = ""; }
    );

    let valid = true;
    if (!fname) {
      document.getElementById("err-reg-fname").textContent = "First name is required.";
      valid = false;
    }
    if (!isValidEmail(email)) {
      document.getElementById("err-reg-email").textContent = "Enter a valid email.";
      valid = false;
    }
    if (phone && !/^[6-9]\d{9}$/.test(phone)) {
      document.getElementById("err-reg-phone").textContent = "Enter a valid 10-digit Indian mobile number.";
      valid = false;
    }
    if (pw.length < 8) {
      document.getElementById("err-reg-password").textContent = "Password must be at least 8 characters.";
      valid = false;
    }
    if (!agreed) {
      document.getElementById("err-terms").textContent = "You must agree to the terms.";
      valid = false;
    }
    if (!valid) return;

    setButtonLoading("btn-register", true);

    setTimeout(() => {
      const users = getUsers();
      if (users.find((u) => u.email === email)) {
        document.getElementById("err-reg-email").textContent = "An account with this email already exists.";
        setButtonLoading("btn-register", false);
        return;
      }

      const newUser = {
        id:          uid(),
        firstName:   fname,
        lastName:    lname,
        email,
        phone,
        password:    btoa(pw), // NOTE: use bcrypt on a real backend!
        interests,
        joinedAt:    new Date().toISOString(),
        savedCount:  0,
        searchCount: 0,
        goal:        null,
        city:        null,
        bio:         null,
        avatar:      null,
      };
      users.push(newUser);
      saveUsers(users);
      setSession(newUser.id);
      addActivity("🎉", "Joined FitnessNearMe!");
      setButtonLoading("btn-register", false);
      showToast("🎉 Account created! Welcome, " + fname + "!", "success");
      setTimeout(() => { window.location.href = "profile.html"; }, 700);
    }, 1000);
  });

  // ── Google / Phone (placeholder) ──
  document.getElementById("btn-google")?.addEventListener("click", () => {
    showToast("🔗 Google Sign-In coming soon!", "");
  });
  document.getElementById("btn-phone")?.addEventListener("click", () => {
    showToast("📱 OTP login coming soon!", "");
  });

  // ── Forgot submit ──
  document.getElementById("btn-forgot-submit")?.addEventListener("click", () => {
    const email = document.getElementById("forgot-email").value.trim();
    if (!isValidEmail(email)) {
      showToast("Please enter a valid email address.", "error");
      return;
    }
    showToast("📧 Password reset link sent (demo)!", "success");
  });
}

// ─── LOADING STATE HELPER ─────────────────────────────────────────────────────
function setButtonLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const text   = btn.querySelector(".btn-text");
  const loader = btn.querySelector(".btn-loader");
  if (text)   text.style.display   = loading ? "none"   : "";
  if (loader) loader.style.display = loading ? "inline" : "none";
  btn.disabled = loading;
}


// ══════════════════════════════════════════════════════════════════════════════
//   PROFILE PAGE INIT
// ══════════════════════════════════════════════════════════════════════════════
function initProfilePage() {
  requireAuth("login.html");

  const user = getCurrentUser();
  if (!user) return;

  bindPasswordToggles();
  renderBanner(user);
  loadOverviewSection(user);
  loadEditSection(user);
  loadSavedSection();
  loadInterestsSection(user);
  bindSecuritySection(user);
  bindNavigation();
  bindAvatarUpload(user);
  bindLogout();
  bindModal();
}

// ─── BANNER ───────────────────────────────────────────────────────────────────
function renderBanner(user) {
  const initials = ((user.firstName?.[0] || "") + (user.lastName?.[0] || "")).toUpperCase() || "?";
  const avatarEl = document.getElementById("profile-avatar");
  if (user.avatar) {
    avatarEl.innerHTML = `<img src="${user.avatar}" alt="Avatar"/>`;
  } else {
    avatarEl.textContent = initials;
  }

  document.getElementById("banner-name").textContent =
    [user.firstName, user.lastName].filter(Boolean).join(" ");
  document.getElementById("banner-email").textContent = user.email;
  document.getElementById("bstat-saved").textContent    = user.savedCount || 0;
  document.getElementById("bstat-searches").textContent = user.searchCount || 0;
  document.getElementById("bstat-joined").textContent   =
    new Date(user.joinedAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
function bindNavigation() {
  const navItems   = document.querySelectorAll(".pnav-item[data-section]");
  const sections   = document.querySelectorAll(".psection");

  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      navItems.forEach((n) => n.classList.remove("active"));
      item.classList.add("active");
      const target = item.dataset.section;
      sections.forEach((s) => {
        const isActive = s.id === "section-" + target;
        s.style.display = isActive ? "" : "none";
        if (isActive) s.classList.add("active");
        else s.classList.remove("active");
      });
    });
  });
}

// ─── OVERVIEW ────────────────────────────────────────────────────────────────
function loadOverviewSection(user) {
  const saved = getSavedPlaces();
  const counts = { gym: 0, yoga: 0, dance: 0, zumba: 0, protein: 0, martial: 0 };
  saved.forEach((p) => { if (counts[p.cat] !== undefined) counts[p.cat]++; });

  document.getElementById("ov-gyms").textContent    = counts.gym;
  document.getElementById("ov-yoga").textContent    = counts.yoga;
  document.getElementById("ov-dance").textContent   = counts.dance + counts.zumba;
  document.getElementById("ov-protein").textContent = counts.protein;

  const actList = document.getElementById("activity-list");
  const activity = getActivity();
  if (activity.length) {
    actList.innerHTML = activity.map((a) => `
      <div class="activity-item">
        <span>${a.icon}</span>
        <span>${a.text}</span>
        <span class="activity-time">${relativeTime(a.time)}</span>
      </div>
    `).join("");
  }
}

// ─── EDIT PROFILE ─────────────────────────────────────────────────────────────
function loadEditSection(user) {
  document.getElementById("edit-fname").value = user.firstName || "";
  document.getElementById("edit-lname").value = user.lastName  || "";
  document.getElementById("edit-email").value = user.email     || "";
  document.getElementById("edit-phone").value = user.phone     || "";
  document.getElementById("edit-city").value  = user.city      || "";
  document.getElementById("edit-bio").value   = user.bio       || "";

  const bioEl = document.getElementById("edit-bio");
  const countEl = document.getElementById("bio-count");
  if (bioEl && countEl) {
    countEl.textContent = bioEl.value.length;
    bioEl.addEventListener("input", () => { countEl.textContent = bioEl.value.length; });
  }

  if (user.goal) {
    const radio = document.querySelector(`input[name="goal"][value="${user.goal}"]`);
    if (radio) radio.checked = true;
  }

  document.getElementById("form-edit-profile")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const updated = {
      ...getCurrentUser(),
      firstName: document.getElementById("edit-fname").value.trim(),
      lastName:  document.getElementById("edit-lname").value.trim(),
      email:     document.getElementById("edit-email").value.trim().toLowerCase(),
      phone:     document.getElementById("edit-phone").value.trim(),
      city:      document.getElementById("edit-city").value.trim(),
      bio:       document.getElementById("edit-bio").value.trim(),
      goal:      document.querySelector('input[name="goal"]:checked')?.value || null,
    };
    updateUser(updated);
    renderBanner(updated);
    addActivity("✏️", "Updated profile info");
    showToast("✅ Profile saved!", "success");
  });
}

// ─── SAVED PLACES ─────────────────────────────────────────────────────────────
function loadSavedSection() {
  const places  = getSavedPlaces();
  const emptyEl = document.getElementById("saved-empty");
  const gridEl  = document.getElementById("saved-grid");
  if (!places.length) {
    emptyEl.style.display = "flex";
    gridEl.style.display  = "none";
    return;
  }
  emptyEl.style.display = "none";
  gridEl.style.display  = "grid";
  gridEl.innerHTML = places.map((p) => `
    <div class="saved-card">
      <div class="saved-card-icon" style="background:${p.color}22;">${p.emoji}</div>
      <div class="saved-card-body">
        <div class="saved-card-name">${escHtml(p.name)}</div>
        <div class="saved-card-meta">
          <span class="saved-card-tag" style="background:${p.color}22;color:${p.color};">${p.label}</span>
          <span>📍 ${p.dist ? formatDist(p.dist) : "—"}</span>
        </div>
      </div>
      <button class="btn-unsave" data-id="${p.id}" title="Remove">✕</button>
    </div>
  `).join("");

  gridEl.querySelectorAll(".btn-unsave").forEach((btn) => {
    btn.addEventListener("click", () => {
      unsavePlaceForUser(btn.dataset.id);
      loadSavedSection();
      showToast("Removed from saved places.", "");
    });
  });
}

// ─── INTERESTS ────────────────────────────────────────────────────────────────
function loadInterestsSection(user) {
  const interests = user.interests || [];
  interests.forEach((cat) => {
    const input = document.querySelector(`#interests-big-grid input[value="${cat}"]`);
    if (input) input.checked = true;
  });

  document.getElementById("btn-save-interests")?.addEventListener("click", () => {
    const selected = [...document.querySelectorAll("#interests-big-grid input:checked")].map(i => i.value);
    const updated = { ...getCurrentUser(), interests: selected };
    updateUser(updated);
    addActivity("🎯", `Updated interests (${selected.length} selected)`);
    showToast("✅ Interests saved!", "success");
  });
}

// ─── SECURITY ─────────────────────────────────────────────────────────────────
function bindSecuritySection(user) {
  // Password strength on new pw field
  document.getElementById("sec-new-pw")?.addEventListener("input", function () {
    renderStrength(getPasswordStrength(this.value), "pw-fill-2", "pw-label-2");
  });

  document.getElementById("form-change-pw")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const curPw  = document.getElementById("sec-cur-pw").value;
    const newPw  = document.getElementById("sec-new-pw").value;
    const confPw = document.getElementById("sec-conf-pw").value;

    document.getElementById("err-cur-pw").textContent  = "";
    document.getElementById("err-conf-pw").textContent = "";

    const cur = getCurrentUser();
    if (btoa(curPw) !== cur.password) {
      document.getElementById("err-cur-pw").textContent = "Current password is incorrect.";
      return;
    }
    if (newPw.length < 8) {
      document.getElementById("err-conf-pw").textContent = "New password must be at least 8 characters.";
      return;
    }
    if (newPw !== confPw) {
      document.getElementById("err-conf-pw").textContent = "Passwords do not match.";
      return;
    }
    const updated = { ...cur, password: btoa(newPw) };
    updateUser(updated);
    addActivity("🔒", "Changed password");
    showToast("✅ Password updated!", "success");
    document.getElementById("form-change-pw").reset();
    renderStrength(0, "pw-fill-2", "pw-label-2");
  });

  // Delete account
  document.getElementById("btn-delete-account")?.addEventListener("click", () => {
    showConfirmModal(
      "Delete Account?",
      "This will permanently delete your account and all saved data. This cannot be undone.",
      () => {
        const users = getUsers().filter((u) => u.id !== user.id);
        saveUsers(users);
        clearSession();
        localStorage.removeItem(KEY_ACTIVITY);
        showToast("Account deleted.", "");
        setTimeout(() => { window.location.href = "index.html"; }, 800);
      }
    );
  });
}

// ─── AVATAR UPLOAD ────────────────────────────────────────────────────────────
function bindAvatarUpload(user) {
  const avatarEl = document.getElementById("profile-avatar");
  const fileInput = document.getElementById("avatar-file-input");
  const editBtn   = document.getElementById("avatar-edit-btn");

  editBtn?.addEventListener("click", () => fileInput?.click());
  avatarEl?.addEventListener("click", () => fileInput?.click());

  fileInput?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast("❌ Image too large. Max 2MB.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      avatarEl.innerHTML = `<img src="${dataUrl}" alt="Avatar"/>`;
      const updated = { ...getCurrentUser(), avatar: dataUrl };
      updateUser(updated);
      addActivity("🖼️", "Updated profile photo");
      showToast("✅ Photo updated!", "success");
    };
    reader.readAsDataURL(file);
  });
}

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
function bindLogout() {
  const doLogout = () => {
    addActivity("👋", "Logged out");
    clearSession();
    window.location.href = "index.html";
  };

  document.getElementById("btn-logout")?.addEventListener("click", doLogout);
  document.getElementById("nav-logout")?.addEventListener("click", doLogout);
}

// ─── CONFIRM MODAL ────────────────────────────────────────────────────────────
let _confirmCallback = null;

function showConfirmModal(title, desc, onConfirm) {
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-desc").textContent  = desc;
  document.getElementById("confirm-modal").style.display = "flex";
  _confirmCallback = onConfirm;
}

function bindModal() {
  document.getElementById("modal-cancel")?.addEventListener("click", () => {
    document.getElementById("confirm-modal").style.display = "none";
    _confirmCallback = null;
  });
  document.getElementById("modal-confirm")?.addEventListener("click", () => {
    document.getElementById("confirm-modal").style.display = "none";
    if (_confirmCallback) _confirmCallback();
    _confirmCallback = null;
  });
  // Close on overlay click
  document.getElementById("confirm-modal")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) {
      e.currentTarget.style.display = "none";
      _confirmCallback = null;
    }
  });
}

// ─── SHARED UTILS (also used by script.js via save button) ───────────────────
function formatDist(m) {
  return m < 1000 ? Math.round(m) + " m" : (m / 1000).toFixed(1) + " km";
}

function escHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── EXPOSE PUBLIC API (used by script.js on index page) ─────────────────────
window.FNMAuth = {
  getCurrentUser,
  savePlaceForUser,
  unsavePlaceForUser,
  getSavedPlaces,
  bumpSearchCount,
  showToast,
};

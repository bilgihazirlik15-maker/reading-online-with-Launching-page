import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ADMIN_EMAIL = "bilgi.hazirlik15@gmail.com";

function getInitial(email) {
  return email ? email.charAt(0).toUpperCase() : "?";
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function getUserRole(user) {
  if (!user || !user.email) return "student";

  const email = normalizeEmail(user.email);

  if (email === ADMIN_EMAIL) {
    return "admin";
  }

  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const data = userSnap.data();
      return String(data.role || "student").trim().toLowerCase();
    }

    return "student";

  } catch (err) {
    console.error("Role load error:", err);
    return "student";
  }
}

function getTeacherLinks() {
  return document.querySelectorAll(
    ".teacher-nav-link, a[href='teacher.html'], a[href$='/teacher.html']"
  );
}

function getAdminLinks() {
  return document.querySelectorAll(
    ".admin-nav-link, a[href='admin.html'], a[href$='/admin.html']"
  );
}

function hideRoleLinks() {
  getTeacherLinks().forEach(link => {
    link.style.setProperty("display", "none", "important");
  });

  getAdminLinks().forEach(link => {
    link.style.setProperty("display", "none", "important");
  });
}

function showTeacherLinks() {
  getTeacherLinks().forEach(link => {
    link.style.setProperty("display", "inline-flex", "important");
  });
}

function showAdminLinks() {
  getAdminLinks().forEach(link => {
    link.style.setProperty("display", "inline-flex", "important");
  });
}

function applyRoleVisibility(role) {
  hideRoleLinks();

  console.log("CURRENT USER ROLE:", role);

  if (role === "teacher") {
    showTeacherLinks();
  }

  if (role === "admin") {
    showTeacherLinks();
    showAdminLinks();
  }
}

function reapplyRoleVisibilityWhenHeaderLoads(role) {
  let attempts = 0;

  const timer = setInterval(() => {
    attempts++;

    applyRoleVisibility(role);

    const teacherLinks = getTeacherLinks();
    const adminLinks = getAdminLinks();

    if (teacherLinks.length > 0 || adminLinks.length > 0 || attempts > 25) {
      clearInterval(timer);
    }
  }, 200);
}

function createAuthModal() {
  if (document.getElementById("authModal")) return;

  const modal = document.createElement("div");
  modal.id = "authModal";

  modal.innerHTML = `
    <div class="auth-overlay">
      <div class="auth-box">
        <h2>Welcome to myReading Online</h2>
        <p>Please login or register to continue.</p>

        <div id="authMessage"></div>

        <div id="loginForm" class="auth-form">
          <input type="email" id="loginEmail" placeholder="Email">
          <input type="password" id="loginPassword" placeholder="Password">
          <button id="loginSubmit">Login</button>
        </div>

        <div id="registerForm" class="auth-form" style="display:none;">
          <input type="email" id="registerEmail" placeholder="Email">
          <input type="password" id="registerPassword" placeholder="Password">
          <button id="registerSubmit">Register</button>
        </div>

        <div id="resetForm" class="auth-form" style="display:none;">
          <input type="email" id="resetEmail" placeholder="Enter your email">
          <button id="resetSubmit">Send Reset Email</button>
        </div>

        <div class="auth-tabs">
          <button id="showLogin" style="display:none;">Back to Login</button>
          <button id="showRegister">Register</button>
          <button id="showReset">Forgotten Your Password?</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const style = document.createElement("style");
  style.innerHTML = `
    #authModal {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: none;
    }

    .auth-overlay {
      width: 100%;
      height: 100%;
      background: rgba(36, 28, 18, 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .auth-box {
      width: 100%;
      max-width: 430px;
      background: #fffaf1;
      border: 1px solid #efe2cf;
      border-radius: 24px;
      padding: 28px;
      box-shadow: 0 18px 45px rgba(60, 45, 25, 0.25);
      text-align: center;
    }

    .auth-box h2 {
      margin: 0 0 8px;
      color: #374151;
    }

    .auth-box p {
      color: #7a6f63;
      margin-bottom: 20px;
    }

    #authMessage {
      font-size: 14px;
      margin-bottom: 12px;
      color: #9b2c2c;
    }

    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .auth-form input {
      padding: 13px;
      border-radius: 14px;
      border: 1px solid #ddceb8;
      font-size: 15px;
      background: #eef4ff;
    }

    .auth-form button {
      border: none;
      padding: 12px;
      border-radius: 999px;
      background: #6b7fd7;
      color: white;
      font-weight: bold;
      cursor: pointer;
    }

    .auth-form button:hover {
      background: #5266c7;
    }

    .auth-tabs {
      margin-top: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .auth-tabs button {
      background: transparent;
      border: none;
      color: #5266c7;
      font-weight: 600;
      cursor: pointer;
      padding: 8px;
      border-radius: 999px;
    }

    .auth-tabs button:hover {
      background: #eef1ff;
    }

    .user-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: #6b7fd7;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      cursor: pointer;
    }

    .avatar-menu {
      position: fixed;
      background: #fffaf1;
      border: 1px solid #efe2cf;
      border-radius: 14px;
      padding: 10px;
      box-shadow: 0 10px 25px rgba(60,45,25,0.15);
      display: none;
      min-width: 180px;
      text-align: left;
      z-index: 99999;
    }

    .avatar-menu a {
      display: block;
      padding: 10px;
      border-radius: 8px;
      text-decoration: none;
      color: #374151;
      font-size: 14px;
    }

    .avatar-menu a:hover {
      background: #eadfce;
      color: #5266c7;
    }

    .avatar-menu button {
      width: 100%;
      border: none;
      padding: 10px;
      border-radius: 8px;
      background: transparent;
      color: #374151;
      font-size: 14px;
      text-align: left;
      cursor: pointer;
      margin-top: 4px;
    }

    .avatar-menu button:hover {
      background: #eadfce;
      color: #5266c7;
    }
  `;

  document.head.appendChild(style);
  setupModalEvents();
}

function showForm(formName) {
  const forms = ["loginForm", "registerForm", "resetForm"];

  forms.forEach(id => {
    document.getElementById(id).style.display = "none";
  });

  document.getElementById(formName).style.display = "flex";

  const showLogin = document.getElementById("showLogin");
  const showRegister = document.getElementById("showRegister");
  const showReset = document.getElementById("showReset");

  if (formName === "loginForm") {
    showLogin.style.display = "none";
    showRegister.style.display = "block";
    showReset.style.display = "block";
  } else {
    showLogin.style.display = "block";
    showRegister.style.display = "block";
    showReset.style.display = "block";
  }

  document.getElementById("authMessage").style.color = "#9b2c2c";
  document.getElementById("authMessage").innerText = "";
}

function openAuthModal() {
  createAuthModal();
  showForm("loginForm");
  document.getElementById("authModal").style.display = "block";
}

function closeAuthModal() {
  const modal = document.getElementById("authModal");
  if (modal) modal.style.display = "none";
}

function setupModalEvents() {
  document.getElementById("showLogin").onclick = () => showForm("loginForm");
  document.getElementById("showRegister").onclick = () => showForm("registerForm");
  document.getElementById("showReset").onclick = () => showForm("resetForm");

  document.getElementById("loginSubmit").onclick = async () => {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value.trim();

    try {
      await signInWithEmailAndPassword(auth, email, password);
      closeAuthModal();
    } catch (err) {
      document.getElementById("authMessage").style.color = "#9b2c2c";
      document.getElementById("authMessage").innerText = err.message;
    }
  };

  document.getElementById("registerSubmit").onclick = async () => {
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value.trim();

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      closeAuthModal();
    } catch (err) {
      document.getElementById("authMessage").style.color = "#9b2c2c";
      document.getElementById("authMessage").innerText = err.message;
    }
  };

  document.getElementById("resetSubmit").onclick = async () => {
    const email = document.getElementById("resetEmail").value.trim();

    try {
      await sendPasswordResetEmail(auth, email);
      document.getElementById("authMessage").style.color = "#2f6650";
      document.getElementById("authMessage").innerText = "Password reset email sent.";
    } catch (err) {
      document.getElementById("authMessage").style.color = "#9b2c2c";
      document.getElementById("authMessage").innerText = err.message;
    }
  };
}

function initAuthUI() {
  const authArea = document.getElementById("authArea");

  if (!authArea) {
    setTimeout(initAuthUI, 200);
    return;
  }

  createAuthModal();

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const role = await getUserRole(user);

      applyRoleVisibility(role);
      reapplyRoleVisibilityWhenHeaderLoads(role);

      closeAuthModal();

      authArea.innerHTML = `
        <div class="user-avatar" id="userAvatar">${getInitial(user.email)}</div>
      `;

      const oldMenu = document.getElementById("avatarMenu");
      if (oldMenu) oldMenu.remove();

      const avatarMenu = document.createElement("div");
      avatarMenu.id = "avatarMenu";
      avatarMenu.className = "avatar-menu";
      avatarMenu.innerHTML = `
        <a href="profile.html">Profile</a>
        <a href="feedback.html">Feedback</a>
        <a href="help.html">Help / Support</a>
        <button id="logoutBtn">Logout</button>
      `;

      document.body.appendChild(avatarMenu);

      document.getElementById("userAvatar").onclick = (event) => {
        event.stopPropagation();

        const avatar = document.getElementById("userAvatar");
        const rect = avatar.getBoundingClientRect();

        avatarMenu.style.top = rect.bottom + 10 + "px";
        avatarMenu.style.left = rect.right - 180 + "px";
        avatarMenu.style.display =
          avatarMenu.style.display === "block" ? "none" : "block";
      };

      avatarMenu.onclick = (event) => {
        event.stopPropagation();
      };

      document.addEventListener("click", () => {
        avatarMenu.style.display = "none";
      });

      document.getElementById("logoutBtn").onclick = async () => {
        await signOut(auth);
        window.location.href = "app.html";
      };

    } else {
      hideRoleLinks();

      const oldMenu = document.getElementById("avatarMenu");
      if (oldMenu) oldMenu.remove();

      authArea.innerHTML = `
        <button id="openAuthBtn" style="
          border:none;
          padding:10px 16px;
          border-radius:999px;
          background:#d8dcf8;
          color:#5266c7;
          font-weight:bold;
          cursor:pointer;
        ">Login</button>
      `;

      document.getElementById("openAuthBtn").onclick = openAuthModal;
      openAuthModal();
    }
  });
}

window.openAuthModal = openAuthModal;

initAuthUI();

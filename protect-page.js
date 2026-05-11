import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ADMIN_EMAIL = "bilgi.hazirlik15@gmail.com";

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
    console.error("Protect page role check error:", err);
    return "student";
  }
}

function getCurrentPageName() {
  const path = window.location.pathname;
  const fileName = path.split("/").pop();

  return fileName || "index.html";
}

function redirectHome() {
  window.location.href = "index.html";
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    redirectHome();
    return;
  }

  const currentPage = getCurrentPageName();
  const role = await getUserRole(user);

  if (currentPage === "admin.html" && role !== "admin") {
    redirectHome();
    return;
  }

  if (
    currentPage === "teacher.html" &&
    role !== "teacher" &&
    role !== "admin"
  ) {
    redirectHome();
    return;
  }
  document.body.style.visibility = "visible";
});

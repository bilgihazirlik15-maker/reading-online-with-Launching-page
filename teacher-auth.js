import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "app.html";
    return;
  }

  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  const userData = userSnap.exists() ? userSnap.data() : {};
  const role = userData.role || "student";

  const isAdminEmail =
    user.email &&
    user.email.toLowerCase() === "bilgi.hazirlik15@gmail.com";

  const canAccessTeacherPanel =
    role === "teacher" ||
    role === "admin" ||
    isAdminEmail;

  if (!canAccessTeacherPanel) {
    document.body.innerHTML = `
      <div style="
        min-height:100vh;
        display:flex;
        align-items:center;
        justify-content:center;
        background:#f6efe4;
        font-family:Arial, sans-serif;
        color:#374151;
        text-align:center;
        padding:30px;
      ">
        <div style="
          background:#fffaf1;
          padding:35px;
          border-radius:24px;
          border:1px solid #efe2cf;
          max-width:460px;
        ">
          <h2>Access Denied</h2>
          <p>This page is only available for teacher and admin accounts.</p>
          <a href="app.html" style="
            display:inline-block;
            margin-top:15px;
            padding:12px 18px;
            border-radius:999px;
            background:#6b7fd7;
            color:white;
            text-decoration:none;
            font-weight:bold;
          ">Back to Home</a>
        </div>
      </div>
    `;
    return;
  }

  document.getElementById("teacherContent").style.display = "block";
});

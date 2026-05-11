// admin-student-upload-v5.js
// CSV batch student upload with class dropdown selection.

import { auth, db } from "./firebase-config.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let parsedStudents = [];
let availableClasses = [];
let selectedClass = null;

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function setUploadMessage(message, type = "info") {
  const el = document.getElementById("studentUploadMessage");
  if (!el) return;

  el.textContent = message || "";

  el.style.color =
    type === "success" ? "#2f6650" :
    type === "error" ? "#9b2420" :
    "#7a6f63";
}

function injectUploadFeedbackStyles() {
  if (document.getElementById("uploadFeedbackStyles")) return;

  const style = document.createElement("style");
  style.id = "uploadFeedbackStyles";
  style.textContent = `
    .student-upload-table tr.student-row-uploaded { background: #eef8f1; }
    .student-upload-table tr.student-row-error { background: #fff0ef; }

    .student-status {
      display: inline-block;
      border-radius: 999px;
      padding: 5px 9px;
      font-size: 12px;
      font-weight: bold;
    }

    .student-status.ready {
      background: #d8dcf8;
      color: #5266c7;
    }

    .student-status.uploaded {
      background: #d6eadf;
      color: #2f6650;
    }

    .student-status.error {
      background: #f2d1cf;
      color: #7a1f1b;
    }

    .student-error-text {
      display: block;
      margin-top: 5px;
      color: #9b2420;
      font-size: 12px;
      line-height: 1.35;
    }

    .upload-feedback-overlay {
      position: fixed;
      inset: 0;
      background: rgba(55, 65, 81, 0.34);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 99999;
      padding: 20px;
    }

    .upload-feedback-popup {
      width: min(460px, 100%);
      background: #fffaf1;
      border: 1px solid #efe2cf;
      border-radius: 24px;
      box-shadow: 0 18px 42px rgba(92, 74, 52, 0.25);
      padding: 26px;
      text-align: center;
    }

    .upload-feedback-popup h2 {
      margin: 0 0 10px;
      color: #374151;
      font-size: 24px;
    }

    .upload-feedback-popup p {
      margin: 0 0 18px;
      color: #7a6f63;
      line-height: 1.5;
    }

    .upload-feedback-stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 18px;
    }

    .upload-feedback-stat {
      background: #f1eadf;
      border: 1px solid #e5d7c4;
      border-radius: 18px;
      padding: 14px;
    }

    .upload-feedback-stat strong {
      display: block;
      font-size: 26px;
      margin-bottom: 4px;
    }

    .upload-feedback-stat.success strong { color: #2f6650; }
    .upload-feedback-stat.error strong { color: #9b2420; }

    .upload-feedback-stat span {
      color: #7a6f63;
      font-size: 13px;
    }

    .upload-feedback-close {
      border: none;
      background: #6b7fd7;
      color: white;
      font-weight: bold;
      padding: 11px 20px;
      border-radius: 999px;
      cursor: pointer;
    }

    .upload-feedback-close:hover { background: #5266c7; }
  `;

  document.head.appendChild(style);
}

function showUploadFeedbackPopup(uploadedCount, errorCount) {
  injectUploadFeedbackStyles();

  const oldPopup = document.getElementById("uploadFeedbackOverlay");
  if (oldPopup) oldPopup.remove();

  const overlay = document.createElement("div");
  overlay.id = "uploadFeedbackOverlay";
  overlay.className = "upload-feedback-overlay";

  overlay.innerHTML = `
    <div class="upload-feedback-popup">
      <h2>${errorCount > 0 ? "Upload Completed with Errors" : "Upload Successful"}</h2>
      <p>${
        errorCount > 0
          ? "Some students could not be uploaded. Check the error details in the table."
          : "All student accounts were created successfully."
      }</p>

      <div class="upload-feedback-stats">
        <div class="upload-feedback-stat success">
          <strong>${uploadedCount}</strong>
          <span>Students added</span>
        </div>

        <div class="upload-feedback-stat error">
          <strong>${errorCount}</strong>
          <span>Failed rows</span>
        </div>
      </div>

      <button type="button" class="upload-feedback-close" id="uploadFeedbackCloseBtn">OK</button>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("uploadFeedbackCloseBtn").addEventListener("click", () => {
    overlay.remove();
  });

  overlay.addEventListener("click", event => {
    if (event.target === overlay) overlay.remove();
  });
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function normalizeCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/-/g, "");
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let value = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      value += '"';
      i++;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      row.push(value.trim());
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") i++;

      row.push(value.trim());

      if (row.some(cell => String(cell).trim() !== "")) {
        rows.push(row);
      }

      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  row.push(value.trim());

  if (row.some(cell => String(cell).trim() !== "")) {
    rows.push(row);
  }

  return rows;
}

function mapCSVRows(rows) {
  if (!rows || rows.length < 2) return [];

  const headers = rows[0].map(normalizeHeader);

  return rows.slice(1)
    .filter(row => row.some(cell => String(cell || "").trim() !== ""))
    .map((row, index) => {
      const item = {};

      headers.forEach((header, colIndex) => {
        item[header] = row[colIndex] || "";
      });

      return {
        rowNumber: index + 2,
        email: String(item.email || item.studentemail || "").trim(),
        password: String(item.password || item.temppassword || item.temporarypassword || "").trim(),
        name: String(item.name || item.fullname || item.studentname || "").trim(),
        csvClassCode: normalizeCode(item.classcode || item.joincode || ""),
        level: String(item.level || "").trim().toUpperCase(),
        status: "Ready",
        error: "",
        classId: "",
        classCode: "",
        className: ""
      };
    });
}

function validateStudents(students) {
  return students.map(student => {
    const errors = [];

    if (!student.email || !student.email.includes("@")) {
      errors.push("Invalid email");
    }

    if (!student.password || student.password.length < 6) {
      errors.push("Password must be at least 6 characters");
    }

    if (!student.name) {
      errors.push("Missing name");
    }

    return {
      ...student,
      status: errors.length ? "Error" : "Ready",
      error: errors.join("; ")
    };
  });
}

async function loadAvailableClasses() {
  const classSelect = document.getElementById("studentUploadClassSelect");

  if (classSelect) {
    classSelect.innerHTML = `<option value="">Loading classes...</option>`;
  }

  try {
    const snapshot = await getDocs(collection(db, "classes"));

    availableClasses = snapshot.docs.map(docSnap => {
      const data = docSnap.data();

      const rawCode =
        data.code ||
        data.classCode ||
        data.joinCode ||
        data.class_code ||
        docSnap.id;

      return {
        id: docSnap.id,
        name: data.name || data.className || data.title || "Untitled Class",
        code: normalizeCode(rawCode),
        rawCode: String(rawCode || "")
      };
    });

    if (classSelect) {
      if (availableClasses.length === 0) {
        classSelect.innerHTML = `<option value="">No classes found</option>`;
      } else {
        classSelect.innerHTML = `
          <option value="">Select a class</option>
          ${availableClasses.map(cls => `
            <option value="${escapeHtml(cls.id)}">
              ${escapeHtml(cls.name)} (${escapeHtml(cls.rawCode || cls.code)})
            </option>
          `).join("")}
        `;
      }
    }

  } catch (err) {
    console.error("Class list load error:", err);
    availableClasses = [];

    if (classSelect) {
      classSelect.innerHTML = `<option value="">Classes could not be loaded</option>`;
    }
  }
}

function getSelectedClassFromDropdown() {
  const classSelect = document.getElementById("studentUploadClassSelect");

  if (!classSelect || !classSelect.value) {
    selectedClass = null;
    return null;
  }

  selectedClass = availableClasses.find(cls => cls.id === classSelect.value) || null;
  return selectedClass;
}

function applySelectedClassToStudents() {
  const cls = getSelectedClassFromDropdown();

  parsedStudents = parsedStudents.map(student => {
    const baseErrors = [];

    if (!student.email || !student.email.includes("@")) baseErrors.push("Invalid email");
    if (!student.password || student.password.length < 6) baseErrors.push("Password must be at least 6 characters");
    if (!student.name) baseErrors.push("Missing name");

    if (baseErrors.length > 0) {
      return {
        ...student,
        status: "Error",
        error: baseErrors.join("; ")
      };
    }

    if (!cls) {
      return {
        ...student,
        classId: "",
        classCode: "",
        className: "",
        status: "Error",
        error: "Please choose a class from the dropdown"
      };
    }

    return {
      ...student,
      classId: cls.id,
      classCode: cls.rawCode || cls.code,
      className: cls.name,
      status: "Ready",
      error: ""
    };
  });

  renderPreviewTable(parsedStudents);
}

function getFriendlyAuthError(errorMessage) {
  const msg = String(errorMessage || "").toLowerCase();

  if (msg.includes("email-already-in-use")) return "Email already exists";
  if (msg.includes("invalid-email")) return "Invalid email address";
  if (msg.includes("weak-password")) return "Weak password";
  if (msg.includes("network")) return "Network error";
  if (msg.includes("permission")) return "Permission denied";

  return errorMessage || "Could not create account";
}

function renderPreviewTable(students) {
  const box = document.getElementById("studentUploadPreview");
  if (!box) return;

  if (!students || students.length === 0) {
    box.innerHTML = `
      <div class="student-upload-empty">
        No student data loaded yet.
      </div>
    `;
    return;
  }

  box.innerHTML = `
    <div class="student-upload-count">
      ${students.length} student(s) found in CSV.
    </div>

    <div class="student-upload-table-wrap">
      <table class="student-upload-table">
        <thead>
          <tr>
            <th>Row</th>
            <th>Name</th>
            <th>Email</th>
            <th>Selected Class</th>
            <th>Level</th>
            <th>Status / Details</th>
          </tr>
        </thead>

        <tbody>
          ${students.map(student => {
            const rowClass =
              student.status === "Uploaded" ? "student-row-uploaded" :
              student.status === "Error" ? "student-row-error" :
              "";

            return `
              <tr class="${rowClass}">
                <td>${escapeHtml(student.rowNumber)}</td>
                <td>${escapeHtml(student.name)}</td>
                <td>${escapeHtml(student.email)}</td>
                <td>${escapeHtml(student.className || student.classCode || "-")}</td>
                <td>${escapeHtml(student.level)}</td>
                <td>
                  <span class="student-status ${String(student.status).toLowerCase()}">
                    ${escapeHtml(student.status)}
                  </span>
                  ${student.error ? `<span class="student-error-text">${escapeHtml(student.error)}</span>` : ""}
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function handleCSVFileSelected(event) {
  const file = event.target.files && event.target.files[0];

  if (!file) return;

  if (!file.name.toLowerCase().endsWith(".csv")) {
    setUploadMessage("Please choose a CSV file.", "error");
    return;
  }

  try {
    const text = await file.text();
    const rows = parseCSV(text);

    parsedStudents = validateStudents(mapCSVRows(rows));

    applySelectedClassToStudents();

    const errorCount = parsedStudents.filter(student => student.status === "Error").length;

    if (!getSelectedClassFromDropdown()) {
      setUploadMessage("CSV loaded. Please choose a class from the dropdown.", "error");
    } else if (errorCount > 0) {
      setUploadMessage(`${errorCount} row(s) need correction before upload.`, "error");
    } else {
      setUploadMessage("CSV is ready. You can upload students now.", "success");
    }

  } catch (err) {
    console.error("CSV parse error:", err);
    setUploadMessage("CSV could not be read. Please check the file format.", "error");
  }
}

async function createStudentAccount(student) {
  const appName = "studentUploadApp_" + Date.now() + "_" + Math.random().toString(36).slice(2);
  const secondaryApp = initializeApp(auth.app.options, appName);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      student.email,
      student.password
    );

    const studentUser = credential.user;

    if (student.name) {
      await updateProfile(studentUser, {
        displayName: student.name
      });
    }

    await setDoc(doc(db, "users", studentUser.uid), {
      uid: studentUser.uid,
      email: student.email,
      name: student.name,
      displayName: student.name,
      role: "student",
      level: student.level || "",
      classId: student.classId || "",
      classCode: student.classCode || "",
      className: student.className || "",
      importedBy: auth.currentUser ? auth.currentUser.uid : "",
      importedAt: serverTimestamp(),
      mustChangePassword: true
    }, { merge: true });

    await signOut(secondaryAuth);

    return {
      ...student,
      uid: studentUser.uid,
      status: "Uploaded",
      error: ""
    };

  } catch (err) {
    console.error("Student account create error:", student.email, err);

    return {
      ...student,
      status: "Error",
      error: getFriendlyAuthError(err.message)
    };

  } finally {
    await deleteApp(secondaryApp);
  }
}

async function uploadStudentsFromCSV() {
  if (!parsedStudents || parsedStudents.length === 0) {
    setUploadMessage("Please choose a CSV file first.", "error");
    return;
  }

  applySelectedClassToStudents();

  const readyStudents = parsedStudents.filter(student => student.status === "Ready");

  if (!getSelectedClassFromDropdown()) {
    setUploadMessage("Please choose a class before uploading students.", "error");
    return;
  }

  if (readyStudents.length === 0) {
    setUploadMessage("There are no valid students to upload.", "error");
    renderPreviewTable(parsedStudents);
    return;
  }

  const uploadButton = document.getElementById("studentUploadButton");

  if (uploadButton) {
    uploadButton.disabled = true;
    uploadButton.textContent = "Uploading...";
  }

  setUploadMessage("Uploading students. Please do not close this page.", "info");

  const results = [];

  for (const student of parsedStudents) {
    if (student.status !== "Ready") {
      results.push(student);
      continue;
    }

    const result = await createStudentAccount(student);
    results.push(result);

    parsedStudents = results.concat(parsedStudents.slice(results.length));
    renderPreviewTable(parsedStudents);
  }

  parsedStudents = results;
  renderPreviewTable(parsedStudents);

  const uploadedCount = results.filter(student => student.status === "Uploaded").length;
  const errorCount = results.filter(student => student.status === "Error").length;

  if (uploadButton) {
    uploadButton.disabled = false;
    uploadButton.textContent = "Upload Students";
  }

  if (errorCount > 0) {
    setUploadMessage(`${uploadedCount} uploaded, ${errorCount} failed. Check the table.`, "error");
  } else {
    setUploadMessage(`${uploadedCount} student account(s) uploaded successfully.`, "success");
  }

  showUploadFeedbackPopup(uploadedCount, errorCount);
}

function downloadStudentCSVTemplate() {
  const csvContent =
`email,password,name,classCode,level
ayse.student@example.com,Temp1234,Ayse Yilmaz,,A2
mehmet.student@example.com,Temp1234,Mehmet Demir,,A2
elif.student@example.com,Temp1234,Elif Kaya,,B1
`;

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "student-upload-template.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function initializeStudentBatchUpload() {
  injectUploadFeedbackStyles();

  const fileInput = document.getElementById("studentCSVInput");
  const uploadButton = document.getElementById("studentUploadButton");
  const templateButton = document.getElementById("studentTemplateButton");
  const classSelect = document.getElementById("studentUploadClassSelect");

  if (fileInput) {
    fileInput.addEventListener("change", handleCSVFileSelected);
  }

  if (uploadButton) {
    uploadButton.addEventListener("click", uploadStudentsFromCSV);
  }

  if (templateButton) {
    templateButton.addEventListener("click", downloadStudentCSVTemplate);
  }

  if (classSelect) {
    classSelect.addEventListener("change", function() {
      applySelectedClassToStudents();

      if (parsedStudents.length > 0) {
        const errorCount = parsedStudents.filter(student => student.status === "Error").length;

        if (errorCount > 0) {
          setUploadMessage(`${errorCount} row(s) need correction before upload.`, "error");
        } else {
          setUploadMessage("Class selected. CSV is ready to upload.", "success");
        }
      }
    });
  }

  loadAvailableClasses();
  renderPreviewTable([]);
}

window.uploadStudentsFromCSV = uploadStudentsFromCSV;
window.downloadStudentCSVTemplate = downloadStudentCSVTemplate;

initializeStudentBatchUpload();

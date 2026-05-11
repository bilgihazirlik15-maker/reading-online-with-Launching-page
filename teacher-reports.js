import { auth, db } from "./firebase-config.js";

import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let reportSchools = [];
let reportClasses = [];

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function safeText(value) {
  return String(value === undefined || value === null ? "" : value);
}

function setReportMessage(message, type = "info") {
  const box = document.getElementById("reportMessage");
  if (!box) return;

  box.textContent = message || "";

  if (type === "success") {
    box.style.color = "#2f6650";
  } else if (type === "error") {
    box.style.color = "#9b2420";
  } else {
    box.style.color = "#7a6f63";
  }
}

function getCurrentUser() {
  return new Promise(resolve => {
    if (auth.currentUser) {
      resolve(auth.currentUser);
      return;
    }

    const timeout = setTimeout(() => {
      resolve(null);
    }, 4000);

    const unsubscribe = auth.onAuthStateChanged(user => {
      clearTimeout(timeout);
      unsubscribe();
      resolve(user);
    });
  });
}

function isAdminUser(user) {
  return (
    user &&
    user.email &&
    user.email.toLowerCase() === "bilgi.hazirlik15@gmail.com"
  );
}

function isTeacherClass(data, user) {
  if (!data || !user) return false;

  if (isAdminUser(user)) return true;

  const uid = String(user.uid || "");
  const email = String(user.email || "").toLowerCase();

  const possibleUidFields = [
    data.teacherId,
    data.teacherUid,
    data.createdBy,
    data.ownerId,
    data.uid,
    data.userId
  ].map(value => String(value || ""));

  const possibleEmailFields = [
    data.teacherEmail,
    data.createdByEmail,
    data.ownerEmail,
    data.email
  ].map(value => String(value || "").toLowerCase());

  return (
    possibleUidFields.includes(uid) ||
    possibleEmailFields.includes(email)
  );
}

async function loadReportSchools() {
  const schoolSelect = document.getElementById("reportSchoolSelect");
  if (!schoolSelect) return;

  try {
    schoolSelect.innerHTML = `<option value="">Loading schools...</option>`;

    const snapshot = await getDocs(collection(db, "schools"));

    reportSchools = snapshot.docs.map(docSnap => {
      const data = docSnap.data();

      return {
        id: docSnap.id,
        schoolName:
          data.schoolName ||
          data.name ||
          data.title ||
          "Unnamed School"
      };
    });

    reportSchools.sort((a, b) =>
      String(a.schoolName || "").localeCompare(String(b.schoolName || ""))
    );

    if (reportSchools.length === 0) {
      schoolSelect.innerHTML = `<option value="">No schools found</option>`;
      return;
    }

    schoolSelect.innerHTML = `
      <option value="">Choose School</option>
      ${reportSchools.map(school => `
        <option value="${escapeHtml(school.id)}">
          ${escapeHtml(school.schoolName)}
        </option>
      `).join("")}
    `;

  } catch (err) {
    console.error("Report schools load error:", err);
    schoolSelect.innerHTML = `<option value="">Schools could not be loaded</option>`;
    setReportMessage("Schools could not be loaded.", "error");
  }
}

async function loadReportClasses() {
  const schoolSelect = document.getElementById("reportSchoolSelect");
  const classSelect = document.getElementById("reportClassSelect");

  if (!schoolSelect || !classSelect) return;

  const selectedSchoolId = schoolSelect.value;

  if (!selectedSchoolId) {
    classSelect.innerHTML = `<option value="">Choose a school first</option>`;
    setReportMessage("", "info");
    return;
  }

  classSelect.innerHTML = `<option value="">Loading classes...</option>`;
  setReportMessage("", "info");

  try {
    const user = await getCurrentUser();

    if (!user) {
      classSelect.innerHTML = `<option value="">Please log in first</option>`;
      setReportMessage("Please log in first.", "error");
      return;
    }

    const snapshot = await getDocs(collection(db, "classes"));

    reportClasses = snapshot.docs
      .map(docSnap => {
        const data = docSnap.data();

        return {
          id: docSnap.id,
          raw: data,
          className:
            data.className ||
            data.name ||
            data.title ||
            "Untitled Class",
          classCode:
            data.classCode ||
            data.code ||
            data.joinCode ||
            docSnap.id,
          schoolId:
            data.schoolId || "",
          schoolName:
            data.schoolName ||
            data.school ||
            "",
          teacherEmail:
            data.teacherEmail ||
            data.createdByEmail ||
            data.ownerEmail ||
            ""
        };
      })
      .filter(cls => String(cls.schoolId || "") === String(selectedSchoolId))
      .filter(cls => isTeacherClass(cls.raw, user));

    reportClasses.sort((a, b) =>
      String(a.className || "").localeCompare(String(b.className || ""))
    );

    if (reportClasses.length === 0) {
      classSelect.innerHTML = `<option value="">No classes found for this school</option>`;
      return;
    }

    classSelect.innerHTML = `
      <option value="ALL_CLASSES">All Classes in This School</option>
      ${reportClasses.map(cls => `
        <option value="${escapeHtml(cls.id)}">
          ${escapeHtml(cls.className)} (${escapeHtml(cls.classCode)})
        </option>
      `).join("")}
    `;

  } catch (err) {
    console.error("Report classes load error:", err);
    classSelect.innerHTML = `<option value="">Classes could not be loaded</option>`;
    setReportMessage("Classes could not be loaded.", "error");
  }
}

async function getStudentsForClass(classId) {
  const snapshot = await getDocs(collection(db, "users"));

  return snapshot.docs
    .map(docSnap => {
      const data = docSnap.data();

      return {
        id: docSnap.id,
        email: data.email || "",
        name: data.name || data.displayName || "",
        level: data.level || "",
        classId: data.classId || "",
        classCode: data.classCode || "",
        raw: data
      };
    })
    .filter(student => String(student.classId || "") === String(classId));
}

async function getAssignedActivitiesForClass(classId) {
  const snapshot = await getDocs(
    collection(db, "classes", classId, "assignedActivities")
  );

  return snapshot.docs.map(docSnap => {
    const data = docSnap.data();

    return {
      id: data.id || data.activityId || docSnap.id,
      activityId: data.activityId || data.id || docSnap.id,
      title: data.title || "Untitled Activity",
      level: data.level || "",
      words: data.words || "",
      raw: data
    };
  });
}

async function getCompletedActivitiesForStudent(studentId) {
  const snapshot = await getDocs(
    collection(db, "users", studentId, "completedActivities")
  );

  return snapshot.docs.map(docSnap => {
    const data = docSnap.data();

    return {
      docId: docSnap.id,
      id: data.id || data.activityId || docSnap.id,
      activityId: data.activityId || data.id || docSnap.id,
      title: data.title || "",
      level: data.level || "",
      score: data.score,
      total: data.total || data.totalQuestions,
      date: data.date || data.completedAt || "",
      raw: data
    };
  });
}

function findCompletedActivity(assigned, completedList) {
  return completedList.find(done => {
    const doneId = String(done.id || done.activityId || "");
    const assignedId = String(assigned.id || assigned.activityId || "");

    if (doneId && assignedId && doneId === assignedId) return true;

    const doneTitle = String(done.title || "").trim().toLowerCase();
    const assignedTitle = String(assigned.title || "").trim().toLowerCase();

    return doneTitle && assignedTitle && doneTitle === assignedTitle;
  });
}

async function buildReportRows(selectedClasses) {
  const rows = [];

  for (const cls of selectedClasses) {
    const students = await getStudentsForClass(cls.id);
    const assignedActivities = await getAssignedActivitiesForClass(cls.id);

    if (assignedActivities.length === 0) {
      rows.push({
        school: cls.schoolName,
        className: cls.className,
        classCode: cls.classCode,
        studentEmail: "",
        studentName: "",
        activityTitle: "No assigned activities",
        activityLevel: "",
        score: "",
        total: "",
        percent: "",
        status: "No Assignment",
        completedDate: ""
      });

      continue;
    }

    if (students.length === 0) {
      assignedActivities.forEach(activity => {
        rows.push({
          school: cls.schoolName,
          className: cls.className,
          classCode: cls.classCode,
          studentEmail: "",
          studentName: "",
          activityTitle: activity.title,
          activityLevel: activity.level,
          score: "",
          total: "",
          percent: "",
          status: "No Student",
          completedDate: ""
        });
      });

      continue;
    }

    for (const student of students) {
      const completedList = await getCompletedActivitiesForStudent(student.id);

      assignedActivities.forEach(activity => {
        const completed = findCompletedActivity(activity, completedList);

        if (completed) {
          const score = Number(completed.score || 0);
          const total = Number(completed.total || 0);
          const percent = total > 0 ? Math.round((score / total) * 100) + "%" : "";

          rows.push({
            school: cls.schoolName,
            className: cls.className,
            classCode: cls.classCode,
            studentEmail: student.email,
            studentName: student.name,
            activityTitle: activity.title,
            activityLevel: activity.level || completed.level,
            score,
            total,
            percent,
            status: "Completed",
            completedDate: completed.date
          });

        } else {
          rows.push({
            school: cls.schoolName,
            className: cls.className,
            classCode: cls.classCode,
            studentEmail: student.email,
            studentName: student.name,
            activityTitle: activity.title,
            activityLevel: activity.level,
            score: "",
            total: "",
            percent: "",
            status: "Missing",
            completedDate: ""
          });
        }
      });
    }
  }

  return rows;
}

function makeFileName(schoolName, className) {
  const clean = text =>
    String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const date = new Date().toISOString().slice(0, 10);

  return `reading-report-${clean(schoolName)}-${clean(className)}-${date}.xls`;
}

function exportRowsToExcel(rows, fileName) {
  const headers = [
    "School",
    "Class Name",
    "Class Code",
    "Student Email",
    "Student Name",
    "Activity Title",
    "Activity Level",
    "Score",
    "Total",
    "Percentage",
    "Status",
    "Completed Date"
  ];

  const html = `
    <html>
    <head>
      <meta charset="UTF-8">
    </head>
    <body>
      <table border="1">
        <thead>
          <tr>
            ${headers.map(h => `<th>${escapeHtml(h)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td>${escapeHtml(row.school)}</td>
              <td>${escapeHtml(row.className)}</td>
              <td>${escapeHtml(row.classCode)}</td>
              <td>${escapeHtml(row.studentEmail)}</td>
              <td>${escapeHtml(row.studentName)}</td>
              <td>${escapeHtml(row.activityTitle)}</td>
              <td>${escapeHtml(row.activityLevel)}</td>
              <td>${escapeHtml(row.score)}</td>
              <td>${escapeHtml(row.total)}</td>
              <td>${escapeHtml(row.percent)}</td>
              <td>${escapeHtml(row.status)}</td>
              <td>${escapeHtml(row.completedDate)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob(["\ufeff" + html], {
    type: "application/vnd.ms-excel;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function generateExcelReport() {
  const schoolSelect = document.getElementById("reportSchoolSelect");
  const classSelect = document.getElementById("reportClassSelect");

  if (!schoolSelect || !classSelect) return;

  const schoolId = schoolSelect.value;
  const classId = classSelect.value;

  if (!schoolId) {
    setReportMessage("Please choose a school first.", "error");
    return;
  }

  if (!classId) {
    setReportMessage("Please choose a class or All Classes.", "error");
    return;
  }

  try {
    setReportMessage("Preparing report...", "info");

    const selectedSchool =
      reportSchools.find(school => String(school.id) === String(schoolId));

    const selectedClasses =
      classId === "ALL_CLASSES"
        ? reportClasses
        : reportClasses.filter(cls => String(cls.id) === String(classId));

    if (selectedClasses.length === 0) {
      setReportMessage("No classes found for this report.", "error");
      return;
    }

    const rows = await buildReportRows(selectedClasses);

    if (rows.length === 0) {
      setReportMessage("No report data found.", "error");
      return;
    }

    const classNameForFile =
      classId === "ALL_CLASSES"
        ? "all-classes"
        : selectedClasses[0].className;

    const fileName = makeFileName(
      selectedSchool ? selectedSchool.schoolName : "school",
      classNameForFile
    );

    exportRowsToExcel(rows, fileName);

    setReportMessage("Excel report downloaded successfully.", "success");

  } catch (err) {
    console.error("Generate report error:", err);
    setReportMessage("Report could not be generated.", "error");
  }
}

function bindReportEvents() {
  const schoolSelect = document.getElementById("reportSchoolSelect");

  if (schoolSelect) {
    schoolSelect.addEventListener("change", loadReportClasses);
  }
}

async function initializeReports() {
  bindReportEvents();
  await loadReportSchools();
}

window.generateExcelReport = generateExcelReport;

initializeReports();

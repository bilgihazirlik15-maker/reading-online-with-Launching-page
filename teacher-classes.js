import { auth, db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  deleteField,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---------- UTIL ---------- */

function generateClassCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function waitForUser() {
  return new Promise((resolve) => {
    if (auth.currentUser) return resolve(auth.currentUser);

    const unsub = auth.onAuthStateChanged((user) => {
      unsub();
      resolve(user);
    });
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

const teacherActionButtonStyle = `
  display:inline-flex;
  align-items:center;
  justify-content:center;
  text-align:center;
  text-decoration:none;
  min-height:38px;
  border:none;
  padding:8px 14px;
  border-radius:999px;
  background:#6b7fd7;
  color:white;
  font-weight:bold;
  cursor:pointer;
  font-size:14px;
  line-height:1;
`;

const teacherDeleteButtonStyle = `
  display:inline-flex;
  align-items:center;
  justify-content:center;
  text-align:center;
  text-decoration:none;
  min-height:38px;
  border:none;
  padding:8px 14px;
  border-radius:999px;
  background:#f3c7c7;
  color:#7a1f1f;
  font-weight:bold;
  cursor:pointer;
  font-size:14px;
  line-height:1;
`;

/* ---------- LOAD SCHOOLS ---------- */

async function loadSchools() {
  const schoolSelect = document.getElementById("schoolSelect");

  if (!schoolSelect) return;

  try {
    schoolSelect.innerHTML = `<option value="">Loading schools...</option>`;

    const snapshot = await getDocs(collection(db, "schools"));

    if (snapshot.empty) {
      schoolSelect.innerHTML = `<option value="">No schools added yet</option>`;
      return;
    }

    const schools = snapshot.docs.map(docSnap => {
      const data = docSnap.data();

      return {
        id: docSnap.id,
        schoolName: data.schoolName || data.name || data.title || "Unnamed School"
      };
    });

    schools.sort((a, b) =>
      String(a.schoolName || "").localeCompare(String(b.schoolName || ""))
    );

    schoolSelect.innerHTML = `
      <option value="">Choose School</option>
      ${schools.map(school => `
        <option
          value="${escapeHtml(school.id)}"
          data-school-name="${escapeHtml(school.schoolName || "")}"
        >
          ${escapeHtml(school.schoolName || "Unnamed School")}
        </option>
      `).join("")}
    `;

  } catch (err) {
    console.error("Load schools error:", err);
    schoolSelect.innerHTML = `<option value="">Schools could not be loaded</option>`;
  }
}

/* ---------- CREATE CLASS ---------- */

window.createClass = async function () {
  const user = await waitForUser();

  if (!user) {
    alert("Please login first.");
    return;
  }

  const input = document.getElementById("classNameInput");
  const message = document.getElementById("classMessage");
  const schoolSelect = document.getElementById("schoolSelect");

  const className = input.value.trim();

  let schoolId = "";
  let schoolName = "";

  if (schoolSelect) {
    schoolId = schoolSelect.value;
    const selectedOption = schoolSelect.options[schoolSelect.selectedIndex];
    schoolName = selectedOption?.dataset?.schoolName || selectedOption?.textContent?.trim() || "";
  }

  if (!schoolId) {
    message.style.color = "#9b2c2c";
    message.innerText = "Please choose a school.";
    return;
  }

  if (!className) {
    message.style.color = "#9b2c2c";
    message.innerText = "Please enter a class name.";
    return;
  }

  const classCode = generateClassCode();

  await addDoc(collection(db, "classes"), {
    className,
    classCode,
    schoolId,
    schoolName,
    teacherId: user.uid,
    teacherEmail: user.email,
    createdAt: serverTimestamp()
  });

  input.value = "";
  message.style.color = "#2f6650";
  message.innerText = "Class created successfully.";

  window.loadTeacherClasses();
};

/* ---------- STUDENT COUNT ---------- */

async function getStudentCount(classId) {
  try {
    const studentQuery = query(
      collection(db, "users"),
      where("classId", "==", classId)
    );

    const snapshot = await getDocs(studentQuery);
    return snapshot.size;

  } catch (err) {
    console.error("Get student count error:", err);
    return 0;
  }
}

/* ---------- CLASS ANALYTICS ---------- */

async function getClassAnalytics(classId) {
  const defaultAnalytics = {
    averagePercent: 0,
    completedCount: 0,
    assignedCount: 0,
    topStudentEmail: "-"
  };

  try {
    const studentQuery = query(
      collection(db, "users"),
      where("classId", "==", classId)
    );

    const studentSnapshot = await getDocs(studentQuery);

    let assignedCount = 0;

    try {
      const assignedSnapshot = await getDocs(
        collection(db, "classes", classId, "assignedActivities")
      );

      assignedCount = assignedSnapshot.size;

    } catch (assignedErr) {
      console.error("Assigned activities analytics error:", assignedErr);
      assignedCount = 0;
    }

    let totalScore = 0;
    let totalQuestions = 0;
    let completedCount = 0;

    let topStudentEmail = "-";
    let topStudentAverage = -1;

    for (const studentDoc of studentSnapshot.docs) {
      const studentId = studentDoc.id;
      const studentData = studentDoc.data();

      let completedSnapshot = null;

      try {
        completedSnapshot = await getDocs(
          collection(db, "users", studentId, "completedActivities")
        );
      } catch (completedErr) {
        console.error("Completed activities analytics error:", completedErr);
        continue;
      }

      let studentScore = 0;
      let studentTotal = 0;

      completedSnapshot.forEach(activityDoc => {
        const activity = activityDoc.data();

        const score = Number(activity.score || 0);
        const total = Number(activity.total || activity.totalQuestions || 0);

        studentScore += score;
        studentTotal += total;

        totalScore += score;
        totalQuestions += total;
        completedCount++;
      });

      if (studentTotal > 0) {
        const studentAverage = studentScore / studentTotal;

        if (studentAverage > topStudentAverage) {
          topStudentAverage = studentAverage;
          topStudentEmail =
            studentData.email ||
            studentData.name ||
            studentData.displayName ||
            "Student";
        }
      }
    }

    const averagePercent =
      totalQuestions > 0
        ? Math.round((totalScore / totalQuestions) * 100)
        : 0;

    return {
      averagePercent,
      completedCount,
      assignedCount,
      topStudentEmail
    };

  } catch (err) {
    console.error("Class analytics error:", err);
    return defaultAnalytics;
  }
}

/* ---------- DELETE ASSIGNMENTS ---------- */

window.deleteAssignments = async function (classId) {
  const confirmDelete = confirm(
    "Delete all assigned activities for this class? Students will no longer see these assignments."
  );

  if (!confirmDelete) return;

  try {
    const assignedSnapshot = await getDocs(
      collection(db, "classes", classId, "assignedActivities")
    );

    if (assignedSnapshot.empty) {
      alert("There are no assignments to delete.");
      return;
    }

    const deletePromises = assignedSnapshot.docs.map(docSnap =>
      deleteDoc(doc(db, "classes", classId, "assignedActivities", docSnap.id))
    );

    await Promise.all(deletePromises);

    alert("Assignments deleted successfully.");
    await window.loadTeacherClasses();

  } catch (err) {
    console.error("Delete assignments error:", err);
    alert("Assignments could not be deleted.");
  }
};

/* ---------- LOAD STUDENT PROGRESS ---------- */

async function loadStudentProgress(studentId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `<p style="color:#7a6f63;">Loading progress...</p>`;

  try {
    const completedSnapshot = await getDocs(
      collection(db, "users", studentId, "completedActivities")
    );

    const progressSnapshot = await getDocs(
      collection(db, "users", studentId, "activitiesInProgress")
    );

    let html = "";

    if (completedSnapshot.empty) {
      html += `<p style="color:#7a6f63;">No completed activities.</p>`;
    } else {
      html += `<strong style="display:block; margin-top:8px;">Completed Activities</strong>`;

      html += completedSnapshot.docs.map(docSnap => {
        const item = docSnap.data();

        return `
          <div style="
            margin-top:6px;
            padding:10px;
            background:#f9f6f1;
            border:1px solid #e5d7c4;
            border-radius:10px;
            font-size:13px;
          ">
            📘 <strong>${escapeHtml(item.title || "Untitled Activity")}</strong><br>
            <span>${escapeHtml(item.level || "")} Level</span><br>
            Score: <b>${escapeHtml(item.score)}/${escapeHtml(item.total)}</b><br>
            <span style="color:#7a6f63;">${escapeHtml(item.date || "")}</span>
          </div>
        `;
      }).join("");
    }

    if (!progressSnapshot.empty) {
      html += `<strong style="display:block; margin-top:12px;">Activities in Progress</strong>`;

      html += progressSnapshot.docs.map(docSnap => {
        const item = docSnap.data();

        return `
          <div style="
            margin-top:6px;
            padding:10px;
            background:#fffaf1;
            border:1px solid #e5d7c4;
            border-radius:10px;
            font-size:13px;
          ">
            ⏳ <strong>${escapeHtml(item.title || "Untitled Activity")}</strong><br>
            <span>${escapeHtml(item.level || "")} Level</span><br>
            <span style="color:#7a6f63;">Started: ${escapeHtml(item.date || "")}</span>
          </div>
        `;
      }).join("");
    }

    container.innerHTML = html;

  } catch (err) {
    console.error("Load student progress error:", err);
    container.innerHTML = `<p style="color:#9b2c2c;">Error loading progress.</p>`;
  }
}

/* ---------- TOGGLE PROGRESS ---------- */

window.toggleProgress = async function (studentId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (container.dataset.loaded === "true") {
    container.innerHTML = "";
    container.dataset.loaded = "false";
    return;
  }

  await loadStudentProgress(studentId, containerId);
  container.dataset.loaded = "true";
};

/* ---------- LOAD STUDENTS ---------- */

async function loadStudents(classId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let snapshot = null;

  try {
    const q = query(
      collection(db, "users"),
      where("classId", "==", classId)
    );

    snapshot = await getDocs(q);

  } catch (err) {
    console.error("Load students query error:", err);
    container.innerHTML = `<p style="color:#9b2c2c;">Students could not be loaded.</p>`;
    return;
  }

  if (snapshot.empty) {
    container.innerHTML = `<p style="color:#7a6f63;">No students yet.</p>`;
    return;
  }

  container.innerHTML = snapshot.docs.map(docSnap => {
    const s = docSnap.data();
    const studentId = docSnap.id;
    const progressId = "progress-" + studentId;

    return `
      <div style="
        padding:10px;
        margin-top:8px;
        background:#fffaf1;
        border:1px solid #e5d7c4;
        border-radius:10px;
        font-size:14px;
      ">
        <div style="
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
        ">
          <span>👤 ${escapeHtml(s.email || "Student")}</span>

          <div style="
            display:flex;
            align-items:center;
            justify-content:center;
            gap:6px;
          ">
            <button
              type="button"
              onclick="toggleProgress('${studentId}', '${progressId}')"
              style="
                display:inline-flex;
                align-items:center;
                justify-content:center;
                border:none;
                padding:6px 10px;
                border-radius:999px;
                background:#d6eadf;
                color:#2f6650;
                font-weight:bold;
                cursor:pointer;
                font-size:12px;
              "
            >
              Progress
            </button>

            <button
              type="button"
              onclick="removeStudentFromClass('${studentId}', '${classId}', '${containerId}')"
              style="
                display:inline-flex;
                align-items:center;
                justify-content:center;
                border:none;
                padding:6px 10px;
                border-radius:999px;
                background:#f3c7c7;
                color:#7a1f1f;
                font-weight:bold;
                cursor:pointer;
                font-size:12px;
              "
            >
              Remove
            </button>
          </div>
        </div>

        <div id="${progressId}" style="margin-top:8px;"></div>
      </div>
    `;
  }).join("");
}

/* ---------- TOGGLE STUDENTS ---------- */

window.toggleStudents = async function (classId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (container.dataset.loaded === "true") {
    container.innerHTML = "";
    container.dataset.loaded = "false";
    return;
  }

  container.innerHTML = `<p style="color:#7a6f63;">Loading students...</p>`;

  await loadStudents(classId, containerId);
  container.dataset.loaded = "true";
};

/* ---------- REMOVE STUDENT ---------- */

window.removeStudentFromClass = async function (studentId, classId, containerId) {
  const confirmRemove = confirm("Remove this student from the class?");
  if (!confirmRemove) return;

  try {
    await updateDoc(doc(db, "users", studentId), {
      classId: deleteField(),
      classCode: deleteField(),
      className: deleteField()
    });

    await loadStudents(classId, containerId);
    await window.loadTeacherClasses();

  } catch (err) {
    console.error("Remove student error:", err);
    alert("Student could not be removed.");
  }
};

/* ---------- LOAD TEACHER CLASSES ---------- */

window.loadTeacherClasses = async function () {
  const user = await waitForUser();

  const list = document.getElementById("classList");

  if (!list) return;

  if (!user) {
    list.innerHTML = `<p style="color:#9b2c2c;">Please login first.</p>`;
    return;
  }

  list.innerHTML = `<p style="color:#7a6f63;">Loading classes...</p>`;

  try {
    const snapshot = await getDocs(collection(db, "classes"));

    const teacherClassDocs = snapshot.docs.filter(docSnap => {
      const data = docSnap.data();

      const teacherUidFields = [
        data.teacherId,
        data.teacherUid,
        data.createdBy,
        data.ownerId
      ].map(value => String(value || ""));

      const teacherEmailFields = [
        data.teacherEmail,
        data.createdByEmail,
        data.ownerEmail
      ].map(value => String(value || "").toLowerCase());

      return (
        teacherUidFields.includes(String(user.uid)) ||
        teacherEmailFields.includes(String(user.email || "").toLowerCase())
      );
    });

    if (teacherClassDocs.length === 0) {
      list.innerHTML = `<p style="color:#7a6f63;">No classes created yet.</p>`;
      return;
    }

    const classCards = await Promise.all(
      teacherClassDocs.map(async (docSnap) => {
        const item = docSnap.data();
        const classId = docSnap.id;
        const studentsContainerId = "students-" + classId;
        const studentCount = await getStudentCount(classId);
        const analytics = await getClassAnalytics(classId);

        const displaySchoolName =
          item.schoolName ||
          item.name ||
          item.school ||
          "No school selected";

        const assignUrl =
          "assign-activity.html?classId=" +
          encodeURIComponent(classId) +
          "&className=" +
          encodeURIComponent(item.className || item.name || "Class");

        const statusUrl =
          "assignment-status.html?classId=" +
          encodeURIComponent(classId) +
          "&className=" +
          encodeURIComponent(item.className || item.name || "Class");

        return `
          <div style="
            margin-top:14px;
            padding:14px;
            background:#f1eadf;
            border:1px solid #e5d7c4;
            border-radius:14px;
            text-align:left;
          ">
            <strong>${escapeHtml(item.className || item.name || "Untitled Class")}</strong><br>
            <span>School: <b>${escapeHtml(displaySchoolName)}</b></span><br>
            <span>Class Code: <b>${escapeHtml(item.classCode || item.code || docSnap.id)}</b></span><br>
            <span>Students: <b>${studentCount}</b></span><br>

            <div style="
              margin-top:10px;
              padding:12px;
              background:#fffaf1;
              border:1px solid #e5d7c4;
              border-radius:14px;
            ">
              <strong style="display:block; margin-bottom:10px;">Class Analytics</strong>

              <div style="
                display:grid;
                grid-template-columns:repeat(2, 1fr);
                gap:10px;
              ">
                <div style="
                  background:#f1eadf;
                  border-radius:12px;
                  padding:10px;
                  text-align:center;
                ">
                  <div style="font-size:12px; color:#7a6f63;">Average Score</div>
                  <b style="font-size:20px;">${analytics.averagePercent}%</b>
                </div>

                <div style="
                  background:#f1eadf;
                  border-radius:12px;
                  padding:10px;
                  text-align:center;
                ">
                  <div style="font-size:12px; color:#7a6f63;">Completed</div>
                  <b style="font-size:20px;">${analytics.completedCount}</b>
                </div>

                <div style="
                  background:#f1eadf;
                  border-radius:12px;
                  padding:10px;
                  text-align:center;
                ">
                  <div style="font-size:12px; color:#7a6f63;">Assigned</div>
                  <b style="font-size:20px;">${analytics.assignedCount}</b>
                </div>

                <div style="
                  background:#f1eadf;
                  border-radius:12px;
                  padding:10px;
                  text-align:center;
                ">
                  <div style="font-size:12px; color:#7a6f63;">Top Student</div>
                  <b style="font-size:13px;">${escapeHtml(analytics.topStudentEmail)}</b>
                </div>
              </div>
            </div>

            <div style="
              display:flex;
              align-items:center;
              justify-content:center;
              gap:8px;
              flex-wrap:wrap;
              margin-top:12px;
            ">
              <button
                type="button"
                onclick="toggleStudents('${classId}', '${studentsContainerId}')"
                style="${teacherActionButtonStyle}"
              >
                View Students
              </button>

              <a
                href="${assignUrl}"
                style="${teacherActionButtonStyle}"
              >
                Assign Activity
              </a>

              <a
                href="${statusUrl}"
                style="${teacherActionButtonStyle}"
              >
                Assignment Status
              </a>

              <button
                type="button"
                onclick="deleteAssignments('${classId}')"
                style="${teacherDeleteButtonStyle}"
              >
                Delete Assignment
              </button>
            </div>

            <div id="${studentsContainerId}" style="margin-top:10px;"></div>
          </div>
        `;
      })
    );

    list.innerHTML = classCards.join("");

  } catch (err) {
    console.error("Load teacher classes error:", err);
    list.innerHTML = `<p style="color:#9b2c2c;">Error loading classes.</p>`;
  }
};

/* ---------- INIT ---------- */

auth.onAuthStateChanged((user) => {
  if (user) {
    loadSchools();
    window.loadTeacherClasses();
  }
});

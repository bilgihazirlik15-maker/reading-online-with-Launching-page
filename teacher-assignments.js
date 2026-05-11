import { auth, db } from "./firebase-config.js";

import {
  collection,
  doc,
  getDocs,
  addDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let teacherClasses = [];
let readingActivities = [];
let schools = [];

/* ---------- UTIL ---------- */

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function setAssignmentMessage(message, type = "info") {

  const messageBox =
    document.getElementById("assignmentMessage");

  if (!messageBox) return;

  messageBox.textContent = message || "";

  if (type === "success") {

    messageBox.style.color = "#2f6650";

  } else if (type === "error") {

    messageBox.style.color = "#9b2420";

  } else {

    messageBox.style.color = "#7a6f63";
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

    const unsubscribe =
      auth.onAuthStateChanged(user => {

        clearTimeout(timeout);

        unsubscribe();

        resolve(user);
      });
  });
}

function isTeacherClass(data, user) {

  if (!data || !user) return false;

  const uid = String(user.uid || "");
  const email =
    String(user.email || "").toLowerCase();

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

/* ---------- LOAD SCHOOLS ---------- */

async function loadAssignmentSchools() {

  const schoolSelect =
    document.getElementById("assignmentSchoolSelect");

  if (!schoolSelect) return;

  schoolSelect.innerHTML =
    `<option value="">Loading schools...</option>`;

  try {

    const snapshot =
      await getDocs(collection(db, "schools"));

    schools = snapshot.docs.map(docSnap => {

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

    if (schools.length === 0) {

      schoolSelect.innerHTML =
        `<option value="">No schools found</option>`;

      return;
    }

    schools.sort((a, b) =>
      String(a.schoolName || "")
        .localeCompare(String(b.schoolName || ""))
    );

    schoolSelect.innerHTML = `
      <option value="">Choose School</option>

      ${schools.map(school => `
        <option value="${escapeHtml(school.id)}">
          ${escapeHtml(school.schoolName)}
        </option>
      `).join("")}
    `;

  } catch (err) {

    console.error("Assignment schools load error:", err);

    schoolSelect.innerHTML =
      `<option value="">Schools could not be loaded</option>`;
  }
}

/* ---------- LOAD CLASSES ---------- */

async function loadTeacherClassesForAssignments() {

  const classSelect =
    document.getElementById("assignmentClassSelect");

  const schoolSelect =
    document.getElementById("assignmentSchoolSelect");

  if (!classSelect) return;

  classSelect.innerHTML =
    `<option value="">Loading classes...</option>`;

  setAssignmentMessage("", "info");

  try {

    const user = await getCurrentUser();

    if (!user) {

      classSelect.innerHTML =
        `<option value="">Please log in first</option>`;

      setAssignmentMessage(
        "Please log in as a teacher first.",
        "error"
      );

      return;
    }

    const selectedSchoolId =
      schoolSelect?.value || "";

    const snapshot =
      await getDocs(collection(db, "classes"));

    teacherClasses = snapshot.docs
      .map(docSnap => {

        const data = docSnap.data();

        return {
          id: docSnap.id,
          raw: data,

          name:
            data.name ||
            data.className ||
            data.title ||
            "Untitled Class",

          code:
            data.code ||
            data.classCode ||
            data.joinCode ||
            docSnap.id,

          schoolId:
            data.schoolId || "",

          schoolName:
            data.schoolName ||
            data.school ||
            "",

          teacherId:
            data.teacherId ||
            data.teacherUid ||
            data.createdBy ||
            data.ownerId ||
            "",

          teacherEmail:
            data.teacherEmail ||
            data.createdByEmail ||
            data.ownerEmail ||
            ""
        };
      })

      .filter(cls => isTeacherClass(cls.raw, user))

      .filter(cls => {

        if (!selectedSchoolId) return true;

        return String(cls.schoolId || "") ===
          String(selectedSchoolId);
      });

    if (teacherClasses.length === 0) {

      classSelect.innerHTML =
        `<option value="">No classes found</option>`;

      renderAssignmentList([]);

      return;
    }

    classSelect.innerHTML = `
      <option value="">Select a class</option>

      ${teacherClasses.map(cls => `
        <option value="${escapeHtml(cls.id)}">

          ${escapeHtml(cls.name)}
          (${escapeHtml(cls.code)})

        </option>
      `).join("")}
    `;

  } catch (err) {

    console.error(
      "Assignment class load error:",
      err
    );

    classSelect.innerHTML =
      `<option value="">Classes could not be loaded</option>`;

    setAssignmentMessage(
      "Classes could not be loaded.",
      "error"
    );
  }
}

/* ---------- LOAD ACTIVITIES ---------- */

async function loadActivitiesForAssignments() {

  const activitySelect =
    document.getElementById("assignmentActivitySelect");

  if (!activitySelect) return;

  activitySelect.innerHTML =
    `<option value="">Loading activities...</option>`;

  try {

    const manifestRes =
      await fetch("data/manifest.json");

    if (!manifestRes.ok) {
      throw new Error("manifest.json not found");
    }

    const manifest =
      await manifestRes.json();

    if (!Array.isArray(manifest)) {
      throw new Error(
        "manifest.json must be an array"
      );
    }

    const loaded = [];

    for (const file of manifest) {

      try {

        const res =
          await fetch("data/" + file);

        if (!res.ok) continue;

        const data = await res.json();

        loaded.push({
          id:
            data.id ||
            String(file).replace(".json", ""),

          title:
            data.title ||
            "Untitled Activity",

          level:
            data.level || "A2",

          words:
            data.words || 0,

          image:
            data.image || ""
        });

      } catch (err) {

        console.error(
          "Reading JSON load error:",
          file,
          err
        );
      }
    }

    readingActivities = loaded;

    if (readingActivities.length === 0) {

      activitySelect.innerHTML =
        `<option value="">No activities found</option>`;

      return;
    }

    activitySelect.innerHTML = `
      <option value="">Select an activity</option>

      ${readingActivities.map(activity => `
        <option value="${escapeHtml(activity.id)}">

          ${escapeHtml(activity.level)}
          -
          ${escapeHtml(activity.title)}

        </option>
      `).join("")}
    `;

  } catch (err) {

    console.error(
      "Assignment activity load error:",
      err
    );

    activitySelect.innerHTML =
      `<option value="">Activities could not be loaded</option>`;
  }
}

/* ---------- ASSIGNMENT LIST ---------- */

function renderAssignmentList(assignments) {

  const assignmentList =
    document.getElementById("assignmentList");

  if (!assignmentList) return;

  if (!assignments || assignments.length === 0) {

    assignmentList.innerHTML = `
      <div class="assignment-placeholder">
        No activities assigned to this class yet.
      </div>
    `;

    return;
  }

  assignmentList.innerHTML =
    assignments.map(item => `

      <div class="assignment-row">

        <strong>
          ${escapeHtml(item.title || "Untitled Activity")}
        </strong>

        <span>
          ${escapeHtml(item.level || "")}
          Level •
          ${escapeHtml(item.words || 0)}
          words
        </span>

        <div class="assignment-actions">

          <a
            class="view-progress-btn"
            href="assignment-progress.html?classId=${encodeURIComponent(item.classId || "")}&activityId=${encodeURIComponent(item.id || "")}&title=${encodeURIComponent(item.title || "")}"
          >
            View Progress
          </a>

          <button
            type="button"
            class="delete-assignment-btn"
            onclick="deleteAssignedActivity('${escapeHtml(item.assignmentDocId || "")}')"
          >
            Delete
          </button>

        </div>

      </div>

    `).join("");
}

/* ---------- LOAD ASSIGNMENTS ---------- */

async function loadAssignmentsForSelectedClass() {

  const classSelect =
    document.getElementById("assignmentClassSelect");

  if (!classSelect) return;

  const classId = classSelect.value;

  if (!classId) {

    renderAssignmentList([]);

    return;
  }

  const assignmentList =
    document.getElementById("assignmentList");

  if (assignmentList) {

    assignmentList.innerHTML = `
      <div class="assignment-placeholder">
        Loading assigned activities...
      </div>
    `;
  }

  try {

    const snapshot =
      await getDocs(
        collection(
          db,
          "classes",
          classId,
          "assignedActivities"
        )
      );

    const assignments =
      snapshot.docs.map(docSnap => {

        const data = docSnap.data();

        return {
          assignmentDocId: docSnap.id,
          classId,

          id:
            data.id ||
            data.activityId ||
            "",

          title:
            data.title ||
            "Untitled Activity",

          level:
            data.level || "",

          words:
            data.words || 0,

          image:
            data.image || ""
        };
      });

    renderAssignmentList(assignments);

  } catch (err) {

    console.error(
      "Assignment list load error:",
      err
    );

    if (assignmentList) {

      assignmentList.innerHTML = `
        <div class="assignment-placeholder">
          Assigned activities could not be loaded.
        </div>
      `;
    }
  }
}

/* ---------- ASSIGN ACTIVITY ---------- */

async function assignActivityToClass() {

  const classSelect =
    document.getElementById("assignmentClassSelect");

  const activitySelect =
    document.getElementById("assignmentActivitySelect");

  if (!classSelect || !activitySelect) return;

  const classId = classSelect.value;
  const activityId = activitySelect.value;

  if (!classId) {

    setAssignmentMessage(
      "Please choose a class first.",
      "error"
    );

    return;
  }

  if (!activityId) {

    setAssignmentMessage(
      "Please choose an activity first.",
      "error"
    );

    return;
  }

  const selectedActivity =
    readingActivities.find(
      activity =>
        String(activity.id) ===
        String(activityId)
    );

  if (!selectedActivity) {

    setAssignmentMessage(
      "Selected activity could not be found.",
      "error"
    );

    return;
  }

  try {

    const existingSnapshot =
      await getDocs(
        collection(
          db,
          "classes",
          classId,
          "assignedActivities"
        )
      );

    const alreadyAssigned =
      existingSnapshot.docs.some(docSnap => {

        const data = docSnap.data();

        return String(
          data.id ||
          data.activityId ||
          ""
        ) === String(activityId);
      });

    if (alreadyAssigned) {

      setAssignmentMessage(
        "This activity is already assigned to this class.",
        "error"
      );

      return;
    }

    await addDoc(
      collection(
        db,
        "classes",
        classId,
        "assignedActivities"
      ),
      {
        id: selectedActivity.id,
        activityId: selectedActivity.id,
        title: selectedActivity.title,
        level: selectedActivity.level,
        words: selectedActivity.words,
        image: selectedActivity.image || "",
        assignedAt: serverTimestamp()
      }
    );

    setAssignmentMessage(
      "Activity assigned successfully.",
      "success"
    );

    await loadAssignmentsForSelectedClass();

  } catch (err) {

    console.error(
      "Assign activity error:",
      err
    );

    setAssignmentMessage(
      "Activity could not be assigned.",
      "error"
    );
  }
}

/* ---------- DELETE ASSIGNED ---------- */

async function deleteAssignedActivity(
  assignmentDocId
) {

  const classSelect =
    document.getElementById("assignmentClassSelect");

  if (!classSelect) return;

  const classId = classSelect.value;

  if (!classId || !assignmentDocId) {

    setAssignmentMessage(
      "Assignment could not be deleted.",
      "error"
    );

    return;
  }

  const confirmed =
    window.confirm(
      "Delete this assignment from the class?"
    );

  if (!confirmed) return;

  try {

    await deleteDoc(
      doc(
        db,
        "classes",
        classId,
        "assignedActivities",
        assignmentDocId
      )
    );

    setAssignmentMessage(
      "Assignment deleted successfully.",
      "success"
    );

    await loadAssignmentsForSelectedClass();

  } catch (err) {

    console.error(
      "Delete assignment error:",
      err
    );

    setAssignmentMessage(
      "Assignment could not be deleted.",
      "error"
    );
  }
}

/* ---------- CLASS PROGRESS ---------- */

function openSelectedClassProgress() {

  const classSelect =
    document.getElementById("assignmentClassSelect");

  if (!classSelect || !classSelect.value) {

    setAssignmentMessage(
      "Please choose a class first.",
      "error"
    );

    return;
  }

  window.location.href =
    "class-progress.html?classId=" +
    encodeURIComponent(classSelect.value);
}

/* ---------- EVENTS ---------- */

function bindAssignmentEvents() {

  const classSelect =
    document.getElementById("assignmentClassSelect");

  const schoolSelect =
    document.getElementById("assignmentSchoolSelect");

  if (classSelect) {

    classSelect.addEventListener(
      "change",
      loadAssignmentsForSelectedClass
    );
  }

  if (schoolSelect) {

    schoolSelect.addEventListener(
      "change",
      loadTeacherClassesForAssignments
    );
  }
}

/* ---------- INIT ---------- */

async function initializeTeacherAssignments() {

  bindAssignmentEvents();

  await loadAssignmentSchools();

  await loadActivitiesForAssignments();

  await loadTeacherClassesForAssignments();
}

window.assignActivityToClass =
  assignActivityToClass;

window.deleteAssignedActivity =
  deleteAssignedActivity;

window.openSelectedClassProgress =
  openSelectedClassProgress;

window.loadAssignmentsForSelectedClass =
  loadAssignmentsForSelectedClass;

initializeTeacherAssignments();

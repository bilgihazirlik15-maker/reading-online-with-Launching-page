import { auth, db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  deleteField,
  serverTimestamp,
  deleteDoc
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

/* ---------- CREATE CLASS ---------- */

window.createClass = async function () {
  const user = await waitForUser();

  if (!user) {
    alert("Please login first.");
    return;
  }

  const input = document.getElementById("classNameInput");
  const message = document.getElementById("classMessage");

  const className = input.value.trim();

  if (!className) {
    message.innerText = "Please enter a class name.";
    return;
  }

  const classCode = generateClassCode();

  await addDoc(collection(db, "classes"), {
    className,
    classCode,
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
  const studentQuery = query(
    collection(db, "users"),
    where("classId", "==", classId)
  );

  const snapshot = await getDocs(studentQuery);
  return snapshot.size;
}

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
            📘 <strong>${item.title || "Untitled Activity"}</strong><br>
            <span>${item.level || ""} Level</span><br>
            Score: <b>${item.score}/${item.total}</b><br>
            <span style="color:#7a6f63;">${item.date || ""}</span>
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
            ⏳ <strong>${item.title || "Untitled Activity"}</strong><br>
            <span>${item.level || ""} Level</span><br>
            <span style="color:#7a6f63;">Started: ${item.date || ""}</span>
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

  const q = query(
    collection(db, "users"),
    where("classId", "==", classId)
  );

  const snapshot = await getDocs(q);

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
          <span>👤 ${s.email || "Student"}</span>

          <div style="display:flex; gap:6px;">
            <button
              type="button"
              onclick="toggleProgress('${studentId}', '${progressId}')"
              style="
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
    const q = query(
      collection(db, "classes"),
      where("teacherId", "==", user.uid)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      list.innerHTML = `<p style="color:#7a6f63;">No classes created yet.</p>`;
      return;
    }

    const classCards = await Promise.all(
      snapshot.docs.map(async (docSnap) => {
        const item = docSnap.data();
        const classId = docSnap.id;
        const studentsContainerId = "students-" + classId;
        const studentCount = await getStudentCount(classId);

        return `
          <div style="
            margin-top:14px;
            padding:14px;
            background:#f1eadf;
            border:1px solid #e5d7c4;
            border-radius:14px;
            text-align:left;
          ">
            <strong>${item.className}</strong><br>
            <span>Class Code: <b>${item.classCode}</b></span><br>
            <span>Students: <b>${studentCount}</b></span><br>

            <button
              type="button"
              onclick="toggleStudents('${classId}', '${studentsContainerId}')"
              style="
                margin-top:10px;
                border:none;
                padding:8px 12px;
                border-radius:999px;
                background:#6b7fd7;
                color:white;
                font-weight:bold;
                cursor:pointer;
              "
            >
              View Students
            </button>

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
    window.loadTeacherClasses();
  }
});

/* ---------- SAVE IN PROGRESS (STUDENT ACTIVITY) ---------- */

window.saveProgressToFirebase = async function(activityData) {
  const user = await waitForUser();

  if (!user || !activityData || !activityData.id) return;

  try {
    const existingQuery = query(
      collection(db, "users", user.uid, "activitiesInProgress"),
      where("id", "==", activityData.id)
    );

    const existingSnapshot = await getDocs(existingQuery);

    if (!existingSnapshot.empty) {
      for (const docSnap of existingSnapshot.docs) {
        await updateDoc(docSnap.ref, {
          ...activityData,
          updatedAt: serverTimestamp()
        });
      }

      console.log("Progress updated:", activityData.title || activityData.id);
      return;
    }

    await addDoc(
      collection(db, "users", user.uid, "activitiesInProgress"),
      {
        ...activityData,
        startedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }
    );

    console.log("Progress saved:", activityData.title || activityData.id);

  } catch (err) {
    console.error("Save progress error:", err);
  }
};

/* ---------- REMOVE IN PROGRESS (STUDENT ACTIVITY) ---------- */

window.removeProgressFromFirebase = async function(activityId) {
  const user = await waitForUser();

  if (!user || !activityId) return;

  try {
    const progressQuery = query(
      collection(db, "users", user.uid, "activitiesInProgress"),
      where("id", "==", activityId)
    );

    const progressSnapshot = await getDocs(progressQuery);

    for (const docSnap of progressSnapshot.docs) {
      await deleteDoc(docSnap.ref);
    }

    console.log("Progress removed:", activityId);

  } catch (err) {
    console.error("Remove progress error:", err);
  }
};

/* ---------- SAVE COMPLETED (STUDENT ACTIVITY) ---------- */

window.saveCompletedToFirebase = async function(activityData) {
  const user = await waitForUser();

  if (!user || !activityData || !activityData.id) return;

  try {
    const completedQuery = query(
      collection(db, "users", user.uid, "completedActivities"),
      where("id", "==", activityData.id)
    );

    const completedSnapshot = await getDocs(completedQuery);

    for (const docSnap of completedSnapshot.docs) {
      await deleteDoc(docSnap.ref);
    }

    await addDoc(
      collection(db, "users", user.uid, "completedActivities"),
      {
        ...activityData,
        completedAt: serverTimestamp()
      }
    );

    console.log("Completed saved:", activityData.title || activityData.id);

  } catch (err) {
    console.error("Save completed error:", err);
  }
};

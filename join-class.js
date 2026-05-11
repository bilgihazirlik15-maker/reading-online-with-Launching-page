import { auth, db } from "./firebase-config.js";

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function getCurrentUser() {
  return new Promise((resolve) => {
    if (auth.currentUser) return resolve(auth.currentUser);

    const unsub = auth.onAuthStateChanged((user) => {
      unsub();
      resolve(user);
    });
  });
}

window.joinClass = async function() {
  const user = await getCurrentUser();

  const input = document.getElementById("joinClassCodeInput");
  const message = document.getElementById("joinClassMessage");

  if (!message || !input) return;

  if (!user) {
    message.style.color = "#9b2c2c";
    message.innerText = "Please login first.";
    return;
  }

  const classCode = input.value.trim().toUpperCase();

  if (!classCode) {
    message.style.color = "#9b2c2c";
    message.innerText = "Please enter a class code.";
    return;
  }

  try {
    const q = query(
      collection(db, "classes"),
      where("classCode", "==", classCode)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      message.style.color = "#9b2c2c";
      message.innerText = "Class code not found.";
      return;
    }

    const classDoc = snapshot.docs[0];
    const classData = classDoc.data();

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    const existingUserData = userSnap.exists() ? userSnap.data() : {};

    const existingJoinedClasses = Array.isArray(existingUserData.joinedClasses)
      ? existingUserData.joinedClasses
      : [];

    const newClassItem = {
      classId: classDoc.id,
      classCode: classData.classCode || classCode,
      className: classData.className || classData.name || "Class",
      schoolId: classData.schoolId || "",
      schoolName: classData.schoolName || classData.school || "",
      joinedAt: new Date().toISOString()
    };

    const alreadyJoined = existingJoinedClasses.some(item =>
      String(item.classId || "") === String(newClassItem.classId) ||
      String(item.classCode || "").toUpperCase() === String(newClassItem.classCode).toUpperCase()
    );

    const updatedJoinedClasses = alreadyJoined
      ? existingJoinedClasses.map(item => {
          const sameClass =
            String(item.classId || "") === String(newClassItem.classId) ||
            String(item.classCode || "").toUpperCase() === String(newClassItem.classCode).toUpperCase();

          return sameClass
            ? {
                ...item,
                ...newClassItem
              }
            : item;
        })
      : [
          ...existingJoinedClasses,
          newClassItem
        ];

    await setDoc(
      userRef,
      {
        email: user.email,
        role: existingUserData.role || "student",

        // Backward compatibility: son katıldığı sınıf eski sistem için burada kalır.
        classId: newClassItem.classId,
        classCode: newClassItem.classCode,
        className: newClassItem.className,
        schoolId: newClassItem.schoolId,
        schoolName: newClassItem.schoolName,

        // Yeni çoklu sınıf sistemi
        joinedClasses: updatedJoinedClasses
      },
      { merge: true }
    );

    message.style.color = "#2f6650";

    if (alreadyJoined) {
      message.innerText = "You are already in this class: " + newClassItem.className;
    } else {
      message.innerText = "You joined: " + newClassItem.className;
    }

    input.value = "";

  } catch (err) {
    console.error("Join class error:", err);

    message.style.color = "#9b2c2c";
    message.innerText = "Could not join class. Please check the code or permissions.";
  }
};

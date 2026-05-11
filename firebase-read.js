import { auth, db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function waitForUser() {
  return new Promise((resolve) => {
    if (auth.currentUser) {
      resolve(auth.currentUser);
      return;
    }

    const unsub = auth.onAuthStateChanged((user) => {
      unsub();
      resolve(user);
    });
  });
}

// ✅ COMPLETED
window.loadCompletedFromFirebase = async function() {
  const user = await waitForUser();
  if (!user) return [];

  const q = query(
    collection(db, "users", user.uid, "completedActivities"),
    orderBy("completedAt", "desc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => doc.data());
};

// ✅ IN PROGRESS
window.loadProgressFromFirebase = async function() {
  const user = await waitForUser();
  if (!user) return [];

  const snapshot = await getDocs(
    collection(db, "users", user.uid, "activitiesInProgress")
  );

  return snapshot.docs.map(doc => doc.data());
};

// ✅ ASSIGNED ACTIVITIES / HOMEWORK
window.loadAssignedFromFirebase = async function() {
  const user = await waitForUser();
  if (!user) return [];

  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) return [];

  const userData = userSnap.data();

  if (!userData.classId) return [];

  const snapshot = await getDocs(
    collection(db, "classes", userData.classId, "assignedActivities")
  );

  return snapshot.docs.map(doc => doc.data());
};

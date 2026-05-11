// firebase-config.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import { 
  getAuth 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { 
  getFirestore 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDGmSMW-upGCQvHXOdM4Jcv1-wNg4Wr5xU",
  authDomain: "myreading-online-be5d9.firebaseapp.com",
  projectId: "myreading-online-be5d9",
  storageBucket: "myreading-online-be5d9.firebasestorage.app",
  messagingSenderId: "251309105750",
  appId: "1:251309105750:web:dac365305cea9f3b9291f7"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };

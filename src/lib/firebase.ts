import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAnsOWhcgrtqCAXvM1gY-n2c7T9-TmuRLg",
  authDomain: "begu-engeda-1bc7c.firebaseapp.com",
  projectId: "begu-engeda-1bc7c",
  storageBucket: "begu-engeda-1bc7c.firebasestorage.app",
  messagingSenderId: "951153341268",
  appId: "1:951153341268:web:33c15a1b3363f7758c8ec1",
  measurementId: "G-H5G59RNJ50"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

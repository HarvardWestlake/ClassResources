import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

// Your web app's Firebase configuration.
// This matches the config snippet from your Firebase console.
const firebaseConfig = {
  apiKey: 'AIzaSyABz50rKzTg9PPnIc5KNmm24sIyRGOlFDM',
  authDomain: 'learnhw.firebaseapp.com',
  projectId: 'learnhw',
  storageBucket: 'learnhw.firebasestorage.app',
  messagingSenderId: '784730197465',
  appId: '1:784730197465:web:0a55f4a22c821836e6ddc8',
} as const

// Initialize Firebase
export const app = initializeApp(firebaseConfig)

// Initialize Firestore (we'll use this for heatmap event writes).
export const db = getFirestore(app)




import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            "AIzaSyA6FejWslSziJdR1nEOTLv79SPwrdKc-QM",
  authDomain:        "heiskill-baby-c7893.firebaseapp.com",
  projectId:         "heiskill-baby-c7893",
  storageBucket:     "heiskill-baby-c7893.firebasestorage.app",
  messagingSenderId: "83060210595",
  appId:             "1:83060210595:web:56ca5c81b8a0094286f816",
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)

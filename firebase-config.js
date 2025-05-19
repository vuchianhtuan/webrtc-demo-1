// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyA4vgKaaKo2mTevWJ0f91gcmBbcFMiwnFA",
  authDomain: "webrtc-demo-5a3d2.firebaseapp.com",
  databaseURL: "https://webrtc-demo-5a3d2-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "webrtc-demo-5a3d2",
  storageBucket: "webrtc-demo-5a3d2.appspot.com",
  messagingSenderId: "13809054436",
  appId: "1:13809054436:web:19da665bec9717dec932f1"
};

// Init Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

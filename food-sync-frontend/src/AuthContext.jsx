import { createContext, useContext, useEffect, useState } from "react";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { auth } from "./firebase";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Signup function
  function signup(email, password, name) {
    return createUserWithEmailAndPassword(auth, email, password).then((res) => {
      // Auto-send verification email on signup
      sendEmailVerification(res.user).catch((err) => {
        console.error("Error sending verification email on signup:", err);
      });
      return updateProfile(res.user, { displayName: name });
    });
  }

  // Login function
  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  // Google Login function
  function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  }

  // Logout function
  function logout() {
    return signOut(auth);
  }

  // Manual send verification function
  function sendVerificationEmail() {
    if (!currentUser) return Promise.reject("No user logged in");
    return sendEmailVerification(currentUser);
  }

  function getAuthHeaders() {
    const uid = currentUser?.uid || auth?.currentUser?.uid || "demo_user";
    return {
      "Content-Type": "application/json",
      "X-User-Id": uid,
    };
  }

  // Auto login check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    signup,
    login,
    loginWithGoogle,
    logout,
    sendVerificationEmail,
    getAuthHeaders,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

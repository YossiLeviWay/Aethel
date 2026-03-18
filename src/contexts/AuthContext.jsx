import { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';

const AuthContext = createContext();

const GLOBAL_ADMIN_PASSWORD = '123qwe123';

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSchool, setSelectedSchool] = useState(null);

  async function register(email, password, userInfo) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const userDoc = {
      uid: cred.user.uid,
      email,
      fullName: userInfo.fullName,
      role: 'viewer',
      jobTitle: userInfo.jobTitle || '',
      schoolId: userInfo.schoolId || '',
      phone: userInfo.phone || '',
      avatar: '',
      createdAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'users', cred.user.uid), userDoc);
    return cred;
  }

  async function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function loginAsAdmin(password) {
    if (password !== GLOBAL_ADMIN_PASSWORD) {
      throw new Error('סיסמת אדמין שגויה');
    }
    const adminEmail = 'admin@eduflow.co.il';
    try {
      return await signInWithEmailAndPassword(auth, adminEmail, GLOBAL_ADMIN_PASSWORD);
    } catch {
      const cred = await createUserWithEmailAndPassword(auth, adminEmail, GLOBAL_ADMIN_PASSWORD);
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        email: adminEmail,
        fullName: 'מנהל מערכת',
        role: 'global_admin',
        jobTitle: 'מנהל על',
        schoolId: '',
        phone: '',
        avatar: '',
        createdAt: new Date().toISOString()
      });
      return cred;
    }
  }

  async function logout() {
    setUserData(null);
    setSelectedSchool(null);
    return signOut(auth);
  }

  async function fetchUserData(uid) {
    const docSnap = await getDoc(doc(db, 'users', uid));
    if (docSnap.exists()) {
      const data = docSnap.data();
      setUserData(data);
      if (data.schoolId) {
        setSelectedSchool(data.schoolId);
      }
      return data;
    }
    return null;
  }

  function switchSchool(schoolId) {
    setSelectedSchool(schoolId);
  }

  function isGlobalAdmin() {
    return userData?.role === 'global_admin';
  }

  function isPrincipal() {
    return userData?.role === 'principal';
  }

  function isEditor() {
    return userData?.role === 'editor';
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchUserData(user.uid);
      } else {
        setUserData(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const value = {
    currentUser,
    userData,
    selectedSchool,
    loading,
    register,
    login,
    loginAsAdmin,
    logout,
    switchSchool,
    isGlobalAdmin,
    isPrincipal,
    isEditor,
    fetchUserData
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

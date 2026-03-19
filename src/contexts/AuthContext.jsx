import { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  arrayUnion,
  arrayRemove
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
    const schoolId = userInfo.schoolId || '';
    const userDoc = {
      uid: cred.user.uid,
      email,
      fullName: userInfo.fullName,
      role: 'viewer',
      jobTitle: userInfo.jobTitle || '',
      schoolId: schoolId,
      schoolIds: [],
      pendingSchools: schoolId ? [schoolId] : [],
      phone: userInfo.phone || '',
      avatar: '',
      createdAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'users', cred.user.uid), userDoc);
    return cred;
  }

  async function login(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    // Check if admin set a new password for this user
    try {
      const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
      const data = userDoc.data();
      if (data?._pendingPassword) {
        await updatePassword(cred.user, data._pendingPassword);
        await updateDoc(doc(db, 'users', cred.user.uid), { _pendingPassword: '' });
      }
    } catch (err) {
      console.warn('Could not apply pending password:', err);
    }
    return cred;
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
        schoolIds: [],
        pendingSchools: [],
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
      // Handle both new schoolIds array and old schoolId field
      if (data.schoolIds && data.schoolIds.length > 0) {
        setSelectedSchool(data.schoolIds[0]);
      } else if (data.schoolId) {
        setSelectedSchool(data.schoolId);
      }
      return data;
    }
    return null;
  }

  async function approveUser(userId, schoolId) {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      pendingSchools: arrayRemove(schoolId),
      schoolIds: arrayUnion(schoolId)
    });
  }

  async function rejectUser(userId, schoolId) {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      pendingSchools: arrayRemove(schoolId)
    });
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
    fetchUserData,
    approveUser,
    rejectUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

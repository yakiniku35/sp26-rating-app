import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, addDoc, onSnapshot, serverTimestamp, doc, setDoc, deleteDoc, updateDoc, getDoc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { Star, Send, BarChart3, MessageSquare, ChevronDown, X, Trophy, CheckCircle, Users, Table2, Download, LogOut, CalendarDays, Trash2 } from 'lucide-react';
import { Analytics } from '@vercel/analytics/react';

// Config & Constants
import { db, auth, googleProvider } from './config/firebase';
import { EVENT_SCHEDULE_URL, GOOGLE_AUTH_ERROR_MESSAGE, ADMIN_LOGIN_INTENT_KEY, ADMIN_PATH, SCORE_ITEMS } from './constants/config';
import { I18N } from './constants/i18n';
import { ROOMS as INITIAL_ROOMS } from './constants/rooms';

// Utils
import { buildPresentationKey, buildRatingDocId, buildAuthDebugText, prefersRedirectLogin } from './utils/helpers';

// Styles
import { styles } from './styles/appStyles';

const SCORE_KEYS = SCORE_ITEMS.map((item) => item.key);
const EMPTY_SCORES = SCORE_KEYS.reduce((acc, key) => {
  acc[key] = 0;
  return acc;
}, {});

const normalizeScores = (rawScores = {}) => {
  const normalized = { ...EMPTY_SCORES };
  normalized.structure = rawScores?.structure ?? rawScores?.inspiration ?? 0;
  normalized.fluency = rawScores?.fluency ?? 0;
  normalized.professionalism = rawScores?.professionalism ?? 0;
  normalized.visualDesign = rawScores?.visualDesign ?? rawScores?.visual ?? 0;
  return normalized;
};

const calculateAverageScore = (rawScores = {}) => {
  const scores = normalizeScores(rawScores);
  const total = SCORE_KEYS.reduce((sum, key) => sum + (scores[key] || 0), 0);
  return SCORE_KEYS.length ? total / SCORE_KEYS.length : 0;
};

const mergeRoomsWithBackup = (sourceRooms = []) => {
  return sourceRooms.map((room) => {
    return {
      id: room.id,
      name: room.name || room.id,
      theme: room.theme || '',
      presentations: Array.isArray(room.presentations)
        ? room.presentations.map((presentation) => {
          const internshipUnit = presentation['實習'] || '';
          const internshipTopic = internshipUnit || presentation.internshipTopic || '';

          return {
            session: presentation.session || '',
            time: presentation.time || '',
            presenter: presentation.presenter || '',
            '實習': internshipUnit,
            internshipTopic: internshipTopic || presentation.topic || '',
            topic: presentation.topic || internshipTopic || presentation.internshipTopic || '',
          };
        })
        : [],
    };
  });
};

export default function App() {
  const [language, setLanguage] = useState('zh');
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth || 1024);
  const [currentPath, setCurrentPath] = useState(() => (window.location.pathname === ADMIN_PATH ? ADMIN_PATH : '/'));
  const [userId, setUserId] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [rooms, setRooms] = useState(() => mergeRoomsWithBackup(INITIAL_ROOMS));
  const [onlineCount, setOnlineCount] = useState(0);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [selectedPresentationIdx, setSelectedPresentationIdx] = useState('');
  const [presentationDrafts, setPresentationDrafts] = useState({});
  const [showToast, setShowToast] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginLoading, setAdminLoginLoading] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [adminRatings, setAdminRatings] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [csvExporting, setCsvExporting] = useState(false);
  const [clearingRatings, setClearingRatings] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [googleLoginLoading, setGoogleLoginLoading] = useState(false);
  const [submittedPresentationKeys, setSubmittedPresentationKeys] = useState({});
  const [adminSearchText, setAdminSearchText] = useState('');
  const [adminRoomFilter, setAdminRoomFilter] = useState('ALL');
  const [adminSortBy, setAdminSortBy] = useState('time-desc');
  const [adminPageSize, setAdminPageSize] = useState(50);
  const [adminCurrentPage, setAdminCurrentPage] = useState(1);
  const isAdminPage = currentPath === ADMIN_PATH;
  const isMobile = viewportWidth <= 768;
  const t = useCallback((key) => (I18N[language] && I18N[language][key]) || I18N.zh[key] || key, [language]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth || 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'rooms'), (snapshot) => {
      if (snapshot.empty) {
        return;
      }

      const remoteRooms = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data() || {};
          return {
            id: data.id || docSnap.id,
            name: data.name || '',
            theme: data.theme || '',
            presentations: Array.isArray(data.presentations) ? data.presentations : [],
            order: typeof data.order === 'number' ? data.order : Number.MAX_SAFE_INTEGER,
          };
        })
        .sort((a, b) => {
          if (a.order !== b.order) return a.order - b.order;
          return a.id.localeCompare(b.id);
        });

      setRooms(mergeRoomsWithBackup(remoteRooms));
    }, (err) => {
      console.error('讀取 rooms 設定失敗，改用本地預設：', err);
    });

    return () => unsub();
  }, []);

  const navigateToMainPage = useCallback((replace = false) => {
    const target = '/';
    if (replace) {
      window.history.replaceState({}, '', target);
    } else if (window.location.pathname !== target) {
      window.history.pushState({}, '', target);
    }
    setCurrentPath(target);
  }, []);

  const navigateToAdminPage = useCallback((replace = false) => {
    if (!isAdminUser) return;
    if (replace) {
      window.history.replaceState({}, '', ADMIN_PATH);
    } else if (window.location.pathname !== ADMIN_PATH) {
      window.history.pushState({}, '', ADMIN_PATH);
    }
    setCurrentPath(ADMIN_PATH);
  }, [isAdminUser]);

  useEffect(() => {
    const onPopState = () => {
      setCurrentPath(window.location.pathname === ADMIN_PATH ? ADMIN_PATH : '/');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const fetchAdminDoc = useCallback(async (uid) => {
    const adminRef = doc(db, 'admins', uid);
    try {
      return await getDoc(adminRef);
    } catch (err) {
      if (err?.code === 'permission-denied' && auth.currentUser) {
        await auth.currentUser.getIdToken(true);
        return await getDoc(adminRef);
      }
      throw err;
    }
  }, []);

  const verifyAdminAccess = useCallback(async (user) => {
    if (!user || !user.uid) {
      const err = new Error('NO_AUTH_USER');
      err.code = 'app/no-auth-user';
      throw err;
    }

    const snap = await fetchAdminDoc(user.uid);
    if (!snap.exists()) {
      alert('此帳號尚未在 Firestore 的 admins 集合中授權為管理員');
      setAdminPassword('');
      setIsAdminUser(false);
      return false;
    }

    setIsAdminUser(true);
    setAdminPassword('');
    setShowAdminLogin(false);
    navigateToAdminPage();
    return true;
  }, [fetchAdminDoc, navigateToAdminPage]);

  const signInWithGoogle = useCallback(async ({ adminIntent = false } = {}) => {
    setGoogleLoginLoading(true);
    if (adminIntent) {
      window.sessionStorage.setItem(ADMIN_LOGIN_INTENT_KEY, '1');
    } else {
      window.sessionStorage.removeItem(ADMIN_LOGIN_INTENT_KEY);
    }
    try {
      if (prefersRedirectLogin()) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }

      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      if (
        err.code === 'auth/popup-blocked' ||
        err.code === 'auth/operation-not-supported-in-this-environment'
      ) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr) {
          window.sessionStorage.removeItem(ADMIN_LOGIN_INTENT_KEY);
          alert(GOOGLE_AUTH_ERROR_MESSAGE);
          console.error(redirectErr);
        }
      } else if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        window.sessionStorage.removeItem(ADMIN_LOGIN_INTENT_KEY);
        alert(GOOGLE_AUTH_ERROR_MESSAGE);
        console.error(err);
      } else {
        window.sessionStorage.removeItem(ADMIN_LOGIN_INTENT_KEY);
      }
    } finally {
      setGoogleLoginLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    getRedirectResult(auth).catch((err) => {
      if (!active) return;
      alert(GOOGLE_AUTH_ERROR_MESSAGE);
      console.error(err);
      setGoogleLoginLoading(false);
    });

    const unsub = onAuthStateChanged(auth, (user) => {
      if (!active) return;

      if (!user) {
        setUserId(null);
        setUserProfile(null);
        setIsAdminUser(false);
        window.sessionStorage.removeItem(ADMIN_LOGIN_INTENT_KEY);
        setAuthReady(false);
        setGoogleLoginLoading(false);
        signInAnonymously(auth).catch((err) => {
          console.error('匿名登入失敗：', err);
          if (active) setAuthReady(true);
        });
        return;
      }

      setUserId(user.uid);
      setUserProfile({
        uid: user.uid,
        displayName: user.displayName || (user.isAnonymous ? '匿名評分者' : ''),
        email: user.email || '',
      });

      fetchAdminDoc(user.uid)
        .then((snap) => {
          if (!active) return;
          const allowed = snap.exists();
          setIsAdminUser(allowed);
          if (window.sessionStorage.getItem(ADMIN_LOGIN_INTENT_KEY) === '1') {
            window.sessionStorage.removeItem(ADMIN_LOGIN_INTENT_KEY);
            if (allowed) {
              setShowAdminLogin(false);
              navigateToAdminPage(true);
            } else {
              alert('此帳號尚未在 Firestore 的 admins 集合中授權為管理員');
              if (window.location.pathname === ADMIN_PATH) {
                navigateToMainPage(true);
              }
            }
          }
        })
        .catch((err) => {
          console.error('讀取管理員權限失敗：', err);
          if (active) setIsAdminUser(false);
        })
        .finally(() => {
          if (!active) return;
          setAuthReady(true);
          setGoogleLoginLoading(false);
        });
    });

    return () => {
      active = false;
      unsub();
    };
  }, [fetchAdminDoc, navigateToAdminPage, navigateToMainPage]);

  useEffect(() => {
    if (!isAdminUser && isAdminPage) {
      navigateToMainPage(true);
      setShowAdminLogin(true);
    }
  }, [isAdminPage, isAdminUser, navigateToMainPage]);

  useEffect(() => {
    if (!userId) {
      setSubmittedPresentationKeys({});
      return;
    }

    const ratingsQuery = query(collection(db, 'ratings'), where('raterUserId', '==', userId));
    const unsub = onSnapshot(ratingsQuery, (snapshot) => {
      const nextSubmittedKeys = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.presentationKey) {
          nextSubmittedKeys[data.presentationKey] = true;
        }
      });
      setSubmittedPresentationKeys(nextSubmittedKeys);
    }, (err) => {
      console.error('讀取個人提交紀錄失敗：', err);
    });

    return () => unsub();
  }, [userId]);

  // 線上人數：簡易即時狀態（onlineUsers 集合）
  useEffect(() => {
    if (!userId) return;

    const userDocRef = doc(db, 'onlineUsers', userId);

    // 註冊 / 心跳更新
    setDoc(
      userDocRef,
      { userId, lastActive: serverTimestamp() },
      { merge: true }
    ).catch((err) => console.error('更新線上狀態失敗：', err));

    const intervalId = setInterval(() => {
      setDoc(
        userDocRef,
        { userId, lastActive: serverTimestamp() },
        { merge: true }
      ).catch((err) => console.error('更新線上狀態失敗：', err));
    }, 30000);

    const handleBeforeUnload = () => {
      deleteDoc(userDocRef).catch(() => {});
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      deleteDoc(userDocRef).catch(() => {});
    };
  }, [userId]);

  // 只有在開啟管理員頁時才訂閱線上人數
  useEffect(() => {
    if (!isAdminPage || !isAdminUser) return;

    const unsub = onSnapshot(collection(db, 'onlineUsers'), (snapshot) => {
      const now = Date.now();
      let count = 0;
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const ts = data.lastActive;
        if (ts && typeof ts.toMillis === 'function') {
          const diff = now - ts.toMillis();
          if (diff < 60000) {
            count += 1;
          }
        } else {
          // 若 timestamp 還沒同步回來，先暫時算在線
          count += 1;
        }
      });
      setOnlineCount(count);
    }, (err) => {
      console.error('讀取線上人數失敗：', err);
    });

    return () => unsub();
  }, [isAdminPage, isAdminUser]);

  const currentRoom = rooms.find((r) => r.id === selectedRoom);
  const currentPresentation =
    currentRoom && selectedPresentationIdx !== ''
      ? currentRoom.presentations[Number(selectedPresentationIdx)]
      : null;

  const getDraft = useCallback(
    (idx) =>
      presentationDrafts[idx] || {
        scores: { ...EMPTY_SCORES },
        comment: '',
        submitting: false,
      },
    [presentationDrafts]
  );

  const updateDraft = useCallback((idx, updater) => {
    setPresentationDrafts((prev) => {
      const current =
        prev[idx] || {
          scores: { ...EMPTY_SCORES },
          comment: '',
          submitting: false,
        };
      return { ...prev, [idx]: updater(current) };
    });
  }, []);

  const handleSubmitForPresentation = useCallback(
    async (presentation, idx) => {
      if (!userId || !userProfile) {
        alert('請先使用 Google 登入後再評分');
        return;
      }

      const presentationKey = buildPresentationKey(selectedRoom, presentation);
      if (!isAdminUser && submittedPresentationKeys[presentationKey]) {
        alert('這份評分您已提交過，一般使用者每位報告只能送出一次。');
        return;
      }

      const draft = getDraft(idx);
      if (!SCORE_KEYS.every((key) => Number(draft.scores?.[key]) > 0)) {
        alert('請完成所有 4 項評分');
        return;
      }

      updateDraft(idx, (prev) => ({ ...prev, submitting: true }));
      try {
        const ratingData = {
          presentationKey,
          roomId: selectedRoom,
          presenter: presentation.presenter,
          topic: presentation.topic || presentation.internshipTopic || presentation['實習'] || '',
          session: presentation.session,
          scores: normalizeScores(draft.scores),
          comment: draft.comment,
          timestamp: serverTimestamp(),
          raterUserId: userId,
          raterName: userProfile.displayName,
          raterEmail: userProfile.email,
          anonymousUserId: userId,
        };

        if (isAdminUser) {
          await addDoc(collection(db, 'ratings'), ratingData);
        } else {
          await setDoc(doc(db, 'ratings', buildRatingDocId(userId, presentationKey)), ratingData);
        }

        updateDraft(idx, (prev) => ({
          ...prev,
          scores: { ...EMPTY_SCORES },
          comment: '',
          submitting: false,
        }));
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      } catch (err) {
        alert('提交失敗，請稍後再試。');
        console.error(err);
        updateDraft(idx, (prev) => ({ ...prev, submitting: false }));
      }
    },
    [getDraft, isAdminUser, selectedRoom, submittedPresentationKeys, updateDraft, userId, userProfile]
  );

  useEffect(() => {
    if (!showLeaderboard) return;
    setLeaderboardLoading(true);
    const unsub = onSnapshot(collection(db, 'ratings'), (snapshot) => {
      const map = {};
      snapshot.forEach((doc) => {
        const d = doc.data();
        const key = `${d.roomId}||${d.presenter}||${d.topic}`;
        if (!map[key]) {
          map[key] = { roomId: d.roomId, presenter: d.presenter, topic: d.topic, total: 0, count: 0 };
        }
        const avg = calculateAverageScore(d.scores);
        map[key].total += avg;
        map[key].count += 1;
      });
      const list = Object.values(map)
        .map((item) => ({ ...item, average: item.total / item.count }))
        .sort((a, b) => b.average - a.average);
      setLeaderboardData(list);
      setLeaderboardLoading(false);
    }, (err) => {
      console.error('讀取排行榜失敗：', err);
      setLeaderboardLoading(false);
    });
    return () => unsub();
  }, [showLeaderboard]);

  const handleOpenLeaderboard = () => setShowLeaderboard(true);

  const handleOpenAdmin = async () => {
    if (!userId || !auth.currentUser) {
      setShowAdminLogin(true);
      return;
    }

    try {
      const snap = await fetchAdminDoc(auth.currentUser.uid);
      if (snap.exists()) {
        setIsAdminUser(true);
        navigateToAdminPage();
        setShowAdminLogin(false);
      } else {
        setIsAdminUser(false);
        setShowAdminLogin(true);
      }
    } catch (err) {
      console.error('驗證管理員權限失敗：', err);
      alert(`無法驗證管理員權限，請確認 Firestore 規則已部署，且 admins 文件 ID 與目前登入 UID 完全一致。\n\n${buildAuthDebugText(auth.currentUser?.uid)}`);
      setShowAdminLogin(true);
    }
  };

  const handleAdminLoginSubmit = async (e) => {
    e.preventDefault();
    if (!adminEmail.trim() || !adminPassword) {
      alert('請輸入 Email 與密碼');
      return;
    }
    setAdminLoginLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, adminEmail.trim(), adminPassword);
      const allowed = await verifyAdminAccess(credential.user);
      if (!allowed) {
        return;
      }
    } catch (err) {
      alert('登入失敗，請確認 Email／密碼是否正確');
      console.error(err);
    } finally {
      setAdminLoginLoading(false);
    }
  };

  const handleGoogleAdminLogin = async () => {
    setAdminLoginLoading(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || currentUser.isAnonymous) {
        await signInWithGoogle({ adminIntent: true });
        return;
      }
      await verifyAdminAccess(currentUser);
    } catch (err) {
      console.error('管理員登入流程失敗：', err);
      if (err?.code === 'app/no-auth-user') {
        alert('尚未取得登入狀態，請先用 Google 登入後再試一次。');
      } else if (err?.code === 'permission-denied') {
        alert(`無法讀取 admins 權限：請確認已部署最新 Firestore 規則，且目前 Firebase 專案正確。\n\n${buildAuthDebugText(auth.currentUser?.uid)}`);
      } else if (err?.code === 'unavailable') {
        alert('Firestore 暫時無法連線，請稍後再試。');
      } else {
        alert(`管理員登入流程失敗：${err?.code || 'unknown-error'}`);
      }
    } finally {
      setAdminLoginLoading(false);
    }
  };

  const handleAdminLogout = async () => {
    try {
      await signOut(auth);
      navigateToMainPage(true);
    } catch (err) {
      console.error('登出失敗：', err);
    }
  };

  // 管理員：Dashboard - 監聽所有評分紀錄
  useEffect(() => {
    if (!isAdminPage || !isAdminUser) return;
    setAdminLoading(true);

    const unsub = onSnapshot(
      collection(db, 'ratings'),
      (snapshot) => {
        const list = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          list.push({ id: docSnap.id, ...d });
        });
        // 依時間排序（新到舊）
        list.sort((a, b) => {
          const ta = a.timestamp && typeof a.timestamp.toMillis === 'function' ? a.timestamp.toMillis() : 0;
          const tb = b.timestamp && typeof b.timestamp.toMillis === 'function' ? b.timestamp.toMillis() : 0;
          return tb - ta;
        });
        setAdminRatings(list);
        setAdminLoading(false);
      },
      (err) => {
        console.error('讀取 Dashboard 資料失敗：', err);
        setAdminLoading(false);
      }
    );

    return () => unsub();
  }, [isAdminPage, isAdminUser]);

  // 管理員資料篩選、搜尋、排序
  const filteredAndSortedAdminRatings = useMemo(() => {
    let result = [...adminRatings];

    // 搜尋篩選
    if (adminSearchText.trim()) {
      const searchLower = adminSearchText.toLowerCase();
      result = result.filter((r) => {
        return (
          r.presenter?.toLowerCase().includes(searchLower) ||
          r.topic?.toLowerCase().includes(searchLower) ||
          r.raterName?.toLowerCase().includes(searchLower) ||
          r.raterEmail?.toLowerCase().includes(searchLower) ||
          r.comment?.toLowerCase().includes(searchLower)
        );
      });
    }

    // 教室篩選
    if (adminRoomFilter !== 'ALL') {
      result = result.filter((r) => r.roomId === adminRoomFilter);
    }

    // 排序
    result.sort((a, b) => {
      if (adminSortBy === 'time-desc') {
        const ta = a.timestamp && typeof a.timestamp.toMillis === 'function' ? a.timestamp.toMillis() : 0;
        const tb = b.timestamp && typeof b.timestamp.toMillis === 'function' ? b.timestamp.toMillis() : 0;
        return tb - ta;
      } else if (adminSortBy === 'time-asc') {
        const ta = a.timestamp && typeof a.timestamp.toMillis === 'function' ? a.timestamp.toMillis() : 0;
        const tb = b.timestamp && typeof b.timestamp.toMillis === 'function' ? b.timestamp.toMillis() : 0;
        return ta - tb;
      } else if (adminSortBy === 'score-desc') {
        const avgA = calculateAverageScore(a.scores);
        const avgB = calculateAverageScore(b.scores);
        return avgB - avgA;
      } else if (adminSortBy === 'score-asc') {
        const avgA = calculateAverageScore(a.scores);
        const avgB = calculateAverageScore(b.scores);
        return avgA - avgB;
      } else if (adminSortBy === 'presenter') {
        return (a.presenter || '').localeCompare(b.presenter || '');
      }
      return 0;
    });

    return result;
  }, [adminRatings, adminSearchText, adminRoomFilter, adminSortBy]);

  // 統計數據
  const adminStats = useMemo(() => {
    const totalRatings = adminRatings.length;
    const uniqueRaters = new Set(adminRatings.map(r => r.raterUserId)).size;
    const totalScore = adminRatings.reduce((sum, r) => {
      return sum + calculateAverageScore(r.scores);
    }, 0);
    const avgScore = totalRatings > 0 ? totalScore / totalRatings : 0;

    const roomStats = {};
    adminRatings.forEach(r => {
      if (!roomStats[r.roomId]) {
        roomStats[r.roomId] = { count: 0, total: 0 };
      }
      roomStats[r.roomId].count += 1;
      roomStats[r.roomId].total += calculateAverageScore(r.scores);
    });

    const presenterStats = {};
    adminRatings.forEach(r => {
      if (!presenterStats[r.presenter]) {
        presenterStats[r.presenter] = { count: 0, total: 0 };
      }
      presenterStats[r.presenter].count += 1;
      presenterStats[r.presenter].total += calculateAverageScore(r.scores);
    });

    return {
      totalRatings,
      uniqueRaters,
      avgScore,
      roomStats,
      presenterStats,
    };
  }, [adminRatings]);

  // 分頁處理
  const paginatedRatings = useMemo(() => {
    if (adminPageSize === 0) return filteredAndSortedAdminRatings; // 顯示全部
    const startIdx = (adminCurrentPage - 1) * adminPageSize;
    return filteredAndSortedAdminRatings.slice(startIdx, startIdx + adminPageSize);
  }, [filteredAndSortedAdminRatings, adminCurrentPage, adminPageSize]);

  const totalPages = useMemo(() => {
    if (adminPageSize === 0) return 1;
    return Math.ceil(filteredAndSortedAdminRatings.length / adminPageSize);
  }, [filteredAndSortedAdminRatings.length, adminPageSize]);

  // 當篩選條件改變時重置頁碼
  useEffect(() => {
    setAdminCurrentPage(1);
  }, [adminSearchText, adminRoomFilter, adminSortBy, adminPageSize]);

  const handleExportCSV = () => {
    if (!adminRatings.length) {
      alert('目前沒有可匯出的評分資料');
      return;
    }
    setCsvExporting(true);
    try {
      const headers = [
        'roomId',
        'roomName',
        'presentationKey',
        'presenter',
        'topic',
        'session',
        ...SCORE_KEYS,
        'comment',
        'timestamp',
        'raterUserId',
        'raterName',
        'raterEmail',
        'anonymousUserId',
      ];

      const rows = adminRatings.map((r) => {
        const room = rooms.find((x) => x.id === r.roomId);
        const ts =
          r.timestamp && typeof r.timestamp.toDate === 'function'
            ? r.timestamp.toDate().toISOString()
            : '';
        const normalizedScores = normalizeScores(r.scores);
        const values = [
          r.roomId || '',
          room?.name || '',
          r.presentationKey || '',
          r.presenter || '',
          r.topic || '',
          r.session || '',
          ...SCORE_KEYS.map((key) => normalizedScores[key] ?? ''),
          r.comment || '',
          ts,
          r.raterUserId || '',
          r.raterName || '',
          r.raterEmail || '',
          r.anonymousUserId || '',
        ];
        return values
          .map((val) =>
            `"${String(val).replace(/"/g, '""')}"`
          )
          .join(',');
      });

      // 加上 UTF-8 BOM，避免 Excel 開啟中文亂碼
      const csvContent = [headers.join(','), ...rows].join('\r\n');
      const csvWithBom = `\uFEFF${csvContent}`;
      const blob = new Blob([csvWithBom], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sp26-ratings-dashboard.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('匯出 CSV 失敗：', err);
      alert('匯出 CSV 失敗，請稍後再試。');
    } finally {
      setCsvExporting(false);
    }
  };

  const handleClearAllRatings = async () => {
    if (!isAdminUser) {
      alert('只有管理員可以清空評分資料');
      return;
    }
    if (!adminRatings.length) {
      alert('目前沒有可清空的評分資料');
      return;
    }

    const secondConfirm = window.prompt('此操作會永久刪除所有 ratings。請輸入 DELETE 確認：', '');
    if (secondConfirm !== 'DELETE') {
      return;
    }

    setClearingRatings(true);
    try {
      // Firestore batch limit is 500 operations per commit, so delete in chunks.
      const allSnapshot = await getDocs(collection(db, 'ratings'));
      if (allSnapshot.empty) {
        alert('目前沒有可清空的評分資料');
        return;
      }

      const docs = allSnapshot.docs;
      const chunkSize = 450;
      for (let i = 0; i < docs.length; i += chunkSize) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + chunkSize);
        chunk.forEach((docSnap) => batch.delete(docSnap.ref));
        await batch.commit();
      }

      alert(`已清空 ratings，共刪除 ${docs.length} 筆資料。`);
    } catch (err) {
      console.error('清空 ratings 失敗：', err);
      if (err?.code === 'permission-denied') {
        alert('清空失敗：目前帳號沒有刪除權限，請確認為管理員且 Firestore 規則已發布。');
      } else {
        alert('清空 ratings 失敗，請稍後再試。');
      }
    } finally {
      setClearingRatings(false);
    }
  };

  const handleDeleteRating = async (ratingId) => {
    if (!isAdminUser) {
      alert('只有管理員可以刪除評分資料');
      return;
    }

    if (!window.confirm('確定要刪除這筆評分資料嗎？此操作無法復原。')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'ratings', ratingId));
    } catch (err) {
      console.error('刪除評分失敗：', err);
      if (err?.code === 'permission-denied') {
        alert('刪除失敗：目前帳號沒有刪除權限，請確認為管理員且 Firestore 規則已發布。');
      } else {
        alert('刪除評分失敗，請稍後再試。');
      }
    }
  };

  const handleAdminScoreAction = async (rating, action) => {
    try {
      const nextScores = normalizeScores(rating.scores);

      if (action === 'reset') {
        SCORE_KEYS.forEach((key) => {
          nextScores[key] = 0;
        });
      } else {
        const delta = action === 'inc' ? 1 : -1;
        SCORE_KEYS.forEach((key) => {
          nextScores[key] = Math.max(0, Math.min(10, (nextScores[key] || 0) + delta));
        });
      }

      await updateDoc(doc(db, 'ratings', rating.id), { scores: nextScores });
    } catch (err) {
      console.error('管理員調整分數失敗：', err);
      alert('調整分數失敗，請稍後再試');
    }
  };

  const handleOpenSchedule = useCallback(() => {
    if (!EVENT_SCHEDULE_URL) {
      alert('尚未設定本次發表會議程連結');
      return;
    }
    window.open(EVENT_SCHEDULE_URL, '_blank', 'noopener,noreferrer');
  }, []);

  const persistRoomChanges = useCallback(async (roomId, updater) => {
    const targetRoom = rooms.find((r) => r.id === roomId);
    if (!targetRoom) return;

    const nextRoom = updater(targetRoom);
    if (!nextRoom) return;

    await setDoc(
      doc(db, 'rooms', roomId),
      {
        id: roomId,
        name: nextRoom.name || roomId,
        theme: nextRoom.theme || '',
        presentations: Array.isArray(nextRoom.presentations)
          ? nextRoom.presentations.map((p) => ({
              ...p,
              session: p.session || '',
              time: p.time || '',
              presenter: p.presenter || '',
              topic: p.topic || '',
              '實習': p['實習'] || p.internshipTopic || '',
            }))
          : [],
      },
      { merge: true }
    );
  }, [rooms]);

  const initializeRooms = useCallback(async () => {
    if (!window.confirm('確定要初始化所有會議廳到 Firestore 嗎？')) {
      return;
    }
    try {
      for (let i = 0; i < INITIAL_ROOMS.length; i++) {
        const room = INITIAL_ROOMS[i];
        await setDoc(
          doc(db, 'rooms', room.id),
          {
            id: room.id,
            name: room.name,
            theme: room.theme,
            presentations: Array.isArray(room.presentations)
              ? room.presentations.map((p) => ({
                  ...p,
                  session: p.session || '',
                  time: p.time || '',
                  presenter: p.presenter || '',
                  topic: p.topic || '',
                  '實習': p['實習'] || p.internshipTopic || '',
                }))
              : [],
            order: i,
          },
          { merge: true }
        );
      }
      alert('會議廳初始化成功！');
    } catch (err) {
      console.error('初始化會議廳失敗：', err);
      alert('初始化失敗，請檢查 Firestore 權限設定或稍後再試。');
    }
  }, []);

  return (
    <div style={styles.app}>
      <header style={{ ...styles.header, ...(isMobile ? { padding: '12px 10px', alignItems: 'flex-start' } : {}) }}>
        <div>
          <div style={{ ...styles.headerTitle, ...(isMobile ? { fontSize: '1rem' } : {}) }}>🎓 {t('appTitle')}</div>
          <div style={{ ...styles.headerSub, ...(isMobile ? { fontSize: '0.72rem' } : {}) }}>
            {isAdminUser ? `${t('subAdmin')} · ${userProfile?.displayName || ''}` : t('subUser')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: isMobile ? 6 : 8, flexWrap: isMobile ? 'wrap' : 'nowrap', justifyContent: 'flex-end' }}>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            style={{
              ...styles.headerBtn,
              padding: isMobile ? '6px 8px' : '6px 10px',
              fontSize: isMobile ? '0.74rem' : '0.8rem',
              background: 'rgba(255,255,255,0.2)',
            }}
          >
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
          {isAdminUser && (
            <button style={{ ...styles.headerBtn, ...(isMobile ? { padding: '5px 7px', fontSize: '0.72rem' } : {}) }} onClick={handleAdminLogout}>
              <LogOut size={16} />
              {t('logout')}
            </button>
          )}
          <button style={{ ...styles.headerBtn, ...(isMobile ? { padding: '5px 7px', fontSize: '0.72rem' } : {}) }} onClick={handleOpenLeaderboard}>
            <BarChart3 size={16} />
            {t('leaderboard')}
          </button>
          <button style={{ ...styles.headerBtn, ...(isMobile ? { padding: '5px 7px', fontSize: '0.72rem' } : {}) }} onClick={handleOpenAdmin}>
            <Users size={16} />
            {t('admin')}
          </button>
        </div>
      </header>

      {!isAdminPage && (
      <main style={{ ...styles.main, ...(isMobile ? { padding: '14px 10px 40px' } : { maxWidth: 980, padding: '22px 22px 60px' }) }}>
        {!authReady ? (
          <div style={{ ...styles.card, ...(isMobile ? { borderRadius: 12, padding: 14, marginBottom: 12 } : {}) }}>
            <div style={styles.cardTitle}>
              <Users size={18} color="#1a73e8" />
              {t('loadingAuth')}
            </div>
            <div style={{ fontSize: '0.9rem', color: '#666' }}>{t('loadingHint')}</div>
          </div>
        ) : (
          <>
        <div style={{ ...styles.card, ...(isMobile ? { borderRadius: 12, padding: 14, marginBottom: 12 } : {}) }}>
          <div style={styles.cardTitle}>
            <CalendarDays size={18} color="#1a73e8" />
            {t('scheduleTitle')}
          </div>
          <div style={{ fontSize: '0.86rem', color: '#555', lineHeight: 1.6, marginBottom: 10 }}>
            {t('scheduleDesc')}
          </div>
          <button
            type="button"
            style={{
              ...styles.primaryBtn,
              marginTop: 0,
              opacity: EVENT_SCHEDULE_URL ? 1 : 0.7,
              cursor: EVENT_SCHEDULE_URL ? 'pointer' : 'not-allowed',
            }}
            onClick={handleOpenSchedule}
            disabled={!EVENT_SCHEDULE_URL}
          >
            {t('scheduleBtn')}
          </button>
          {!EVENT_SCHEDULE_URL && (
            <div style={{ fontSize: '0.78rem', color: '#888', marginTop: 8 }}>
              尚未設定連結，可於環境變數新增 REACT_APP_EVENT_SCHEDULE_URL。
            </div>
          )}
        </div>

        <div style={{ ...styles.card, ...(isMobile ? { borderRadius: 12, padding: 14, marginBottom: 12 } : {}) }}>
          <div style={styles.cardTitle}>
            <ChevronDown size={18} color="#1a73e8" />
            {t('chooseTitle')}
          </div>

          <select
            style={{ ...styles.select, ...(isMobile ? { fontSize: '0.9rem', padding: '11px 12px' } : {}) }}
            value={selectedRoom}
            onChange={(e) => {
              setSelectedRoom(e.target.value);
              setSelectedPresentationIdx('');
              setPresentationDrafts({});
            }}
          >
            <option value="">{t('chooseRoom')}</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>{room.name}</option>
            ))}
          </select>

          {currentRoom && (
            <div style={{ fontSize: '0.8rem', color: '#1a73e8', background: '#e8f0fe', padding: '8px 12px', borderRadius: 8, marginBottom: 10 }}>
              📌 主題：{currentRoom.theme}
            </div>
          )}
          {currentRoom && (
            <div style={{ fontSize: '0.8rem', color: '#1565c0', background: '#e3f2fd', padding: '8px 12px', borderRadius: 8, marginTop: 6 }}>
              請再選擇要評分的報告者，共 {currentRoom.presentations.length} 位同學
            </div>
          )}

          {currentRoom && (
            <select
              style={{ ...styles.select, marginTop: 10, marginBottom: 0, ...(isMobile ? { fontSize: '0.88rem', padding: '11px 12px' } : {}) }}
              value={selectedPresentationIdx}
              onChange={(e) => setSelectedPresentationIdx(e.target.value)}
            >
              <option value="">{t('choosePresenter')}</option>
              {currentRoom.presentations.map((presentation, idx) => (
                <option key={`${presentation.presenter}-${idx}`} value={String(idx)}>
                  [{presentation.session || '-'} {presentation.time || ''}] {presentation.presenter}
                  {presentation['實習'] ? ` - ${presentation['實習']}` : ''}
                </option>
              ))}
            </select>
          )}

        </div>

        {currentRoom && currentPresentation && (() => {
          const idx = Number(selectedPresentationIdx);
          const presentation = currentPresentation;
          const draft = getDraft(idx);
          const presentationKey = buildPresentationKey(selectedRoom, presentation);
          const alreadySubmitted = !isAdminUser && submittedPresentationKeys[presentationKey];
          const rowLocked = draft.submitting || alreadySubmitted;
          return (
            <div id="rating-page" key={`${presentation.presenter}-${idx}`} style={{ ...styles.card, ...(isMobile ? { borderRadius: 12, padding: 14, marginBottom: 12 } : {}) }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: '0.82rem', color: '#1a73e8', fontWeight: 600 }}>{t('ratingPage')}</div>
                <button
                  type="button"
                  onClick={() => setSelectedPresentationIdx('')}
                  style={{
                    border: '1px solid #90caf9',
                    background: '#e3f2fd',
                    color: '#1565c0',
                    borderRadius: 8,
                    padding: '4px 8px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  {t('reselect')}
                </button>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#333', background: '#f5f8ff', padding: '10px 14px', borderRadius: 8, lineHeight: 1.6, marginBottom: 12 }}>
                <span style={{ fontWeight: 600 }}>
                  {presentation.session ? `[${presentation.session}${presentation.time ? ` ${presentation.time}` : ''}] ` : ''}
                  {presentation.presenter}
                </span>
                <br />
                {presentation.topic || presentation.internshipTopic || presentation['實習'] || '未提供題目'}
              </div>

              <div style={styles.cardTitle}>
                <Star size={18} color="#f59e0b" fill="#f59e0b" />
                {t('scoreTitle')}
              </div>
              {SCORE_ITEMS.map((item) => (
                <div key={`${idx}-${item.key}`} style={{ ...styles.scoreRow, ...(isMobile ? { flexDirection: 'column', alignItems: 'stretch', gap: 8, marginBottom: 12 } : {}) }}>
                  <div style={{ ...styles.scoreLabel, ...(isMobile ? { width: 'auto', fontSize: '0.85rem' } : {}) }}>{item.label}</div>
                  <div style={{ ...styles.scoreButtons, ...(isMobile ? { gap: 3 } : {}) }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <button
                        key={n}
                        type="button"
                        style={styles.scoreBtn(draft.scores[item.key] === n, isMobile)}
                        disabled={rowLocked}
                        onClick={() =>
                          updateDraft(idx, (prev) => ({
                            ...prev,
                            scores: { ...prev.scores, [item.key]: n },
                          }))
                        }
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div style={{ ...styles.cardTitle, marginTop: 12 }}>
                <MessageSquare size={18} color="#1a73e8" />
                {t('feedbackTitle')}
              </div>
              <textarea
                style={{ ...styles.textarea, opacity: rowLocked ? 0.75 : 1, ...(isMobile ? { minHeight: 72, fontSize: '0.9rem' } : {}) }}
                placeholder="寫下您對這場報告的一句話回饋…"
                value={draft.comment}
                readOnly={rowLocked}
                onChange={(e) =>
                  updateDraft(idx, (prev) => ({ ...prev, comment: e.target.value }))
                }
                onFocus={(e) => (e.target.style.borderColor = '#1a73e8')}
                onBlur={(e) => (e.target.style.borderColor = '#e0e7ff')}
              />
              {alreadySubmitted && (
                <div style={{ fontSize: '0.8rem', color: '#2e7d32', background: '#e8f5e9', padding: '8px 10px', borderRadius: 8, marginTop: 8 }}>
                  您已提交過這位報告者的評分；一般使用者每位報告只能填一次。
                </div>
              )}

              <button
                type="button"
                style={{
                  ...styles.primaryBtn,
                  ...(isMobile ? { padding: '9px 10px', fontSize: '0.82rem' } : {}),
                  opacity: rowLocked ? 0.7 : 1,
                  cursor: rowLocked ? 'not-allowed' : 'pointer',
                }}
                onClick={() => handleSubmitForPresentation(presentation, idx)}
                disabled={rowLocked}
              >
                <Send size={18} />
                {draft.submitting ? '提交中…' : alreadySubmitted ? '已提交' : `提交 ${presentation.presenter} 評分`}
              </button>
            </div>
          );
        })()}

        <div style={styles.footer}>
          <p>© 2026 SP26 成果發表會 · 評分系統</p>
          <p style={{ marginTop: 4 }}>Powered by React · Firebase</p>
        </div>
          </>
        )}
      </main>
      )}

      <div style={styles.toast(showToast)}>
        <CheckCircle size={18} />
        評分已成功提交！感謝您的參與 🎉
      </div>

      {showLeaderboard && (
        <div style={styles.overlay} onClick={() => setShowLeaderboard(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>
                <Trophy size={20} color="#ffc107" />
                即時排行榜
              </div>
              <button
                type="button"
                aria-label="關閉"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                onClick={() => setShowLeaderboard(false)}
              >
                <X size={22} color="#666" />
              </button>
            </div>

            {leaderboardLoading ? (
              <div style={{ textAlign: 'center', padding: '32px', color: '#888' }}>載入中…</div>
            ) : leaderboardData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: '#888' }}>目前尚無評分資料</div>
            ) : (
              leaderboardData.map((item, idx) => {
                const rank = idx + 1;
                const room = rooms.find((r) => r.id === item.roomId);
                return (
                  <div key={idx} style={styles.rankItem(rank)}>
                    <div style={styles.rankNum(rank)}>{rank}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#222', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.presenter}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {room?.name} · {item.topic.length > 18 ? item.topic.slice(0, 18) + '…' : item.topic}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#1a73e8' }}>
                        {item.average.toFixed(1)}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#999' }}>{item.count} 票</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {showAdminLogin && (
        <div style={styles.overlay} onClick={() => !adminLoginLoading && setShowAdminLogin(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>
                <Users size={20} />
                管理員登入
              </div>
              <button
                type="button"
                aria-label="關閉"
                disabled={adminLoginLoading}
                style={{ background: 'none', border: 'none', cursor: adminLoginLoading ? 'not-allowed' : 'pointer', padding: 4 }}
                onClick={() => setShowAdminLogin(false)}
              >
                <X size={22} color="#666" />
              </button>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: 14, lineHeight: 1.5 }}>
              一般評分者使用匿名模式即可。若要進入管理員 Dashboard，請使用 Google 帳號登入，並在 Firestore 的 <strong>admins</strong> 集合中，以該帳號的 <strong>UID</strong> 作為文件 ID 建立一筆文件。
            </p>
            <button
              type="button"
              onClick={handleGoogleAdminLogin}
              disabled={adminLoginLoading || googleLoginLoading}
              style={{
                ...styles.primaryBtn,
                marginTop: 0,
                marginBottom: 12,
                background: '#fff',
                color: '#222',
                border: '1px solid #dadce0',
                opacity: adminLoginLoading || googleLoginLoading ? 0.7 : 1,
                cursor: adminLoginLoading || googleLoginLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {adminLoginLoading || googleLoginLoading ? '登入中…' : userId ? '用目前帳號驗證管理員權限' : '使用 Google 登入'}
            </button>
            <div style={{ textAlign: 'center', fontSize: '0.78rem', color: '#888', marginBottom: 12 }}>或使用 Email / 密碼</div>
            <form onSubmit={handleAdminLoginSubmit}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#333', marginBottom: 6 }}>Email</label>
              <input
                type="email"
                autoComplete="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                style={{ ...styles.textarea, minHeight: 44, marginBottom: 12 }}
                disabled={adminLoginLoading}
              />
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#333', marginBottom: 6 }}>密碼</label>
              <input
                type="password"
                autoComplete="current-password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                style={{ ...styles.textarea, minHeight: 44, marginBottom: 16 }}
                disabled={adminLoginLoading}
              />
              <button
                type="submit"
                style={{ ...styles.primaryBtn, opacity: adminLoginLoading ? 0.7 : 1, cursor: adminLoginLoading ? 'not-allowed' : 'pointer' }}
                disabled={adminLoginLoading}
              >
                {adminLoginLoading ? '登入中…' : '登入'}
              </button>
            </form>
          </div>
        </div>
      )}

      {isAdminPage && isAdminUser && (
        <main style={{ 
          width: '100%',
          minHeight: '100vh',
          padding: isMobile ? '14px 10px 40px' : '0',
          background: '#f5f7fa',
        }}>
          <div style={{ 
            ...styles.card, 
            marginTop: 0,
            borderRadius: 0,
            minHeight: '100vh',
            maxWidth: 'none',
            padding: isMobile ? '14px' : '20px 30px',
          }}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>
                <Table2 size={20} />
                {t('adminDashboard')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  style={{
                    ...styles.headerBtn,
                    background: 'rgba(26,115,232,0.1)',
                    border: '1px solid rgba(26,115,232,0.35)',
                    color: '#1a73e8',
                    padding: isMobile ? '4px 6px' : '6px 10px',
                    fontSize: isMobile ? '0.68rem' : '0.8rem',
                  }}
                  onClick={() => navigateToMainPage()}
                  title="返回一般評分頁"
                >
                  {t('backToVote')}
                </button>
                <button
                  type="button"
                  style={{
                    ...styles.headerBtn,
                    background: 'rgba(26,115,232,0.1)',
                    border: '1px solid rgba(26,115,232,0.35)',
                    color: '#1a73e8',
                    padding: isMobile ? '4px 6px' : '6px 10px',
                    fontSize: isMobile ? '0.68rem' : '0.8rem',
                  }}
                  onClick={handleAdminLogout}
                  title="登出目前帳號"
                >
                  <LogOut size={16} />
                  {t('endAdmin')}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 12, padding: isMobile ? '8px 10px' : '10px 12px', borderRadius: 10, background: '#e8f5e9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: isMobile ? '0.82rem' : '0.9rem', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={18} color="#2e7d32" />
                <span>目前在線人數：</span>
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>{onlineCount}</span>
              </div>
              <div style={{ fontSize: isMobile ? '0.68rem' : '0.75rem', color: '#555' }}>（最近 1 分鐘有心跳的使用者）</div>
            </div>

            {/* 統計卡片區 */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', 
              gap: isMobile ? 8 : 16, 
              marginBottom: 20 
            }}>
              <div style={{ padding: isMobile ? '10px 12px' : '16px 20px', borderRadius: 12, background: '#1976d2', color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                <div style={{ fontSize: isMobile ? '0.7rem' : '0.8rem', opacity: 0.9, marginBottom: 6 }}>總評分數</div>
                <div style={{ fontSize: isMobile ? '1.6rem' : '2.2rem', fontWeight: 700 }}>{adminStats.totalRatings}</div>
              </div>
              <div style={{ padding: isMobile ? '10px 12px' : '16px 20px', borderRadius: 12, background: '#388e3c', color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                <div style={{ fontSize: isMobile ? '0.7rem' : '0.8rem', opacity: 0.9, marginBottom: 6 }}>參與人數</div>
                <div style={{ fontSize: isMobile ? '1.6rem' : '2.2rem', fontWeight: 700 }}>{adminStats.uniqueRaters}</div>
              </div>
              <div style={{ padding: isMobile ? '10px 12px' : '16px 20px', borderRadius: 12, background: '#f57c00', color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                <div style={{ fontSize: isMobile ? '0.7rem' : '0.8rem', opacity: 0.9, marginBottom: 6 }}>平均分數</div>
                <div style={{ fontSize: isMobile ? '1.6rem' : '2.2rem', fontWeight: 700 }}>{adminStats.avgScore.toFixed(2)}</div>
              </div>
              <div style={{ padding: isMobile ? '10px 12px' : '16px 20px', borderRadius: 12, background: '#7b1fa2', color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                <div style={{ fontSize: isMobile ? '0.7rem' : '0.8rem', opacity: 0.9, marginBottom: 6 }}>顯示筆數</div>
                <div style={{ fontSize: isMobile ? '1.6rem' : '2.2rem', fontWeight: 700 }}>{filteredAndSortedAdminRatings.length}</div>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 8, flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 700, fontSize: isMobile ? '0.88rem' : '1.1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <BarChart3 size={20} color="#1a73e8" />
                  投票紀錄 Dashboard
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    disabled={csvExporting || clearingRatings || !adminRatings.length}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: isMobile ? '4px 6px' : '8px 14px',
                      borderRadius: 8,
                      border: '1px solid #1a73e8',
                      background: csvExporting || clearingRatings || !adminRatings.length ? '#e3f2fd' : '#fff',
                      color: '#1a73e8',
                      fontSize: isMobile ? '0.68rem' : '0.85rem',
                      cursor: csvExporting || clearingRatings || !adminRatings.length ? 'not-allowed' : 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    <Download size={16} />
                    {csvExporting ? '匯出中…' : '匯出 CSV'}
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllRatings}
                    disabled={clearingRatings || csvExporting || !adminRatings.length}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: isMobile ? '4px 6px' : '8px 14px',
                      borderRadius: 8,
                      border: '1px solid #d32f2f',
                      background: clearingRatings || csvExporting || !adminRatings.length ? '#ffebee' : '#fff',
                      color: '#c62828',
                      fontSize: isMobile ? '0.68rem' : '0.85rem',
                      cursor: clearingRatings || csvExporting || !adminRatings.length ? 'not-allowed' : 'pointer',
                      fontWeight: 500,
                    }}
                    title="永久刪除所有投票紀錄"
                  >
                    {clearingRatings ? '清空中…' : '一鍵清空 ratings'}
                  </button>
                </div>
              </div>

              {/* 搜尋與篩選區 */}
              <div style={{ marginBottom: 16, padding: isMobile ? '12px' : '16px 20px', border: '1px solid #e0e7ff', borderRadius: 12, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: isMobile ? '0.8rem' : '0.9rem', color: '#1a237e', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  🔍 搜尋與篩選
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                  <input
                    type="text"
                    placeholder="搜尋報告者、題目、評分者或評論..."
                    value={adminSearchText}
                    onChange={(e) => setAdminSearchText(e.target.value)}
                    style={{
                      flex: isMobile ? '1 1 100%' : '1 1 350px',
                      padding: isMobile ? '8px 10px' : '10px 14px',
                      border: '1px solid #d0d7de',
                      borderRadius: 8,
                      fontSize: isMobile ? '0.82rem' : '0.9rem',
                      outline: 'none',
                    }}
                  />
                  <select
                    value={adminRoomFilter}
                    onChange={(e) => setAdminRoomFilter(e.target.value)}
                    style={{
                      flex: isMobile ? '1 1 100%' : '0 0 200px',
                      padding: isMobile ? '8px 10px' : '10px 14px',
                      border: '1px solid #d0d7de',
                      borderRadius: 8,
                      fontSize: isMobile ? '0.82rem' : '0.9rem',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="ALL">全部教室</option>
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>{room.name}</option>
                    ))}
                  </select>
                  <select
                    value={adminSortBy}
                    onChange={(e) => setAdminSortBy(e.target.value)}
                    style={{
                      flex: isMobile ? '1 1 100%' : '0 0 170px',
                      padding: isMobile ? '8px 10px' : '10px 14px',
                      border: '1px solid #d0d7de',
                      borderRadius: 8,
                      fontSize: isMobile ? '0.82rem' : '0.9rem',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="time-desc">時間 ↓ 新到舊</option>
                    <option value="time-asc">時間 ↑ 舊到新</option>
                    <option value="score-desc">分數 ↓ 高到低</option>
                    <option value="score-asc">分數 ↑ 低到高</option>
                    <option value="presenter">報告者 A-Z</option>
                  </select>
                  {(adminSearchText || adminRoomFilter !== 'ALL') && (
                    <button
                      type="button"
                      onClick={() => {
                        setAdminSearchText('');
                        setAdminRoomFilter('ALL');
                      }}
                      style={{
                        padding: isMobile ? '8px 12px' : '10px 16px',
                        border: '1px solid #ef9a9a',
                        background: '#ffebee',
                        color: '#c62828',
                        borderRadius: 8,
                        fontSize: isMobile ? '0.78rem' : '0.85rem',
                        cursor: 'pointer',
                        fontWeight: 500,
                      }}
                    >
                      清除篩選
                    </button>
                  )}
                </div>
                <div style={{ fontSize: isMobile ? '0.7rem' : '0.78rem', color: '#546e7a' }}>
                  {filteredAndSortedAdminRatings.length === adminRatings.length
                    ? `顯示全部 ${adminRatings.length} 筆資料`
                    : `篩選後顯示 ${filteredAndSortedAdminRatings.length} / ${adminRatings.length} 筆`}
                </div>
              </div>

              {adminLoading ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#888', fontSize: isMobile ? '0.82rem' : '0.9rem' }}>載入中…</div>
              ) : filteredAndSortedAdminRatings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#888', fontSize: isMobile ? '0.82rem' : '0.95rem', background: '#fff', borderRadius: 12, border: '1px solid #eee' }}>沒有符合條件的評分資料</div>
              ) : (
                <>
                <div style={{ 
                  overflowX: 'auto', 
                  border: '1px solid #e0e0e0', 
                  borderRadius: 12, 
                  background: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                  <div style={{ maxHeight: isMobile ? 400 : 'calc(100vh - 480px)', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: isMobile ? '0.76rem' : '0.88rem' }}>
                      <thead>
                        <tr style={{ background: '#f8f9fa' }}>
                          <th style={{ padding: isMobile ? '12px 8px' : '14px 12px', borderBottom: '2px solid #dee2e6', textAlign: 'left', position: 'sticky', top: 0, background: '#f8f9fa', zIndex: 1, fontWeight: 600, whiteSpace: 'nowrap' }}>時間</th>
                          <th style={{ padding: isMobile ? '12px 8px' : '14px 12px', borderBottom: '2px solid #dee2e6', textAlign: 'left', position: 'sticky', top: 0, background: '#f8f9fa', zIndex: 1, fontWeight: 600, whiteSpace: 'nowrap' }}>評分帳號</th>
                          <th style={{ padding: isMobile ? '12px 8px' : '14px 12px', borderBottom: '2px solid #dee2e6', textAlign: 'left', position: 'sticky', top: 0, background: '#f8f9fa', zIndex: 1, fontWeight: 600, whiteSpace: 'nowrap' }}>教室</th>
                          <th style={{ padding: isMobile ? '12px 8px' : '14px 12px', borderBottom: '2px solid #dee2e6', textAlign: 'left', position: 'sticky', top: 0, background: '#f8f9fa', zIndex: 1, fontWeight: 600, whiteSpace: 'nowrap' }}>報告者</th>
                          <th style={{ padding: isMobile ? '12px 8px' : '14px 12px', borderBottom: '2px solid #dee2e6', textAlign: 'left', position: 'sticky', top: 0, background: '#f8f9fa', zIndex: 1, fontWeight: 600, minWidth: '200px' }}>題目</th>
                          <th style={{ padding: isMobile ? '12px 6px' : '14px 10px', borderBottom: '2px solid #dee2e6', textAlign: 'center', position: 'sticky', top: 0, background: '#f8f9fa', zIndex: 1, fontWeight: 600, whiteSpace: 'nowrap' }}>架構</th>
                          <th style={{ padding: isMobile ? '12px 6px' : '14px 10px', borderBottom: '2px solid #dee2e6', textAlign: 'center', position: 'sticky', top: 0, background: '#f8f9fa', zIndex: 1, fontWeight: 600, whiteSpace: 'nowrap' }}>流暢</th>
                          <th style={{ padding: isMobile ? '12px 6px' : '14px 10px', borderBottom: '2px solid #dee2e6', textAlign: 'center', position: 'sticky', top: 0, background: '#f8f9fa', zIndex: 1, fontWeight: 600, whiteSpace: 'nowrap' }}>專業</th>
                          <th style={{ padding: isMobile ? '12px 6px' : '14px 10px', borderBottom: '2px solid #dee2e6', textAlign: 'center', position: 'sticky', top: 0, background: '#f8f9fa', zIndex: 1, fontWeight: 600, whiteSpace: 'nowrap' }}>視覺</th>
                          <th style={{ padding: isMobile ? '12px 6px' : '14px 10px', borderBottom: '2px solid #dee2e6', textAlign: 'center', position: 'sticky', top: 0, background: '#f8f9fa', zIndex: 1, fontWeight: 600, whiteSpace: 'nowrap' }}>平均</th>
                          <th style={{ padding: isMobile ? '12px 8px' : '14px 12px', borderBottom: '2px solid #dee2e6', textAlign: 'left', position: 'sticky', top: 0, background: '#f8f9fa', zIndex: 1, fontWeight: 600, minWidth: '180px' }}>回饋</th>
                          <th style={{ padding: isMobile ? '12px 8px' : '14px 12px', borderBottom: '2px solid #dee2e6', textAlign: 'center', position: 'sticky', top: 0, background: '#f8f9fa', zIndex: 1, fontWeight: 600, whiteSpace: 'nowrap' }}>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedRatings.map((r) => {
                        const room = rooms.find((x) => x.id === r.roomId);
                        const ts =
                          r.timestamp && typeof r.timestamp.toDate === 'function'
                            ? r.timestamp.toDate()
                            : null;
                        const timeStr = ts
                          ? `${ts.getHours().toString().padStart(2, '0')}:${ts.getMinutes().toString().padStart(2, '0')}`
                          : '';
                        const displayScores = normalizeScores(r.scores);
                        const avgScore = calculateAverageScore(r.scores);
                        return (
                          <tr key={r.id} style={{ borderBottom: '1px solid #f0f0f0', ':hover': { background: '#f8f9fa' } }}>
                            <td style={{ padding: isMobile ? '10px 8px' : '12px 12px', whiteSpace: 'nowrap' }}>{timeStr}</td>
                            <td style={{ padding: isMobile ? '10px 8px' : '12px 12px', whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.raterEmail || r.raterUserId || ''}>
                              {r.raterName || r.raterEmail || (r.raterUserId ? `${r.raterUserId.slice(0, 8)}…` : '-')}
                            </td>
                            <td style={{ padding: isMobile ? '10px 8px' : '12px 12px', whiteSpace: 'nowrap' }}>{room?.name || r.roomId}</td>
                            <td style={{ padding: isMobile ? '10px 8px' : '12px 12px', whiteSpace: 'nowrap', fontWeight: 500 }}>{r.presenter}</td>
                            <td style={{ padding: isMobile ? '10px 8px' : '12px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.topic}</td>
                            <td style={{ padding: isMobile ? '10px 6px' : '12px 10px', textAlign: 'center', fontWeight: 500 }}>{displayScores.structure}</td>
                            <td style={{ padding: isMobile ? '10px 6px' : '12px 10px', textAlign: 'center', fontWeight: 500 }}>{displayScores.fluency}</td>
                            <td style={{ padding: isMobile ? '10px 6px' : '12px 10px', textAlign: 'center', fontWeight: 500 }}>{displayScores.professionalism}</td>
                            <td style={{ padding: isMobile ? '10px 6px' : '12px 10px', textAlign: 'center', fontWeight: 500 }}>{displayScores.visualDesign}</td>
                            <td style={{ padding: isMobile ? '10px 6px' : '12px 10px', textAlign: 'center', fontWeight: 700, color: avgScore >= 8 ? '#2e7d32' : avgScore >= 6 ? '#1976d2' : '#ef6c00' }}>{avgScore.toFixed(1)}</td>
                            <td style={{ padding: isMobile ? '10px 8px' : '12px 12px', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.comment}</td>
                            <td style={{ padding: isMobile ? '10px 8px' : '12px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', gap: 5, justifyContent: 'center', flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  onClick={() => handleAdminScoreAction(r, 'inc')}
                                  style={{ border: '1px solid #81c784', background: '#e8f5e9', color: '#2e7d32', borderRadius: 6, padding: isMobile ? '5px 10px' : '6px 12px', fontSize: isMobile ? '0.72rem' : '0.78rem', cursor: 'pointer', fontWeight: 500 }}
                                  title="所有分數 +1"
                                >
                                  +1
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAdminScoreAction(r, 'dec')}
                                  style={{ border: '1px solid #ffcc80', background: '#fff3e0', color: '#ef6c00', borderRadius: 6, padding: isMobile ? '5px 10px' : '6px 12px', fontSize: isMobile ? '0.72rem' : '0.78rem', cursor: 'pointer', fontWeight: 500 }}
                                  title="所有分數 -1"
                                >
                                  -1
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!window.confirm('確定要把這筆投票四項分數全部重置為 0 嗎？')) return;
                                    handleAdminScoreAction(r, 'reset');
                                  }}
                                  style={{ border: '1px solid #ef9a9a', background: '#ffebee', color: '#c62828', borderRadius: 6, padding: isMobile ? '5px 10px' : '6px 12px', fontSize: isMobile ? '0.72rem' : '0.78rem', cursor: 'pointer', fontWeight: 500 }}
                                  title="重置所有分數為 0"
                                >
                                  重置
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRating(r.id)}
                                  style={{ border: '1px solid #e57373', background: '#ffebee', color: '#d32f2f', borderRadius: 6, padding: isMobile ? '5px 10px' : '6px 12px', fontSize: isMobile ? '0.72rem' : '0.78rem', cursor: 'pointer', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}
                                  title="刪除此筆評分"
                                >
                                  <Trash2 size={14} />
                                  刪除
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>

                {/* 分頁控制 */}
                {filteredAndSortedAdminRatings.length > 0 && (
                  <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: isMobile ? '10px 12px' : '14px 16px', background: '#fff', borderRadius: 10, border: '1px solid #e0e0e0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: isMobile ? '0.78rem' : '0.88rem' }}>
                      <span style={{ fontWeight: 500 }}>每頁顯示：</span>
                      <select
                        value={adminPageSize}
                        onChange={(e) => setAdminPageSize(Number(e.target.value))}
                        style={{
                          padding: '6px 10px',
                          border: '1px solid #d0d7de',
                          borderRadius: 6,
                          fontSize: isMobile ? '0.78rem' : '0.85rem',
                          cursor: 'pointer',
                        }}
                      >
                        <option value={20}>20 筆</option>
                        <option value={50}>50 筆</option>
                        <option value={100}>100 筆</option>
                        <option value={0}>全部</option>
                      </select>
                    </div>
                    {adminPageSize > 0 && totalPages > 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => setAdminCurrentPage(Math.max(1, adminCurrentPage - 1))}
                          disabled={adminCurrentPage === 1}
                          style={{
                            padding: '6px 14px',
                            border: '1px solid #d0d7de',
                            background: adminCurrentPage === 1 ? '#f0f0f0' : '#fff',
                            borderRadius: 6,
                            fontSize: isMobile ? '0.76rem' : '0.85rem',
                            cursor: adminCurrentPage === 1 ? 'not-allowed' : 'pointer',
                            fontWeight: 500,
                          }}
                        >
                          ← 上一頁
                        </button>
                        <span style={{ fontSize: isMobile ? '0.78rem' : '0.88rem', padding: '0 10px', fontWeight: 500 }}>
                          {adminCurrentPage} / {totalPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setAdminCurrentPage(Math.min(totalPages, adminCurrentPage + 1))}
                          disabled={adminCurrentPage === totalPages}
                          style={{
                            padding: '6px 14px',
                            border: '1px solid #d0d7de',
                            background: adminCurrentPage === totalPages ? '#f0f0f0' : '#fff',
                            borderRadius: 6,
                            fontSize: isMobile ? '0.76rem' : '0.85rem',
                            cursor: adminCurrentPage === totalPages ? 'not-allowed' : 'pointer',
                            fontWeight: 500,
                          }}
                        >
                          下一頁 →
                        </button>
                      </div>
                    )}
                  </div>
                )}
                </>
              )}
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 700, fontSize: isMobile ? '0.9rem' : '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Table2 size={18} color="#5e35b1" />
                  課程與老師管理
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: isMobile ? '0.7rem' : '0.78rem', color: '#777' }}>（此區操作會同步寫入 Firestore rooms，前台會即時更新）</span>
                  <button
                    type="button"
                    style={{ border: '1px solid #ff6b6b', background: '#fff', color: '#ff6b6b', borderRadius: 8, padding: isMobile ? '8px 10px' : '6px 12px', fontSize: isMobile ? '0.78rem' : '0.8rem', cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap' }}
                    onClick={initializeRooms}
                  >
                    🔄 初始化會議廳
                  </button>
                </div>
              </div>
              <div style={{ maxHeight: isMobile ? 500 : 600, overflowY: 'auto', border: '1px solid #eee', borderRadius: 10, padding: isMobile ? 12 : 16, fontSize: isMobile ? '0.82rem' : '0.88rem' }}>
                {rooms.map((room) => (
                  <div key={room.id} style={{ marginBottom: 20, borderBottom: '1px solid #e0e0e0', paddingBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: 10, gap: 8, flexDirection: isMobile ? 'column' : 'row' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: '#1a237e', fontSize: isMobile ? '0.95rem' : '1.05rem', marginBottom: 4 }}>
                          {room.name}（{room.id}）
                        </div>
                        <div style={{ fontSize: isMobile ? '0.8rem' : '0.85rem', color: '#555', marginTop: 4 }}>主題：{room.theme}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button
                          type="button"
                          style={{ border: '1px solid #5e35b1', background: '#fff', color: '#5e35b1', borderRadius: 8, padding: isMobile ? '8px 12px' : '6px 12px', fontSize: isMobile ? '0.82rem' : '0.8rem', cursor: 'pointer', fontWeight: 500 }}
                          onClick={async () => {
                            const newName = window.prompt('請輸入教室名稱', room.name);
                            if (newName == null || newName.trim() === '') return;
                            const newTheme = window.prompt('請輸入主題', room.theme);
                            if (newTheme == null || newTheme.trim() === '') return;
                            try {
                              await persistRoomChanges(room.id, (target) => ({
                                ...target,
                                name: newName.trim(),
                                theme: newTheme.trim(),
                              }));
                            } catch (err) {
                              console.error('更新教室失敗：', err);
                              alert('更新教室失敗，請稍後再試。');
                            }
                          }}
                        >
                          編輯教室
                        </button>
                      </div>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      {room.presentations.map((p, idx) => (
                        <div key={idx} style={{ 
                          display: 'flex', 
                          alignItems: isMobile ? 'flex-start' : 'center', 
                          gap: isMobile ? 6 : 10, 
                          fontSize: isMobile ? '0.8rem' : '0.85rem', 
                          marginBottom: isMobile ? 12 : 8,
                          padding: isMobile ? '10px 8px' : '8px 6px',
                          background: '#fafafa',
                          borderRadius: 8,
                          flexDirection: isMobile ? 'column' : 'row'
                        }}>
                          <div style={{ display: 'flex', gap: 8, width: isMobile ? '100%' : 'auto', flexWrap: 'wrap' }}>
                            <span style={{ color: '#666', minWidth: isMobile ? 40 : 50, fontWeight: 500 }}>{p.session || '-'}</span>
                            <span style={{ color: '#666', minWidth: isMobile ? 90 : 100, fontWeight: 500 }}>{p.time || ''}</span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0, width: isMobile ? '100%' : 'auto' }}>
                            <div style={{ fontWeight: 600, color: '#333', marginBottom: 3 }}>{p.presenter}</div>
                            <div style={{ color: '#555', fontSize: isMobile ? '0.78rem' : '0.82rem', lineHeight: 1.4 }}>{p.topic}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0, width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'flex-end' : 'flex-start' }}>
                            <button
                              type="button"
                              style={{ border: '1px solid #90caf9', background: '#e3f2fd', color: '#1565c0', borderRadius: 8, padding: isMobile ? '8px 12px' : '4px 10px', fontSize: isMobile ? '0.78rem' : '0.75rem', cursor: 'pointer', fontWeight: 500 }}
                              onClick={async () => {
                                const session = window.prompt('場次（例如 S1）', p.session || '');
                                if (session == null) return;
                                const time = window.prompt('時間（例如 10:05-10:20）', p.time || '');
                                if (time == null) return;
                                const presenter = window.prompt('報告者 / 老師姓名', p.presenter || '');
                                if (presenter == null || presenter.trim() === '') return;
                                const topic = window.prompt('題目', p.topic || '');
                                if (topic == null || topic.trim() === '') return;
                                try {
                                  await persistRoomChanges(room.id, (target) => ({
                                    ...target,
                                    presentations: target.presentations.map((pp, i) =>
                                      i === idx
                                        ? {
                                            ...pp,
                                            session: session.trim(),
                                            time: time.trim(),
                                            presenter: presenter.trim(),
                                            topic: topic.trim(),
                                          }
                                        : pp
                                    ),
                                  }));
                                } catch (err) {
                                  console.error('更新報告失敗：', err);
                                  alert('更新報告失敗，請稍後再試。');
                                }
                              }}
                            >
                              編輯
                            </button>
                            <button
                              type="button"
                              style={{ border: '1px solid #ef9a9a', background: '#ffebee', color: '#c62828', borderRadius: 8, padding: isMobile ? '8px 12px' : '4px 10px', fontSize: isMobile ? '0.78rem' : '0.75rem', cursor: 'pointer', fontWeight: 500 }}
                              onClick={async () => {
                                if (!window.confirm('確定要刪除這筆報告嗎？')) return;
                                try {
                                  await persistRoomChanges(room.id, (target) => ({
                                    ...target,
                                    presentations: target.presentations.filter((_, i) => i !== idx),
                                  }));
                                } catch (err) {
                                  console.error('刪除報告失敗：', err);
                                  alert('刪除報告失敗，請稍後再試。');
                                }
                              }}
                            >
                              刪除
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        style={{ 
                          marginTop: 8, 
                          border: '1px dashed #4caf50', 
                          background: '#e8f5e9', 
                          color: '#2e7d32', 
                          borderRadius: 8, 
                          padding: isMobile ? '10px 16px' : '6px 12px', 
                          fontSize: isMobile ? '0.82rem' : '0.78rem', 
                          cursor: 'pointer',
                          fontWeight: 500,
                          width: isMobile ? '100%' : 'auto'
                        }}
                        onClick={async () => {
                          const session = window.prompt('場次（例如 S1）', '');
                          if (session == null) return;
                          const time = window.prompt('時間（例如 10:05-10:20）', '');
                          if (time == null) return;
                          const presenter = window.prompt('報告者 / 老師姓名', '');
                          if (presenter == null || presenter.trim() === '') return;
                          const topic = window.prompt('題目', '');
                          if (topic == null || topic.trim() === '') return;
                          try {
                            await persistRoomChanges(room.id, (target) => ({
                              ...target,
                              presentations: [
                                ...target.presentations,
                                {
                                  session: session.trim(),
                                  time: time.trim(),
                                  presenter: presenter.trim(),
                                  topic: topic.trim(),
                                },
                              ],
                            }));
                          } catch (err) {
                            console.error('新增報告失敗：', err);
                            alert('新增報告失敗，請稍後再試。');
                          }
                        }}
                      >
                        ＋ 新增報告
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      )}
      <Analytics />
    </div>
  );
}

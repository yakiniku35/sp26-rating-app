import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, onSnapshot, serverTimestamp, doc, setDoc, deleteDoc, updateDoc, getDoc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';
import { Star, Send, BarChart3, MessageSquare, ChevronDown, X, Trophy, CheckCircle, Users, Table2, Download, LogOut, CalendarDays } from 'lucide-react';

// 請將以下 placeholder 替換為您在 Firebase Console 取得的實際設定值
// const firebaseConfig = {
//   apiKey: 'YOUR_FIREBASE_API_KEY',
//   authDomain: 'YOUR_PROJECT.firebaseapp.com',
//   projectId: 'YOUR_PROJECT_ID',
//   storageBucket: 'YOUR_PROJECT.appspot.com',
//   messagingSenderId: 'YOUR_SENDER_ID',
//   appId: 'YOUR_APP_ID',
// };

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY';
const EVENT_SCHEDULE_URL = process.env.REACT_APP_EVENT_SCHEDULE_URL || '';

const app = initializeApp(firebaseConfig);
// Firebase Analytics 需要 `measurementId`，避免未設定時初始化失敗
if (firebaseConfig.measurementId) {
  getAnalytics(app);
}
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
const GOOGLE_AUTH_ERROR_MESSAGE = 'Google 登入失敗，請確認 Firebase Authentication 已啟用 Google 登入，且已把目前網域加入 Authorized domains。';
const ADMIN_LOGIN_INTENT_KEY = 'sp26-admin-login-intent';
const ADMIN_PATH = '/admin';

function buildAuthDebugText(uid) {
  return `目前 projectId: ${firebaseConfig.projectId || '未設定'}\n目前 uid: ${uid || '未登入'}`;
}

function prefersRedirectLogin() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent);
}

const ROOMS = [
  {
    id: 'A646',
    name: 'A646 階梯型會議廳',
    theme: '地緣政治、軍事戰略、政策、經貿',
    presentations: [
      { session: 'S1', time: '10:05-10:20', presenter: '伯煜昆 Walker', topic: '財團法人國策研究院文教基金會－臺灣政府如何維持現狀' },
      { session: 'S1', time: '10:20-10:35', presenter: '宋詩琳 Priyanka', topic: '2016 年政黨輪替後民進黨與國民黨兩岸政策的差異性：國家認同與戰略思維的比較' },
      { session: 'S1', time: '10:35-10:50', presenter: '羅福山 Sean', topic: '美國科技巨頭對政府決策之影響及其對臺的利弊' },
      { session: 'S1', time: '10:50-11:05', presenter: '蘇蘭珺 Sophia', topic: '臺灣海峽灰色地帶行動之研究：以海上運輸與關鍵基礎設施為核心' },
      { session: 'S2', time: '11:15-11:30', presenter: '英慧 Cyrus', topic: '臺灣勞動基準法對加班的影響' },
      { session: 'S2', time: '11:30-11:45', presenter: '郭恩美 Amy', topic: '美國關稅政策對臺灣農漁產品出口影響之分析' },
      { session: 'S2', time: '11:45-12:00', presenter: '淦波帆 Katelynn', topic: '中國「數字絲綢之路」倡議對臺灣的影響' },
      { session: 'S2', time: '12:00-12:15', presenter: '何維明', topic: '伊朗戰爭的原因與影響' },
      { session: 'S3', time: '13:50-14:05', presenter: '伯煜昆 Walker', topic: '反送中之後香港的移民潮' },
      { session: 'S3', time: '14:05-14:20', presenter: '馬麗莎 Alyssa', topic: '臺灣的城市外交--以臺北為例' },
      { session: 'S3', time: '14:20-14:35', presenter: '白敏樂 Emily', topic: '中國在拉丁美洲的雙重用途基礎建設--以阿根廷內烏肯省深空站為例' },
      { session: 'S4', time: '14:45-15:00', presenter: '英慧 Cyrus', topic: '碁石智庫－金融資料分析過程' },
      { session: 'S4', time: '15:00-15:15', presenter: '賀新 Jaden', topic: '虛假訊息對臺灣關鍵基礎設施的威脅' },
      { session: 'S4', time: '15:15-15:30', presenter: '麥世寧 Sean', topic: '臺灣半總統制的理論與現實：從制度設計到政治運作的權責分析' },
    ],
  },
  {
    id: 'A604',
    name: 'A604 個案教室',
    theme: '心理、教育、人文藝術、行為分析',
    presentations: [
      { session: 'S1', time: '10:05-10:20', presenter: '林小聖 Sage', topic: '黑田視覺整合有限公司－人際關係對小型設計公司的重要性' },
      { session: 'S1', time: '10:20-10:35', presenter: '范露莎 Larissa', topic: '自閉症患者社交偽裝對心理健康的影響' },
      { session: 'S1', time: '10:35-10:50', presenter: '華美珍', topic: '自閉症兒童的學習過程' },
      { session: 'S1', time: '10:50-11:05', presenter: '竹麗 Julia', topic: '臺美大學生理財行為的比較' },
      { session: 'S2', time: '11:15-11:30', presenter: '柯海琳 Kailyn', topic: '城鄉差距與臺灣雙語教育成效之關聯' },
      { session: 'S2', time: '11:30-11:45', presenter: '江雨川 Emma', topic: '小團體策略對 ASD/ADHD 學生情緒調節與人際互動之影響' },
      { session: 'S2', time: '11:45-12:00', presenter: '郭吉達 Gilda', topic: 'AI 語音合成中的「口音」與「偏見」' },
      { session: 'S2', time: '12:00-12:15', presenter: '梁安妮 Annie', topic: '以代理式人工智慧建構對話式購物推薦系統：以滑鼠選購情境為例' },
      { session: 'S3', time: '13:50-14:05', presenter: '范露莎 Larissa', topic: '社團中華民國自閉症總會－自閉症患者在職場的溝通策略' },
      { session: 'S3', time: '14:05-14:20', presenter: '楊子璇 Elizabeth', topic: '臺灣的原住民語言復興運動' },
      { session: 'S3', time: '14:20-14:35', presenter: '貝責 Beyza', topic: '臺灣原住民如何使用藝術進行文化抵抗與保留' },
      { session: 'S4', time: '14:45-15:00', presenter: '柯海琳 Kailyn', topic: '博物館作為第二教室－故宮博物院的教育功能探討' },
      { session: 'S4', time: '15:00-15:15', presenter: '郭琳熙 Gwendolyn', topic: '走進青銅時代｜「赫列克蘇爾」的古代墳墓' },
      { session: 'S4', time: '15:15-15:30', presenter: '林小聖 Sage', topic: '比較臺美字型創作與產業概況' },
    ],
  },
  {
    id: 'A605',
    name: 'A605 個案教室',
    theme: 'AI、軟體、半導體、醫療、資安、環境',
    presentations: [
      { session: 'S1', time: '10:05-10:20', presenter: '彭毅 Brandon', topic: '網絡安全：無聲的守護者' },
      { session: 'S1', time: '10:20-10:35', presenter: '楊怡珠 Emma', topic: '非英語母語者學習編程的挑戰' },
      { session: 'S1', time: '10:35-10:50', presenter: '福媛芳 Emily', topic: '知己知彼：孫子兵法在網絡防禦中的運用' },
      { session: 'S1', time: '10:50-11:05', presenter: '徐芯怡 Katherine', topic: '國立陽明交通大學－醫療影像(X射線)與物質相互作用的屏蔽機制' },
      { session: 'S2', time: '11:15-11:30', presenter: '何安娜 Anashelly', topic: '衰老對疫苗免疫反應的影響' },
      { session: 'S2', time: '11:30-11:45', presenter: '冉爍蕊 Carolyn', topic: '臺灣的垃圾管理制度' },
      { session: 'S2', time: '11:45-12:00', presenter: '金達 Tegan', topic: '人工智能對於會計產業的影響' },
      { session: 'S2', time: '12:00-12:15', presenter: '謝劉燁', topic: '心得分享--《淺談 AI 發展浪潮下企業營業秘密保護因應對策》' },
      { session: 'S3', time: '13:50-14:05', presenter: '徐芯怡 Katherine', topic: '美國與臺灣醫療制度的比較--以闌尾炎為例' },
      { session: 'S3', time: '14:05-14:20', presenter: '羅福山 Sean', topic: '工業技術研究院－防禦科技產業供應鏈的全球化' },
      { session: 'S3', time: '14:20-14:35', presenter: '蘇蘭珺 Sophia', topic: '工業技術研究院－防禦科技產業供應鏈的全球化' },
      { session: 'S4', time: '14:45-15:00', presenter: '詹彬禮 Brooklyn', topic: 'AI 與自主機器人在半導體製造產業中的應用：機械工程師角色的轉變' },
      { session: 'S4', time: '15:00-15:15', presenter: '楊怡珠 Emma', topic: '崧旭資訊股份有限公司－共享開發文件在軟體發展中的重要性' },
      { session: 'S4', time: '15:15-15:30', presenter: '郭恩美 Amy', topic: '臺灣金融研訓院－人工智能在招募流程中的應用' },
    ],
  },
];

const SCORE_ITEMS = [
  { key: 'professionalism', label: '內容專業度', emoji: '📚' },
  { key: 'fluency', label: '表達流暢度', emoji: '🎤' },
  { key: 'visual', label: '視覺設計感', emoji: '🎨' },
  { key: 'inspiration', label: '整體啟發性', emoji: '💡' },
];

function buildPresentationKey(roomId, presentation) {
  return encodeURIComponent([
    roomId,
    presentation.session || '',
    presentation.time || '',
    presentation.presenter || '',
    presentation.topic || '',
  ].join('||'));
}

function buildRatingDocId(userId, presentationKey) {
  return `${userId}_${presentationKey}`;
}

async function generateAIComment(topic, scores) {
  const prompt = `這位學生報告的題目是「${topic}」，觀眾給的評分為：內容專業度 ${scores.professionalism}/10、表達流暢度 ${scores.fluency}/10、視覺設計感 ${scores.visual}/10、整體啟發性 ${scores.inspiration}/10。請用繁體中文寫一段 50 字以內、溫暖鼓勵的評語。`;
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  if (!res.ok) throw new Error('Gemini API 呼叫失敗');
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '謝謝您精彩的分享！';
}

const styles = {
  app: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #e8f0fe 0%, #f0f4f8 50%, #e8f4fd 100%)',
    fontFamily: "'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif",
  },
  header: {
    background: 'linear-gradient(90deg, #1a73e8 0%, #0d47a1 100%)',
    color: '#fff',
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 2px 8px rgba(26,115,232,0.4)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  headerTitle: {
    fontSize: '1.2rem',
    fontWeight: 700,
    letterSpacing: '0.02em',
  },
  headerSub: {
    fontSize: '0.75rem',
    opacity: 0.85,
    marginTop: 2,
  },
  headerBtn: {
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: 8,
    color: '#fff',
    padding: '8px 12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: '0.85rem',
    transition: 'background 0.2s',
  },
  main: {
    maxWidth: 640,
    margin: '0 auto',
    padding: '20px 16px 60px',
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
    padding: '20px',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#1a237e',
    marginBottom: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  select: {
    width: '100%',
    padding: '12px 14px',
    border: '2px solid #e0e7ff',
    borderRadius: 10,
    fontSize: '0.95rem',
    color: '#333',
    background: '#fff',
    appearance: 'none',
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%231a73e8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    cursor: 'pointer',
    outline: 'none',
    transition: 'border-color 0.2s',
    marginBottom: 10,
  },
  scoreRow: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  scoreLabel: {
    fontSize: '0.9rem',
    color: '#444',
    width: 100,
    flexShrink: 0,
  },
  scoreButtons: {
    display: 'flex',
    gap: 4,
    flexWrap: 'wrap',
  },
  scoreBtn: (active, compact = false) => ({
    width: compact ? 30 : 32,
    height: compact ? 30 : 32,
    borderRadius: 6,
    border: active ? '2px solid #1a73e8' : '2px solid #e0e7ff',
    background: active ? 'linear-gradient(135deg, #1a73e8, #0d47a1)' : '#f5f8ff',
    color: active ? '#fff' : '#666',
    fontSize: compact ? '0.8rem' : '0.85rem',
    fontWeight: active ? 700 : 400,
    cursor: 'pointer',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  textarea: {
    width: '100%',
    padding: '12px',
    border: '2px solid #e0e7ff',
    borderRadius: 10,
    fontSize: '0.95rem',
    resize: 'vertical',
    minHeight: 80,
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  },
  primaryBtn: {
    width: '100%',
    padding: '14px',
    background: 'linear-gradient(90deg, #1a73e8 0%, #0d47a1 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'opacity 0.2s, transform 0.1s',
    marginTop: 8,
  },
  aiBtn: {
    padding: '10px 16px',
    background: '#eef5ff',
    color: '#1a73e8',
    border: '1px solid #cfe2ff',
    borderRadius: 10,
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    transition: 'opacity 0.2s',
  },
  toast: (show) => ({
    position: 'fixed',
    bottom: 24,
    left: '50%',
    transform: show ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(100px)',
    background: '#1b5e20',
    color: '#fff',
    padding: '14px 24px',
    borderRadius: 12,
    fontWeight: 600,
    fontSize: '0.95rem',
    boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
    transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  }),
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  modal: {
    background: '#fff',
    borderRadius: '20px 20px 0 0',
    padding: '24px 20px',
    width: '100%',
    maxWidth: 640,
    maxHeight: '80vh',
    overflowY: 'auto',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#1a237e',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  rankItem: (rank) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px',
    borderRadius: 10,
    marginBottom: 8,
    background: rank === 1 ? '#fff8e1' : rank === 2 ? '#f5f5f5' : rank === 3 ? '#fbe9e7' : '#fafafa',
    border: rank === 1 ? '1px solid #ffc107' : '1px solid #eee',
  }),
  rankNum: (rank) => ({
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: rank === 1 ? '#ffc107' : rank === 2 ? '#9e9e9e' : rank === 3 ? '#ff7043' : '#e0e0e0',
    color: rank <= 3 ? '#fff' : '#666',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '0.85rem',
    flexShrink: 0,
  }),
  footer: {
    textAlign: 'center',
    color: '#9e9e9e',
    fontSize: '0.75rem',
    marginTop: 32,
  },
};

export default function App() {
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth || 1024);
  const [currentPath, setCurrentPath] = useState(() => (window.location.pathname === ADMIN_PATH ? ADMIN_PATH : '/'));
  const [userId, setUserId] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [rooms, setRooms] = useState(ROOMS);
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
  const [adminRaterFilter, setAdminRaterFilter] = useState('ALL');
  const [adminLoading, setAdminLoading] = useState(false);
  const [csvExporting, setCsvExporting] = useState(false);
  const [clearingRatings, setClearingRatings] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [googleLoginLoading, setGoogleLoginLoading] = useState(false);
  const [submittedPresentationKeys, setSubmittedPresentationKeys] = useState({});
  const isAdminPage = currentPath === ADMIN_PATH;
  const isMobile = viewportWidth <= 768;

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth || 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
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
    if (!isAdminPage) {
      setAdminRaterFilter('ALL');
    }
  }, [isAdminPage]);

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
        scores: { professionalism: 0, fluency: 0, visual: 0, inspiration: 0 },
        comment: '',
        aiLoading: false,
        submitting: false,
      },
    [presentationDrafts]
  );

  const updateDraft = useCallback((idx, updater) => {
    setPresentationDrafts((prev) => {
      const current =
        prev[idx] || {
          scores: { professionalism: 0, fluency: 0, visual: 0, inspiration: 0 },
          comment: '',
          aiLoading: false,
          submitting: false,
        };
      return { ...prev, [idx]: updater(current) };
    });
  }, []);

  const handleGenerateAIForPresentation = useCallback(
    async (presentation, idx) => {
      const draft = getDraft(idx);
      if (!Object.values(draft.scores).every((v) => v > 0)) {
        alert('請先完成 4 項評分，再產生建議回饋');
        return;
      }
      updateDraft(idx, (prev) => ({ ...prev, aiLoading: true }));
      try {
        const text = await generateAIComment(presentation.topic, draft.scores);
        updateDraft(idx, (prev) => ({ ...prev, comment: text, aiLoading: false }));
      } catch (err) {
        alert('建議回饋產生失敗，請確認設定是否正確。');
        console.error(err);
        updateDraft(idx, (prev) => ({ ...prev, aiLoading: false }));
      }
    },
    [getDraft, updateDraft]
  );

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
      if (!Object.values(draft.scores).every((v) => v > 0)) {
        alert('請完成所有 4 項評分');
        return;
      }

      updateDraft(idx, (prev) => ({ ...prev, submitting: true }));
      try {
        const ratingData = {
          presentationKey,
          roomId: selectedRoom,
          presenter: presentation.presenter,
          topic: presentation.topic,
          session: presentation.session,
          scores: draft.scores,
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
          scores: { professionalism: 0, fluency: 0, visual: 0, inspiration: 0 },
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
        const avg = (d.scores.professionalism + d.scores.fluency + d.scores.visual + d.scores.inspiration) / 4;
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

  const adminRaterOptions = useMemo(() => {
    const map = {};
    adminRatings.forEach((r) => {
      const uid = r.raterUserId || 'UNKNOWN_UID';
      if (!map[uid]) {
        map[uid] = {
          uid,
          name: r.raterName || '',
          email: r.raterEmail || '',
          count: 0,
        };
      }
      map[uid].count += 1;
      if (!map[uid].name && r.raterName) map[uid].name = r.raterName;
      if (!map[uid].email && r.raterEmail) map[uid].email = r.raterEmail;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [adminRatings]);

  const filteredAdminRatings = useMemo(() => {
    if (adminRaterFilter === 'ALL') return adminRatings;
    return adminRatings.filter((r) => (r.raterUserId || 'UNKNOWN_UID') === adminRaterFilter);
  }, [adminRatings, adminRaterFilter]);

  const selectedRater = useMemo(() => {
    if (adminRaterFilter === 'ALL') return null;
    return adminRaterOptions.find((x) => x.uid === adminRaterFilter) || null;
  }, [adminRaterFilter, adminRaterOptions]);

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
        'professionalism',
        'fluency',
        'visual',
        'inspiration',
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
        const values = [
          r.roomId || '',
          room?.name || '',
          r.presentationKey || '',
          r.presenter || '',
          r.topic || '',
          r.session || '',
          r.scores?.professionalism ?? '',
          r.scores?.fluency ?? '',
          r.scores?.visual ?? '',
          r.scores?.inspiration ?? '',
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

  const handleAdminScoreAction = async (rating, action) => {
    try {
      const currentScores = rating.scores || {};
      const nextScores = {
        professionalism: currentScores.professionalism ?? 0,
        fluency: currentScores.fluency ?? 0,
        visual: currentScores.visual ?? 0,
        inspiration: currentScores.inspiration ?? 0,
      };

      if (action === 'reset') {
        nextScores.professionalism = 0;
        nextScores.fluency = 0;
        nextScores.visual = 0;
        nextScores.inspiration = 0;
      } else {
        const delta = action === 'inc' ? 1 : -1;
        nextScores.professionalism = Math.max(0, Math.min(10, nextScores.professionalism + delta));
        nextScores.fluency = Math.max(0, Math.min(10, nextScores.fluency + delta));
        nextScores.visual = Math.max(0, Math.min(10, nextScores.visual + delta));
        nextScores.inspiration = Math.max(0, Math.min(10, nextScores.inspiration + delta));
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

  return (
    <div style={styles.app}>
      <header style={{ ...styles.header, ...(isMobile ? { padding: '12px 10px', alignItems: 'flex-start' } : {}) }}>
        <div>
          <div style={{ ...styles.headerTitle, ...(isMobile ? { fontSize: '1rem' } : {}) }}>🎓 SP26 成果發表會</div>
          <div style={{ ...styles.headerSub, ...(isMobile ? { fontSize: '0.72rem' } : {}) }}>
            {isAdminUser ? `管理員模式 · ${userProfile?.displayName || ''}` : '即時評分系統（匿名評分）'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: isMobile ? 6 : 8, flexWrap: isMobile ? 'wrap' : 'nowrap', justifyContent: 'flex-end' }}>
          {isAdminUser && (
            <button style={{ ...styles.headerBtn, ...(isMobile ? { padding: '7px 9px', fontSize: '0.78rem' } : {}) }} onClick={handleAdminLogout}>
              <LogOut size={16} />
              登出
            </button>
          )}
          <button style={{ ...styles.headerBtn, ...(isMobile ? { padding: '7px 9px', fontSize: '0.78rem' } : {}) }} onClick={handleOpenLeaderboard}>
            <BarChart3 size={16} />
            排行榜
          </button>
          <button style={{ ...styles.headerBtn, ...(isMobile ? { padding: '7px 9px', fontSize: '0.78rem' } : {}) }} onClick={handleOpenAdmin}>
            <Users size={16} />
            管理員
          </button>
        </div>
      </header>

      {!isAdminPage && (
      <main style={{ ...styles.main, ...(isMobile ? { padding: '14px 10px 40px' } : {}) }}>
        {!authReady ? (
          <div style={{ ...styles.card, ...(isMobile ? { borderRadius: 12, padding: 14, marginBottom: 12 } : {}) }}>
            <div style={styles.cardTitle}>
              <Users size={18} color="#1a73e8" />
              讀取登入狀態中
            </div>
            <div style={{ fontSize: '0.9rem', color: '#666' }}>請稍候，系統正在確認您的登入狀態。</div>
          </div>
        ) : (
          <>
        <div style={{ ...styles.card, ...(isMobile ? { borderRadius: 12, padding: 14, marginBottom: 12 } : {}) }}>
          <div style={styles.cardTitle}>
            <CalendarDays size={18} color="#1a73e8" />
            本次發表會議程
          </div>
          <div style={{ fontSize: '0.86rem', color: '#555', lineHeight: 1.6, marginBottom: 10 }}>
            查看本次發表會完整議程與時程安排。
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
            觀看議程連結
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
            選擇教室與報告
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
            <option value="">── 請選擇教室 ──</option>
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
              <option value="">── 請選擇學生 / 題目 ──</option>
              {currentRoom.presentations.map((presentation, idx) => (
                <option key={`${presentation.presenter}-${idx}`} value={String(idx)}>
                  [{presentation.session || '-'} {presentation.time || ''}] {presentation.presenter} - {presentation.topic}
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
                <div style={{ fontSize: '0.82rem', color: '#1a73e8', fontWeight: 600 }}>評分頁面</div>
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
                  重新選擇學生
                </button>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#333', background: '#f5f8ff', padding: '10px 14px', borderRadius: 8, lineHeight: 1.6, marginBottom: 12 }}>
                <span style={{ fontWeight: 600 }}>
                  {presentation.session ? `[${presentation.session}${presentation.time ? ` ${presentation.time}` : ''}] ` : ''}
                  {presentation.presenter}
                </span>
                <br />
                {presentation.topic}
              </div>

              <div style={styles.cardTitle}>
                <Star size={18} color="#f59e0b" fill="#f59e0b" />
                評分項目（1–10 分）
              </div>
              {SCORE_ITEMS.map((item) => (
                <div key={`${idx}-${item.key}`} style={{ ...styles.scoreRow, ...(isMobile ? { flexDirection: 'column', alignItems: 'stretch', gap: 8, marginBottom: 12 } : {}) }}>
                  <div style={{ ...styles.scoreLabel, ...(isMobile ? { width: 'auto', fontSize: '0.85rem' } : {}) }}>{item.emoji} {item.label}</div>
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
                一句話回饋
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
                  ...styles.aiBtn,
                  ...(isMobile ? { width: '100%', justifyContent: 'center' } : {}),
                  opacity: draft.aiLoading || rowLocked ? 0.7 : 1,
                  cursor: draft.aiLoading || rowLocked ? 'not-allowed' : 'pointer',
                }}
                onClick={() => handleGenerateAIForPresentation(presentation, idx)}
                disabled={draft.aiLoading || rowLocked}
              >
                <MessageSquare size={14} />
                {draft.aiLoading ? '建議產生中…' : '快速產生建議回饋'}
              </button>

              <button
                type="button"
                style={{
                  ...styles.primaryBtn,
                  ...(isMobile ? { padding: '12px', fontSize: '0.95rem' } : {}),
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
        <main style={{ ...styles.main, ...(isMobile ? { padding: '14px 10px 40px' } : {}) }}>
          <div style={{ ...styles.card, marginTop: 8, ...(isMobile ? { borderRadius: 12, padding: 14 } : {}) }}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>
                <Table2 size={20} />
                管理員 Dashboard
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  style={{
                    ...styles.headerBtn,
                    background: 'rgba(26,115,232,0.1)',
                    border: '1px solid rgba(26,115,232,0.35)',
                    color: '#1a73e8',
                    padding: '6px 10px',
                    fontSize: '0.8rem',
                  }}
                  onClick={() => navigateToMainPage()}
                  title="返回一般評分頁"
                >
                  返回評分頁
                </button>
                <button
                  type="button"
                  style={{
                    ...styles.headerBtn,
                    background: 'rgba(26,115,232,0.1)',
                    border: '1px solid rgba(26,115,232,0.35)',
                    color: '#1a73e8',
                    padding: '6px 10px',
                    fontSize: '0.8rem',
                  }}
                  onClick={handleAdminLogout}
                  title="登出目前帳號"
                >
                  <LogOut size={16} />
                  結束管理
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 10, background: '#e8f5e9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={18} color="#2e7d32" />
                <span>目前在線人數：</span>
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>{onlineCount}</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#555' }}>（最近 1 分鐘有心跳的使用者）</div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <BarChart3 size={16} color="#1a73e8" />
                  投票紀錄 Dashboard
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    disabled={csvExporting || clearingRatings || !adminRatings.length}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: '1px solid #1a73e8',
                      background: csvExporting || clearingRatings || !adminRatings.length ? '#e3f2fd' : '#fff',
                      color: '#1a73e8',
                      fontSize: '0.8rem',
                      cursor: csvExporting || clearingRatings || !adminRatings.length ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <Download size={14} />
                    {csvExporting ? '匯出中…' : '匯出 CSV'}
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllRatings}
                    disabled={clearingRatings || csvExporting || !adminRatings.length}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: '1px solid #d32f2f',
                      background: clearingRatings || csvExporting || !adminRatings.length ? '#ffebee' : '#fff',
                      color: '#c62828',
                      fontSize: '0.8rem',
                      cursor: clearingRatings || csvExporting || !adminRatings.length ? 'not-allowed' : 'pointer',
                    }}
                    title="永久刪除所有投票紀錄"
                  >
                    {clearingRatings ? '清空中…' : '一鍵清空 ratings'}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 10, padding: '10px', border: '1px solid #e8eefc', borderRadius: 10, background: '#f8fbff' }}>
                <div style={{ fontSize: '0.8rem', color: '#1a237e', fontWeight: 700, marginBottom: 8 }}>依帳號查看全部評分</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <select
                    style={{ ...styles.select, marginBottom: 0, minWidth: 240, maxWidth: 360 }}
                    value={adminRaterFilter}
                    onChange={(e) => setAdminRaterFilter(e.target.value)}
                  >
                    <option value="ALL">全部帳號（{adminRatings.length} 筆）</option>
                    {adminRaterOptions.map((opt) => (
                      <option key={opt.uid} value={opt.uid}>
                        {(opt.name || opt.email || opt.uid)}（{opt.count} 筆）
                      </option>
                    ))}
                  </select>
                  {adminRaterFilter !== 'ALL' && (
                    <button
                      type="button"
                      style={{
                        border: '1px solid #90caf9',
                        background: '#e3f2fd',
                        color: '#1565c0',
                        borderRadius: 8,
                        padding: '8px 10px',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                      }}
                      onClick={() => setAdminRaterFilter('ALL')}
                    >
                      清除篩選
                    </button>
                  )}
                </div>
                <div style={{ fontSize: '0.76rem', color: '#546e7a', marginTop: 8 }}>
                  {adminRaterFilter === 'ALL'
                    ? `目前顯示全部資料，共 ${adminRatings.length} 筆。`
                    : `目前顯示：${selectedRater?.name || selectedRater?.email || selectedRater?.uid || adminRaterFilter}，共 ${filteredAdminRatings.length} 筆。`}
                </div>
              </div>

              {adminLoading ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#888', fontSize: '0.9rem' }}>載入中…</div>
              ) : filteredAdminRatings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#888', fontSize: '0.9rem' }}>目前尚無評分資料</div>
              ) : (
                <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #eee', borderRadius: 10 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: '#f5f5f5' }}>
                        <th style={{ padding: '8px 6px', borderBottom: '1px solid #eee', textAlign: 'left', position: 'sticky', top: 0, background: '#f5f5f5', zIndex: 1 }}>時間</th>
                        <th style={{ padding: '8px 6px', borderBottom: '1px solid #eee', textAlign: 'left', position: 'sticky', top: 0, background: '#f5f5f5', zIndex: 1 }}>評分帳號</th>
                        <th style={{ padding: '8px 6px', borderBottom: '1px solid #eee', textAlign: 'left', position: 'sticky', top: 0, background: '#f5f5f5', zIndex: 1 }}>教室</th>
                        <th style={{ padding: '8px 6px', borderBottom: '1px solid #eee', textAlign: 'left', position: 'sticky', top: 0, background: '#f5f5f5', zIndex: 1 }}>報告者</th>
                        <th style={{ padding: '8px 6px', borderBottom: '1px solid #eee', textAlign: 'left', position: 'sticky', top: 0, background: '#f5f5f5', zIndex: 1 }}>題目</th>
                        <th style={{ padding: '8px 6px', borderBottom: '1px solid #eee', textAlign: 'center', position: 'sticky', top: 0, background: '#f5f5f5', zIndex: 1 }}>專業</th>
                        <th style={{ padding: '8px 6px', borderBottom: '1px solid #eee', textAlign: 'center', position: 'sticky', top: 0, background: '#f5f5f5', zIndex: 1 }}>流暢</th>
                        <th style={{ padding: '8px 6px', borderBottom: '1px solid #eee', textAlign: 'center', position: 'sticky', top: 0, background: '#f5f5f5', zIndex: 1 }}>視覺</th>
                        <th style={{ padding: '8px 6px', borderBottom: '1px solid #eee', textAlign: 'center', position: 'sticky', top: 0, background: '#f5f5f5', zIndex: 1 }}>啟發</th>
                        <th style={{ padding: '8px 6px', borderBottom: '1px solid #eee', textAlign: 'left', position: 'sticky', top: 0, background: '#f5f5f5', zIndex: 1 }}>回饋</th>
                        <th style={{ padding: '8px 6px', borderBottom: '1px solid #eee', textAlign: 'center', position: 'sticky', top: 0, background: '#f5f5f5', zIndex: 1 }}>分數管理</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAdminRatings.map((r) => {
                        const room = rooms.find((x) => x.id === r.roomId);
                        const ts =
                          r.timestamp && typeof r.timestamp.toDate === 'function'
                            ? r.timestamp.toDate()
                            : null;
                        const timeStr = ts
                          ? `${ts.getHours().toString().padStart(2, '0')}:${ts.getMinutes().toString().padStart(2, '0')}`
                          : '';
                        return (
                          <tr key={r.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                            <td style={{ padding: '6px 6px', whiteSpace: 'nowrap' }}>{timeStr}</td>
                            <td style={{ padding: '6px 6px', whiteSpace: 'nowrap', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.raterEmail || r.raterUserId || ''}>
                              {r.raterName || r.raterEmail || (r.raterUserId ? `${r.raterUserId.slice(0, 8)}…` : '-')}
                            </td>
                            <td style={{ padding: '6px 6px', whiteSpace: 'nowrap' }}>{room?.name || r.roomId}</td>
                            <td style={{ padding: '6px 6px', whiteSpace: 'nowrap' }}>{r.presenter}</td>
                            <td style={{ padding: '6px 6px', maxWidth: 140, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.topic}</td>
                            <td style={{ padding: '6px 4px', textAlign: 'center' }}>{r.scores?.professionalism}</td>
                            <td style={{ padding: '6px 4px', textAlign: 'center' }}>{r.scores?.fluency}</td>
                            <td style={{ padding: '6px 4px', textAlign: 'center' }}>{r.scores?.visual}</td>
                            <td style={{ padding: '6px 4px', textAlign: 'center' }}>{r.scores?.inspiration}</td>
                            <td style={{ padding: '6px 6px', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.comment}</td>
                            <td style={{ padding: '6px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <button
                                type="button"
                                onClick={() => handleAdminScoreAction(r, 'inc')}
                                style={{ border: '1px solid #81c784', background: '#e8f5e9', color: '#2e7d32', borderRadius: 6, padding: '2px 6px', fontSize: '0.7rem', cursor: 'pointer', marginRight: 4 }}
                              >
                                +1
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdminScoreAction(r, 'dec')}
                                style={{ border: '1px solid #ffcc80', background: '#fff3e0', color: '#ef6c00', borderRadius: 6, padding: '2px 6px', fontSize: '0.7rem', cursor: 'pointer', marginRight: 4 }}
                              >
                                -1
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!window.confirm('確定要把這筆投票四項分數全部重置為 0 嗎？')) return;
                                  handleAdminScoreAction(r, 'reset');
                                }}
                                style={{ border: '1px solid #ef9a9a', background: '#ffebee', color: '#c62828', borderRadius: 6, padding: '2px 6px', fontSize: '0.7rem', cursor: 'pointer' }}
                              >
                                重置
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Table2 size={16} color="#5e35b1" />
                  課程與老師管理
                </div>
                <span style={{ fontSize: '0.75rem', color: '#777' }}>（此設定只在目前頁面有效，重新整理會回到預設）</span>
              </div>
              <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #eee', borderRadius: 10, padding: 10, fontSize: '0.8rem' }}>
                {rooms.map((room) => (
                  <div key={room.id} style={{ marginBottom: 10, borderBottom: '1px solid #f0f0f0', paddingBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#1a237e' }}>
                          {room.name}（{room.id}）
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#555', marginTop: 2 }}>主題：{room.theme}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          style={{ border: '1px solid #5e35b1', background: '#fff', color: '#5e35b1', borderRadius: 6, padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer' }}
                          onClick={() => {
                            const newName = window.prompt('請輸入教室名稱', room.name);
                            if (newName == null || newName.trim() === '') return;
                            const newTheme = window.prompt('請輸入主題', room.theme);
                            if (newTheme == null || newTheme.trim() === '') return;
                            setRooms((prev) =>
                              prev.map((r) =>
                                r.id === room.id ? { ...r, name: newName.trim(), theme: newTheme.trim() } : r
                              )
                            );
                          }}
                        >
                          編輯教室
                        </button>
                      </div>
                    </div>
                    <div style={{ marginTop: 4 }}>
                      {room.presentations.map((p, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', marginBottom: 2 }}>
                          <span style={{ color: '#999', minWidth: 50 }}>{p.session || '-'}</span>
                          <span style={{ color: '#999', minWidth: 70 }}>{p.time || ''}</span>
                          <span style={{ minWidth: 90 }}>{p.presenter}</span>
                          <span style={{ flex: 1 }}>{p.topic}</span>
                          <button
                            type="button"
                            style={{ border: '1px solid #90caf9', background: '#e3f2fd', color: '#1565c0', borderRadius: 6, padding: '2px 6px', fontSize: '0.7rem', cursor: 'pointer' }}
                            onClick={() => {
                              const session = window.prompt('場次（例如 S1）', p.session || '');
                              if (session == null) return;
                              const time = window.prompt('時間（例如 10:05-10:20）', p.time || '');
                              if (time == null) return;
                              const presenter = window.prompt('報告者 / 老師姓名', p.presenter || '');
                              if (presenter == null || presenter.trim() === '') return;
                              const topic = window.prompt('題目', p.topic || '');
                              if (topic == null || topic.trim() === '') return;
                              setRooms((prev) =>
                                prev.map((r) =>
                                  r.id === room.id
                                    ? {
                                        ...r,
                                        presentations: r.presentations.map((pp, i) =>
                                          i === idx ? { session: session.trim(), time: time.trim(), presenter: presenter.trim(), topic: topic.trim() } : pp
                                        ),
                                      }
                                    : r
                                )
                              );
                            }}
                          >
                            編輯
                          </button>
                          <button
                            type="button"
                            style={{ border: '1px solid #ef9a9a', background: '#ffebee', color: '#c62828', borderRadius: 6, padding: '2px 6px', fontSize: '0.7rem', cursor: 'pointer' }}
                            onClick={() => {
                              if (!window.confirm('確定要刪除這筆報告嗎？')) return;
                              setRooms((prev) =>
                                prev.map((r) =>
                                  r.id === room.id
                                    ? {
                                        ...r,
                                        presentations: r.presentations.filter((_, i) => i !== idx),
                                      }
                                    : r
                                )
                              );
                            }}
                          >
                            刪除
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        style={{ marginTop: 4, border: '1px dashed #4caf50', background: '#e8f5e9', color: '#2e7d32', borderRadius: 6, padding: '2px 8px', fontSize: '0.7rem', cursor: 'pointer' }}
                        onClick={() => {
                          const session = window.prompt('場次（例如 S1）', '');
                          if (session == null) return;
                          const time = window.prompt('時間（例如 10:05-10:20）', '');
                          if (time == null) return;
                          const presenter = window.prompt('報告者 / 老師姓名', '');
                          if (presenter == null || presenter.trim() === '') return;
                          const topic = window.prompt('題目', '');
                          if (topic == null || topic.trim() === '') return;
                          setRooms((prev) =>
                            prev.map((r) =>
                              r.id === room.id
                                ? {
                                    ...r,
                                    presentations: [
                                      ...r.presentations,
                                      { session: session.trim(), time: time.trim(), presenter: presenter.trim(), topic: topic.trim() },
                                    ],
                                  }
                                : r
                            )
                          );
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
    </div>
  );
}

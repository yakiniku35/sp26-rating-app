import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, onSnapshot, serverTimestamp, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';
import { Star, Send, BarChart3, Sparkles, ChevronDown, X, Trophy, CheckCircle, Users, Table2, Download } from 'lucide-react';

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

// 管理員登入帳號密碼（可改成環境變數）
const ADMIN_USERNAME = process.env.REACT_APP_ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.REACT_APP_ADMIN_PASS || 'sp26admin';

const app = initializeApp(firebaseConfig);
// Firebase Analytics 需要 `measurementId`，避免未設定時初始化失敗
if (firebaseConfig.measurementId) {
  getAnalytics(app);
}
const db = getFirestore(app);
const auth = getAuth(app);

const ROOMS = [
  {
    id: 'A646',
    name: 'A646 陸美強老師講座',
    theme: '地緣政治、軍事戰略、政策、修復',
    presentations: [
      { session: 'S1', time: '10:05-10:20', presenter: '台煜昆 Walker', topic: '財團法人國策研究院文教基金會─臺灣政府如何維持現狀' },
      { session: 'S1', time: '10:20-10:35', presenter: '宋持暐 Priyanka', topic: '2016年政黨輪替後民進黨與國民黨兩岸政策的差異性：國家認同與戰略思維的比較' },
      { session: 'S1', time: '10:35-10:50', presenter: '羅福山 Sean', topic: '美國科技巨頭對政府決策之影響及其對業的利弊' },
      { session: 'S1', time: '10:50-11:05', presenter: '蘇暐瑀 Sophia', topic: '臺灣海峽灰色地帶行動之研究：以海上圍繞與靈擊基礎設施為核心' },
      { session: 'S2', time: '11:15-11:30', presenter: '英甍 Cyrus', topic: '臺灣勞動基準法對加班的影響' },
      { session: 'S2', time: '11:30-11:45', presenter: '郭晟鑫 Amy', topic: '美國關稅政策對臺灣農漁產品出口影響之分析' },
      { session: 'S2', time: '11:45-12:00', presenter: '游迎帆 Katelynn', topic: '中國「數字絲綢之路」佈繩對臺灣的影響' },
      { session: 'S2', time: '12:00-12:15', presenter: '何純明', topic: '伊朗聽軍的原因與影響' },
      { session: 'S3', time: '13:50-14:05', presenter: '台煜昆 Walker', topic: '反送中之後香港的影虹灣' },
      { session: 'S3', time: '14:05-14:20', presenter: '馬麗莎 Alyssa', topic: '臺灣的城市外交-以臺北為例' },
      { session: 'S3', time: '14:20-14:35', presenter: '白毓樊 Emily', topic: '中國在拉丁美洲的雙重角色基礎建設、以及軍事近五年的宏觀策略為例' },
      { session: 'S4', time: '14:45-15:00', presenter: '英甍 Cyrus', topic: '基石智庫─金融資料分析總經' },
      { session: 'S4', time: '15:00-15:15', presenter: '賀新 Jaden', topic: '虛假訊息對臺灣國際基礎設施的威脅' },
      { session: 'S4', time: '15:15-15:30', presenter: '麥世尊 Sean', topic: '臺灣半總統制的理論與現實：從制度設計到政治運作的辯真分析' },
    ],
  },
  {
    id: 'A604',
    name: 'A604 信義教室',
    theme: '心理、醫療、人文藝析、行為分析',
    presentations: [
      { session: 'S1', time: '10:05-10:20', presenter: '林小夏 Sage', topic: '黑田祝整合有限公司─人界關係與小型組織計公司的重要性' },
      { session: 'S1', time: '10:20-10:35', presenter: '冠麗莎 Larissa', topic: '自閉症患者社交偽裝對心理健康的影響' },
      { session: 'S1', time: '10:35-10:50', presenter: '華美珍', topic: '自閉症兒童的學習過程' },
      { session: 'S1', time: '10:50-11:05', presenter: '竹圃 Julia', topic: '臺美大學生理財行為的比較' },
      { session: 'S2', time: '11:15-11:30', presenter: '柯海琳 Kailyn', topic: '城鄉差距與臺灣雙語教育成效之關聯' },
      { session: 'S2', time: '11:30-11:45', presenter: '江雨川 Emma', topic: '小腦體質對 ASD/ADHD 學生情緒調節與人際互動之影響' },
      { session: 'S2', time: '11:45-12:00', presenter: '郭芭達 Gilda', topic: 'A 語音合成中的「口音」與「偏見」' },
      { session: 'S2', time: '12:00-12:15', presenter: '宋安妮 Annie', topic: '以代理式人工智慧建模射程式讓物預售系統：以消費民認購情境為例' },
      { session: 'S3', time: '13:50-14:05', presenter: '冠麗莎 Larissa', topic: '社團中華民國自閉症總會─自閉症患者在職場的清潔策略' },
      { session: 'S3', time: '14:05-14:20', presenter: '楊子慧 Elizabeth', topic: '臺灣的原住民語言復興問題' },
      { session: 'S3', time: '14:20-14:35', presenter: '貝寶 Beyza', topic: '臺灣原住民如何使用藝術維持文化抵抗異保留' },
      { session: 'S4', time: '14:45-15:00', presenter: '柯海琳 Kailyn', topic: '博物館作為第二教室─故宮博物館的教育功能探討' },
      { session: 'S4', time: '15:00-15:15', presenter: '郭端照 Gwendolyn', topic: '走過青銅時代「秘列克斯頓」的古代煉基' },
      { session: 'S4', time: '15:15-15:30', presenter: '林小夏 Sage', topic: '比較臺美字型創作與產業概況' },
    ],
  },
  {
    id: 'A605',
    name: 'A605 信義教室',
    theme: 'AI、軟體、半導體、醫療、資安、環境',
    presentations: [
      { session: '', time: '', presenter: '彭毅 Brandon', topic: '網路安全：無聲的守護者' },
      { session: '', time: '', presenter: '楊怡珠 Emma', topic: '非英語母語者學習編程的挑戰' },
      { session: '', time: '', presenter: '福慧芳 Emily', topic: '知己知彼：孫子兵法在網絡防禦中的運用' },
      { session: '', time: '', presenter: '徐芯怡 Katherine', topic: '國立陽明交通大學─醫療影像(X射線/胸部X光)在軟體開發中的屏蔽機制' },
      { session: '', time: '', presenter: '何安娜 Anashelly', topic: '衰老對疫苗免疫反應的影響' },
      { session: '', time: '', presenter: '冉嫺蕊 Carolyn', topic: '臺灣的垃圾管理制度' },
      { session: '', time: '', presenter: '金蓮 Tegan', topic: '人工智能對於計畫產業的影響' },
      { session: '', time: '', presenter: '謝劍樺', topic: '心得分享─《淺談 AI 原廠潛下企業營業祕密保護因應對策》' },
      { session: '', time: '', presenter: '徐芯怡 Katherine', topic: '美國與臺灣醫療制度的比較-以腎尿疾為例' },
      { session: '', time: '', presenter: '羅堆山 Sean', topic: '工業技術研究院─防禦科技產業供應鏈的全球化' },
      { session: '', time: '', presenter: '鄧圓瑀 Sophia', topic: '工業技術研究院─防禦科技產業供應鏈的全球化' },
      { session: '', time: '', presenter: '曾彭揚 Brooklyn', topic: 'AI 與自主機器人在半導體對於高業中的應用：機械工程師角色的轉變' },
      { session: '', time: '', presenter: '楊怡珠 Emma', topic: '啟迁資訊股份有公司─共享剪接/廣告作文在軟體開發中的重要性' },
      { session: '', time: '', presenter: '郭晟鑫 Amy', topic: '臺灣金融科技─人工智慧在投資顧問流程中的應用' },
    ],
  },
];

const SCORE_ITEMS = [
  { key: 'professionalism', label: '內容專業度', emoji: '📚' },
  { key: 'fluency', label: '表達流暢度', emoji: '🎤' },
  { key: 'visual', label: '視覺設計感', emoji: '🎨' },
  { key: 'inspiration', label: '整體啟發性', emoji: '💡' },
];

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
  scoreBtn: (active) => ({
    width: 32,
    height: 32,
    borderRadius: 6,
    border: active ? '2px solid #1a73e8' : '2px solid #e0e7ff',
    background: active ? 'linear-gradient(135deg, #1a73e8, #0d47a1)' : '#f5f8ff',
    color: active ? '#fff' : '#666',
    fontSize: '0.85rem',
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
    background: 'linear-gradient(90deg, #7c4dff, #e040fb)',
    color: '#fff',
    border: 'none',
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
  const [userId, setUserId] = useState(null);
  const [rooms, setRooms] = useState(ROOMS);
  const [onlineCount, setOnlineCount] = useState(0);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [selectedPresentationIdx, setSelectedPresentationIdx] = useState('');
  const [scores, setScores] = useState({ professionalism: 0, fluency: 0, visual: 0, inspiration: 0 });
  const [comment, setComment] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [adminRatings, setAdminRatings] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [csvExporting, setCsvExporting] = useState(false);

  useEffect(() => {
    if (auth.currentUser) {
      setUserId(auth.currentUser.uid);
      return;
    }
    signInAnonymously(auth)
      .then((cred) => setUserId(cred.user.uid))
      .catch((err) => console.error('匿名登入失敗：', err));
  }, []);

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
    if (!showAdmin) return;

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
  }, [showAdmin]);

  const currentRoom = rooms.find((r) => r.id === selectedRoom);
  const currentPresentation =
    currentRoom && selectedPresentationIdx !== ''
      ? currentRoom.presentations[parseInt(selectedPresentationIdx, 10)]
      : null;

  const handleGenerateAI = useCallback(async () => {
    if (!currentPresentation) return;
    if (!Object.values(scores).every((v) => v > 0)) {
      alert('請先完成 4 項評分，再產生 AI 評語');
      return;
    }
    setAiLoading(true);
    try {
      const text = await generateAIComment(currentPresentation.topic, scores);
      setComment(text);
    } catch (err) {
      alert('AI 評語產生失敗，請確認 Gemini API Key 是否正確。');
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  }, [currentPresentation, scores]);

  const handleSubmit = useCallback(async () => {
    if (!currentPresentation) {
      alert('請先選擇報告者');
      return;
    }
    if (!Object.values(scores).every((v) => v > 0)) {
      alert('請完成所有 4 項評分');
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'ratings'), {
        roomId: selectedRoom,
        presenter: currentPresentation.presenter,
        topic: currentPresentation.topic,
        session: currentPresentation.session,
        scores,
        comment,
        timestamp: serverTimestamp(),
        anonymousUserId: userId,
      });
      setScores({ professionalism: 0, fluency: 0, visual: 0, inspiration: 0 });
      setComment('');
      setSelectedPresentationIdx('');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err) {
      alert('提交失敗，請稍後再試。');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }, [currentPresentation, scores, comment, selectedRoom, userId]);

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
  const handleOpenAdmin = () => {
    if (!adminLoggedIn) {
      const username = window.prompt('請輸入管理員帳號：', '');
      if (username == null) return;
      const password = window.prompt('請輸入管理員密碼：', '');
      if (password == null) return;
      if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        setAdminLoggedIn(true);
        setShowAdmin(true);
      } else {
        alert('帳號或密碼錯誤');
      }
    } else {
      setShowAdmin(true);
    }
  };

  // 管理員：Dashboard - 監聽所有評分紀錄
  useEffect(() => {
    if (!showAdmin) return;
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
  }, [showAdmin]);

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
        'presenter',
        'topic',
        'session',
        'professionalism',
        'fluency',
        'visual',
        'inspiration',
        'comment',
        'timestamp',
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
          r.presenter || '',
          r.topic || '',
          r.session || '',
          r.scores?.professionalism ?? '',
          r.scores?.fluency ?? '',
          r.scores?.visual ?? '',
          r.scores?.inspiration ?? '',
          r.comment || '',
          ts,
          r.anonymousUserId || '',
        ];
        return values
          .map((val) =>
            `"${String(val).replace(/"/g, '""')}"`
          )
          .join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div>
          <div style={styles.headerTitle}>🎓 SP26 成果發表會</div>
          <div style={styles.headerSub}>AI 智慧評分系統</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={styles.headerBtn} onClick={handleOpenLeaderboard}>
            <BarChart3 size={16} />
            排行榜
          </button>
          <button style={styles.headerBtn} onClick={handleOpenAdmin}>
            <Users size={16} />
            管理員
          </button>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.card}>
          <div style={styles.cardTitle}>
            <ChevronDown size={18} color="#1a73e8" />
            選擇教室與報告
          </div>

          <select
            style={styles.select}
            value={selectedRoom}
            onChange={(e) => {
              setSelectedRoom(e.target.value);
              setSelectedPresentationIdx('');
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
            <select
              style={styles.select}
              value={selectedPresentationIdx}
              onChange={(e) => setSelectedPresentationIdx(e.target.value)}
            >
              <option value="">── 請選擇報告者 ──</option>
              {currentRoom.presentations.map((p, idx) => (
                <option key={idx} value={idx}>
                  {p.session ? `[${p.session}${p.time ? ' ' + p.time : ''}] ` : ''}
                  {p.presenter} — {p.topic.length > 20 ? p.topic.slice(0, 20) + '…' : p.topic}
                </option>
              ))}
            </select>
          )}

          {currentPresentation && (
            <div style={{ fontSize: '0.85rem', color: '#333', background: '#f5f8ff', padding: '10px 14px', borderRadius: 8, lineHeight: 1.6, marginTop: 4 }}>
              <span style={{ fontWeight: 600 }}>{currentPresentation.presenter}</span>
              <br />
              {currentPresentation.topic}
            </div>
          )}
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>
            <Star size={18} color="#f59e0b" fill="#f59e0b" />
            評分項目（1–10 分）
          </div>
          {SCORE_ITEMS.map((item) => (
            <div key={item.key} style={styles.scoreRow}>
              <div style={styles.scoreLabel}>{item.emoji} {item.label}</div>
              <div style={styles.scoreButtons}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <button
                    key={n}
                    style={styles.scoreBtn(scores[item.key] === n)}
                    onClick={() => setScores((prev) => ({ ...prev, [item.key]: n }))}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>
            <Sparkles size={18} color="#7c4dff" />
            一句話回饋
          </div>
          <textarea
            style={styles.textarea}
            placeholder="寫下您對這場報告的一句話回饋…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onFocus={(e) => (e.target.style.borderColor = '#1a73e8')}
            onBlur={(e) => (e.target.style.borderColor = '#e0e7ff')}
          />
          <button
            style={{ ...styles.aiBtn, opacity: aiLoading ? 0.7 : 1, cursor: aiLoading ? 'not-allowed' : 'pointer' }}
            onClick={handleGenerateAI}
            disabled={aiLoading}
          >
            <Sparkles size={14} />
            {aiLoading ? 'AI 生成中…' : '✨ AI 產生評語'}
          </button>
        </div>

        <button
          style={{ ...styles.primaryBtn, opacity: submitting ? 0.7 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}
          onClick={handleSubmit}
          disabled={submitting}
        >
          <Send size={18} />
          {submitting ? '提交中…' : '提交評分'}
        </button>

        <div style={styles.footer}>
          <p>© 2026 SP26 成果發表會 · AI 評分系統</p>
          <p style={{ marginTop: 4 }}>Powered by React · Firebase · Gemini AI</p>
        </div>
      </main>

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

      {showAdmin && (
        <div style={styles.overlay} onClick={() => setShowAdmin(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>
                <Table2 size={20} />
                管理員 Dashboard
              </div>
              <button
                type="button"
                aria-label="關閉"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                onClick={() => setShowAdmin(false)}
              >
                <X size={22} color="#666" />
              </button>
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
                <button
                  type="button"
                  onClick={handleExportCSV}
                  disabled={csvExporting || !adminRatings.length}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: '1px solid #1a73e8',
                    background: csvExporting || !adminRatings.length ? '#e3f2fd' : '#fff',
                    color: '#1a73e8',
                    fontSize: '0.8rem',
                    cursor: csvExporting || !adminRatings.length ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Download size={14} />
                  {csvExporting ? '匯出中…' : '匯出 CSV'}
                </button>
              </div>

              {adminLoading ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#888', fontSize: '0.9rem' }}>載入中…</div>
              ) : adminRatings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#888', fontSize: '0.9rem' }}>目前尚無評分資料</div>
              ) : (
                <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #eee', borderRadius: 10 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: '#f5f5f5' }}>
                        <th style={{ padding: '8px 6px', borderBottom: '1px solid #eee', textAlign: 'left', position: 'sticky', top: 0, background: '#f5f5f5', zIndex: 1 }}>時間</th>
                        <th style={{ padding: '8px 6px', borderBottom: '1px solid #eee', textAlign: 'left', position: 'sticky', top: 0, background: '#f5f5f5', zIndex: 1 }}>教室</th>
                        <th style={{ padding: '8px 6px', borderBottom: '1px solid #eee', textAlign: 'left', position: 'sticky', top: 0, background: '#f5f5f5', zIndex: 1 }}>報告者</th>
                        <th style={{ padding: '8px 6px', borderBottom: '1px solid #eee', textAlign: 'left', position: 'sticky', top: 0, background: '#f5f5f5', zIndex: 1 }}>題目</th>
                        <th style={{ padding: '8px 6px', borderBottom: '1px solid #eee', textAlign: 'center', position: 'sticky', top: 0, background: '#f5f5f5', zIndex: 1 }}>專業</th>
                        <th style={{ padding: '8px 6px', borderBottom: '1px solid #eee', textAlign: 'center', position: 'sticky', top: 0, background: '#f5f5f5', zIndex: 1 }}>流暢</th>
                        <th style={{ padding: '8px 6px', borderBottom: '1px solid #eee', textAlign: 'center', position: 'sticky', top: 0, background: '#f5f5f5', zIndex: 1 }}>視覺</th>
                        <th style={{ padding: '8px 6px', borderBottom: '1px solid #eee', textAlign: 'center', position: 'sticky', top: 0, background: '#f5f5f5', zIndex: 1 }}>啟發</th>
                        <th style={{ padding: '8px 6px', borderBottom: '1px solid #eee', textAlign: 'left', position: 'sticky', top: 0, background: '#f5f5f5', zIndex: 1 }}>回饋</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminRatings.map((r) => {
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
                            <td style={{ padding: '6px 6px', whiteSpace: 'nowrap' }}>{room?.name || r.roomId}</td>
                            <td style={{ padding: '6px 6px', whiteSpace: 'nowrap' }}>{r.presenter}</td>
                            <td style={{ padding: '6px 6px', maxWidth: 140, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.topic}</td>
                            <td style={{ padding: '6px 4px', textAlign: 'center' }}>{r.scores?.professionalism}</td>
                            <td style={{ padding: '6px 4px', textAlign: 'center' }}>{r.scores?.fluency}</td>
                            <td style={{ padding: '6px 4px', textAlign: 'center' }}>{r.scores?.visual}</td>
                            <td style={{ padding: '6px 4px', textAlign: 'center' }}>{r.scores?.inspiration}</td>
                            <td style={{ padding: '6px 6px', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.comment}</td>
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
        </div>
      )}
    </div>
  );
}

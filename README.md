# 🎓 SP26 成果發表會 AI 評分系統

一套結合 **React + Firebase + Gemini AI** 的現場評分應用程式，專為 SP26 成果發表會設計。觀眾可透過手機掃描 QR Code，對每位報告者進行即時評分，並由 AI 自動生成鼓勵性評語。

---

## ✨ 功能特色

- 📱 **手機友善**：響應式設計（RWD），手機掃描 QR Code 即可評分
- 🏫 **三教室分類**：A646（地緣政治）、A604（心理醫療）、A605（AI 技術）
- ⭐ **5 項評分指標**：內容專業度、表達流暢度、視覺設計感、整體啟發性（各 1–10 分），以及一句話文字回饋
- 🤖 **AI 智慧評語**：使用 Gemini 2.0 Flash 自動產生繁體中文鼓勵評語
- 🔐 **匿名評分**：Firebase Anonymous Auth，無需註冊即可評分
- ☁️ **即時雲端儲存**：評分即時存入 Firestore
- 📊 **即時排行榜**：按平均分數即時排名

---

## 🚀 快速開始（純雲端，無需本地環境）

### Step 1：Fork 或 Clone 此 Repository

點擊右上角 **Fork**，將此 Repository 複製到您的 GitHub 帳號下。

### Step 2：設定 Firebase

1. 前往 [Firebase Console](https://console.firebase.google.com/)
2. 建立新專案，命名為 `SP26-Rating`
3. 進入 **Build > Firestore Database**，點擊「建立資料庫」，**選擇「生產模式」（Production mode）**，避免資料庫對外完全開放讀寫
4. 建立後，在 Firestore **規則** 頁面設定最低限度的安全規則，例如：
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /ratings/{doc} {
         allow write: if request.auth != null;
         allow read: if request.auth != null;
       }
     }
   }
   ```
   此規則僅允許已登入（含匿名登入）的使用者讀寫，防止未登入者直接存取。
5. 進入 **Build > Authentication**，在 Sign-in method 中開啟「**匿名 (Anonymous)**」登入
6. 在「**專案設定 > 一般**」下方找到 SDK 設定，複製 `firebaseConfig` 物件的值
7. 開啟 `src/App.jsx`，將 `firebaseConfig` 中的 placeholder 替換為您的實際設定值

### Step 3：設定 Gemini API Key

1. 前往 [Google AI Studio](https://aistudio.google.com/)
2. 點擊「**Get API Key**」，建立新的 API Key
3. 在 Vercel 部署設定中，加入環境變數：
   - 變數名稱：`REACT_APP_GEMINI_API_KEY`
   - 值：您的 Gemini API Key

### Step 4：部署到 Vercel

1. 前往 [Vercel](https://vercel.com/)，使用 GitHub 帳號登入
2. 點擊「**New Project**」，選擇此 Repository
3. 在「**Environment Variables**」中加入：
   ```
   REACT_APP_GEMINI_API_KEY = your_gemini_api_key
   ```
4. 點擊「**Deploy**」，等待部署完成
5. 取得部署網址（例如 `https://sp26-rating-app.vercel.app`）

### Step 5：產生 QR Code

使用以下工具將 Vercel 網址轉為 QR Code，印在現場海報上：
- [qr-code-generator.com](https://www.qr-code-generator.com/)
- [qrcode-monkey.com](https://www.qrcode-monkey.com/)

---

## 🔧 環境變數說明

| 變數名稱 | 說明 | 範例 |
|---------|------|------|
| `REACT_APP_GEMINI_API_KEY` | Google Gemini API Key | `AIzaSy...` |

Firebase 設定直接寫在 `src/App.jsx` 的 `firebaseConfig` 中（非機密公開設定）。

---

## 📁 專案結構

```
sp26-rating-app/
├── public/
│   ├── index.html          # HTML 入口頁面
│   └── manifest.json       # PWA Manifest
├── src/
│   ├── App.jsx             # 主要應用程式（含所有功能）
│   ├── index.js            # React 入口點
│   └── index.css           # 全域樣式
├── .env.example            # 環境變數範本
├── .gitignore
├── package.json
└── README.md
```

---

## 🎯 管理員功能

### 前端查看排行榜
點擊 App 右上角的「📊 排行榜」圖示，即可即時看到所有報告者的平均分數排行。

### 後台匯出資料
1. 前往 [Firebase Console](https://console.firebase.google.com/)
2. 進入您的專案 > **Firestore Database**
3. 選擇 `ratings` collection
4. 點擊右上角「⋮」> 「匯出資料」，可匯出 JSON 格式後轉換為 Excel

---

## 🏫 教室資料

| 教室 | 主題 | 報告數 |
|------|------|--------|
| **A646** | 地緣政治、軍事戰略、政策、修復 | 14 場 |
| **A604** | 心理、醫療、人文藝析、行為分析 | 14 場 |
| **A605** | AI、軟體、半導體、醫療、資安、環境 | 14 場 |

---

© 2026 SP26 成果發表會 · Powered by React · Firebase · Gemini AI

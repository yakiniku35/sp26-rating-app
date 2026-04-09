# 架構說明

## 目錄結構

```
src/
├── config/          # Firebase 配置
│   └── firebase.js  # Firebase 初始化與實例
│
├── constants/       # 靜態常數
│   ├── config.js    # 應用配置常數
│   ├── i18n.js      # 多語言翻譯
│   └── rooms.js     # 教室與報告資料
│
├── utils/           # 工具函數
│   └── helpers.js   # 通用輔助函數
│
├── hooks/           # 自訂 React Hooks
│   └── (待實作)
│
├── components/      # UI 元件
│   └── (待實作)
│
├── styles/          # 樣式定義
│   └── (待實作)
│
├── App.jsx          # 主應用元件
└── index.js         # 應用入口點
```

## 模組說明

### config/firebase.js
- Firebase 應用初始化
- 導出 `db`, `auth`, `googleProvider` 實例
- 集中管理 Firebase 配置

### constants/
- **config.js**: 應用層級的常數（URL、錯誤訊息、評分項目等）
- **i18n.js**: 中英文翻譯對照表
- **rooms.js**: 教室與報告資料（可從 API 或 JSON 載入）

### utils/helpers.js
- 純函數工具集
- 不依賴外部狀態
- 可獨立測試

## 重構原則

1. **關注點分離**: 配置、資料、邏輯、UI 分離
2. **可測試性**: 純函數便於單元測試
3. **可維護性**: 單一職責，易於定位和修改
4. **可擴展性**: 模組化設計便於新增功能

## 下一步優化建議

1. 將巨大的樣式物件提取到 `styles/` 目錄
2. 拆分 UI 元件（Header, RatingCard, AdminDashboard 等）
3. 創建自訂 hooks（useAuth, useOnlineUsers, useRatings 等）
4. 考慮使用 Context API 管理全局狀態
5. 將 ROOMS 資料改為從 API 或 JSON 檔案載入

export const EVENT_SCHEDULE_URL = process.env.REACT_APP_EVENT_SCHEDULE_URL || '';

export const GOOGLE_AUTH_ERROR_MESSAGE = 'Google 登入失敗，請確認 Firebase Authentication 已啟用 Google 登入，且已把目前網域加入 Authorized domains。';

export const ADMIN_LOGIN_INTENT_KEY = 'sp26-admin-login-intent';

export const ADMIN_PATH = '/admin';

export const SCORE_ITEMS = [
  { key: 'structure', label: '邏輯架構性' },
  { key: 'fluency', label: '表達流暢度' },
  { key: 'professionalism', label: '內容專業性' },
  { key: 'visualDesign', label: '視覺設計感' },
];
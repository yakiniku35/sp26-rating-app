export const EVENT_SCHEDULE_URL = process.env.REACT_APP_EVENT_SCHEDULE_URL || '';

export const GOOGLE_AUTH_ERROR_MESSAGE = 'Google 登入失敗，請確認 Firebase Authentication 已啟用 Google 登入，且已把目前網域加入 Authorized domains。';

export const ADMIN_LOGIN_INTENT_KEY = 'sp26-admin-login-intent';

export const ADMIN_PATH = '/admin';

export const SCORE_ITEMS = [
  { key: 'professionalism', label: '內容專業度', emoji: '📚' },
  { key: 'fluency', label: '表達流暢度', emoji: '🎤' },
  { key: 'visual', label: '視覺設計感', emoji: '🎨' },
  { key: 'inspiration', label: '整體啟發性', emoji: '💡' },
];

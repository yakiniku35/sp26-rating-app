import { firebaseConfig } from '../config/firebase';

export function buildPresentationKey(roomId, presentation) {
  return encodeURIComponent([
    roomId,
    presentation.session || '',
    presentation.time || '',
    presentation.presenter || '',
    presentation.topic || '',
  ].join('||'));
}

export function buildRatingDocId(userId, presentationKey) {
  return `${userId}_${presentationKey}`;
}

export function buildAuthDebugText(uid) {
  return `目前 projectId: ${firebaseConfig.projectId || '未設定'}\n目前 uid: ${uid || '未登入'}`;
}

export function prefersRedirectLogin() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent);
}

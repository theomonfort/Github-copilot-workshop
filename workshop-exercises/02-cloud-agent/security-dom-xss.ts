// 意図的に不安全な教材。通常アプリから import / 実行しない。
export function renderExerciseMessage() {
  const message = decodeURIComponent(window.location.hash.slice(1));
  const target = document.getElementById('workshop-example');
  if (target) {
    target.innerHTML = message;
  }
}

// 意図的な品質問題の教材。通常アプリから import / 実行しない。
export function extendExerciseList(items: string[]) {
  const labels = ['workshop'];
  labels.concat(items);
  return labels;
}

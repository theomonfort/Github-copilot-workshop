// 意図的に不安全な教材。通常アプリから import / 実行しない。
import { Agent } from 'node:https';

export function createExerciseAgent() {
  return new Agent({ rejectUnauthorized: false });
}

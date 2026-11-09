// 意図的に不安全な教材。鍵を生成せず、通常アプリから import / 実行しない。
import { generateKeyPairSync } from 'node:crypto';

export function generateExerciseKey() {
  return generateKeyPairSync('rsa', { modulusLength: 1024 });
}

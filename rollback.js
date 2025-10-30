import { execSync } from "child_process";

const commitHash = process.argv[2];

if (!commitHash) {
  console.error("❌ Потрібно вказати хеш коміту або тег");
  console.log("Використання: npm run rollback <commit-hash>");
  console.log("Приклад: npm run rollback abc123");
  console.log("Або: npm run rollback HEAD~1 (для попереднього коміту)");
  process.exit(1);
}

try {
  console.log(`🔄 Відкат до версії ${commitHash}...`);

  // Перевіряємо чи існує коміт
  execSync(`git rev-parse ${commitHash}`, { stdio: "pipe" });

  // Відкат локально
  execSync(`git reset --hard ${commitHash}`, { stdio: "inherit" });

  // Force push на обидва репозиторії
  console.log("📤 Пушимо зміни на origin...");
  execSync("git push --force origin main", { stdio: "inherit" });

  console.log("📤 Пушимо зміни на cpanel...");
  execSync("git push --force cpanel main", { stdio: "inherit" });

  console.log("✅ Відкат успішно завершено!");
} catch (e) {
  console.error("❌ Відкат не вдався:", e.message);
  process.exit(1);
}

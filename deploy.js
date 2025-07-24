const { execSync } = require("child_process");

const msg = process.argv[2] || "commit";

try {
  execSync("git add .", { stdio: "inherit" });
  execSync(`git commit -m "${msg}"`, { stdio: "inherit" });
  execSync("git push origin main", { stdio: "inherit" });
  execSync("git push cpanel main", { stdio: "inherit" });
} catch (e) {
  console.error("❌ Deploy failed");
  process.exit(1);
}

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const { execSync } = require("child_process");

const port = process.env.PORT || 3045;
const currentPid = String(process.pid);

function freePortOnWindows() {
  try {
    const output = execSync(`netstat -ano | findstr :${port}`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });

    const pids = new Set();

    for (const line of output.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.includes("LISTENING")) continue;

      const pid = trimmed.split(/\s+/).at(-1);
      if (pid && pid !== "0" && pid !== currentPid) {
        pids.add(pid);
      }
    }

    if (!pids.size) {
      console.log(`Nenhum processo ocupando a porta ${port}.`);
      return;
    }

    for (const pid of pids) {
      execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      console.log(`Processo ${pid} encerrado (porta ${port}).`);
    }
  } catch {
    console.log(`Nenhum processo ocupando a porta ${port}.`);
  }
}

function freePortOnUnix() {
  try {
    const output = execSync(`lsof -ti tcp:${port}`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });

    const pids = output
      .split("\n")
      .map((pid) => pid.trim())
      .filter((pid) => pid && pid !== currentPid);

    if (!pids.length) {
      console.log(`Nenhum processo ocupando a porta ${port}.`);
      return;
    }

    for (const pid of pids) {
      execSync(`kill -9 ${pid}`, { stdio: "ignore" });
      console.log(`Processo ${pid} encerrado (porta ${port}).`);
    }
  } catch {
    console.log(`Nenhum processo ocupando a porta ${port}.`);
  }
}

if (process.platform === "win32") {
  freePortOnWindows();
} else {
  freePortOnUnix();
}

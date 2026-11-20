import {randomUUID} from "node:crypto";
import {existsSync, rmSync} from "node:fs";
import {dirname, join} from "node:path";
import {FPS} from "../src/timeline.mjs";
import {capture, command, readJson, root, schemaPath, validateStoryboard, writeJson} from "./project.mjs";

const skills = ["visual-director", "motion-designer", "scene-generator", "video-quality-review"];

function codexCommand() {
  if (process.env.CODEX_BIN) return [process.env.CODEX_BIN, []];
  const shimPath = ["node_modules", "@openai", "codex", "bin", "codex.js"];
  const local = join(root, ".cache", "codex-cli", ...shimPath);
  const npmGlobal = join(dirname(process.execPath), ...shimPath);
  if (existsSync(local)) return [process.execPath, [local]];
  if (process.platform === "win32" && existsSync(npmGlobal)) return [process.execPath, [npmGlobal]];
  return ["codex", []];
}

export async function generateStoryboard(topic, path, {duration = null, brief = ""} = {}) {
  if (existsSync(path)) {
    console.log(`[CODEX] Reusing storyboard ${path}`);
    return readJson(path);
  }
  const temp = join(dirname(path), `storyboard-${randomUUID()}.json`);
  const responseSchema = temp.replace(/\.json$/, ".schema.json");
  const prompt = `Write a cinematic English-language documentary about this quoted topic: ${JSON.stringify(topic)}.
Read AGENTS.md, storyboards/storyboard.schema.json, and the following project skills:
${skills.map((skill) => `.agents/skills/${skill}/SKILL.md`).join("\n")}
Act in order as the scriptwriter, visual director, motion designer, and scene generator. Follow the output schema.
Write ${duration !== null && (duration < 60 || duration > 120) ? "enough scenes" : "6–10 scenes"} totaling ${duration === null ? "about 74" : "exactly " + duration} seconds, each 4–24 seconds, with a compelling first sentence timed to the first five seconds.
Set language to "en" and use concise, naturally spoken English. Target about ${Math.round((duration ?? 74) * 2.2)} words total. Spell out abbreviations and numbers as spoken in the narration.
Use complete sentences, each at most 160 characters. Titles should be under 70 characters, kickers under 65 and display notes under 68.
Design a distinct subject toward the right of each frame, a three-layer composition and exactly three hex colors in dark-to-light order.
The visualType determines the preset illustration. Pick a matching preset for ocean scenes and use abstract for other topics.
Use image and music null unless the following editorial brief supplies a permitted local asset. Keep camera motion slow and varied. Return data only.
Use primary scientific or government sources when verifiable with search. Map sources through each scene's sourceIds.
Make unverified claims explicit as needs-verification in factChecks, and omit them as factual assertions from narration.
Framing of open questions must distinguish established findings from unresolved science. Do not invent links, statistics, or quotes.
Keep all source URLs HTTPS and use unique lowercase hyphenated scene IDs. Do not create or edit files.
${brief ? "\nEditorial brief\n" + brief : ""}`;
  const [file, baseArgs] = codexCommand();
  const env = {...process.env};
  delete env.OPENAI_API_KEY;
  delete env.CODEX_API_KEY;
  let login;
  try {
    login = capture(file, [...baseArgs, "login", "status"], {env});
  } catch (error) {
    throw new Error("Codex CLI login check failed. Install the CLI and run codex login with ChatGPT.", {cause: error});
  }
  if (!/using ChatGPT/i.test(login.stdout + login.stderr)) {
    throw new Error("Sign in to Codex CLI with ChatGPT to generate topics. Use --storyboard for a local JSON file.");
  }
  const model = env.CODEX_MODEL ? ["--model", env.CODEX_MODEL] : [];
  try {
    const schema = readJson(schemaPath);
    schema.properties = Object.fromEntries(schema.required.map((key) => [key, schema.properties[key]]));
    schema.properties.language.enum = ["en"];
    const scene = schema.properties.scenes.items;
    scene.properties = Object.fromEntries(scene.required.map((key) => [key, scene.properties[key]]));
    writeJson(responseSchema, schema);
    await command(file, [...baseArgs, "--search", "exec", ...model, "--ephemeral", "--sandbox", "read-only", "--skip-git-repo-check",
      "--output-schema", responseSchema, "--output-last-message", temp, "-"], {
      stdio: ["pipe", "inherit", "inherit"],
      env,
      input: prompt,
    });
    const storyboard = readJson(temp);
    const plannedFrames = validateStoryboard(storyboard, {assets: false});
    if (duration !== null && plannedFrames !== duration * FPS) throw new Error(`Expected a ${duration}-second storyboard.`);
    writeJson(path, storyboard);
    return storyboard;
  } finally {
    rmSync(temp, {force: true});
    rmSync(responseSchema, {force: true});
  }
}

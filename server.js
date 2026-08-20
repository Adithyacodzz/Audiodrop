import express from "express";
import multer from "multer";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

const exec = promisify(execFile);
const app = express();
const PORT = process.env.PORT || 3000;
const MAX_BYTES = 500 * 1024 * 1024;

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: MAX_BYTES }
});

app.use(express.static("public"));

app.post("/convert", upload.single("video"), async (req, res) => {
  let input = req.file?.path;
  if (!input) return res.status(400).json({ error: "Please choose a video." });

  const allowed = new Set(["mp3", "m4a", "wav", "ogg"]);
  const format = allowed.has(req.body.format) ? req.body.format : "mp3";
  const id = crypto.randomUUID();
  const output = path.join(os.tmpdir(), `audiodrop-${id}.${format}`);

  try {
    const codecArgs = {
      mp3: ["-c:a", "libmp3lame", "-b:a", "192k", "-f", "mp3"],
      m4a: ["-c:a", "aac", "-b:a", "192k", "-f", "ipod"],
      wav: ["-c:a", "pcm_s16le", "-f", "wav"],
      ogg: ["-c:a", "libvorbis", "-b:a", "192k", "-f", "ogg"]
    }[format];

    await exec("ffmpeg", [
      "-hide_banner", "-loglevel", "error",
      "-i", input,
      "-map", "0:a:0",
      "-vn",
      ...codecArgs,
      output,
      "-y"
    ], { timeout: 10 * 60 * 1000, maxBuffer: 2 * 1024 * 1024 });

    const stat = await fs.stat(output);
    if (!stat.size) throw new Error("Empty output");

    res.download(output, `audiodrop.${format}`, async () => {
      await Promise.allSettled([fs.unlink(input), fs.unlink(output)]);
    });
  } catch (err) {
    await Promise.allSettled([fs.unlink(input), fs.unlink(output)]);
    const message = String(err?.stderr || err?.message || "");
    if (/Stream map.*matches no streams|matches no streams/i.test(message)) {
      return res.status(422).json({ error: "This video does not contain an audio track." });
    }
    res.status(500).json({ error: "Conversion failed. Please try another video." });
  }
});

app.use((err, req, res, next) => {
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "Video is too large. Maximum size is 500 MB." });
  }
  res.status(500).json({ error: "Something went wrong." });
});

app.listen(PORT, () => console.log(`AudioDrop running on port ${PORT}`));
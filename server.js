import express from "express";
import multer from "multer";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
const exec=promisify(execFile),app=express(),PORT=Number(process.env.PORT||3000);
const upload=multer({dest:os.tmpdir(),limits:{fileSize:1024*1024*1024}});
app.use(express.static("public"));
const mime={mp3:"audio/mpeg",m4a:"audio/mp4",wav:"audio/wav",ogg:"audio/ogg"};
const rm=async(...f)=>Promise.allSettled(f.filter(Boolean).map(x=>fs.unlink(x)));
async function probe(input){const {stdout}=await exec("ffprobe",["-v","error","-select_streams","a:0","-show_entries","stream=codec_name","-of","default=noprint_wrappers=1:nokey=1",input],{timeout:30000});return stdout.trim().split(/\s+/)[0]||""}
app.post("/convert",upload.single("video"),async(req,res)=>{
 const input=req.file?.path;if(!input)return res.status(400).json({error:"Please choose a video."});
 const allowed=new Set(["mp3","m4a","wav","ogg"]),format=allowed.has(req.body.format)?req.body.format:"mp3";
 const output=path.join(os.tmpdir(),`audiodrop-${crypto.randomUUID()}.${format}`);
 try{
  const codec=await probe(input);
  const copy=(format==="mp3"&&codec==="mp3")||(format==="m4a"&&codec==="aac");
  let args=["-hide_banner","-loglevel","error","-i",input,"-map","0:a:0","-vn"];
  if(copy) args.push("-c:a","copy");
  else if(format==="mp3") args.push("-c:a","libmp3lame","-b:a","192k","-threads","0");
  else if(format==="m4a") args.push("-c:a","aac","-b:a","192k","-threads","0");
  else if(format==="wav") args.push("-c:a","pcm_s16le");
  else args.push("-c:a","libvorbis","-q:a","5","-threads","0");
  args.push("-map_metadata","0",output,"-y");
  await exec("ffmpeg",args,{timeout:600000});
  if(!(await fs.stat(output)).size)throw Error("Empty output");
  res.setHeader("Content-Type",mime[format]);
  res.download(output,`audiodrop.${format}`,async()=>{await rm(input,output)});
 }catch(e){await rm(input,output);console.error(e?.stderr||e);res.status(500).json({error:"Conversion failed. Please try another video."})}
});
app.use((e,req,res,next)=>e?.code==="LIMIT_FILE_SIZE"?res.status(413).json({error:"Video is too large. Maximum size is 1 GB."}):res.status(500).json({error:"Something went wrong."}));
app.listen(PORT,"0.0.0.0",()=>console.log(`AudioDrop listening on ${PORT}`));
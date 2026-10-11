# 拾历 Demo 视频 · 可编辑工程

逐帧 HTML 合成：`src/engine.js` 的 `renderAt(t)` 只由时间 t 决定画面，Playwright 多页并行截帧，ffmpeg 编码，最后混入代码合成的配乐。

```
edit/
  src/timeline.js   时间线数据（唯一的数据源）：每个实操片段截取的源时间、倍速、推近目标、标注框、步骤与说明文字
  src/engine.js     合成引擎：开场文字、品牌粒子、实操窗口（真实录屏帧 + 相机推近 + 标注）、步骤标题、说明、记录卡、收束、封面
  src/index.html    1920×1080 舞台；src/style.css 视觉样式（沿用产品的白纸黑字、衬线体、蓝/橙两色）
  scripts/extract-frames.mjs  把 ../footage/segNN.mp4 解成逐帧 JPEG（build/frames）
  scripts/render.mjs          渲染整片 / 片段 / 单帧 / 封面
  scripts/music.py            原创配乐与转场音效（numpy 合成）
  scripts/serve.mjs           本地预览服务
```

## 重新出片

```bash
cd demo-video/edit
npm install                         # 字体（@fontsource），Playwright 用全局安装的即可
node scripts/extract-frames.mjs     # 约 1 分钟，生成 build/frames
python3 scripts/music.py            # 生成 build/audio/mix.wav
node scripts/render.mjs --workers 3 --out build/video.mp4     # 4 核约 12 分钟
ffmpeg -i build/video.mp4 -i build/audio/mix.wav -map 0:v -map 1:a -c:v copy \
  -af volume=-2.5dB -c:a aac -b:a 256k -ar 48000 -movflags +faststart ../output/拾历_Demo_v1.mp4
node scripts/render.mjs --cover --out ../output/封面_拾历Demo.png
```

- 只渲染一段：`node scripts/render.mjs --from 28 --to 54 --out build/part.mp4`
- 抽查单帧：`node scripts/render.mjs --stills 30.5,45,61 --outdir build/stills`
- 浏览器里拖动预览：`node scripts/serve.mjs`，打开 `http://127.0.0.1:5300/?preview`

## 常见修改

- 某个镜头太快或太慢：改 `src/timeline.js` 里对应片段的 `speed`，或 `a`/`b`（源视频秒数，对照 `../markers.md`）。后面的片段会自动顺延；同时调整 `music.py` 里的 `T` 段落时间。
- 推近位置：改片段的 `cams`。坐标是录屏页面的 CSS 像素（1440×810），`z` 是倍率，最大建议 1.6。
- 标注框：改片段的 `fx`。`blue` 表示新写的表达，`orange` 表示待补充，`ink` 表示普通依据。
- 文案：步骤标题和说明在 `STEPS`，压测记录卡在 `RECORD`，开场与收束文字在 `src/index.html`。

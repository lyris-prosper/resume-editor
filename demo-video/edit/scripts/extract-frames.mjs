// 把四段实操录屏解成逐帧 JPEG（build/frames/segNN/000001.jpg，第 n 帧 = 视频时间 (n-1)/30 秒）
import { execFileSync } from 'node:child_process'
import { mkdirSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const seg of ['seg01', 'seg02', 'seg03', 'seg04']) {
  const out = join(root, 'build/frames', seg)
  if (existsSync(out) && readdirSync(out).length > 100) continue
  mkdirSync(out, { recursive: true })
  console.log('extract', seg)
  execFileSync('ffmpeg', ['-v', 'error', '-i', join(root, '../footage', `${seg}.mp4`), '-vsync', '0', '-q:v', '2', join(out, '%06d.jpg')], { stdio: 'inherit' })
}

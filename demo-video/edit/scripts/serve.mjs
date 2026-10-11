// 合成舞台的本地静态服务：/src、/node_modules（字体）、/frames（录屏逐帧）、/brand（产品图标）、/footage-final（真实导出的简历图）
import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { join, dirname, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const EDIT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ROUTES = [
  ['/frames/', join(EDIT, 'build/frames')],
  ['/brand/', join(EDIT, '../../public/brand')],
  ['/footage-final/', join(EDIT, '../final')],
  ['/', EDIT],
]
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' }

export function serve(port = 0) {
  const server = createServer((req, res) => {
    let url = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    if (url === '/') url = '/src/index.html'
    for (const [prefix, dir] of ROUTES) {
      if (!url.startsWith(prefix)) continue
      const file = normalize(join(dir, url.slice(prefix.length)))
      if (!file.startsWith(dir) || !existsSync(file) || !statSync(file).isFile()) break
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'max-age=3600' })
      return createReadStream(file).pipe(res)
    }
    res.writeHead(404).end('not found')
  })
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port })))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { port } = await serve(Number(process.env.PORT ?? 5300))
  console.log(`预览：http://127.0.0.1:${port}/?preview`)
}

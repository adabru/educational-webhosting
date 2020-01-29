const http = require('http')
const fs = require('fs').promises
fs.createReadStream = require('fs').createReadStream
const path = require('path')
const url =  require('url')

let port = 2222
let host = '::1'
let token = process.argv[2] || process.env.TOKEN
if (!token) {
  console.log('\nmissing TOKEN argument: either as first command line argument or as TOKEN environment variable\n')
  return
}

let server = http.createServer( async (req, res) => {
  try {
    let _url = url.parse(req.url, true)

    if(_url.pathname.endsWith('/'))
      _url.pathname += 'index.html'

    if (_url.pathname != path.normalize(_url.pathname)) {
      res.writeHead(400)
      res.end('invalid path')
    } else if (_url.pathname == '/upload' && req.method == 'POST') {
      let filepath = path.resolve( path.join('./public', _url.query.path, _url.query.file) )
      let basepath = path.resolve('./public')
      if (!filepath.startsWith(basepath) || filepath.length <= basepath.length) {
        res.writeHead(400)
        res.end('invalid file path')
      }
      let body = []
      let size = 0
      req.on('data', (data) => {
        body.push(data)
        size += data.length
        if (size > 10e6) {
          res.writeHead(413)
          res.end('max 10 MB', null, () => req.destroy())
        }
      })
      req.on('error', (e) => {
        console.error(e)
        res.writeHead(500)
        res.end('error')
      })
      req.on('end', async () => {
        try {
          await fs.mkdir(path.dirname(filepath), {recursive: true})
          await fs.writeFile(filepath, Buffer.concat(body))
          res.writeHead(200)
          res.end('ok')
        } catch(e) {
          console.error(e)
          res.writeHead(500)
          res.end('error')
        }
      })
    } else {
      fs.createReadStream(`./public${_url.pathname}`)
      .on('error', () => {
        res.writeHead(404)
        res.end('not found') })
      .on('open', () => {
        contenttypes = {
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.styl': 'text/css',
          '.svg': 'image/svg+xml',
          '.png': 'image/png',
          '.jpg': 'image/jpg',
          '.pdf': 'application/pdf',
          '.html': 'text/html; charset=utf-8',
          '.htm': 'text/html; charset=utf-8'
        };
        // 'Content-Type': 'text/html; charset=utf-8'
        res.writeHead(200, {'Content-Type': contenttypes[path.extname(_url.pathname)] || 'text/plain; charset=utf-8'})})
      .pipe(res)
    }
  }
  catch (e) {
    console.error(e)
    res.writeHead(500)
    res.end('server error')
  }
})

server.listen(port, host, () => console.log(`http-server running at http://${host}:${port}/`))

server.on('error', e => {
  console.log('An error occured while serving: ' + e)
  setTimeout(() => {
      server.close();
      server.listen(port, host);
    }, 1000)
})

process.on('SIGINT', function () {
  try { server.close() }
  catch(e) { }
  process.exit()
})

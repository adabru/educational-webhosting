const http = require('http')
const fs = require('fs').promises
fs.createReadStream = require('fs').createReadStream
const path = require('path')
const url =  require('url')

let config = {
  port: 2222,
  host: '::1',
  baseurl: ''
}
for (let arg of process.argv.slice(2)) {
  let [key, value] = arg.split('=')
  key = key.substring('--'.length)
  config[key] = value
}
if (!config.token) {
  console.log('usage:\n    node server.js --token=TOKEN [--port=2222] [--baseurl=]\n')
  return
}

let server = http.createServer( async (req, res) => {
  try {
    let _url = url.parse(req.url, true)

    if(_url.pathname.endsWith('/'))
      _url.pathname += 'index.html'

    if (_url.pathname != path.normalize(_url.pathname) || !_url.pathname.startsWith(config.baseurl)) {
      res.writeHead(400)
      res.end('invalid path')
    }
    // remove baseurl
    _url.pathname = _url.pathname.substring(config.baseurl.length)
    if (_url.pathname == '/upload' && req.method == 'POST') {
      // check token
      if (_url.query.token != config.token) {
        res.writeHead(401)
        return res.end('wrong token')
      }

      let filepath = path.resolve( path.join('./public', _url.query.path, _url.query.file) )
      let basepath = path.resolve('./public')
      if (!filepath.startsWith(basepath) || path.dirname(filepath).length <= basepath.length) {
        res.writeHead(400)
        return res.end('invalid file path')
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
      let filepath = unescape(`./public${_url.pathname}`)
      fs.createReadStream(filepath)
      .on('error', (e) => {
        if (e.code == 'EISDIR') {
          res.writeHead(302, {'Location': path.basename(_url.pathname) + '/index.html'})
          res.end('redirect...')
        } else if (e.code == 'ENOENT') {
          res.writeHead(404)
          res.end('not found')
        } else {
          console.error(e)
          res.writeHead(500)
          res.end('error')
        }
      }).on('open', () => {
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
        }
        // 'Content-Type': 'text/html; charset=utf-8'
        let type = contenttypes[path.extname(_url.pathname)]
        res.writeHead(200, type ? {'Content-Type':  type} : null)
      }).pipe(res)
    }
  }
  catch (e) {
    console.error(e)
    res.writeHead(500)
    res.end('server error')
  }
})

server.listen(config.port, config.host, () => console.log(`http-server running at http://${config.host}:${config.port}/`))

server.on('error', e => {
  console.log('An error occured while serving: ' + e)
  setTimeout(() => {
      server.close();
      server.listen(config.port, config.host);
    }, 1000)
})

process.on('SIGINT', function () {
  try { server.close() }
  catch(e) { }
  process.exit()
})

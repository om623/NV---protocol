// A transparent "edge": forwards HTTP and WebSocket upgrades to the Vite dev server and adds the Preview's policy header.
const http = require('http'); const net = require('net');
const PORT = +process.env.EDGE_PORT || 5180, TARGET = +process.env.EDGE_TARGET || 5173;
const CSP = process.env.EDGE_CSP || "frame-ancestors https://studio.arc.io; connect-src 'self'";
const server = http.createServer((req, res) => {
  const up = http.request({ host: '127.0.0.1', port: TARGET, method: req.method, path: req.url, headers: req.headers }, (r) => {
    const h = { ...r.headers, 'content-security-policy': CSP }; res.writeHead(r.statusCode, h); r.pipe(res);
  });
  up.on('error', () => { res.statusCode = 502; res.end(); }); req.pipe(up);
});
server.on('upgrade', (req, socket, head) => {
  const up = net.connect(TARGET, '127.0.0.1', () => {
    let raw = `${req.method} ${req.url} HTTP/1.1\r\n`;
    for (let i = 0; i < req.rawHeaders.length; i += 2) raw += `${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`;
    up.write(raw + '\r\n'); if (head && head.length) up.write(head); up.pipe(socket); socket.pipe(up);
  });
  up.on('error', () => socket.destroy()); socket.on('error', () => up.destroy());
});
server.listen(PORT, '127.0.0.1', () => console.log('edge listening on ' + PORT));

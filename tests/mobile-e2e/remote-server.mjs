import http from 'node:http';

const port = Number(process.env.PORT || 1337);

const html = `<!doctype html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Springboard Remote Server</title></head>
<body style="margin:0;background:#082f49;color:#f8fafc;font-family:sans-serif">
  <main data-testid="springboard-mobile-remote-server" style="min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px">
    <h1 data-testid="springboard-mobile-heading">Springboard remote server loaded</h1>
  </main>
  <script>window.receiveMessageFromRN = window.receiveMessageFromRN || function() {}; window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({type:'springboard-mobile-e2e-remote-server-ready'}));</script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Springboard mobile E2E remote server listening on ${port}`);
});

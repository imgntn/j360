const http = require('http');
const crypto = require('crypto');

const clients = new Set();

function acceptKey(key){
  return crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
}

function frame(data){
  const json = Buffer.from(data);
  const len = json.length;
  let header;
  if(len < 126){ header = Buffer.from([0x81, len]); }
  else { header = Buffer.from([0x81, 126, len >> 8, len & 0xff]); }
  return Buffer.concat([header, json]);
}

function unframe(buf){
  const len = buf[1] & 0x7f;
  let offset = 2;
  if(len === 126){ offset = 4; }
  const mask = buf.slice(offset, offset + 4);
  offset += 4;
  const data = buf.slice(offset, offset + len);
  const out = Buffer.alloc(len);
  for(let i=0;i<len;i++){ out[i] = data[i] ^ mask[i%4]; }
  return out.toString();
}

const server = http.createServer();
server.on('upgrade',(req,socket)=>{
  const key = req.headers['sec-websocket-key'];
  const accept = acceptKey(key);
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n'+
    'Upgrade: websocket\r\n'+
    'Connection: Upgrade\r\n'+
    `Sec-WebSocket-Accept: ${accept}\r\n`+
    '\r\n'
  );
  clients.add(socket);
  socket.on('data',d=>{
    const msg = unframe(d);
    for(const c of clients){ if(c!==socket) c.write(frame(msg)); }
  });
  socket.on('close',()=>clients.delete(socket));
  socket.on('end',()=>clients.delete(socket));
});

const port = process.env.PORT || 4000;
server.listen(port,()=>{
  console.log(`Remote server listening on http://localhost:${port}`);
});

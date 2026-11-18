import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp'};
const inside=(root,file)=>{const relative=path.relative(root,file);return !relative.startsWith('..') && !path.isAbsolute(relative);};
export function createStaticServer(directory) {
  const root=path.resolve(directory);
  return http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'");
    if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');res.writeHead(405);res.end('Método no permitido');return;}
    try {
      const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
      if(pathname.includes('\0') || pathname.includes('\\') || pathname.split('/').some(part=>part.startsWith('.'))){res.writeHead(403);res.end();return;}
      let file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
      if(!inside(root,file) || !types[path.extname(file)]){res.writeHead(403);res.end();return;}
      file=await fs.realpath(file);
      if(!inside(await fs.realpath(root),file)){res.writeHead(403);res.end();return;}
      const content=await fs.readFile(file);res.setHeader('Content-Type',types[path.extname(file)]);res.setHeader('Content-Length',content.length);
      res.writeHead(200);res.end(req.method==='HEAD'?undefined:content);
    }catch(error){res.writeHead(error.code==='ENOENT'?404:400);res.end('No se pudo leer el recurso.');}
  });
}
if(process.argv[1] && fileURLToPath(import.meta.url)===path.resolve(process.argv[1])) {
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..',process.argv.includes('--source')?'src':'dist');
  const portIndex=process.argv.indexOf('--port');const port=Number(portIndex>=0?process.argv[portIndex+1]:(process.env.PORT || 4173));
  if(!Number.isInteger(port) || port<0 || port>65535)throw new Error('El puerto no es válido.');
  try{await fs.access(path.join(root,'index.html'));}catch{throw new Error('Ejecuta npm run build antes de iniciar.');}
  const server=createStaticServer(root);server.listen(port,'127.0.0.1',()=>console.log(`Directorio disponible en http://127.0.0.1:${server.address().port}`));
  server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'El puerto está ocupado. Usa --port con otro valor.':'No se pudo iniciar el servidor.');process.exitCode=1;});
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
}

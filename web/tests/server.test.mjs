import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {once} from 'node:events';
import {createStaticServer} from '../scripts/serve.mjs';
test('static server serves public assets and HEAD with local security headers',async t=>{
  const folder=await fs.mkdtemp(path.join(os.tmpdir(),'directory-server-test-'));
  t.after(async()=>{
    if(path.dirname(path.resolve(folder))!==path.resolve(os.tmpdir()) || !path.basename(folder).startsWith('directory-server-test-'))throw new Error('Unexpected cleanup path');
    await fs.rm(folder,{recursive:true,force:true});
  });
  await fs.writeFile(path.join(folder,'index.html'),'<!doctype html><title>Test directory</title>');
  await fs.writeFile(path.join(folder,'app.mjs'),'export const ready=true;');
  const server=createStaticServer(folder);server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(async()=>{server.close();await once(server,'close');});
  const base='http://127.0.0.1:'+server.address().port;
  const response=await fetch(base);assert.equal(response.status,200);assert.match(await response.text(),/Test directory/);
  assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.match(response.headers.get('content-security-policy'),/script-src 'self'/);
  const head=await fetch(base+'/app.mjs',{method:'HEAD'});assert.equal(head.status,200);assert.match(head.headers.get('content-type'),/javascript/);assert.equal(await head.text(),'');
  assert.equal((await fetch(base+'/missing.json')).status,404);
  assert.equal((await fetch(base+'/app.mjs',{method:'POST'})).status,405);
  for(const file of ['/.git/config','/%2e%2e%2fpackage.json','/secret.env','/%5c..%5csecret.json'])
    assert.equal((await fetch(base+file)).status,403,file);
});

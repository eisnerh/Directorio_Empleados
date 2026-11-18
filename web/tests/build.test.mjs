import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

test('build preserves source provenance with either LF or CRLF checkouts',async t=>{
  const source=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'directory-build-test-'));
  t.after(async()=>{
    if(path.dirname(path.resolve(temp))!==path.resolve(os.tmpdir()) || !path.basename(temp).startsWith('directory-build-test-'))throw new Error('Unexpected cleanup path');
    await fs.rm(temp,{recursive:true,force:true});
  });
  const web=path.join(temp,'fixture/web'),assets=path.join(temp,'fixture/src/assets');
  await fs.mkdir(path.join(web,'scripts'),{recursive:true});await fs.mkdir(assets,{recursive:true});
  await fs.cp(path.join(source,'src'),path.join(web,'src'),{recursive:true});
  await fs.copyFile(path.join(source,'scripts/build.mjs'),path.join(web,'scripts/build.mjs'));
  const xml=(await fs.readFile(path.resolve(source,'../src/assets/employees.xml'),'utf8')).replace(/\r\n?/g,'\n');
  for(const content of [xml,xml.replace(/\n/g,'\r\n')]){
    await fs.writeFile(path.join(assets,'employees.xml'),content);
    const output=execFileSync(process.execPath,[path.join(web,'scripts/build.mjs')],{cwd:web,encoding:'utf8'});
    assert.match(output,/Versión web compilada/);
    const manifest=JSON.parse(await fs.readFile(path.join(web,'dist/build-manifest.json'),'utf8'));
    assert.equal(manifest.length,19);assert.equal(manifest.filter(file=>file.file.startsWith('assets/photos/')).length,12);
  }
});

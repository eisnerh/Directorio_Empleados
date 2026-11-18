import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {validateDirectory} from '../src/model.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'src'),output=path.join(root,'dist');
if(path.relative(root,output)!=='dist')throw new Error('Destino de compilación no válido.');
const hash=data=>createHash('sha256').update(data).digest('hex');
const provenance=JSON.parse(await fs.readFile(path.join(source,'assets/provenance.json'),'utf8'));
const original=await fs.readFile(path.resolve(root,'../src/assets/employees.xml'));
const normalizedXml=original.toString('utf8').replace(/\r\n?/g,'\n');
if(hash(normalizedXml)!==provenance.originalNormalizedSha256)throw new Error('El XML original cambió. Revisa y actualiza su conversión a demo.json antes de compilar.');
validateDirectory(JSON.parse(await fs.readFile(path.join(source,'assets/demo.json'),'utf8')));
const files=['index.html','styles.css','app.mjs','model.mjs','storage.mjs','assets/demo.json','assets/provenance.json',...provenance.photos.map(file=>'assets/photos/'+file.name)];
const manifest=[];
for(const file of files) {
  if(file.endsWith('.mjs'))execFileSync(process.execPath,['--check',path.join(source,file)]);
  const data=await fs.readFile(path.join(source,file));
  if(file.startsWith('assets/photos/')) {
    const originalPhoto=provenance.photos.find(photo=>'assets/photos/'+photo.name===file);
    if(hash(data)!==originalPhoto.sha256)throw new Error('Cambió una fotografía de muestra; revisa su procedencia.');
  }
  await fs.mkdir(path.dirname(path.join(output,file)),{recursive:true});
  await fs.writeFile(path.join(output,file),data);manifest.push({file,sha256:hash(data)});
}
await fs.writeFile(path.join(output,'build-manifest.json'),JSON.stringify(manifest,null,2));
console.log(`Versión web compilada: ${files.length} archivos locales. No requiere plugins ni servicios externos.`);

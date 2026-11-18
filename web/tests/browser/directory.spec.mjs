import {test as base,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const seed=JSON.parse(await fs.readFile(new URL('../../src/assets/demo.json',import.meta.url),'utf8'));
const test=base.extend({page:async({page},use)=>{
  const errors=[],external=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(/^https?:/.test(request.url()) && new URL(request.url()).origin!=='http://127.0.0.1:4173')external.push(request.url());});
  await use(page);expect(errors).toEqual([]);expect(external).toEqual([]);
}});
const boot=async(page,count=12)=>{await page.goto('/');await expect(page.locator('#count')).toHaveText(`${count} de ${count}`);};
const open=async(page,id)=>{await page.locator(`#employee-list a[data-id="${id}"]`).click();await expect(page.locator('#detail-panel h2')).toBeVisible();};
async function importFile(page,payload,accept=true){
  if(accept)page.once('dialog',dialog=>dialog.accept());
  await page.locator('#backup-file').setInputFiles({name:'directorio.json',mimeType:'application/json',buffer:Buffer.from(typeof payload==='string'?payload:JSON.stringify(payload))});
}

test('search, filters, contact links and manager/report navigation',async({page})=>{
  await boot(page);
  await page.getByLabel('Buscar personas',{exact:true}).fill('taylor marketing');
  await expect(page.locator('#count')).toHaveText('1 de 12');await expect(page.locator('#employee-list')).toContainText('Julie Taylor');
  await page.getByLabel('Buscar personas',{exact:true}).fill('');await page.getByLabel('Departamento',{exact:true}).selectOption('Sales');
  await expect(page.locator('#count')).toHaveText('3 de 12');
  await page.getByLabel('Departamento',{exact:true}).selectOption('');
  await open(page,'2');await expect(page.locator('#detail-panel h2')).toHaveText('Julie Taylor');
  await expect(page.locator('#detail-panel a[href^="mailto:"]')).toHaveAttribute('href','mailto:jtaylor%40fakemail.com');
  await expect(page.locator('#detail-panel a[href^="sms:"]')).toHaveAttribute('href','sms:781-000-0002');
  await expect(page.locator('#detail-panel')).toContainText('Reportes directos (2)');
  await page.locator('#detail-panel .person-link[data-id="1"]').click();
  await expect(page.locator('#detail-panel h2')).toHaveText('James King');
  await expect(page.locator('#detail-panel')).toContainText('Reportes directos (4)');
  await page.goBack();await expect(page.locator('#detail-panel h2')).toHaveText('Julie Taylor');
});

test('CRUD survives reload, treats markup as text and confirms deletion',async({page})=>{
  await boot(page);await page.getByRole('link',{name:'＋ Nuevo empleado',exact:true}).click();
  await page.getByLabel('Nombre',{exact:false}).fill('José');await page.getByLabel('Apellidos',{exact:false}).fill('García');
  await page.getByLabel('Cargo',{exact:true}).fill('Ingeniero');await page.locator('#employee-form').getByLabel('Departamento',{exact:true}).fill('Producto');
  await page.getByLabel('Ciudad',{exact:true}).fill('San José');await page.getByLabel('Correo electrónico',{exact:true}).fill('jose@example.com');
  await page.getByLabel('Jefatura',{exact:true}).selectOption('1');await page.getByRole('button',{name:'Guardar empleado',exact:true}).click();
  await expect(page.locator('#detail-panel h2')).toHaveText('José García');await expect(page.locator('#count')).toHaveText('13 de 13');
  await page.reload();await expect(page.locator('#detail-panel h2')).toHaveText('José García');
  await page.getByRole('link',{name:'Editar empleado',exact:true}).click();
  const markup='<img src=x onerror=window.__unsafe=1>';
  await page.getByLabel('Apellidos',{exact:false}).fill(markup);await page.getByRole('button',{name:'Guardar empleado',exact:true}).click();
  await expect(page.locator('#detail-panel h2')).toHaveText('José '+markup);expect(await page.locator('#detail-panel h2 img').count()).toBe(0);
  expect(await page.evaluate(()=>window.__unsafe)).toBeUndefined();
  page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Eliminar empleado',exact:true}).click();
  await expect(page.locator('#count')).toHaveText('13 de 13');
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Eliminar empleado',exact:true}).click();
  await expect(page.locator('#count')).toHaveText('12 de 12');await page.reload();await expect(page.locator('#count')).toHaveText('12 de 12');
});

test('removing a manager preserves direct reports and transfers them to the parent',async({page})=>{
  await boot(page);await open(page,'2');
  page.once('dialog',async dialog=>{expect(dialog.message()).toContain('2 reportes directos');expect(dialog.message()).toContain('James King');await dialog.accept();});
  await page.getByRole('button',{name:'Eliminar empleado',exact:true}).click();await expect(page.locator('#count')).toHaveText('11 de 11');
  await open(page,'8');await expect(page.locator('#detail-panel .person-link[data-id="1"]')).toBeVisible();
  await expect(page.locator('#detail-panel .person-link[data-id="2"]')).toHaveCount(0);await page.reload();await expect(page.locator('#count')).toHaveText('11 de 11');
});

test('export and valid import round trip, invalid data cannot replace the directory',async({page},info)=>{
  await boot(page);
  const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar respaldo',exact:true}).click();
  const download=await downloadEvent;const file=info.outputPath('backup.json');await download.saveAs(file);
  const backup=JSON.parse(await fs.readFile(file,'utf8'));expect(backup.format).toBe('employee-directory');expect(backup.employees).toHaveLength(12);
  await importFile(page,'{broken',false);await expect(page.locator('#notice')).toContainText('JSON válido');await expect(page.locator('#count')).toHaveText('12 de 12');
  const bad={...backup,employees:[{...seed[0],managerId:'1'}]};await importFile(page,bad,false);await expect(page.locator('#notice')).toContainText('ciclo');
  backup.employees[0].firstName='Juan';await importFile(page,backup);await expect(page.locator('#notice')).toHaveText('Respaldo importado.');
  await open(page,'1');await expect(page.locator('#detail-panel h2')).toHaveText('Juan King');await page.reload();await expect(page.locator('#detail-panel h2')).toHaveText('Juan King');
});

test('an intentionally empty directory remains empty after reload',async({page})=>{
  await boot(page);await importFile(page,{format:'employee-directory',version:1,employees:[]});
  await expect(page.locator('#count')).toHaveText('0 de 0');await page.reload();await expect(page.locator('#count')).toHaveText('0 de 0');
  await expect(page.locator('#employee-list')).toContainText('El directorio está vacío');
});

test('a failed write rolls back the clear and retains the form and previous data',async({page})=>{
  await page.addInitScript(()=>{
    const original=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(...args){if(window.__failWrites && this.name==='employees')throw new DOMException('Cuota de prueba agotada','QuotaExceededError');return original.apply(this,args);};
  });
  await boot(page);await page.evaluate(()=>window.__failWrites=true);
  await page.getByRole('link',{name:'＋ Nuevo empleado',exact:true}).click();
  await page.getByLabel('Nombre',{exact:false}).fill('Ada');await page.getByLabel('Apellidos',{exact:false}).fill('Persistencia');
  await page.getByRole('button',{name:'Guardar empleado',exact:true}).click();
  await expect(page.locator('#form-error')).toContainText('Cuota');await expect(page.getByLabel('Nombre',{exact:false})).toHaveValue('Ada');
  await page.evaluate(()=>window.__failWrites=false);page.once('dialog',dialog=>dialog.accept());await page.getByRole('link',{name:'Cancelar',exact:true}).click();
  await page.reload();await expect(page.locator('#count')).toHaveText('12 de 12');await expect(page.locator('#employee-list')).not.toContainText('Ada Persistencia');
});

test('stale saves from another tab are rejected until the user reloads its changes',async({page,context})=>{
  await boot(page);const second=await context.newPage();await boot(second);
  await open(page,'1');await page.getByRole('link',{name:'Editar empleado',exact:true}).click();await page.getByLabel('Ciudad',{exact:true}).fill('San José');
  await open(second,'1');await second.getByRole('link',{name:'Editar empleado',exact:true}).click();await second.getByLabel('Cargo',{exact:true}).fill('Dirección actualizada');
  await page.getByRole('button',{name:'Guardar empleado',exact:true}).click();await expect(page.locator('#detail-panel')).toContainText('San José');
  await expect(second.locator('#external-change')).toBeVisible();await second.getByRole('button',{name:'Guardar empleado',exact:true}).click();
  await expect(second.locator('#form-error')).toContainText('otra pestaña');await expect(second.getByLabel('Cargo',{exact:true})).toHaveValue('Dirección actualizada');
  second.once('dialog',dialog=>dialog.accept());await second.getByRole('button',{name:'Cargar cambios',exact:true}).click();
  await expect(second.getByLabel('Ciudad',{exact:true})).toHaveValue('San José');await second.getByLabel('Cargo',{exact:true}).fill('Dirección actualizada');
  await second.getByRole('button',{name:'Guardar empleado',exact:true}).click();await expect(second.locator('#detail-panel')).toContainText('Dirección actualizada');
  await page.reload();await expect(page.locator('#detail-panel')).toContainText('San José');await expect(page.locator('#detail-panel')).toContainText('Dirección actualizada');
});

test('unsaved form navigation can be cancelled and keyboard skip link works',async({page})=>{
  await boot(page);await page.keyboard.press('Tab');await expect(page.locator('.skip-link')).toBeFocused();await page.keyboard.press('Enter');
  await expect(page.locator('#directory-heading')).toBeFocused();
  await page.getByRole('link',{name:'＋ Nuevo empleado',exact:true}).click();await page.getByLabel('Nombre',{exact:false}).fill('Conservar');
  page.once('dialog',dialog=>dialog.dismiss());await page.locator('a.brand').click();
  await expect(page.getByLabel('Nombre',{exact:false})).toHaveValue('Conservar');
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('link',{name:'Cancelar',exact:true}).click();await expect(page.locator('#employee-form')).toHaveCount(0);
});

test('storage failure is visible and never pretends the directory is saved',async({page})=>{
  await page.addInitScript(()=>{indexedDB.open=()=>{throw new DOMException('Almacenamiento bloqueado de prueba','SecurityError');};});
  await page.goto('/');await expect(page.locator('#fatal')).toBeVisible();await expect(page.locator('#count')).toHaveText('No disponible');
  await expect(page.locator('#add')).toHaveAttribute('aria-disabled','true');await expect(page.getByRole('button',{name:'Exportar respaldo',exact:true})).toBeDisabled();
});

test('desktop and mobile list, details and forms have no horizontal overflow',async({page},info)=>{
  await boot(page);await open(page,'2');await page.screenshot({path:info.outputPath('desktop.png'),fullPage:true});
  for(const width of [320,390,768]){
    await page.setViewportSize({width,height:844});
    for(const hash of ['#directory','#employee/2','#edit/2']){
      await page.evaluate(hash=>location.hash=hash,hash);
      const selector=hash==='#directory'?'#list-panel':hash.startsWith('#edit')?'#employee-form':'#detail-panel h2';
      await expect(page.locator(selector)).toBeVisible();
      if(hash.startsWith('#employee'))await expect(page.locator('#detail-panel h2')).toHaveText('Julie Taylor');
      if(hash==='#directory')await expect(page.locator('#employee-form')).toHaveCount(0);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),hash+' at '+width).toBe(true);
      await page.screenshot({path:info.outputPath(`${width}-${hash.includes('edit')?'form':hash.includes('employee')?'detail':'list'}.png`),fullPage:true});
    }
  }
  await fs.writeFile(info.outputPath('browser-version.txt'),page.context().browser().version());
});

import {fullName,filterEmployees,saveEmployee,deleteEmployee,readBackup,writeBackup} from './model.mjs';
import {openDirectory} from './storage.mjs';

const $=id=>document.getElementById(id);
let database,state,dirty=false,busy=false,previousHash=location.hash || '#directory';
const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('employee-directory-local-v1'):null;
function node(tag,className,text) {
  const result=document.createElement(tag);
  if(className)result.className=className;
  if(text!==undefined)result.textContent=text;
  return result;
}
function notice(message,error=false) {
  $('notice').textContent=message;$('notice').classList.toggle('error',error);
  $('notice').setAttribute('role',error?'alert':'status');$('notice').hidden=!message;
}
function avatar(employee,large=false) {
  const holder=node('span',large?'avatar large':'avatar');holder.setAttribute('aria-hidden','true');
  holder.append(node('span','initials',(employee.firstName[0] || '')+(employee.lastName[0] || '')));
  if(employee.picture) {
    const image=document.createElement('img');image.src='assets/photos/'+encodeURIComponent(employee.picture);image.alt='';image.loading='lazy';
    image.addEventListener('error',()=>image.remove());holder.append(image);
  }
  return holder;
}
function employeeLink(employee,compact=false) {
  const link=node('a',compact?'person-link':'employee-card');link.href='#employee/'+encodeURIComponent(employee.id);
  link.dataset.id=employee.id;link.append(avatar(employee));
  const text=node('span','person-text');text.append(node('strong','',fullName(employee)),node('span','person-role',employee.title || 'Sin cargo indicado'));
  if(!compact)text.append(node('span','person-meta',[employee.department,employee.city].filter(Boolean).join(' · ')));
  link.append(text,node('span','chevron','›'));return link;
}
function renderList() {
  const rows=filterEmployees(state.employees,{query:$('search').value,department:$('department').value});
  const fragment=document.createDocumentFragment();
  for(const employee of rows)fragment.append(employeeLink(employee));
  if(!rows.length)fragment.append(node('p','empty',state.employees.length?'No hay coincidencias. Prueba otro nombre o departamento.':'El directorio está vacío. Puedes crear el primer empleado.'));
  $('employee-list').replaceChildren(fragment);$('count').textContent=`${rows.length} de ${state.employees.length}`;
  $('employee-list').removeAttribute('aria-busy');markSelected();
}
function renderDepartments() {
  const previous=$('department').value;
  const values=[...new Set(state.employees.map(row=>row.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  $('department').replaceChildren(new Option('Todos los departamentos',''),...values.map(value=>new Option(value,value)));
  if(values.includes(previous))$('department').value=previous;
}
function markSelected() {
  const id=currentRoute().id;
  for(const link of $('employee-list').querySelectorAll('a')) {
    link.classList.toggle('selected',link.dataset.id===id);
    if(link.dataset.id===id)link.setAttribute('aria-current','true');else link.removeAttribute('aria-current');
  }
}
function currentRoute() {
  const parts=(location.hash || '#directory').slice(1).split('/');
  let id;try{id=decodeURIComponent(parts[1] || '');}catch{id='';}
  return {mode:parts[0],id};
}
function navigate(hash) {
  if(location.hash===hash)renderRoute();else location.hash=hash;
}
function setBusy(value) {
  busy=value;
  $('storage-status').textContent=value?'Guardando…':dirty?'Cambios sin guardar':'Guardado en este navegador';
  document.querySelectorAll('button').forEach(button=>button.disabled=value);
  const fieldset=$('employee-form')?.querySelector('fieldset');if(fieldset)fieldset.disabled=value;
  $('add').setAttribute('aria-disabled',String(value));
}
async function mutate(transform,onSuccess) {
  if(busy)return;
  setBusy(true);
  try {
    state=await database.mutate(transform,state.revision);dirty=false;
    renderDepartments();renderList();$('external-change').hidden=true;
    channel?.postMessage({revision:state.revision});onSuccess();
  }catch(error) {
    if($('form-error')) {$('form-error').textContent=error.message;$('form-error').hidden=false;$('form-error').focus();}
    else notice(error.message,true);
  }finally {setBusy(false);}
}
function contactLink(label,value,scheme) {
  const link=node('a','contact-action');link.href=scheme+':'+encodeURIComponent(value);
  link.append(node('span','contact-label',label),node('strong','',value));return link;
}
function renderDetail(employee) {
  const panel=$('detail-panel');panel.replaceChildren();
  const back=node('a','back-link','← Volver al directorio');back.href='#directory';panel.append(back);
  const header=node('div','profile-header');header.append(avatar(employee,true));
  const heading=node('div');const title=node('h2','',fullName(employee));title.tabIndex=-1;
  heading.append(node('p','eyebrow','FICHA DEL EMPLEADO'),title,node('p','profile-role',employee.title || 'Sin cargo indicado'));
  const badges=node('div','badges');for(const value of [employee.department,employee.city].filter(Boolean))badges.append(node('span','badge',value));
  heading.append(badges);header.append(heading);panel.append(header);
  const actions=node('div','profile-actions');
  const edit=node('a','button secondary','Editar empleado');edit.href='#edit/'+encodeURIComponent(employee.id);
  const remove=node('button','danger secondary','Eliminar empleado');remove.type='button';
  remove.addEventListener('click',()=>{
    const reports=state.employees.filter(row=>row.managerId===employee.id).length;
    const manager=state.employees.find(row=>row.id===employee.managerId);
    const detail=reports?` Sus ${reports} reportes directos pasarán ${manager?'a '+fullName(manager):'a quedar sin jefatura'}.`:'';
    if(confirm(`¿Eliminar a ${fullName(employee)}?${detail}`))mutate(rows=>deleteEmployee(rows,employee.id),()=>{notice('Empleado eliminado.');navigate('#directory');});
  });
  actions.append(edit,remove);panel.append(actions);
  const contacts=node('section','detail-section');contacts.append(node('h3','','Contacto'));
  const links=node('div','contact-grid');
  if(employee.officePhone)links.append(contactLink('Oficina',employee.officePhone,'tel'));
  if(employee.cellPhone)links.append(contactLink('Móvil',employee.cellPhone,'tel'),contactLink('Enviar SMS',employee.cellPhone,'sms'));
  if(employee.email)links.append(contactLink('Correo electrónico',employee.email,'mailto'));
  if(!links.childElementCount)links.append(node('p','hint','No hay datos de contacto registrados.'));
  contacts.append(links);panel.append(contacts);
  const team=node('section','detail-section');team.append(node('h3','','Jefatura'));
  const manager=state.employees.find(row=>row.id===employee.managerId);
  team.append(manager?employeeLink(manager,true):node('p','hint','Sin jefatura asignada.'));panel.append(team);
  const reports=filterEmployees(state.employees.filter(row=>row.managerId===employee.id));
  const reporting=node('section','detail-section');reporting.append(node('h3','',`Reportes directos (${reports.length})`));
  if(reports.length)for(const row of reports)reporting.append(employeeLink(row,true));
  else reporting.append(node('p','hint','Esta persona no tiene reportes directos.'));
  panel.append(reporting);title.focus({preventScroll:true});
}
function renderForm(employee,creating) {
  const panel=$('detail-panel');panel.replaceChildren($('form-template').content.cloneNode(true));
  $('form-heading').textContent=creating?'Nuevo empleado':'Editar empleado';
  const form=$('employee-form');
  for(const field of ['firstName','lastName','title','department','city','email','officePhone','cellPhone'])form.elements[field].value=employee[field] || '';
  const children=new Map();
  for(const row of state.employees){const group=children.get(row.managerId)||[];group.push(row.id);children.set(row.managerId,group);}
  const forbidden=new Set(),pending=[employee.id];
  while(pending.length){const id=pending.pop();if(forbidden.has(id))continue;forbidden.add(id);pending.push(...(children.get(id)||[]));}
  for(const row of filterEmployees(state.employees).filter(row=>!forbidden.has(row.id)))form.elements.managerId.append(new Option(fullName(row),row.id));
  form.elements.managerId.value=employee.managerId || '';
  $('cancel-form').href=creating?'#directory':'#employee/'+encodeURIComponent(employee.id);
  const changed=()=>{dirty=true;$('unsaved').hidden=false;$('storage-status').textContent='Cambios sin guardar';};
  form.addEventListener('input',changed);
  form.addEventListener('change',changed);
  form.addEventListener('submit',event=>{
    event.preventDefault();if(busy || !form.reportValidity())return;
    const data={...employee,...Object.fromEntries(new FormData(form)),id:employee.id};
    mutate(rows=>saveEmployee(rows,data,{creating}),()=>{notice('Empleado guardado.');navigate('#employee/'+encodeURIComponent(employee.id));});
  });
  $('form-heading').focus({preventScroll:true});
}
function renderRoute() {
  if(!state)return;
  const route=currentRoute();dirty=false;
  $('storage-status').textContent='Guardado en este navegador';
  $('list-panel').classList.toggle('mobile-hidden',route.mode==='employee' || route.mode==='edit' || route.mode==='new');
  $('detail-panel').classList.toggle('mobile-hidden',route.mode==='directory' || !route.mode);
  if(route.mode==='new')renderForm({id:crypto.randomUUID()},true);
  else if(['employee','edit'].includes(route.mode)) {
    const employee=state.employees.find(row=>row.id===route.id);
    if(!employee){notice('El empleado ya no está en el directorio.',true);navigate('#directory');return;}
    if(route.mode==='edit')renderForm(employee,false);else renderDetail(employee);
  }else {
    const placeholder=node('div','placeholder');placeholder.append(node('span','placeholder-icon','↗'),node('h2','','Tu equipo, a un clic'),node('p','','Selecciona una persona para consultar sus datos de contacto y relaciones de equipo.'));
    $('detail-panel').replaceChildren(placeholder);
    if(route.mode!=='directory')navigate('#directory');
  }
  markSelected();
}

document.addEventListener('click',event=>{
  const link=event.target.closest('a[href^="#"]');if(!link)return;
  if(link.classList.contains('skip-link')){event.preventDefault();$('directory-heading').focus();return;}
  if(link.getAttribute('aria-disabled')==='true' || busy){event.preventDefault();return;}
  if(dirty && link.hash!==location.hash && !confirm('Hay cambios sin guardar. ¿Quieres salir del formulario?'))event.preventDefault();
  else if(dirty && link.hash!==location.hash)dirty=false;
});
window.addEventListener('hashchange',()=>{
  if(dirty && !confirm('Hay cambios sin guardar. ¿Quieres salir del formulario?')){history.replaceState(null,'',previousHash);return;}
  previousHash=location.hash;renderRoute();
});
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
$('search').addEventListener('input',renderList);$('department').addEventListener('change',renderList);
$('retry').addEventListener('click',()=>location.reload());
$('reload').addEventListener('click',async()=>{
  if(busy || (dirty && !confirm('Cargar los datos guardados descartará los cambios del formulario. ¿Continuar?')))return;
  try{state=await database.read();dirty=false;renderDepartments();renderList();renderRoute();$('external-change').hidden=true;notice('Datos actualizados.');}
  catch(error){notice(error.message,true);}
});
$('export').addEventListener('click',async()=>{
  try{
    const latest=await database.read();const blob=new Blob([writeBackup(latest.employees)],{type:'application/json'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='directorio-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    notice(dirty?'Respaldo de los datos guardados descargado. Guarda el formulario para incluir tus cambios.':'Respaldo descargado.');
  }catch(error){notice(error.message,true);}
});
$('import').addEventListener('click',()=>$('backup-file').click());
$('backup-file').addEventListener('change',async()=>{
  const file=$('backup-file').files[0];$('backup-file').value='';if(!file || busy)return;
  try{
    if(file.size>4*1024*1024)throw new Error('El respaldo supera el máximo de 4 MB.');
    const rows=readBackup(await file.text());
    if(!confirm(`Se reemplazarán ${state.employees.length} empleados por ${rows.length} del respaldo.${dirty?' Los cambios sin guardar se descartarán.':''} ¿Continuar?`))return;
    mutate(()=>rows,()=>{notice('Respaldo importado.');navigate('#directory');});
  }catch(error){notice(error.message,true);}
});
if(channel)channel.onmessage=event=>{if(state && event.data?.revision>state.revision)$('external-change').hidden=false;};

async function start() {
  try{
    const response=await fetch('assets/demo.json');if(!response.ok)throw new Error('No se pudieron cargar los datos iniciales.');
    database=await openDirectory(await response.json());state=await database.read();
    for(const id of ['search','department','export','import'])$(id).disabled=false;
    $('add').setAttribute('aria-disabled','false');renderDepartments();renderList();renderRoute();
  }catch(error){$('fatal-message').textContent=error.message;$('fatal').hidden=false;$('count').textContent='No disponible';$('storage-status').textContent='Almacenamiento no disponible';}
}
start();

import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {validateDirectory,filterEmployees,saveEmployee,deleteEmployee,readBackup,writeBackup} from '../src/model.mjs';
const employee=(id,values={})=>({id,firstName:'Ana',lastName:'García',title:'Ingeniería',department:'Producto',city:'San José',email:'ana@example.com',managerId:null,...values});

test('original demo data retains twelve valid people and their hierarchy',async()=>{
  const rows=validateDirectory(JSON.parse(await fs.readFile(new URL('../src/assets/demo.json',import.meta.url),'utf8')));
  assert.equal(rows.length,12);assert.equal(rows.find(row=>row.id==='2').managerId,'1');
});
test('creation trims values and excludes unknown properties without mutating input',()=>{
  const original=[employee('1')],input=employee('2',{firstName:' José ',lastName:' Pérez ',extra:'ignored'});
  const result=saveEmployee(original,input,{creating:true});
  assert.equal(result[1].firstName,'José');assert.equal(result[1].lastName,'Pérez');assert.equal('extra' in result[1],false);
  assert.equal(original.length,1);assert.equal(input.firstName,' José ');
});
test('updates preserve other employees and refuse deleted or duplicate IDs',()=>{
  const original=[employee('1'),employee('2',{managerId:'1'})];
  const result=saveEmployee(original,employee('2',{firstName:'María',managerId:'1'}));
  assert.equal(result[0].firstName,'Ana');assert.equal(result[1].firstName,'María');assert.equal(original[1].firstName,'Ana');
  assert.throws(()=>saveEmployee(original,employee('3')),/ya no existe/);
  assert.throws(()=>saveEmployee(original,employee('2'),{creating:true}),/Ya existe/);
});
test('search ignores accents/case and supports words across fields with department filtering',()=>{
  const rows=validateDirectory([employee('1'),employee('2',{firstName:'Carlos',department:'Ventas'})]);
  assert.deepEqual(filterEmployees(rows,{query:'GARCIA san jose',department:'Producto'}).map(row=>row.id),['1']);
  assert.equal(filterEmployees(rows,{query:'ingenieria',department:'Ventas'}).length,1);
  assert.equal(filterEmployees(rows,{query:'inexistente'}).length,0);
});
test('self references, unknown managers and indirect cycles are rejected',()=>{
  assert.throws(()=>validateDirectory([employee('1',{managerId:'1'})]),/ciclo/);
  assert.throws(()=>validateDirectory([employee('1',{managerId:'9'})]),/no existe/);
  assert.throws(()=>validateDirectory([employee('1',{managerId:'3'}),employee('2',{managerId:'1'}),employee('3',{managerId:'2'})]),/ciclo/);
});
test('deleting a manager transfers reports to its parent, root deletion keeps a valid graph',()=>{
  const rows=validateDirectory([employee('1'),employee('2',{managerId:'1'}),employee('3',{managerId:'2'})]);
  const withoutMiddle=deleteEmployee(rows,'2');assert.equal(withoutMiddle.find(row=>row.id==='3').managerId,'1');
  const withoutRoot=deleteEmployee(rows,'1');assert.equal(withoutRoot.find(row=>row.id==='2').managerId,null);assert.equal(withoutRoot.find(row=>row.id==='3').managerId,'2');
  assert.equal(rows.length,3);assert.throws(()=>deleteEmployee(rows,'missing'),/ya no existe/);
});
test('required names, field types, email and field limits are validated before saving',()=>{
  for(const values of [{firstName:' '},{lastName:''},{title:'x'.repeat(121)},{email:'invalid'},{email:['array']},{officePhone:'123\n456'}])
    assert.throws(()=>validateDirectory([employee('1',values)]));
  assert.equal(validateDirectory([employee('1',{email:'',officePhone:'+506 (8888) 0000'})]).length,1);
});
test('photos can only refer to local filenames',()=>{
  for(const picture of ['../outside.jpg','https://example.com/photo.jpg','javascript:alert(1)','photo.svg'])
    assert.throws(()=>validateDirectory([employee('1',{picture})]),/fotografía/);
  assert.equal(validateDirectory([employee('1',{picture:'james_king.jpg'})])[0].picture,'james_king.jpg');
});
test('backup round trip preserves data including literal markup as text',()=>{
  const rows=validateDirectory([employee('1',{firstName:'<img src=x>',lastName:'O’Neil & García'})]);
  assert.deepEqual(readBackup(writeBackup(rows)),rows);
  assert.deepEqual(readBackup(writeBackup([])),[]);
});
test('bad backups, duplicates and unsupported versions are rejected as a whole',()=>{
  assert.throws(()=>readBackup('{broken'),/JSON/);
  assert.throws(()=>readBackup(JSON.stringify({format:'employee-directory',version:2,employees:[]})),/compatible/);
  assert.throws(()=>readBackup(JSON.stringify({format:'employee-directory',version:1,employees:[employee('1'),employee('1')]})),/duplicados/);
  assert.throws(()=>readBackup(JSON.stringify({format:'employee-directory',version:1,employees:[employee('1',{managerId:'2'})]})),/jefatura/);
});
test('the maximum-size hierarchy is checked without recursive stack overflow',()=>{
  const rows=Array.from({length:5000},(_,index)=>employee(String(index+1),{managerId:index?String(index):null})).reverse();
  assert.equal(validateDirectory(rows).length,5000);
  assert.throws(()=>validateDirectory([...rows,employee('5001')]),/5000/);
});

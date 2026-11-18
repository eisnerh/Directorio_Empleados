export class DirectoryError extends Error {}
export const limits = Object.freeze({firstName:100,lastName:100,title:120,department:100,city:120,officePhone:40,cellPhone:40,email:254,picture:120});
export const fullName = employee => `${employee.firstName} ${employee.lastName}`.trim();
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value);
const fold = value => value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('es');

function normalizeEmployee(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new DirectoryError('El registro del empleado no es válido.');
  if (!validId(input.id)) throw new DirectoryError('El identificador del empleado no es válido.');
  const result = {id:input.id};
  for (const [field,maximum] of Object.entries(limits)) {
    const value = input[field] ?? '';
    if (typeof value !== 'string' || value.trim().length > maximum || /[\u0000-\u001f\u007f]/.test(value))
      throw new DirectoryError(`El campo ${field} debe ser texto de hasta ${maximum} caracteres, sin saltos de línea.`);
    result[field] = value.trim();
  }
  if (!result.firstName || !result.lastName) throw new DirectoryError('El nombre y los apellidos son obligatorios.');
  if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) throw new DirectoryError('El correo electrónico no es válido.');
  if (result.picture && !/^[a-zA-Z0-9_-]{1,100}\.(?:jpg|jpeg|png|webp)$/i.test(result.picture))
    throw new DirectoryError('La fotografía debe ser el nombre de un recurso local del directorio.');
  const managerId = input.managerId;
  if (managerId !== undefined && managerId !== null && managerId !== '' && !validId(managerId)) throw new DirectoryError('La jefatura no es válida.');
  result.managerId = managerId || null;
  return result;
}

/** Validate the entire graph before a mutation or import can reach storage. */
export function validateDirectory(input) {
  if (!Array.isArray(input) || input.length > 5000) throw new DirectoryError('El directorio debe contener un máximo de 5000 empleados.');
  const rows = input.map(normalizeEmployee);
  const byId = new Map();
  for (const employee of rows) {
    if (byId.has(employee.id)) throw new DirectoryError('El archivo contiene identificadores duplicados.');
    byId.set(employee.id,employee);
  }
  const completed = new Set();
  for (const employee of rows) {
    const visiting = new Set();
    let current = employee;
    while (current && !completed.has(current.id)) {
      if (visiting.has(current.id)) throw new DirectoryError('La relación de jefaturas forma un ciclo.');
      visiting.add(current.id);
      if (current.managerId && !byId.has(current.managerId)) throw new DirectoryError('La jefatura indicada no existe en el directorio.');
      current = byId.get(current.managerId);
    }
    for (const id of visiting) completed.add(id);
  }
  return rows;
}

export function saveEmployee(rows,input,{creating=false}={}) {
  const employee = normalizeEmployee(input);
  const exists = rows.some(row=>row.id===employee.id);
  if (creating && exists) throw new DirectoryError('Ya existe ese identificador. Recarga el directorio.');
  if (!creating && !exists) throw new DirectoryError('El empleado ya no existe. Recarga el directorio.');
  return validateDirectory(creating ? [...rows,employee] : rows.map(row=>row.id===employee.id?employee:row));
}

/** Direct reports move to the removed person's manager, preserving the remaining graph. */
export function deleteEmployee(rows,id) {
  const employee = rows.find(row=>row.id===id);
  if (!employee) throw new DirectoryError('El empleado ya no existe.');
  return validateDirectory(rows.filter(row=>row.id!==id).map(row=>row.managerId===id?{...row,managerId:employee.managerId}:row));
}

export function filterEmployees(rows,{query='',department=''}={}) {
  const terms = fold(query.trim()).split(/\s+/).filter(Boolean);
  return rows.filter(employee=>{
    const haystack=fold([fullName(employee),employee.title,employee.department,employee.city,employee.email].join(' '));
    return (!department || employee.department===department) && terms.every(term=>haystack.includes(term));
  }).sort((a,b)=>fullName(a).localeCompare(fullName(b),'es',{sensitivity:'base'}) || a.id.localeCompare(b.id));
}

export function readBackup(text) {
  let data;
  try { data=JSON.parse(text); } catch { throw new DirectoryError('El archivo no contiene JSON válido.'); }
  if (!data || data.format!=='employee-directory' || data.version!==1) throw new DirectoryError('El archivo no es un respaldo compatible del directorio.');
  return validateDirectory(data.employees);
}
export function writeBackup(rows) {
  return JSON.stringify({format:'employee-directory',version:1,exportedAt:new Date().toISOString(),employees:validateDirectory(rows)},null,2);
}

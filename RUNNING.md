# Ejecutar el directorio de empleados

## Versión web e IDE

Abre la carpeta `web` en VS Code, Antigravity o un IDE con soporte de Node. Usa Node 24:

```powershell
Set-Location web
npm run build
npm start
```

Abre <http://127.0.0.1:4173>. Para desarrollo, `npm run dev` sirve directamente `web/src`. Otro puerto puede seleccionarse con `npm start -- --port 4174`. No abras `index.html` mediante file://: la carga de módulos y recursos necesita HTTP.

La ejecución usa módulos JavaScript nativos, HTML/CSS y almacenamiento del navegador. El servidor Node solo entrega archivos estáticos en 127.0.0.1; no recibe empleados ni guarda una base en el servidor. `npm ci --ignore-scripts` instala únicamente herramientas de pruebas, no es necesario para compilar o ejecutar la aplicación.

El build comprueba la sintaxis de los módulos, valida los 12 registros de ejemplo y su procedencia y genera `web/dist` con 19 recursos y un manifiesto de hashes. No minifica el código ni genera un SWF/IPA del proyecto AIR.

## Uso y conservación de datos

- La búsqueda funciona por nombre, cargo, departamento, ciudad o correo, con palabras combinadas e ignorando mayúsculas y acentos.
- Selecciona una persona para consultar sus contactos, jefatura y reportes directos. Los enlaces de llamada/SMS/correo utilizan la aplicación asociada en el sistema; en las pruebas se comprobaron sus destinos, sin realizar llamadas ni enviar mensajes.
- Nuevo empleado y Editar conservan los valores ante errores de validación y avisan si sales con cambios sin guardar.
- Al eliminar una jefatura, sus reportes directos pasan a la jefatura superior, o quedan sin jefatura si era la raíz. La confirmación indica el cambio y no elimina a sus reportes.
- Exportar genera un respaldo JSON de los datos ya guardados. Importar valida el archivo completo y pide confirmar el reemplazo del directorio; no mezcla silenciosamente dos directorios.

El primer arranque de cada almacenamiento carga los 12 contactos de muestra. Si después dejas el directorio vacío, permanece vacío al recargar: no se vuelven a insertar los ejemplos.

Los datos pertenecen al origen del navegador: mantén la misma dirección y puerto. `127.0.0.1`, `localhost`, otro puerto, otro navegador o perfil pueden mostrar almacenamientos distintos. Exporta/importa un respaldo para trasladar datos. Borrar los datos del sitio elimina ese almacenamiento; el repositorio Git no contiene los empleados añadidos ni sus respaldos.

Las escrituras se completan dentro de una transacción IndexedDB antes de anunciar éxito. Un fallo de guardado conserva el estado anterior y los campos del formulario. Si otra pestaña guardó una revisión más reciente, la edición antigua se rechaza; Cargar cambios pide confirmar el descarte de un formulario pendiente. No hay sincronización con nube ni servidor multiusuario.

## Validación

El nombre y los apellidos son obligatorios y admiten 100 caracteres cada uno; cargo/ciudad, 120; departamento, 100; teléfonos, 40; correo, 254. Se recortan espacios de los extremos y se rechazan saltos de línea. El correo tiene una comprobación básica de formato, no de existencia o entrega.

La jefatura debe existir y el grafo no puede contener ciclos. El selector evita asignar la propia persona o sus descendientes. Los respaldos admiten hasta 5000 empleados y 4 MB; se rechazan IDs duplicados, referencias rotas, versiones desconocidas y datos mal formados antes de reemplazar registros. Se usa el formato `employee-directory`, versión 1. No importa archivos XML/SQLite de terceros.

Las fotografías de muestra son recursos locales conocidos. La edición conserva su fotografía; los empleados nuevos muestran iniciales. Esta versión no incorpora carga de fotografías nuevas ni un sistema de cuentas/permisos.

## Pruebas reproducibles

```powershell
npm ci --ignore-scripts
npm test
npx playwright install chromium
npm run build
npm run test:browser
```

Para utilizar Edge instalado en Windows:

```powershell
$env:DIRECTORY_BROWSER = 'msedge'
npm run test:browser
```

Las pruebas de navegador requieren que el puerto 4173 esté libre. Inician y detienen su propio servidor y usan perfiles temporales, sin abrir el perfil personal del usuario. La carpeta `test-results` es salida temporal de pruebas, no el almacenamiento personal.

Comprobado el 18 de noviembre de 2026:

- **13 pruebas Node aprobadas:** modelo de datos, búsqueda, CRUD, validaciones, ciclos, reasignación de reportes, respaldos, grafo de 5000 registros, servidor estático y build con XML LF/CRLF.
- **10 pruebas en Edge 157.0.4341.60 aprobadas:** CRUD persistente tras recargar, jerarquías/contactos, texto HTML tratado como texto, importación/exportación, directorio vacío persistente, rollback ante fallo de escritura, conflicto entre pestañas, navegación con cambios pendientes, teclado, almacenamiento bloqueado y vistas a 320/390/768 píxeles.
- Capturas de escritorio, ficha y formulario móviles revisadas. Sin excepciones JavaScript ni peticiones a servicios externos en esos recorridos.
- `npm audit`: cero avisos en las dependencias instaladas.

## Fuentes originales y límites

El proyecto AIR/Flex está en `src`, con sus vistas MXML, configuración y salidas históricas. La versión web es una implementación adicional: no se recompiló ni se certificó el proyecto AIR antiguo ni se generaron instaladores móviles.

Los 12 contactos y fotografías proceden de `src/assets/employees.xml` y `src/assets/pics`. `web/src/assets/provenance.json` registra el hash del XML con saltos normalizados y los hashes exactos de fotografías. Si modificas los datos originales, revisa su conversión a `web/src/assets/demo.json` y actualiza la procedencia; el build rechaza una conversión desactualizada. Se conserva la atribución existente, sin inventar una licencia para las imágenes originales.

Las copias en `D:\GH\AJ\Directorio_Empleados` y `D:\GH\FSSSRL\eisnerh\Directorio_Empleados` apuntan al mismo repositorio GitHub. Son dos carpetas del mismo proyecto, no dos aplicaciones independientes. Ejecuta una copia a la vez en el puerto predeterminado.

No se desplegó un sitio en línea ni se instaló una aplicación en el perfil personal. Es un directorio local para aprendizaje: no ofrece autenticación, auditoría empresarial ni uso compartido entre equipos. `.gitignore` excluye dependencias, build y evidencias de prueba; las fuentes y el lockfile quedan versionados.

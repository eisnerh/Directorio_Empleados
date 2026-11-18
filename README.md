# Directorio de empleados

Versión web local del ejercicio Employee Directory: contactos, búsqueda, equipos y administración de empleados. Se abre en un navegador actual desde VS Code, Antigravity o la terminal.

## Ejecutar

Con Node 24, desde la carpeta `web`:

```powershell
npm run build
npm start
```

Abre <http://127.0.0.1:4173>. La aplicación y el servidor local no necesitan paquetes de terceros para ejecutarse. Las dependencias de npm se utilizan para las pruebas de navegador.

## Funciones

- Búsqueda por nombre, cargo, departamento, ciudad o correo, sin distinguir mayúsculas o acentos.
- Fichas de contacto, navegación a la jefatura y a los reportes directos.
- Alta, edición y eliminación con validación de jefaturas, confirmación y conservación del equipo al quitar una jefatura.
- Guardado en el navegador, respaldos JSON e importación validada.
- Detección de cambios entre pestañas para evitar sobrescribir datos recientes.
- Interfaz adaptable a móvil, navegación por teclado y avisos de cambios sin guardar.

El primer arranque carga los 12 contactos de demostración y fotografías procedentes de `src/assets`. Las fuentes AIR/Flex permanecen en `src/`; la implementación web está en `web/src/`. Su compilación y las pruebas web no certifican la compilación del proyecto AIR antiguo.

Consulta [RUNNING.md](RUNNING.md) para pruebas, respaldos, límites y procedencia de los datos.

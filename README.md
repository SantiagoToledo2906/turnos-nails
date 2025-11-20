ShelbyBeauty — proyecto migrado desde Google Apps Script to Node/Express + static frontend.

INSTRUCCIONES RÁPIDAS:
1) Descomprimí el zip y abrí la carpeta en VS Code.
2) Instalá dependencias: npm install
3) Si querés usar MercadoPago real, pegá tu token en .env MP_ACCESS_TOKEN=TU_TOKEN
4) Ejecutá: npm start
5) Abrí http://localhost:3000 en tu navegador.

Notas:
- Por defecto el servidor usa archivos en /data (turnos.json y reservations.json) para simular Google Sheets + PropertiesService.
- Si pones MP_ACCESS_TOKEN vacío, el servidor devolverá un link local que simula el pago y redirige a /confirm?status=success...
- El comportamiento de expiración de reservas usa RES_EXPIRATION_MIN (en minutos) desde .env o 30 por defecto.
- Si querés integrar con Google Sheets real, puedo modificar server/server.js para usar Google API con Service Account (te guío paso a paso).

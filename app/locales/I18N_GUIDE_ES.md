# Guía de i18n para `es.json`

Esta guía define qué mantener en inglés y qué traducir al español para evitar conflictos al copiar las mismas claves a otros idiomas.

## Regla principal

- Mantener en inglés solo términos de marca/fandom.
- Traducir al español todo texto funcional de interfaz (botones, errores, placeholders, estados, ayudas).

## Lista oficial de términos que se mantienen en inglés

- HOME
- MARKET
- SHOP
- FANZONE
- FANART
- MERCH
- WTT
- WTS
- OTW
- OT8
- VIP
- K-oins
- Creator Studio
- Selfie
- Unit
- Wishlist
- Photocard
- STRAY KIDS
- SKZ
- 3RACHA

## Ejemplos correctos

- `Busco en WTT`
- `Tu precio (WTS)`
- `Anuncio publicado en el Market`
- `Creator Studio`

## Ejemplos que sí deben ir en español

- `Loading...` -> `Cargando...`
- `Delete` -> `Eliminar`
- `Send Report` -> `Enviar reporte`
- `Error uploading` -> `Error al subir`
- `Save changes` -> `Guardar cambios`

## Recomendación para otros idiomas

Al crear `en.json`, `fr.json`, `de.json`, etc.:

1. Copiar exactamente las mismas claves de `es.json`.
2. Traducir todo el contenido funcional.
3. Conservar los términos de la lista oficial anterior tal cual.

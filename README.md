# Biblioteca Sync

App web installabile (PWA) per archiviare e sincronizzare i tuoi libri tra telefono e PC.

## Funzioni

- registrazione e accesso con email e password
- recupero password
- archivio libri con titolo, autore, genere, ISBN, stato, note e copertina
- ricerca veloce e filtri separati
- sincronizzazione tramite Supabase
- upload copertine su Supabase Storage
- recupero dati da ISBN con Open Library
- scanner ISBN con BarcodeDetector (solo browser compatibili)

## Pubblicazione su GitHub

1. Crea una repository su GitHub.
2. Carica tutti i file di questa cartella.
3. Copia `config.example.js` in `config.js`.
4. Inserisci in `config.js` il tuo URL Supabase e la tua chiave publishable/anon.
5. Attiva GitHub Pages dalla repository.
6. Imposta la URL di GitHub Pages tra i redirect di Supabase Auth.

## Configurazione Supabase

1. Crea un progetto su Supabase.
2. Vai in SQL Editor ed esegui il file `schema.sql`.
3. In Auth > Providers > Email abilita Email provider.
4. Se vuoi entrare subito dopo la registrazione, puoi disattivare Confirm email. Se la lasci attiva, l'utente deve confermare la mail prima del login.
5. In Authentication URL configuration inserisci il tuo Site URL e i Redirect URLs.
6. Vai in Project Settings > API e copia Project URL e publishable/anon key.
7. Inseriscili in `config.js`.

## Nota sicurezza

Non caricare mai `config.js` con chiavi segrete. In frontend usa solo la publishable/anon key, mai la service role key.

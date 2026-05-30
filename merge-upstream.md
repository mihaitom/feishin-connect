# Upstream mergen

## Überblick

- **Upstream-Branch:** `upstream/development` (https://github.com/jeffvli/feishin)
- **Unser Branch:** `development`
- **Letzter Merge:** `v1.12.0` (Commit `731d9df9`)

Fork-eigene Änderungen liegen in:
- `src/renderer/features/player/components/connect/` — Connect-UI
- `src/renderer/features/player/hooks/connect/` — Connect-Hooks
- `backend/` — Python-Backend
- `CHANGELOG.md`, `README.md`, `package.json` (Version + connect-deps)

---

## Schritt für Schritt

### 1. Upstream-Stand holen

```bash
git fetch upstream
```

Neuen Tag prüfen:
```bash
git tag --sort=-v:refname | head -5          # lokale Tags
git ls-remote --tags upstream | tail -10     # upstream Tags
```

### 2. Merge-Branch anlegen

Immer auf einem separaten Branch mergen, nie direkt auf `development`:

```bash
git checkout development
git pull origin development
git checkout -b merge/upstream-v1.13.0      # Versionsnummer anpassen
```

### 3. Mergen

```bash
git merge upstream/development
```

Bei einem konkreten Tag statt dem aktuellen Stand:
```bash
git merge v1.13.0
```

### 4. Konflikte lösen

Typische Konfliktdateien und wie damit umgehen:

| Datei | Was tun |
|---|---|
| `package.json` | Upstream-Änderungen übernehmen, unsere Version (`0.x.x`) und connect-spezifische deps behalten |
| `src/i18n/locales/en.json` | Beides behalten — neue Upstream-Keys und unsere (`page.manageServers.scanLibrary*`) |
| `CHANGELOG.md` | Unseren Abschnitt oben lassen, Upstream-Einträge darunter |
| `README.md` | Manuell entscheiden, meist unsere Version behalten |
| Controller-Dateien (`*-controller.ts`) | Upstream-Änderungen übernehmen, unsere Ergänzungen (z. B. `startScan`) zusätzlich einfügen |

Konflikt-Übersicht:
```bash
git status                      # alle konfliktbehafteten Dateien
git diff --name-only --diff-filter=U  # nur Konflikte
```

Nach jeder Datei:
```bash
git add <datei>
```

### 5. TypeScript-Check

```bash
./node_modules/.bin/tsc --noEmit
```

Keine Ausgabe = keine Fehler.

### 6. Kurz testen

```bash
pnpm run dev
```

Mindestens prüfen:
- Server-Einstellungen → "Scan Library"-Button vorhanden
- Playback funktioniert
- Connect-Popover öffnet sich

### 7. Merge-Commit erstellen

```bash
git commit -m "Merge upstream/development at v1.13.0"
```

### 8. Auf `development` übernehmen

```bash
git checkout development
git merge --no-ff merge/upstream-v1.13.0
git push origin development
```

---

## Checkliste nach dem Merge

- [ ] `./node_modules/.bin/tsc --noEmit` — keine Fehler
- [ ] `package.json` — unsere Version ist noch `0.x.x`, nicht Upstream-Version
- [ ] Connect-Popover funktioniert
- [ ] `startScan` in Subsonic- und Navidrome-Controller noch vorhanden
- [ ] Neue Upstream-i18n-Keys in `en.json` übernommen
- [ ] Merge-Branch löschen: `git branch -d merge/upstream-v1.13.0`

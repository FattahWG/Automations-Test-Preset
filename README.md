# Automations Test Preset

Automation testing aplikasi web (QA/SQA) dengan **Playwright** dan **Bruno CLI**, diterapkan pada satu contoh lengkap:
**Lawak Store**, toko demo dengan panel admin.

**Demo langsung:** <https://fattahwg.github.io/Automations-Test-Preset/>
([toko demo](https://fattahwg.github.io/Automations-Test-Preset/store/) ·
[test dashboard](https://fattahwg.github.io/Automations-Test-Preset/dashboard/)).
Akun demo: `login@demo.com` / `Logindemo123`.

> **Status: tahap awal.** Repo ini masih dasar dan akan terus dikembangkan.

## Isi

| Berkas | Fungsi |
|---|---|
| [demo/](demo/README.md) | Automation untuk Lawak Store: 41 case UI Playwright, 9 case API Bruno CLI, run script, dokumen Word dan Excel (dokumentasi dalam bahasa Inggris) |
| [docs/](docs/index.html) | Situs GitHub Pages: halaman showcase, toko demo dengan backend tiruan di browser, dan test dashboard |

## Cara menjalankan

Instalasi, akun demo, dan perintah run ada di [demo/README.md](demo/README.md). Contoh:

```
cd demo
npm ci
node scripts/run-suite.js --suite smoke
```

## Stack

- Windows 10/11, VS Code, PowerShell, Node 22 LTS, Python 3.11+.
- Playwright runner `@playwright/test` untuk semua test resmi; library `playwright` untuk utilitas.
- Bruno CLI `@usebruno/cli` 4.x (minimal 3.2.1), versi dipin exact.

## Yang tidak di-commit

`.env`, `playwright/.auth/`, hasil run di `automation/`, dan `node_modules/`. Lihat [.gitignore](.gitignore).

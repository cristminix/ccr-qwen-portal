# Dokumentasi Proyek Claude Code Router

## Daftar Isi
1. [Ikhtisar](#ikhtisar)
2. [Arsitektur Sistem](#arsitektur-sistem)
3. [Komponen Utama](#komponen-utama)
4. [Konfigurasi](#konfigurasi)
5. [Perintah CLI](#perintah-cli)
6. [Routing dan Transformasi](#routing-dan-transformasi)
7. [Setup dan Kontribusi](#setup-dan-kontribusi)

## Ikhtisar

Claude Code Router adalah proyek berbasis TypeScript yang berfungsi sebagai router untuk permintaan Claude Code. Proyek ini memungkinkan routing permintaan ke berbagai model bahasa besar (LLM) dari berbagai penyedia berdasarkan aturan kustom. Tujuannya adalah memungkinkan penggunaan Claude Code tanpa akun Anthropic dengan merutekan permintaan ke penyedia LLM lainnya.

## Arsitektur Sistem

Proyek ini memiliki arsitektur modular dengan komponen-komponen berikut:

```
.
├── node_modules/                 # Dependencies
├── llms/                        # Subproyek @musistudio/llms (server LLM universal)
│   ├── dist/                    # Output build
│   ├── scripts/                 # Script build
│   ├── src/                     # Source code
│   └── package.json
├── dist/                        # Output build utama
├── scripts/                     # Script build
├── src/                         # Source code utama
│   ├── middleware/              # Middleware (autentikasi)
│   ├── utils/                   # Utilitas (router, log, cache, dll)
│   ├── @types/                  # Definisi tipe
│   ├── cli.ts                   # Entry point CLI
│   ├── index.ts                 # Entry point server
│   ├── server.ts                # Wrapper server
│   └── constants.ts             # Konstanta
├── ui/                          # Antarmuka pengguna
├── .ccr/                        # Direktori konfigurasi runtime
├── .claude/                     # Konfigurasi Claude
├── package.json                 # Konfigurasi proyek utama
├── tsconfig.json                # Konfigurasi TypeScript
└── CLAUDE.md                    # Dokumentasi proyek
```

## Komponen Utama

### 1. CLI (`src/cli.ts`)
- Menyediakan antarmuka baris perintah
- Mengelola siklus hidup layanan (start/stop/restart)
- Menangani perintah `ccr code` dengan otomatis memulai layanan jika belum berjalan

### 2. Server (`src/index.ts` dan `src/server.ts`)
- Menginisialisasi dan menjalankan server HTTP
- Menerapkan middleware otentikasi
- Mengintegrasikan logika routing
- Menyediakan endpoint API tambahan

### 3. Routing (`src/utils/router.ts`)
- Menentukan penyedia dan model LLM yang akan digunakan
- Melakukan perhitungan token untuk pengambilan keputusan
- Mendukung berbagai skenario (konteks panjang, pencarian web, sub-agent, dll.)

### 4. Utilitas
- `src/utils/processCheck.ts` - Memantau status layanan dan PID
- `src/utils/cache.ts` - Menyediakan cache penggunaan token per sesi
- `src/utils/log.ts` - Manajemen logging
- `src/utils/status.ts` - Menampilkan status layanan
- `src/middleware/auth.ts` - Middleware otentikasi API key

## Konfigurasi

File konfigurasi disimpan di `~/.ccr/config.json` dan mencakup:

### Struktur Konfigurasi
```json
{
  "LOG": true,
  "APIKEY": "your-secret-key",
  "PROXY_URL": "http://127.0.0.1:7890",
  "HOST": "127.0.0.1",
  "Providers": [
    {
      "name": "provider-name",
      "api_base_url": "https://api.provider.com/v1/chat/completions",
      "api_key": "your-api-key",
      "models": ["model1", "model2"],
      "transformer": {
        "use": ["transformer-name"],
        "model-specific": {
          "use": ["specific-transformer"]
        }
      }
    }
  ],
  "Router": {
    "default": "provider,model",
    "background": "provider,model",
    "think": "provider,model",
    "longContext": "provider,model",
    "longContextThreshold": 60000,
    "webSearch": "provider,model"
  }
}
```

### Opsi Konfigurasi
- **`PROXY_URL`**: (opsional) URL proxy untuk permintaan API
- **`LOG`**: (opsional) Aktifkan logging, default `true`
- **`LOG_LEVEL`**: (opsional) Level logging (`fatal`, `error`, `warn`, `info`, `debug`, `trace`)
- **`APIKEY`**: (opsional) Kunci rahasia untuk otentikasi permintaan
- **`HOST`**: (opsional) Alamat host untuk server
- **`NON_INTERACTIVE_MODE`**: (opsional) Mode untuk lingkungan non-interaktif seperti CI/CD

## Perintah CLI

### Perintah Tersedia
- `ccr start` - Memulai server router
- `ccr stop` - Menghentikan server yang sedang berjalan
- `ccr restart` - Merestart server (menghentikan lalu memulai kembali)
- `ccr status` - Menampilkan status server saat ini
- `ccr statusline` - Menampilkan status terintegrasi (untuk baris status IDE)
- `ccr code "<prompt>"` - Menjalankan perintah Claude Code dengan prompt yang diberikan
- `ccr ui` - Membuka antarmuka web di browser
- `ccr -v` atau `ccr version` - Menampilkan informasi versi
- `ccr -h` atau `ccr help` - Menampilkan informasi bantuan

## Routing dan Transformasi

### Proses Routing
1. Permintaan masuk ke endpoint `/v1/messages`
2. Middleware routing (`src/utils/router.ts`) menghitung jumlah token dalam permintaan
3. Berdasarkan kriteria tertentu, sistem menentukan model mana yang akan digunakan:
   - Jika jumlah token melebihi ambang batas → model konteks panjang
   - Jika permintaan menggunakan `claude-3-5-haiku` → model background
   - Jika permintaan memiliki mode "thinking" → model think
   - Jika permintaan menggunakan alat pencarian web → model webSearch
   - Jika ada model khusus dalam metadata → model tersebut
   - Jika ada router kustom → gunakan logika kustom
   - Jika tidak ada kriteria cocok → model default

### Proses Transformasi
1. Proyek menggunakan modul `@musistudio/llms` yang memiliki sistem transformasi API
2. Setiap penyedia LLM memiliki transformer khusus untuk menyesuaikan format permintaan dan respons
3. Transformer mengubah antara format standar dan format spesifik penyedia
4. Sistem mendukung streaming respons dari berbagai penyedia

### Transformer Tersedia
- `Anthropic`: Transformer Anthropic standar
- `deepseek`: Untuk API DeepSeek
- `gemini`: Untuk API Gemini
- `openrouter`: Untuk API OpenRouter
- `maxtoken`: Mengatur nilai `max_tokens`
- `tooluse`: Mengoptimalkan penggunaan alat
- `reasoning`: Memproses bidang `reasoning_content`
- `enhancetool`: Menambahkan toleransi kesalahan untuk panggilan alat
- Dan banyak lagi

## Setup dan Kontribusi

### Instalasi
1. Pastikan Anda telah menginstal [Claude Code](https://docs.anthropic.com/en/docs/claude-code/quickstart):
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

2. Instal Claude Code Router:
   ```bash
   npm install -g @musistudio/claude-code-router
   ```

### Build Proyek
```bash
npm run build
```

### Menjalankan Server
```bash
ccr start
```

### Menjalankan Claude Code dengan Router
```bash
ccr code "Write a Hello World in TypeScript"
```

### Mode UI
```bash
ccr ui
```

### Setup Pengembangan
1. Clone repositori
2. Instal dependensi: `npm install`
3. Build proyek: `npm run build`
4. Jalankan dalam mode pengembangan: `npm run dev`

### Catatan Kontribusi
- Proyek ini menggunakan TypeScript
- Gunakan `esbuild` untuk build
- Gunakan `fastify` sebagai framework web
- Ikuti pola arsitektur yang sudah ada saat menambahkan fitur baru
- Jangan lakukan commit otomatis ke git
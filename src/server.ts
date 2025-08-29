import Server from "../llms/src/server"
import { readConfigFile, writeConfigFile, backupConfigFile } from "./utils"
import { checkForUpdates, performUpdate } from "./utils"
import { join } from "path"
import fastifyStatic from "@fastify/static"

export const createServer = (config: any): Server => {
  const server = new Server(config)

  // Menambahkan endpoint untuk membaca config.json dengan kontrol akses
  server.getApp().get("/api/config", async (req, reply) => {
    return await readConfigFile()
  })

  server.getApp().get("/api/transformers", async () => {
    const transformers = server
      .getApp()
      ._server!.transformerService.getAllTransformers()
    const transformerList = Array.from(transformers.entries()).map(
      ([name, transformer]: any) => ({
        name,
        endpoint: transformer.endPoint || null,
      })
    )
    return { transformers: transformerList }
  })

  // Menambahkan endpoint untuk menyimpan config.json dengan kontrol akses
  server.getApp().post("/api/config", async (req, reply) => {
    const newConfig = req.body

    // Mencadangkan file konfigurasi yang ada jika ada
    const backupPath = await backupConfigFile()
    if (backupPath) {
      console.log(`Backed up existing configuration file to ${backupPath}`)
    }

    await writeConfigFile(newConfig)
    return { success: true, message: "Config saved successfully" }
  })

  // Menambahkan endpoint untuk merestart layanan dengan kontrol akses
  server.getApp().post("/api/restart", async (req, reply) => {
    reply.send({ success: true, message: "Service restart initiated" })

    // Merestart layanan setelah penundaan singkat untuk memungkinkan respons dikirim
    setTimeout(() => {
      const { spawn } = require("child_process")
      spawn(process.execPath, [process.argv[1], "restart"], {
        detached: true,
        stdio: "ignore",
      })
    }, 1000)
  })

  // Mendaftarkan penyajian file statis dengan caching
  server.getApp().register(fastifyStatic, {
    root: join(__dirname, "..", "dist"),
    prefix: "/ui/",
    maxAge: "1h",
  })

  // Mengarahkan /ui ke /ui/ untuk penyajian file statis yang benar
  server.getApp().get("/ui", async (_, reply) => {
    return reply.redirect("/ui/")
  })

  // Endpoint pemeriksaan versi
  server.getApp().get("/api/update/check", async (req, reply) => {
    try {
      // Mendapatkan versi saat ini
      const currentVersion = require("../package.json").version
      const { hasUpdate, latestVersion, changelog } = await checkForUpdates(
        currentVersion
      )

      return {
        hasUpdate,
        latestVersion: hasUpdate ? latestVersion : undefined,
        changelog: hasUpdate ? changelog : undefined,
      }
    } catch (error) {
      console.error("Failed to check for updates:", error)
      reply.status(500).send({ error: "Failed to check for updates" })
    }
  })

  // Endpoint pelaksanaan pembaruan
  server.getApp().post("/api/update/perform", async (req, reply) => {
    try {
      // Hanya mengizinkan pengguna dengan hak akses penuh untuk melakukan pembaruan
      const accessLevel = (req as any).accessLevel || "restricted"
      if (accessLevel !== "full") {
        reply.status(403).send("Full access required to perform updates")
        return
      }

      // Melaksanakan logika pembaruan
      const result = await performUpdate()

      return result
    } catch (error) {
      console.error("Failed to perform update:", error)
      reply.status(500).send({ error: "Failed to perform update" })
    }
  })

  return server
}

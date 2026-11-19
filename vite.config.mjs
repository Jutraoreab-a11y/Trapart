// Site multipage : landing, connexion, application et pages légales.
import { resolve } from "node:path";
import { defineConfig } from "vite";

const page = name => resolve(import.meta.dirname, name + ".html");

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: page("index"),
        connexion: page("connexion"),
        app: page("app"),
        cgu: page("cgu"),
        "mentions-legales": page("mentions-legales"),
        confidentialite: page("confidentialite"),
      },
    },
  },
});

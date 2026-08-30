/**
 * Script interactivo para fijar la contraseña de acceso a Nómina.
 *
 * Uso:
 *   npm run set-password
 *
 * Pide la contraseña dos veces (sin eco en pantalla), la valida, calcula un
 * hash con scrypt (node:crypto) usando un salt aleatorio, y escribe el
 * resultado en la línea `APP_PASSWORD_HASH="..."` de `.env.local`,
 * preservando el resto del archivo (otras variables, comentarios, orden)
 * intacto.
 *
 * Nunca imprime la contraseña ni el hash en la terminal.
 */
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { createInterface } from "node:readline";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const scryptAsync = promisify(scrypt);

const ENV_PATH = path.resolve(process.cwd(), ".env.local");
const MIN_LARGO = 8;
const KEYLEN = 64;

/**
 * Pide una línea de stdin sin mostrarla en pantalla (equivalente a un
 * prompt de contraseña en terminal). Funciona escribiendo la pregunta en
 * stdout y luego silenciando el eco del stdin mientras el usuario escribe.
 */
function preguntarPasswordOculta(pregunta: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const rlAny = rl as unknown as {
      _writeToOutput?: (s: string) => void;
      output: NodeJS.WritableStream;
    };

    let mostrarPregunta = true;

    rlAny._writeToOutput = (stringToWrite: string) => {
      if (mostrarPregunta) {
        rlAny.output.write(stringToWrite);
        // Después de escribir el prompt una vez, dejamos de hacer eco de
        // los caracteres que el usuario tipee.
        if (stringToWrite === pregunta) {
          mostrarPregunta = false;
        }
      }
      // Si no es la pregunta, no escribimos nada (oculta la contraseña).
    };

    rl.question(pregunta, (respuesta) => {
      rl.close();
      process.stdout.write("\n");
      resolve(respuesta);
    });

    rl.on("error", reject);
  });
}

async function calcularHash(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivado = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  return `${salt.toString("hex")}:${derivado.toString("hex")}`;
}

function actualizarEnvLocal(hash: string) {
  if (!existsSync(ENV_PATH)) {
    throw new Error(
      `No se encontró ${ENV_PATH}. Este script espera que .env.local ya exista.`
    );
  }

  const contenidoOriginal = readFileSync(ENV_PATH, "utf8");
  const lineas = contenidoOriginal.split("\n");

  let encontrada = false;
  const nuevasLineas = lineas.map((linea) => {
    if (/^APP_PASSWORD_HASH\s*=/.test(linea)) {
      encontrada = true;
      return `APP_PASSWORD_HASH="${hash}"`;
    }
    return linea;
  });

  if (!encontrada) {
    // No debería pasar (la variable ya existe vacía según el setup del
    // proyecto), pero por robustez la agregamos al final si falta.
    if (nuevasLineas[nuevasLineas.length - 1] !== "") {
      nuevasLineas.push("");
    }
    nuevasLineas.push(`APP_PASSWORD_HASH="${hash}"`);
  }

  writeFileSync(ENV_PATH, nuevasLineas.join("\n"), "utf8");
}

async function main() {
  console.log("Configurar contraseña de acceso — Nómina\n");

  const password1 = await preguntarPasswordOculta("Nueva contraseña: ");

  if (password1.length < MIN_LARGO) {
    console.error(
      `\nLa contraseña debe tener al menos ${MIN_LARGO} caracteres. Inténtalo de nuevo.`
    );
    process.exitCode = 1;
    return;
  }

  const password2 = await preguntarPasswordOculta("Confirma la contraseña: ");

  if (password1 !== password2) {
    console.error("\nLas contraseñas no coinciden. Inténtalo de nuevo.");
    process.exitCode = 1;
    return;
  }

  const hash = await calcularHash(password1);
  actualizarEnvLocal(hash);

  console.log("\nContraseña configurada correctamente en .env.local.");
  console.log(
    "Recuerda definir la misma variable APP_PASSWORD_HASH en Vercel " +
      "(Project Settings → Environment Variables) con este mismo valor, " +
      "y volver a desplegar para que tome efecto."
  );
}

main().catch((err) => {
  console.error("\nError al configurar la contraseña:", err.message ?? err);
  process.exitCode = 1;
});

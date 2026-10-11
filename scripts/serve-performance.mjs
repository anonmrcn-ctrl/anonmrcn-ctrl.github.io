import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { gzip } from "node:zlib";
import { promisify } from "node:util";

const compress = promisify(gzip);
const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.PORT || 8000);
const types = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webmanifest": "application/manifest+json; charset=utf-8",
    ".webp": "image/webp",
    ".xml": "application/xml; charset=utf-8"
};
const compressible = /^(?:text\/|application\/(?:json|javascript|manifest\+json|xml))/;

function send(response, status, body, headers = {}) {
    response.writeHead(status, {
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        ...headers,
        "Content-Length": body.byteLength
    });
    response.end(body);
}

createServer(async (request, response) => {
    try {
        const url = new URL(request.url || "/", `http://${request.headers.host}`);
        let pathname = decodeURIComponent(url.pathname);
        if (pathname.endsWith("/")) pathname += "index.html";
        const filePath = resolve(root, `.${pathname}`);

        if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
            send(response, 403, Buffer.from("Forbidden"));
            return;
        }

        const info = await stat(filePath);
        if (!info.isFile()) throw new Error("Not a file");
        const contentType = types[extname(filePath).toLowerCase()] || "application/octet-stream";
        let body = await readFile(filePath);
        const headers = { "Content-Type": contentType };

        if (
            request.headers["accept-encoding"]?.includes("gzip") &&
            compressible.test(contentType) &&
            body.byteLength > 1024
        ) {
            body = await compress(body, { level: 6 });
            headers["Content-Encoding"] = "gzip";
            headers.Vary = "Accept-Encoding";
        }

        if (request.method === "HEAD") {
            response.writeHead(200, {
                "Cache-Control": "public, max-age=3600",
                "X-Content-Type-Options": "nosniff",
                ...headers,
                "Content-Length": body.byteLength
            });
            response.end();
            return;
        }

        send(response, 200, body, headers);
    } catch (_) {
        send(response, 404, Buffer.from("Not found"), { "Content-Type": "text/plain; charset=utf-8" });
    }
}).listen(port, "127.0.0.1", () => {
    console.log(`Server prestazioni attivo su http://127.0.0.1:${port}`);
});

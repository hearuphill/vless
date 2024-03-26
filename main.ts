import { WebSocketServer } from "ws";
import net from "net";
import { parseVlessRequestPacket } from "./parse";

const port = Number(process.env.PORT) || 8080;

const wss = new WebSocketServer({ port });

wss.on("connection", function connection(ws) {
    ws.on("error", console.error);

    let isFirstRequest = true;
    let isFirstResponse = true;
    let conn: net.Socket;

    const handleError = (e: unknown) => {
        console.error(e);
        if (conn && !conn.destroyed) {
            conn.destroy();
        }
        ws.close();
    };

    ws.on("message", async (_data: unknown) => {
        const data = _data as Buffer;
        if (isFirstRequest) {
            isFirstRequest = false;
            const vless = parseVlessRequestPacket(data);
            // console.log(vless.address);

            try {
                conn = net.connect(vless.port, vless.address);
                conn.on("error", handleError);
                conn.on("data", (data) => {
                    // process.stdout.write(data.toString() + "🔍");
                    let packet: Buffer;
                    if (isFirstResponse) {
                        isFirstResponse = false;
                        packet = Buffer.concat([Buffer.from([vless.version, 0]), data]);
                    } else {
                        packet = data;
                    }
                    ws.send(packet);
                });

                await new Promise<void>((resolve) => {
                    conn.on("ready", () => resolve());
                });

                conn.write(vless.data);
            } catch (e) {
                return handleError(e);
            }
        } else {
            if (conn) {
                conn.write(data);
            }
        }
    });

    ws.on("close", () => {
        if (conn && !conn.destroyed) {
            conn.destroy();
        }
    });
});

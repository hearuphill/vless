/**
 * https://xtls.github.io/development/protocols/vless.html
 */
export function parseVlessRequestPacket(_vlessBuffer: Uint8Array) {
    const vlessBuffer = new Uint8Array(getUnderlyingArrayBuffer(_vlessBuffer));
    if (vlessBuffer.byteLength < 24) throw new Error("invalid buffer");

    const version = new Uint8Array(vlessBuffer.subarray(0, 1))[0];
    const uuid = new Uint8Array(vlessBuffer.subarray(1, 17));

    const protoBufLength = new Uint8Array(vlessBuffer.subarray(17, 18))[0];
    const protoBuf = new Uint8Array(vlessBuffer.subarray(18, 18 + protoBufLength));

    // 0x01 TCP
    // 0x02 UDP
    // 0x03 MUX
    const command = new Uint8Array(
        vlessBuffer.subarray(18 + protoBufLength, 18 + protoBufLength + 1)
    )[0];

    const portIndex = 18 + protoBufLength + 1;
    const portBuffer = vlessBuffer.subarray(portIndex, portIndex + 2);

    // port is big-Endian in raw data etc 80 == 0x005d
    const port = new DataView(getUnderlyingArrayBuffer(portBuffer)).getInt16(0, false);

    const addressIndex = portIndex + 2;
    const addressBuffer = new Uint8Array(vlessBuffer.subarray(addressIndex, addressIndex + 1));

    // 1--> ipv4  addressLength =4
    // 2--> domain name addressLength=addressBuffer[1]
    // 3--> ipv6  addressLength =16
    const addressType = addressBuffer[0];
    let addressLength: number;
    let addressValueIndex = addressIndex + 1;
    let addressValue = "";
    switch (addressType) {
        case 1:
            addressLength = 4;
            addressValue = new Uint8Array(
                vlessBuffer.subarray(addressValueIndex, addressValueIndex + addressLength)
            ).join(".");
            break;
        case 2:
            addressLength = new Uint8Array(
                vlessBuffer.subarray(addressValueIndex, addressValueIndex + 1)
            )[0];
            addressValueIndex += 1;
            addressValue = new TextDecoder().decode(
                vlessBuffer.subarray(addressValueIndex, addressValueIndex + addressLength)
            );
            break;
        case 3:
            addressLength = 16;
            const dataView = new DataView(
                getUnderlyingArrayBuffer(
                    vlessBuffer.subarray(addressValueIndex, addressValueIndex + addressLength)
                )
            );
            // 2001:0db8:85a3:0000:0000:8a2e:0370:7334
            const ipv6: string[] = [];
            for (let i = 0; i < 8; i++) ipv6.push(dataView.getUint16(i * 2).toString(16));
            addressValue = ipv6.join(":");
            break;
        default:
            throw new Error(`invalid addressType: ${addressType}`);
    }

    const data = vlessBuffer.subarray(addressValueIndex + addressLength);

    return {
        version,
        uuid,
        protoBuf,
        command: [undefined, "tcp", "udp", "mux"][command],
        port,
        address: addressValue,
        data,
    };
}

/**
 * This is for node.js
 * so we can get correct underlying array buffer
 * @see https://nodejs.org/api/buffer.html#bufbyteoffset
 */
export function getUnderlyingArrayBuffer(b: Uint8Array) {
    /**
     * It's incorrect that we just return b.buffer
     * the DataView class expect correct array buffer
     */
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}

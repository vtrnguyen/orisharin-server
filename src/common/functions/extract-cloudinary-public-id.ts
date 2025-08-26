
export function extractCloudinaryPublicId(url?: string): string | null {
    if (!url) return null;
    try {
        const re = /\/upload\/(?:.*\/)?v\d+\/(.+?)\.(?:jpg|jpeg|png|gif|mp4|webm|mov|svg|webp|bmp|tiff|heic|heif)(?:\?|$)/i;
        const m = url.match(re);
        if (m && m[1]) return m[1];

        const re2 = /\/upload\/(.+?)\.(?:jpg|jpeg|png|gif|mp4|webm|mov|svg|webp|bmp|tiff|heic|heif)(?:\?|$)/i;
        const m2 = url.match(re2);
        if (m2 && m2[1]) {
            let id = m2[1];
            const parts = id.split('/');
            if (parts.length > 1 && (/[,]|^c_|^w_|^h_|^g_/.test(parts[0]))) {
                while (parts.length > 1 && (/[,]|^c_|^w_|^h_|^g_/.test(parts[0]))) {
                    parts.shift();
                }
            }
            return parts.join('/');
        }
    } catch (e) { }
    return null;
}

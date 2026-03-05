export function downloadFile(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
}

export function getFilenameFromDisposition(header?: string | null, fallback = "download.csv") {
    if (!header) {
        return fallback;
    }

    const match = /filename="?([^"]+)"?/i.exec(header);
    return match?.[1] || fallback;
}

export function downloadFile(blob: Blob, filename: string) {
    if (!(blob instanceof Blob)) {
        throw new Error("Invalid file payload.");
    }

    if (blob.size <= 0) {
        throw new Error("Generated file is empty.");
    }

    const legacyNavigator = window.navigator as Navigator & {
        msSaveOrOpenBlob?: (blob: Blob, defaultName?: string) => boolean;
    };
    if (typeof legacyNavigator.msSaveOrOpenBlob === "function") {
        legacyNavigator.msSaveOrOpenBlob(blob, filename);
        return;
    }

    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => {
        window.URL.revokeObjectURL(url);
    }, 60_000);
}

export function getFilenameFromDisposition(header?: string | null, fallback = "download.csv") {
    if (!header) {
        return fallback;
    }

    const match = /filename="?([^"]+)"?/i.exec(header);
    return match?.[1] || fallback;
}

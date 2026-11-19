import { qrSvgMarkup, isQrAssetUrl } from "@/lib/qr-assets";

export async function QrCode({
  value,
  label,
  downloadHrefPng,
  downloadHrefSvg,
}: {
  value: string;
  label: string;
  downloadHrefPng?: string;
  downloadHrefSvg?: string;
}) {
  if (!isQrAssetUrl(value)) {
    return null;
  }
  const svg = await qrSvgMarkup(value, 232);
  const showDownloads = Boolean(downloadHrefPng || downloadHrefSvg);

  return (
    <div className="grid w-fit gap-3">
      <div
        className="w-fit rounded-2xl bg-white p-3"
        role="img"
        aria-label={label}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {showDownloads ? (
        <div className="flex flex-wrap gap-3 text-sm">
          {downloadHrefPng ? (
            <a href={downloadHrefPng} className="underline" download>
              Download PNG
            </a>
          ) : null}
          {downloadHrefSvg ? (
            <a href={downloadHrefSvg} className="underline" download>
              Download SVG
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

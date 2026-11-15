import QRCode from "qrcode";

export async function QrCode({ value, label }: { value: string; label: string }) {
  if (!/^https?:\/\/\S+$/.test(value)) {
    return null;
  }
  const svg = await QRCode.toString(value, {
    type: "svg",
    margin: 1,
    width: 232,
    errorCorrectionLevel: "M",
  });
  return (
    <div
      className="w-fit rounded-2xl bg-white p-3"
      role="img"
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

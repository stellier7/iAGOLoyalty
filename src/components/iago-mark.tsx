import Image from "next/image";
import Link from "next/link";

export function IagoMark({
  href = "/",
  subtitle = "Loyalty",
  tone = "ink",
  size = "md",
}: {
  href?: string;
  subtitle?: string | null;
  tone?: "ink" | "bone";
  size?: "sm" | "md" | "lg";
}) {
  const titleClass =
    size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-2xl";
  const iconClass = size === "lg" ? "size-10" : size === "sm" ? "size-7" : "size-8";
  const textTone = tone === "bone" ? "text-bone" : "text-ink";
  const subTone = tone === "bone" ? "text-bone/65" : "text-mute";

  return (
    <Link href={href} className={`inline-flex items-center gap-3 ${textTone}`}>
      <Image
        src="/brand/icon.png"
        alt="iAGO Digital"
        width={80}
        height={80}
        className={`${iconClass} rounded-lg`}
        priority
      />
      <span className="leading-none">
        <span className={`block font-heading font-extrabold tracking-tightest ${titleClass}`}>
          iA<span className="text-coral">GO</span>
          <span className="text-coral">.</span>
        </span>
        {subtitle ? (
          <span className={`mt-1 block text-[0.65rem] tracking-[0.22em] uppercase ${subTone}`}>
            {subtitle}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

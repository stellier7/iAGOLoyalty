"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { membershipTokenFromInput } from "@/domain/card-token";
import { addStampAction, recordPurchaseAction, redeemAction } from "@/server/loyalty-actions";
import type { LoyaltyActionState, StaffCustomer } from "@/server/loyalty-types";
import { FormError } from "@/components/credential-forms";
import { TextField } from "@/components/fields";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";

export function CustomerLookup({ initialToken }: { initialToken?: string }) {
  const router = useRouter();
  const [token, setToken] = useState(initialToken ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!live || !video || !stream) {
      return;
    }
    video.srcObject = stream;
    const detectorWindow = window as Window & {
      BarcodeDetector?: new (options: { formats: string[] }) => {
        detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
      };
    };
    const Detector = detectorWindow.BarcodeDetector;
    if (!Detector) {
      return;
    }
    const detector = new Detector({ formats: ["qr_code"] });
    let stopped = false;
    const tick = async () => {
      if (stopped || stopRef.current) {
        return;
      }
      const codes = await detector.detect(video).catch(() => []);
      const found = codes
        .map((code) => membershipTokenFromInput(code.rawValue))
        .find((value): value is string => Boolean(value));
      if (found) {
        stopRef.current = true;
        stream.getTracks().forEach((track) => track.stop());
        router.push(`/app/scan?token=${encodeURIComponent(found)}`);
        return;
      }
      requestAnimationFrame(() => {
        void tick();
      });
    };
    void video.play().then(() => tick());
    return () => {
      stopped = true;
    };
  }, [live, router]);

  useEffect(() => {
    return () => {
      stopRef.current = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function startCamera() {
    const detectorWindow = window as Window & { BarcodeDetector?: unknown };
    if (!detectorWindow.BarcodeDetector || !navigator.mediaDevices?.getUserMedia) {
      setMessage("This browser cannot read a QR code from the camera. Paste the customer card link.");
      return;
    }
    stopRef.current = false;
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    streamRef.current = stream;
    setLive(true);
  }

  return (
    <form action="/app/scan" className="grid max-w-xl gap-3">
      <TextField label="Customer card link" name="token" value={token} onChange={setToken} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit">Find customer</Button>
        <Button type="button" variant="outline" onClick={() => void startCamera()}>
          Use camera
        </Button>
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {live ? <video ref={videoRef} className="max-h-64 w-full rounded-xl bg-black" muted playsInline /> : null}
    </form>
  );
}

function useIdempotencyKey() {
  const [key] = useState(() => crypto.randomUUID());
  return key;
}

export function AddStampForm({ token }: { token: string }) {
  const [state, action] = useActionState(addStampAction, {} as LoyaltyActionState);
  const key = useIdempotencyKey();
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="idempotencyKey" value={key} />
      {state.duplicate ? <input type="hidden" name="confirm" value="yes" /> : null}
      <FormError message={state.error} />
      <SubmitButton>{state.duplicate ? "Confirm another stamp" : "Add stamp"}</SubmitButton>
    </form>
  );
}

export function PurchaseForm({ token }: { token: string }) {
  const [state, action] = useActionState(recordPurchaseAction, {} as LoyaltyActionState);
  const key = useIdempotencyKey();
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="idempotencyKey" value={key} />
      <TextField label="Purchase amount" name="amount" type="number" step="0.01" required />
      <TextField label="External reference" name="externalReference" />
      {state.duplicate ? <input type="hidden" name="confirm" value="yes" /> : null}
      <FormError message={state.error} />
      <SubmitButton>{state.duplicate ? "Confirm another purchase" : "Record purchase"}</SubmitButton>
    </form>
  );
}

export function RedeemForm({ token, customer }: { token: string; customer: StaffCustomer }) {
  const [state, action] = useActionState(redeemAction, {} as LoyaltyActionState);
  const key = useIdempotencyKey();
  const options = [
    ...customer.entitlements.map((item) => ({ value: `entitlement:${item.id}`, label: `${item.name} (earned)` })),
    ...customer.rewards.map((item) => ({ value: `reward:${item.id}`, label: `${item.name} (${item.pointsCost} points)` })),
  ];
  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground">No reward is available for this card.</p>;
  }
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="idempotencyKey" value={key} />
      <div className="grid gap-1.5">
        <label htmlFor="target" className="text-sm font-medium">
          Reward
        </label>
        <select id="target" name="target" defaultValue={options[0]?.value} className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm">
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <FormError message={state.error} />
      <SubmitButton>Redeem</SubmitButton>
    </form>
  );
}

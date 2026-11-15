import { CreateBusinessForm } from "@/components/business-forms";

export const metadata = { title: "New business" };

export default function NewBusinessPage() {
  return (
    <div className="max-w-2xl">
      <h2 className="font-heading text-3xl">New business</h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Creating a business also creates a manual pilot subscription and an owner invitation. Copy the invitation link. Email sending is not configured.
      </p>
      <div className="mt-6">
        <CreateBusinessForm />
      </div>
    </div>
  );
}

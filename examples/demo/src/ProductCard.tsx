import { ChevronRight, ArrowLeft } from "lucide-react";

export function ProductCard({ product, comment, onBack }) {
  return (
    <article className="rounded-l-xl border-l-4 pl-6 text-left">
      <button onClick={onBack} className="mr-2">
        <ArrowLeft className="h-4 w-4" />
      </button>
      <h2 style={{ marginLeft: 12, textAlign: "left" }}>{product.name}</h2>
      <p>{comment.body}</p>
      <input type="text" placeholder="اكتب تعليقك" />
      <a href="/next" className="inline-flex items-center gap-1">
        التالي <ChevronRight className="size-4" />
      </a>
      <p>تابعنا على @ittijah</p>
    </article>
  );
}

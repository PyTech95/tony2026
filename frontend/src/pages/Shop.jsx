import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import Spinner from "@/components/Spinner";
import CartBadge from "@/components/CartBadge";

export default function Shop() {
  const [rows, setRows] = useState(null);
  const [cat, setCat] = useState("all");

  useEffect(() => {
    api.get("/products").then(({ data }) => setRows(data)).catch(() => setRows([]));
  }, []);

  const cats = useMemo(() => {
    if (!rows) return ["all"];
    return ["all", ...Array.from(new Set(rows.map((r) => r.category)))];
  }, [rows]);

  const visible = useMemo(() => (rows || []).filter((r) => cat === "all" || r.category === cat), [rows, cat]);

  return (
    <div data-testid="shop-page">
      <PageHeader eyebrow="Objects for practice" title="Shop" testId="shop-header" action={<CartBadge />} />

      <div className="mx-auto max-w-2xl px-5">
        <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar" data-testid="shop-filters">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              data-testid={`shop-filter-${c}`}
              className={`pill !py-2 !px-4 !text-[13px] shrink-0 ${cat === c ? "pill-primary" : "pill-ghost"}`}
            >
              {c[0].toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>

        {rows === null ? <Spinner /> : (
          <ul className="grid grid-cols-2 gap-4" data-testid="shop-list">
            {visible.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/shop/${p.id}`}
                  data-testid={`shop-item-${p.id}`}
                  className="block rounded-2xl overflow-hidden bg-white border border-[#E5E6DF] hover:border-[#B25A45] transition"
                >
                  <div className="aspect-square bg-[#F2F2EC] overflow-hidden">
                    {p.images?.[0] && <img src={p.images[0]} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="p-3">
                    <div className="text-[13px] font-semibold leading-tight clamp-2">{p.title}</div>
                    <div className="mt-1 text-sm text-[#B25A45] font-semibold">${p.price}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

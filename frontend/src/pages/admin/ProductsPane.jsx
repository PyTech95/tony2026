import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Trash2, Eye, EyeOff, Save, ShoppingBag, Plus } from "lucide-react";
import { api } from "@/lib/api";
import Spinner from "@/components/Spinner";

function ProductsPane() {
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const ic = "w-full rounded-lg border border-[#E5E6DF] bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#B25A45]";

  const load = () => api.get("/admin/products").then(({ data }) => setRows(data)).catch(() => setRows([]));
  const loadStatus = () => api.get("/admin/printful/status").then(({ data }) => setStatus(data)).catch(() => setStatus({ configured: false }));
  useEffect(() => { load(); loadStatus(); }, []);

  const sync = async () => {
    setSyncing(true);
    try {
      const { data } = await api.post("/admin/printful/sync");
      toast.success(`Synced — ${data.created} new, ${data.updated} updated`);
      load(); loadStatus();
    } catch (e) { toast.error(e?.response?.data?.detail || "Sync failed"); }
    finally { setSyncing(false); }
  };

  const set = (id, k, v) => setRows((rs) => rs.map((p) => (p.id === id ? { ...p, [k]: v } : p)));

  const save = async (p) => {
    try {
      await api.patch(`/admin/products/${p.id}`, {
        title: p.title, description: p.description, category: p.category,
        price: Number(p.price), currency: p.currency, stock_qty: Number(p.stock_qty),
        visible: p.visible !== false,
      });
      toast.success("Saved");
    } catch { toast.error("Save failed"); }
  };

  const toggleVisible = async (p) => {
    const v = !(p.visible !== false);
    set(p.id, "visible", v);
    try { await api.patch(`/admin/products/${p.id}`, { visible: v }); } catch { toast.error("Failed"); }
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.title}"?`)) return;
    try { await api.delete(`/admin/products/${p.id}`); load(); } catch { toast.error("Failed"); }
  };

  return (
    <div className="space-y-4" data-testid="products-pane">
      {/* Printful sync card */}
      <div className="rounded-2xl bg-white border border-[#E5E6DF] p-4" data-testid="printful-card">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="eyebrow flex items-center gap-2"><ShoppingBag className="h-3.5 w-3.5 text-[#B25A45]" /> Printful</div>
            <div className="text-sm text-[#545E56] mt-1">
              {status === null ? "…" : status.configured ? (
                <>Connected · store <span className="font-mono text-xs">{status.store_id}</span> · {status.synced_products} synced
                  {status.last_sync && <> · last {new Date(status.last_sync).toLocaleString()}</>}</>
              ) : "Not configured — add PRINTFUL_TOKEN in backend settings."}
            </div>
          </div>
          <button onClick={sync} disabled={syncing || !status?.configured} data-testid="printful-sync-btn" className="pill pill-primary">
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} /> {syncing ? "Syncing…" : "Sync from Printful"}
          </button>
        </div>
        {status?.configured && status?.synced_products === 0 && (
          <p className="text-xs text-[#6B7269] mt-2">Tip: products only sync from your Printful <b>Manual Order / API</b> store. Add products there, then sync.</p>
        )}
      </div>

      <div className="eyebrow">All products {rows?.length ? `(${rows.length})` : ""}</div>
      {rows === null ? <Spinner /> : rows.length === 0 ? (
        <p className="text-sm text-[#6B7269] rounded-2xl bg-[#F2F2EC] p-5">No products yet. Sync from Printful or add manually.</p>
      ) : (
        <ul className="space-y-3" data-testid="products-list">
          {rows.map((p) => (
            <li key={p.id} className="rounded-2xl bg-white border border-[#E5E6DF] p-3" data-testid={`product-row-${p.id}`}>
              <div className="flex gap-3">
                <div className="h-16 w-16 shrink-0 rounded-lg bg-[#F2F2EC] overflow-hidden">
                  {p.images?.[0] && <img src={p.images[0]} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <input className={ic} value={p.title || ""} onChange={(e) => set(p.id, "title", e.target.value)} data-testid={`product-title-${p.id}`} />
                    {p.source === "printful" && <span className="shrink-0 text-[9px] uppercase tracking-widest font-bold bg-[#F7ECE8] text-[#B25A45] rounded-full px-2 py-1">Printful</span>}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input className={ic} type="number" value={p.price ?? 0} onChange={(e) => set(p.id, "price", e.target.value)} placeholder="Price" data-testid={`product-price-${p.id}`} />
                    <input className={ic} value={p.category || ""} onChange={(e) => set(p.id, "category", e.target.value)} placeholder="Category" />
                    <input className={ic} type="number" value={p.stock_qty ?? 0} onChange={(e) => set(p.id, "stock_qty", e.target.value)} placeholder="Stock" />
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => save(p)} data-testid={`product-save-${p.id}`} className="pill pill-primary !py-1.5 !px-3 !text-xs"><Save className="h-3.5 w-3.5" /> Save</button>
                    <button onClick={() => toggleVisible(p)} data-testid={`product-visible-${p.id}`} className="pill pill-ghost !py-1.5 !px-3 !text-xs">
                      {p.visible !== false ? <><Eye className="h-3.5 w-3.5" /> Visible</> : <><EyeOff className="h-3.5 w-3.5" /> Hidden</>}
                    </button>
                    <button onClick={() => remove(p)} data-testid={`product-delete-${p.id}`} className="ml-auto text-[#B25A45] hover:opacity-70"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ProductsPane;

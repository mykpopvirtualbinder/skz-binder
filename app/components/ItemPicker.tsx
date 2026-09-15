"use client";
import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { X, Search, Loader2, Star, CheckCircle2, ChevronLeft } from "lucide-react";
import { useGlobal } from "../context/GlobalContext"; // 👈 Importamos el contexto

const formatPrettyName = (name: string | null | undefined) => {
  if (!name) return "";
  return name.replace(/[-_]/g, " ").split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
};

export default function ItemPicker({ userId, onSelect, onCancel, wantedIds = [], allowedTypes = ["pc", "merch"], initialSelected = [] }: any) {
  const { t } = useGlobal(); // 👈 Extraemos t()
  
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedList, setSelectedList] = useState<any[]>(initialSelected);

  const safeWantedIds = wantedIds.map(String);

  useEffect(() => {
    async function loadBinder() {
      if (!userId) return;
      setLoading(true);
      try {
        const { data: pcs } = await supabase
          .from("user_item_statuses")
          .select("status, item_id, item:items(*)")
          .eq("user_id", userId)
          .in("status", ["have", "wtt", "wts", "otw"]);

        const { data: merch } = await supabase
          .from("user_merch_statuses")
          .select("status, merch_id, merch_item:merch_items(*)")
          .eq("user_id", userId)
          .in("status", ["have", "wtt", "wts", "otw"]);
        
        const all = [
          ...(pcs || []).map((p: any) => {
            const item = Array.isArray(p.item) ? p.item[0] : p.item;
            return {
              id: p.item_id,
              type: "pc",
              image_url: item?.image_url,
              member: item?.member,
              version: item?.version,
              name: item?.name,
              group: item?.group,
              album: item?.album,
            };
          }),
          ...(merch || []).map((m: any) => {
            const merchItem = Array.isArray(m.merch_item) ? m.merch_item[0] : m.merch_item;
            return {
              id: m.merch_id,
              type: "merch",
              image_url: merchItem?.image_url,
              name: merchItem?.name,
            };
          }),
        ];

        const uniqueItems = all.reduce((acc: any[], current) => {
          const x = acc.find(item => String(item.id) === String(current.id) && item.type === current.type);
          if (!x && current.image_url) acc.push(current);
          return acc;
        }, []);

        setItems(uniqueItems);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    }
    loadBinder();
  }, [userId]);

  useEffect(() => {
    setSelectedList(initialSelected);
  }, [initialSelected]);

  const toggleItem = (item: any) => {
    const isSelected = selectedList.find(i => String(i.id) === String(item.id) && i.type === item.type);
    if (isSelected) {
      setSelectedList(selectedList.filter(i => !(String(i.id) === String(item.id) && i.type === item.type)));
    } else {
      setSelectedList([...selectedList, item]);
    }
  };

  const filtered = items.filter((i) => {
    if (!allowedTypes.includes(i.type)) return false;
    return (i.member?.toLowerCase().includes(search.toLowerCase())) || (i.name?.toLowerCase().includes(search.toLowerCase()));
  });
  const sortedItems = [...filtered].sort((a, b) => {
    const aW = safeWantedIds.includes(String(a.id));
    const bW = safeWantedIds.includes(String(b.id));
    return aW && !bW ? -1 : !aW && bW ? 1 : 0;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: "var(--bg-main)", color: "var(--text-main)" }}>
      {/* CABECERA */}
      <div style={{ padding: "20px", borderBottom: "1px solid var(--color-border)", display: "flex", gap: "15px", alignItems: "center", backgroundColor: "var(--bg-card)" }}>
        <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", color: "var(--color-primary)" }}>
          <ChevronLeft size={24} />
        </button>
        <div style={{ flex: 1, position: "relative" }}>
          <Search size={18} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            placeholder={t('item_picker.search_placeholder')} 
            style={{ width: "100%", padding: "12px 12px 12px 42px", borderRadius: "14px", border: "2px solid var(--color-border)", outline: "none", fontSize: "14px", backgroundColor: "var(--bg-main)", color: "var(--text-main)" }} 
          />
        </div>
      </div>

      {/* CUADRÍCULA */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(105px, 1fr))", gap: "20px", paddingBottom: "20px" }}>
          {sortedItems.map((item, idx) => {
            const isWanted = safeWantedIds.includes(String(item.id));
            const isSelected = selectedList.find(i => String(i.id) === String(item.id) && i.type === item.type);
            return (
              <div key={`${item.id}-${idx}`} onClick={() => toggleItem(item)} style={{ cursor: "pointer", position: "relative", transform: isSelected ? "scale(0.95)" : "none", transition: "all 0.2s" }}>
                
                {isSelected && (
                  <div style={{ position: "absolute", top: 5, left: 5, zIndex: 20, color: "var(--color-primary)", background: "var(--bg-card)", borderRadius: "50%", boxShadow: "0 2px 6px var(--shadow-card)" }}>
                    <CheckCircle2 size={24} fill="var(--color-primary)" color="var(--bg-card)" />
                  </div>
                )}
                
                {isWanted && (
                  <div style={{ position: "absolute", top: -5, right: -5, background: "var(--state-warning-fg)", color: "white", fontSize: "8px", fontWeight: 900, padding: "3px 6px", borderRadius: "8px", zIndex: 10 }}>
                    {t('item_picker.wanted_badge')}
                  </div>
                )}

                <div style={{ aspectRatio: "3/4", borderRadius: "12px", overflow: "hidden", border: isSelected ? "4px solid var(--color-primary)" : isWanted ? "3px solid var(--state-warning-fg)" : "1px solid var(--color-border)" }}>
                  <img src={item.image_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <div style={{ fontSize: "10px", fontWeight: 800, marginTop: "5px", textAlign: "center", color: "var(--text-main)" }}>
                  {formatPrettyName(item.type === "pc" ? item.member : item.name)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PIE DE PÁGINA (BOTONES) */}
      <div style={{ padding: "20px", backgroundColor: "var(--bg-card)", borderTop: "1px solid var(--color-border)", display: "flex", gap: "12px" }}>
        <button onClick={onCancel} style={{ flex: 1, backgroundColor: "var(--bg-soft)", color: "var(--text-main)", border: "none", padding: "12px", borderRadius: "12px", fontWeight: 800, cursor: "pointer" }}>
          {t('common.back')}
        </button>
        <button 
          onClick={() => onSelect(selectedList)}
          disabled={selectedList.length === 0}
          style={{ flex: 2, backgroundColor: "var(--color-primary)", color: "white", border: "none", padding: "12px", borderRadius: "12px", fontWeight: 900, cursor: "pointer", opacity: selectedList.length === 0 ? 0.5 : 1 }}
        >
          {t('common.confirm')} ({selectedList.length})
        </button>
      </div>
    </div>
  );
}
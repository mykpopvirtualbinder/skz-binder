"use client";

import React from "react";
import type { VipGroupAssetsRow } from "@/lib/vip-badge-groups";

export type VipBadgeSectionKey = "groups" | "members" | "skzoo";

type AvatarModalInsigniasSectionProps = {
  t: (key: string) => string;
  kpopGroups: Record<string, { logo: string; members: string[] }>;
  biasByGroup: Record<string, string[]>;
  portraitForBiasMember: (
    memberName: string,
    imageUrl: string | null | undefined,
    presetGroupKey: string | null,
  ) => string;
  isPremium: boolean;
  isAdmin: boolean;
  vipBadgeGroupKey: string;
  setVipBadgeGroupKey: (v: string) => void;
  vipGroupAssetsRows: VipGroupAssetsRow[];
  vipBadgeSection: VipBadgeSectionKey;
  setVipBadgeSection: (v: VipBadgeSectionKey) => void;
  selectedVipGroupRow: VipGroupAssetsRow | null;
  vipBadgeSectionTabs: { key: VipBadgeSectionKey; label: string }[];
  onPredefinedAvatarSelect: (url: string) => void | Promise<void>;
  onVipAvatarSelect: (url: string) => void | Promise<void>;
};

export function AvatarModalInsigniasSection({
  t,
  kpopGroups,
  biasByGroup,
  portraitForBiasMember,
  isPremium,
  isAdmin,
  vipBadgeGroupKey,
  setVipBadgeGroupKey,
  vipGroupAssetsRows,
  vipBadgeSection,
  setVipBadgeSection,
  selectedVipGroupRow,
  vipBadgeSectionTabs,
  onPredefinedAvatarSelect,
  onVipAvatarSelect,
}: AvatarModalInsigniasSectionProps) {
  return (
    <div style={{ opacity: !isPremium && !isAdmin ? 0.7 : 1 }}>
      {Object.values(biasByGroup).flat().length > 0 ? (
        <div
          style={{
            marginBottom: 18,
            border: "1px solid var(--color-border)",
            background: "var(--bg-soft)",
            borderRadius: 16,
            padding: 14,
          }}
        >
          <div style={{ fontWeight: 950, color: "var(--color-primary)", marginBottom: 10 }}>
            {t("me.avatar_modal.my_biases_title")}
          </div>
          {(() => {
            const presentGroups = Array.from(
              new Set(Object.keys(biasByGroup).filter((g) => (biasByGroup[g] || []).length > 0)),
            );
            const ordered = [
              ...Object.keys(kpopGroups).filter((g) => presentGroups.includes(g)),
              ...presentGroups
                .filter((g) => !Object.keys(kpopGroups).includes(g))
                .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })),
            ];
            return ordered.map((groupName) => {
              const selected = (biasByGroup[groupName] || []).slice();
              const preset = kpopGroups[groupName];
              if (preset) {
                const order = preset.members;
                selected.sort((a, b) => order.indexOf(a) - order.indexOf(b));
              } else {
                selected.sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
              }
              return (
                <div key={groupName} style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 900,
                      color: "var(--text-main)",
                      marginBottom: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {kpopGroups[groupName]?.logo ? (
                      <img
                        src={kpopGroups[groupName].logo}
                        alt=""
                        style={{ width: 18, height: 18, borderRadius: 6, objectFit: "cover" }}
                      />
                    ) : null}
                    <span>{groupName}</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {selected.map((memberName) => {
                      const portrait = portraitForBiasMember(memberName, null, groupName);
                      return (
                        <button
                          key={`${groupName}:${memberName}`}
                          type="button"
                          onClick={() => void onPredefinedAvatarSelect(portrait)}
                          title={memberName}
                          style={{
                            background: "transparent",
                            border: "none",
                            padding: 0,
                            cursor: "pointer",
                            borderRadius: 999,
                          }}
                        >
                          <img
                            src={portrait}
                            alt={memberName}
                            style={{
                              width: 52,
                              height: 52,
                              borderRadius: "50%",
                              objectFit: "cover",
                              border: "2px solid var(--color-primary)",
                              background: "var(--bg-card)",
                            }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      ) : (
        <div
          style={{
            marginBottom: 18,
            padding: "12px 14px",
            borderRadius: 14,
            border: "1px dashed var(--color-border)",
            background: "color-mix(in srgb, var(--bg-soft) 70%, var(--bg-card))",
            color: "var(--text-muted)",
            fontWeight: 700,
            fontSize: 12,
          }}
        >
          {t("me.avatar_modal.no_badges")}
        </div>
      )}

      <div style={{ marginBottom: 14, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
        <label
          style={{
            display: "block",
            fontSize: 11,
            fontWeight: 950,
            color: "var(--color-primary)",
            marginBottom: 8,
            textAlign: "center",
            textTransform: "uppercase",
          }}
        >
          {t("me.avatar_modal.vip_filter_group")}
        </label>
        <select
          value={vipBadgeGroupKey}
          onChange={(e) => setVipBadgeGroupKey(e.target.value)}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid var(--color-border)",
            outline: "none",
            fontWeight: 700,
            backgroundColor: "var(--bg-main)",
            color: "var(--text-main)",
            cursor: "pointer",
          }}
        >
          {vipGroupAssetsRows.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center", marginBottom: "14px" }}>
        {vipBadgeSectionTabs.map((section) => (
          <button
            key={section.key}
            type="button"
            onClick={() => setVipBadgeSection(section.key)}
            style={{
              borderRadius: "999px",
              border:
                vipBadgeSection === section.key
                  ? "2px solid var(--state-warning-fg)"
                  : "1px solid var(--color-border)",
              background:
                vipBadgeSection === section.key
                  ? "color-mix(in srgb, var(--state-warning-fg) 12%, var(--bg-card))"
                  : "var(--bg-card)",
              color: vipBadgeSection === section.key ? "var(--state-warning-fg)" : "var(--text-main)",
              padding: "7px 12px",
              fontSize: "12px",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {section.label}
          </button>
        ))}
      </div>
      {selectedVipGroupRow ? (
        <div
          style={{
            marginBottom: "16px",
            border: "1px solid var(--color-border)",
            background: "var(--bg-soft)",
            borderRadius: "16px",
            padding: "14px",
          }}
        >
          <div style={{ fontWeight: 900, color: "var(--color-primary)", marginBottom: "10px" }}>
            {t("me.avatar_modal.group_badges").replace("{{group}}", selectedVipGroupRow.label)}
          </div>
          {vipBadgeSection === "groups" && (
            <>
              {selectedVipGroupRow.logo ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center" }}>
                  <button
                    type="button"
                    onClick={() => void onVipAvatarSelect(selectedVipGroupRow.logo!)}
                    title={selectedVipGroupRow.label}
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      borderRadius: "999px",
                    }}
                  >
                    <div
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: "50%",
                        border: "2px solid var(--state-warning-fg)",
                        background: "var(--bg-card)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 10,
                        boxSizing: "border-box",
                        overflow: "hidden",
                      }}
                    >
                      <img
                        src={selectedVipGroupRow.logo}
                        alt=""
                        style={{
                          maxWidth: "100%",
                          maxHeight: "100%",
                          width: "auto",
                          height: "auto",
                          objectFit: "contain",
                        }}
                      />
                    </div>
                  </button>
                </div>
              ) : (
                <div style={{ color: "var(--text-muted)", fontWeight: 700, fontSize: 13, textAlign: "center" }}>
                  {t("me.avatar_modal.vip_logo_empty")}
                </div>
              )}
            </>
          )}
          {vipBadgeSection === "members" && (
            <>
              {selectedVipGroupRow.members.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                  {selectedVipGroupRow.members.map((img) => (
                    <button
                      key={img}
                      type="button"
                      onClick={() => void onVipAvatarSelect(img)}
                      style={{
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        borderRadius: "999px",
                      }}
                    >
                      <img
                        src={img}
                        alt=""
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: "50%",
                          objectFit: "cover",
                          border: "2px solid var(--state-warning-fg)",
                          background: "var(--bg-card)",
                        }}
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ color: "var(--text-muted)", fontWeight: 700, fontSize: 13, textAlign: "center" }}>
                  {t("me.avatar_modal.vip_members_empty")}
                </div>
              )}
            </>
          )}
          {vipBadgeSection === "skzoo" && (
            <>
              {selectedVipGroupRow.mascotas.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                  {selectedVipGroupRow.mascotas.map((img) => (
                    <button
                      key={img}
                      type="button"
                      onClick={() => void onVipAvatarSelect(img)}
                      style={{
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        borderRadius: "999px",
                      }}
                    >
                      <img
                        src={img}
                        alt=""
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: "50%",
                          objectFit: "cover",
                          border: "2px solid var(--state-warning-fg)",
                          background: "var(--bg-card)",
                        }}
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ color: "var(--text-muted)", fontWeight: 700, fontSize: 13, textAlign: "center" }}>
                  {t("me.avatar_modal.vip_mascots_empty")}
                </div>
              )}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

"use client"; // 👈 ¡ESTA ES LA LÍNEA QUE FALTA!

import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div style={{ 
      minHeight: "calc(100vh - 120px)", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center",
      backgroundColor: "var(--bg-main)",
      transition: "background-color 0.3s ease"
    }}>
      <Loader2 
        size={40} 
        color="var(--color-primary)" 
        style={{ animation: "spin 1s linear infinite" }} 
      />
      
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
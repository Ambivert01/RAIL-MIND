"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { AppLayout } from "@/components/layout/app-layout";
import { twinApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Layers, Map, AlertTriangle, ShieldAlert, Cpu, Activity, Eye } from "lucide-react";
import { useTwinStore } from "@/stores/twin.store";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

// Default center: Northern India (NCRN demo network)
const DEFAULT_CENTER: [number, number] = [77.1800, 28.5800];
const DEFAULT_ZOOM = 11;

const STATUS_HEX: Record<string, string> = {
  HEALTHY: "#22c55e", WARNING: "#eab308", CRITICAL: "#ef4444", OFFLINE: "#6b7280",
};

export default function TwinPage() {
  const router = useRouter();
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const { twinData, setTwinData, activeLayers, toggleLayer } = useTwinStore();
  const [loading, setLoading] = useState(true);
  const [selectedStation, setSelectedStation] = useState<any>(null);
  const [mapReady, setMapReady] = useState(false);

  // Fetch twin state
  useEffect(() => {
    twinApi.getState().then((r) => {
      setTwinData(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));

    const interval = setInterval(() => {
      twinApi.getState().then((r) => setTwinData(r.data)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Initialize Mapbox
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    if (!MAPBOX_TOKEN || MAPBOX_TOKEN === "your-mapbox-token-here") {
      setMapReady(false);
      return;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: false,
    });

    map.on("load", () => {
      mapRef.current = map;
      setMapReady(true);
    });

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Place markers when twin data + map are ready
  useEffect(() => {
    if (!mapReady || !mapRef.current || !twinData) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const map = mapRef.current;

    // Station markers
    if (activeLayers.includes("infrastructure")) {
      for (const station of twinData.stations ?? []) {
        const el = document.createElement("div");
        el.className = "station-marker";
        el.style.cssText = `
          width:32px;height:32px;border-radius:50%;
          background:${STATUS_HEX[station.status]??'#6b7280'}22;
          border:2px solid ${STATUS_HEX[station.status]??'#6b7280'};
          cursor:pointer;display:flex;align-items:center;justify-content:center;
          transition:transform 0.2s;
        `;
        el.innerHTML = `<div style="width:10px;height:10px;border-radius:50%;background:${STATUS_HEX[station.status]??'#6b7280'}"></div>`;
        el.addEventListener("mouseenter", () => { el.style.transform = "scale(1.3)"; });
        el.addEventListener("mouseleave", () => { el.style.transform = "scale(1)"; });
        el.addEventListener("click", () => setSelectedStation(station));

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([station.longitude, station.latitude])
          .addTo(map);
        markersRef.current.push(marker);
      }
    }

    // Asset/signal markers
    for (const asset of twinData.assets ?? []) {
      if (!asset.latitude || !asset.longitude) continue;
      if (asset.assetType !== "SIGNAL" && asset.assetType !== "SWITCH") continue;
      if (!activeLayers.includes("infrastructure")) continue;

      const el = document.createElement("div");
      const color = STATUS_HEX[asset.status] ?? "#6b7280";
      const pulse = asset.status === "CRITICAL";

      el.style.cssText = `
        width:14px;height:14px;border-radius:3px;
        background:${color}44;border:1.5px solid ${color};
        cursor:pointer;transition:transform 0.2s;
        ${pulse ? "animation:pulse 1.5s ease-in-out infinite;" : ""}
      `;
      el.addEventListener("click", () => router.push(`/assets/${asset.id}`));
      el.addEventListener("mouseenter", () => { el.style.transform = "scale(1.5)"; });
      el.addEventListener("mouseleave", () => { el.style.transform = "scale(1)"; });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([asset.longitude, asset.latitude])
        .setPopup(new mapboxgl.Popup({ offset: 10, closeButton: false })
          .setHTML(`<div style="font-size:12px;font-weight:600">${asset.assetCode}</div><div style="font-size:11px;opacity:0.7">${asset.assetType} · ${asset.status}</div>`))
        .addTo(map);
      markersRef.current.push(marker);
    }

    // Active incident markers
    if (activeLayers.includes("incidents")) {
      for (const inc of twinData.activeIncidents ?? []) {
        const asset = twinData.assets?.find((a: any) => a.id === inc.assetId);
        if (!asset?.latitude || !asset?.longitude) continue;

        const el = document.createElement("div");
        el.style.cssText = `
          width:20px;height:20px;border-radius:50%;
          background:#ef444444;border:2px solid #ef4444;
          cursor:pointer;display:flex;align-items:center;justify-content:center;
          font-size:10px;color:#ef4444;font-weight:bold;
          animation:pulse 1s ease-in-out infinite;
        `;
        el.textContent = "!";
        el.addEventListener("click", () => router.push(`/incidents/${inc.id}`));

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([asset.longitude, asset.latitude])
          .addTo(map);
        markersRef.current.push(marker);
      }
    }
  }, [mapReady, twinData, activeLayers]);

  const layers = [
    { id: "infrastructure", label: "Infrastructure", icon: Map },
    { id: "risk", label: "Risk", icon: ShieldAlert },
    { id: "incidents", label: "Incidents", icon: AlertTriangle },
    { id: "agents", label: "Agent Activity", icon: Cpu },
  ];

  const stats = twinData ? {
    total: twinData.stations?.length ?? 0,
    critical: twinData.stations?.filter((s: any) => s.status === "CRITICAL").length ?? 0,
    incidents: twinData.activeIncidents?.length ?? 0,
    alerts: twinData.activeAlerts?.length ?? 0,
  } : null;

  return (
    <AppLayout>
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Digital Twin</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Live network visualization — NCRN</p>
          </div>
          {stats && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">{stats.total} stations</span>
              {stats.critical > 0 && <span className="text-red-400 font-medium">{stats.critical} critical</span>}
              {stats.incidents > 0 && <span className="text-orange-400">{stats.incidents} incidents</span>}
            </div>
          )}
        </div>

        <div className="flex gap-4" style={{ height: "calc(100vh - 200px)" }}>
          {/* Map */}
          <div className="flex-1 card-glass overflow-hidden relative">
            {!MAPBOX_TOKEN || MAPBOX_TOKEN === "your-mapbox-token-here" ? (
              <FallbackMap twinData={twinData} onAssetClick={(id) => router.push(`/assets/${id}`)} />
            ) : (
              <div ref={mapContainerRef} className="w-full h-full" />
            )}

            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Activity className="w-4 h-4 animate-pulse" />
                  <span className="text-sm">Loading twin state...</span>
                </div>
              </div>
            )}

            {/* Layer controls */}
            <div className="absolute top-4 right-4 bg-card/95 border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Layers</span>
              </div>
              {layers.map((layer) => (
                <button
                  key={layer.id}
                  onClick={() => toggleLayer(layer.id)}
                  className={cn(
                    "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs w-full text-left transition-colors",
                    activeLayers.includes(layer.id)
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-white/5"
                  )}
                >
                  <layer.icon className="w-3 h-3" />
                  {layer.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right panel */}
          <div className="w-72 flex flex-col gap-4 overflow-y-auto scrollbar-thin">
            {/* Station detail panel */}
            {selectedStation ? (
              <StationPanel station={selectedStation} onClose={() => setSelectedStation(null)} onNavigate={(id) => router.push(`/assets/${id}`)} twinData={twinData} />
            ) : (
              <StationsListPanel stations={twinData?.stations ?? []} onSelect={setSelectedStation} />
            )}

            {/* Active alerts */}
            {(twinData?.activeAlerts?.length ?? 0) > 0 && (
              <div className="card-glass p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-orange-400" />
                  <span className="text-sm font-semibold text-foreground">Active Alerts</span>
                </div>
                <div className="space-y-2">
                  {twinData.activeAlerts.slice(0, 4).map((alert: any) => (
                    <div key={alert.id} className="p-2 rounded-md bg-orange-500/10 border border-orange-500/20">
                      <div className="text-xs font-bold text-orange-400">{alert.assetCode}</div>
                      <div className="text-xs text-foreground mt-0.5">{alert.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function StationsListPanel({ stations, onSelect }: { stations: any[]; onSelect: (s: any) => void }) {
  const STATUS_HEX: Record<string, string> = {
    HEALTHY: "#22c55e", WARNING: "#eab308", CRITICAL: "#ef4444", OFFLINE: "#6b7280",
  };
  return (
    <div className="card-glass p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">Network Stations</h3>
      <div className="space-y-1">
        {stations.map((s: any) => (
          <button key={s.id} onClick={() => onSelect(s)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-white/5 text-left transition-colors">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: STATUS_HEX[s.status] ?? "#6b7280" }} />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-foreground truncate">{s.name}</div>
              <div className="text-xs text-muted-foreground">{s.stationCode} · {s.zone}</div>
            </div>
            {s.activeIncidentCount > 0 && (
              <span className="text-xs text-red-400 font-bold">{s.activeIncidentCount}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function StationPanel({ station, onClose, onNavigate, twinData }: any) {
  const stationAssets = twinData?.assets?.filter((a: any) => a.stationId === station.id) ?? [];
  const STATUS_HEX: Record<string, string> = {
    HEALTHY: "#22c55e", WARNING: "#eab308", CRITICAL: "#ef4444", OFFLINE: "#6b7280",
  };
  return (
    <div className="card-glass p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{station.name}</h3>
          <p className="text-xs text-muted-foreground">{station.stationCode} · {station.zone}</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="p-2 rounded-md bg-white/5 text-center">
          <div className="text-lg font-bold text-foreground">{station.healthScore}%</div>
          <div className="text-xs text-muted-foreground">Health</div>
        </div>
        <div className="p-2 rounded-md bg-white/5 text-center">
          <div className="text-lg font-bold text-red-400">{station.activeIncidentCount}</div>
          <div className="text-xs text-muted-foreground">Incidents</div>
        </div>
      </div>
      <div className="space-y-1">
        {stationAssets.slice(0, 6).map((a: any) => (
          <button key={a.id} onClick={() => onNavigate(a.id)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/8 text-left transition-colors">
            <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: STATUS_HEX[a.status] ?? "#6b7280" }} />
            <span className="text-xs font-mono text-muted-foreground w-12 shrink-0">{a.assetCode}</span>
            <span className="text-xs text-foreground truncate">{a.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function FallbackMap({ twinData, onAssetClick }: { twinData: any; onAssetClick: (id: string) => void }) {
  const STATUS_HEX: Record<string, string> = {
    HEALTHY: "#22c55e", WARNING: "#eab308", CRITICAL: "#ef4444", OFFLINE: "#6b7280",
  };
  const stations = twinData?.stations ?? [];
  const assets = twinData?.assets ?? [];

  if (!twinData) return (
    <div className="w-full h-full flex items-center justify-center bg-card text-muted-foreground">
      <span className="text-sm">Loading network...</span>
    </div>
  );

  return (
    <div className="w-full h-full bg-card flex flex-col">
      <div className="p-4 border-b border-border text-xs text-muted-foreground">
        ⚠️ Mapbox token not configured — showing asset list view. Add NEXT_PUBLIC_MAPBOX_TOKEN to .env for interactive map.
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {stations.map((s: any) => {
            const sAssets = assets.filter((a: any) => a.stationId === s.id);
            return (
              <div key={s.id} className="p-3 rounded-lg border border-border/50 bg-white/3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: STATUS_HEX[s.status] ?? "#6b7280" }} />
                  <span className="text-sm font-medium text-foreground">{s.name}</span>
                </div>
                <div className="space-y-1">
                  {sAssets.filter((a: any) => a.assetType === "SIGNAL").map((a: any) => (
                    <button key={a.id} onClick={() => onAssetClick(a.id)}
                      className="w-full flex items-center gap-2 text-left hover:bg-white/8 rounded px-1 py-0.5 transition-colors">
                      <div className="w-2 h-2 rounded-sm" style={{ background: STATUS_HEX[a.status] ?? "#6b7280" }} />
                      <span className="text-xs font-mono text-muted-foreground">{a.assetCode}</span>
                      <span className="text-xs text-foreground truncate">{a.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

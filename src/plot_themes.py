"""Shared matplotlib colour palettes — kept in sync with frontend CSS variables.

Import with: from src.plot_themes import THEMES
"""

from __future__ import annotations

THEMES: dict[str, dict] = {
    "dark": {
        "fig_bg":    "#0f172a",   # slate-900
        "ax_bg":     "#020617",   # slate-950
        "edge":      "#020617",
        "text":      "#e2e8f0",   # slate-200
        "muted":     "#94a3b8",   # slate-400 / --chart-tick
        "grid":      "#1F2937",
        "spine":     "#1e293b",   # slate-800
        "legend_bg": "#1e293b",

        "line1":     "#bbc4f4",   # actual   / --chart-1
        "line2":     "#f6ad55",   # forecast / --chart-2
        "line3":     "#94a3b8",   # future   / --chart-3
        "line4":     "#cbd5e1",   # slate-300
        "actual":    "#bbc4f4",
        "forecast":  "#f6ad55",
        "future":    "#94a3b8",
        "train":     "#475569",   # slate-600
        "scatter":   "#bbc4f4",
        "semi_avg":  "#94a3b8",
        "palette":   ["#bbc4f4", "#f6ad55", "#94a3b8", "#fb923c", "#34D399", "#F87171"],
    },
    "light": {
        "fig_bg":    "#ffffff",
        "ax_bg":     "#f8f9ff",   # surface
        "edge":      "#f8f9ff",
        "text":      "#0d1c2e",   # on-surface
        "muted":     "#718096",   # outline / --chart-tick
        "grid":      "#e5eeff",   # surface-container
        "spine":     "#e5eeff",
        "legend_bg": "#eff4ff",

        "line1":     "#1b254b",   # actual   / --chart-1
        "line2":     "#b36b00",   # forecast / --chart-2
        "line3":     "#4a5568",   # future   / --chart-3
        "line4":     "#64748b",   # tertiary-container
        "actual":    "#1b254b",
        "forecast":  "#b36b00",
        "future":    "#4a5568",
        "train":     "#94a3b8",   # slate-400
        "scatter":   "#1b254b",
        "semi_avg":  "#4a5568",
        "palette":   ["#1b254b", "#b36b00", "#4a5568", "#F97316", "#10B981", "#EF4444"],
    },
}

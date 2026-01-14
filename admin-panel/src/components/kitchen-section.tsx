"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Flame,
  Weight,
  RefreshCw,
  Download,
  ChefHat,
  Clock,
  Package2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

/* ============================
   TYPES
============================ */

interface KitchenVariant {
  variant: string
  quantity: number
  weight: number
  pieces: number
}

interface KitchenItem {
  name: string
  totalQuantity: number
  totalWeight: number
  totalPieces: number
  orderCount: number
  variants: KitchenVariant[]
  priority: "high" | "medium" | "low"
  estimatedPrepTime: number
}

/* ============================
   ADMIN FETCH
============================ */

export const adminFetch = async (
  url: string,
  options: RequestInit = {}
) => {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("adminToken")
      : null

  if (!token) {
    window.location.href = "/admin/login"
    throw new Error("Admin not authenticated")
  }

  return fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}${url}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
    cache: "no-store",
  })
}

/* ============================
   COMPONENT
============================ */

export function KitchenSection() {
  const [kitchenData, setKitchenData] = useState<KitchenItem[]>([])
  const [statusFilter, setStatusFilter] = useState("confirmed,inprocess")
  const [isLoading, setIsLoading] = useState(false)

  const { toast } = useToast()

  /* ============================
     LOAD DATA
  ============================ */

  const loadKitchenData = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setIsLoading(true)

        const response = await adminFetch(
          `/admin/kitchen-prep?status=${statusFilter}`
        )

        const data: KitchenItem[] = await response.json()

        if (!response.ok || !Array.isArray(data)) {
          throw new Error("Failed to fetch kitchen prep")
        }

        setKitchenData(data)

        if (!silent) {
          toast({
            title: "Success",
            description: "Kitchen prep loaded",
          })
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load kitchen prep",
          variant: "destructive",
        })
      } finally {
        if (!silent) setIsLoading(false)
      }
    },
    [statusFilter, toast]
  )

  /* ============================
     EXPORT CSV
  ============================ */

  const exportKitchenData = () => {
    if (kitchenData.length === 0) {
      toast({
        title: "Error",
        description: "No kitchen data to export",
        variant: "destructive",
      })
      return
    }

    const headers = [
      "Product Name",
      "Total",
      "Order Count",
      "Variants",
      "Priority",
      "Prep Time (min)",
    ]

    const rows = kitchenData.map((item) => [
      item.name,
      item.totalWeight > 0
        ? `${item.totalWeight} g`
        : `${item.totalPieces} pcs`,
      item.orderCount,
      item.variants
        .map((v) =>
          v.weight > 0
            ? `${v.variant}: ${v.quantity}x (${v.weight}g)`
            : `${v.variant}: ${v.quantity}x (${v.pieces} pcs)`
        )
        .join("; "),
      item.priority,
      item.estimatedPrepTime,
    ])

    const csvContent = [headers, ...rows]
      .map((row) => row.map((field) => `"${field}"`).join(","))
      .join("\n")

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    })

    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute(
      "download",
      `kitchen_prep_${new Date().toISOString().split("T")[0]}.csv`
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: "Success",
      description: `Exported ${kitchenData.length} preparation items`,
    })
  }

  /* ============================
     STATS
  ============================ */

  const stats = {
    activeOrders: kitchenData.reduce(
      (sum, item) => sum + item.orderCount,
      0
    ),
    totalWeight: kitchenData.reduce(
      (sum, item) => sum + item.totalWeight,
      0
    ),
    totalPieces: kitchenData.reduce(
      (sum, item) => sum + item.totalPieces,
      0
    ),
    uniqueItems: kitchenData.length,
    highPriorityItems: kitchenData.filter(
      (item) => item.priority === "high"
    ).length,
  }

  /* ============================
     EFFECTS
  ============================ */

  useEffect(() => {
    loadKitchenData()
  }, [loadKitchenData])

  /* ============================
     PRIORITY BADGE
  ============================ */

  const getPriorityBadge = (priority: "high" | "medium" | "low") => {
    const variants = {
      high: "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg",
      medium:
        "bg-gradient-to-r from-yellow-500 to-yellow-600 text-white shadow-lg",
      low: "bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg",
    }

    return (
      <Badge
        className={`${variants[priority]} border-0 font-semibold uppercase text-xs px-3 py-1`}
      >
        {priority}
      </Badge>
    )
  }

  /* ============================
     RENDER
  ============================ */

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="flex items-center gap-3 text-3xl font-bold mb-2 text-slate-900">
                <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                  <ChefHat className="h-5 w-5 text-white" />
                </div>
                Kitchen Preparation Center
              </h1>
              <p className="text-slate-600 text-sm">
                Calculate total quantities needed for efficient order
                preparation
              </p>
            </div>

            {/* STATS */}
            <div className="flex gap-4">
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-4 rounded-xl shadow-lg min-w-[140px]">
                <div className="flex items-center gap-2">
                  <Weight className="h-5 w-5 opacity-80" />
                  <div>
                    <div className="text-xl font-bold">
                      {stats.totalWeight > 0
                        ? `${(stats.totalWeight / 1000).toFixed(1)}kg`
                        : `${stats.totalPieces} pcs`}
                    </div>
                    <div className="text-xs opacity-90">Total</div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-xl shadow-lg min-w-[120px]">
                <div className="flex items-center gap-2">
                  <Package2 className="h-5 w-5 opacity-80" />
                  <div>
                    <div className="text-xl font-bold">
                      {stats.uniqueItems}
                    </div>
                    <div className="text-xs opacity-90">Unique Items</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <div className="max-w-7xl mx-auto p-6">
        {/* CONTROLS */}
        <div className="flex justify-between items-center mb-6 gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="confirmed,inprocess">
                Confirmed & In Process
              </SelectItem>
              <SelectItem value="confirmed">Confirmed Only</SelectItem>
              <SelectItem value="inprocess">In Process Only</SelectItem>
              <SelectItem value="placed,confirmed,inprocess">
                All Active Orders
              </SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => loadKitchenData()}
              disabled={isLoading}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${
                  isLoading ? "animate-spin" : ""
                }`}
              />
              Refresh
            </Button>

            <Button variant="outline" onClick={exportKitchenData}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* TABLE */}
        <div className="bg-white rounded-2xl shadow-lg border overflow-hidden">
          <table className="w-full">
            <thead className="bg-orange-50">
              <tr>
                <th className="px-6 py-4 text-left">Product</th>
                <th className="px-6 py-4 text-left">Total</th>
                <th className="px-6 py-4 text-left">Orders</th>
                <th className="px-6 py-4 text-left">Variants</th>
                <th className="px-6 py-4 text-left">Priority</th>
                <th className="px-6 py-4 text-left">Prep Time</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {kitchenData
                .sort((a, b) => {
                  const p = { high: 3, medium: 2, low: 1 }
                  return p[b.priority] - p[a.priority]
                })
                .map((item, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 font-semibold">
                      {item.name}
                    </td>

                    <td className="px-6 py-4">
                      {item.totalWeight > 0
                        ? item.totalWeight >= 1000
                          ? `${(item.totalWeight / 1000).toFixed(1)} kg`
                          : `${item.totalWeight} g`
                        : `${item.totalPieces} pcs`}
                    </td>

                    <td className="px-6 py-4">
                      {item.orderCount}
                    </td>

                    <td className="px-6 py-4">
                      {item.variants.map((v, i) => (
                        <span
                          key={i}
                          className="inline-block mr-1 mb-1 px-3 py-1 bg-slate-100 rounded-full text-sm"
                        >
                          {v.weight > 0
                            ? `${v.variant}: ${v.quantity}x (${v.weight} g)`
                            : `${v.variant}: ${v.quantity}x (${v.pieces} pcs)`}
                        </span>
                      ))}
                    </td>

                    <td className="px-6 py-4">
                      {getPriorityBadge(item.priority)}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-slate-500" />
                        {item.estimatedPrepTime} min
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

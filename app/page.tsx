"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Download, Save, FileText, Trash2, Copy } from "lucide-react"
import jsPDF from "jspdf"
import "jspdf-autotable"

interface InvoiceItem {
  id: string
  description: string
  hsnCode: string
  quantity: number
  rate: number
  amount: number
  gstRate: number
  cgst: number
  sgst: number
  igst: number
}

interface InvoiceData {
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  sellerName: string
  sellerAddress: string
  sellerGSTIN: string
  sellerPAN: string
  buyerName: string
  buyerAddress: string
  buyerGSTIN: string
  buyerState: string
  sellerState: string
  items: InvoiceItem[]
  notes: string
}

interface Template {
  id: string
  name: string
  data: InvoiceData
  createdAt: string
}

const initialInvoiceData: InvoiceData = {
  invoiceNumber: "",
  invoiceDate: new Date().toISOString().split("T")[0],
  dueDate: "",
  sellerName: "",
  sellerAddress: "",
  sellerGSTIN: "",
  sellerPAN: "",
  buyerName: "",
  buyerAddress: "",
  buyerGSTIN: "",
  buyerState: "",
  sellerState: "",
  items: [],
  notes: "",
}

const initialItem: InvoiceItem = {
  id: "",
  description: "",
  hsnCode: "",
  quantity: 1,
  rate: 0,
  amount: 0,
  gstRate: 18,
  cgst: 0,
  sgst: 0,
  igst: 0,
}

export default function GST_Invoice_Generator() {
  const [invoiceData, setInvoiceData] = useState<InvoiceData>(initialInvoiceData)
  const [templates, setTemplates] = useState<Template[]>([])
  const [templateName, setTemplateName] = useState("")
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)

  useEffect(() => {
    const savedTemplates = localStorage.getItem("gst-invoice-templates")
    if (savedTemplates) {
      setTemplates(JSON.parse(savedTemplates))
    }
  }, [])

  const saveTemplates = (newTemplates: Template[]) => {
    localStorage.setItem("gst-invoice-templates", JSON.stringify(newTemplates))
    setTemplates(newTemplates)
  }

  const addItem = () => {
    const newItem: InvoiceItem = {
      ...initialItem,
      id: Date.now().toString(),
    }
    setInvoiceData((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }))
  }

  const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setInvoiceData((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value }

          // Recalculate amounts when quantity or rate changes
          if (field === "quantity" || field === "rate") {
            updatedItem.amount = updatedItem.quantity * updatedItem.rate
          }

          // Recalculate GST when amount or GST rate changes
          if (field === "quantity" || field === "rate" || field === "gstRate") {
            const isInterState =
              prev.sellerState.toLowerCase().trim() !== prev.buyerState.toLowerCase().trim() &&
              prev.buyerState.trim() !== "" &&
              prev.sellerState.trim() !== ""

            if (isInterState) {
              updatedItem.igst = (updatedItem.amount * updatedItem.gstRate) / 100
              updatedItem.cgst = 0
              updatedItem.sgst = 0
            } else {
              updatedItem.cgst = (updatedItem.amount * updatedItem.gstRate) / 200
              updatedItem.sgst = (updatedItem.amount * updatedItem.gstRate) / 200
              updatedItem.igst = 0
            }
          }

          return updatedItem
        }
        return item
      }),
    }))
  }

  const removeItem = (id: string) => {
    setInvoiceData((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== id),
    }))
  }

  const calculateTotals = () => {
    const subtotal = invoiceData.items.reduce((sum, item) => sum + item.amount, 0)
    const totalCGST = invoiceData.items.reduce((sum, item) => sum + item.cgst, 0)
    const totalSGST = invoiceData.items.reduce((sum, item) => sum + item.sgst, 0)
    const totalIGST = invoiceData.items.reduce((sum, item) => sum + item.igst, 0)
    const totalGST = totalCGST + totalSGST + totalIGST
    const grandTotal = subtotal + totalGST

    return { subtotal, totalCGST, totalSGST, totalIGST, totalGST, grandTotal }
  }

  const generatePDF = () => {
    const doc = new jsPDF()
    const totals = calculateTotals()

    // Header
    doc.setFontSize(20)
    doc.setFont("helvetica", "bold")
    doc.text("GST INVOICE", 105, 20, { align: "center" })

    // Invoice details
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text(`Invoice No: ${invoiceData.invoiceNumber}`, 20, 40)
    doc.text(`Date: ${invoiceData.invoiceDate}`, 20, 45)
    if (invoiceData.dueDate) {
      doc.text(`Due Date: ${invoiceData.dueDate}`, 20, 50)
    }

    // Seller details
    doc.setFont("helvetica", "bold")
    doc.text("SELLER:", 20, 65)
    doc.setFont("helvetica", "normal")
    let sellerY = 70
    doc.text(invoiceData.sellerName, 20, sellerY)
    sellerY += 5

    const sellerAddressLines = doc.splitTextToSize(invoiceData.sellerAddress, 80)
    doc.text(sellerAddressLines, 20, sellerY)
    sellerY += sellerAddressLines.length * 5

    doc.text(`GSTIN: ${invoiceData.sellerGSTIN}`, 20, sellerY)
    sellerY += 5

    if (invoiceData.sellerPAN.trim()) {
      doc.text(`PAN: ${invoiceData.sellerPAN}`, 20, sellerY)
      sellerY += 5
    }

    doc.text(`State: ${invoiceData.sellerState}`, 20, sellerY)

    // Buyer details
    doc.setFont("helvetica", "bold")
    doc.text("BUYER:", 120, 65)
    doc.setFont("helvetica", "normal")
    let buyerY = 70
    doc.text(invoiceData.buyerName, 120, buyerY)
    buyerY += 5

    const buyerAddressLines = doc.splitTextToSize(invoiceData.buyerAddress, 80)
    doc.text(buyerAddressLines, 120, buyerY)
    buyerY += buyerAddressLines.length * 5

    if (invoiceData.buyerGSTIN.trim()) {
      doc.text(`GSTIN: ${invoiceData.buyerGSTIN}`, 120, buyerY)
      buyerY += 5
    }

    doc.text(`State: ${invoiceData.buyerState}`, 120, buyerY)

    // Items table
    const tableData = invoiceData.items.map((item) => [
      item.description,
      item.hsnCode,
      item.quantity.toString(),
      `₹${item.rate.toFixed(2)}`,
      `₹${item.amount.toFixed(2)}`,
      `${item.gstRate}%`,
      `₹${item.cgst.toFixed(2)}`,
      `₹${item.sgst.toFixed(2)}`,
      `₹${item.igst.toFixed(2)}`,
    ])
    ;(doc as any).autoTable({
      startY: Math.max(sellerY, buyerY) + 15,
      head: [["Description", "HSN", "Qty", "Rate", "Amount", "GST%", "CGST", "SGST", "IGST"]],
      body: tableData,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] },
    })

    // Totals section - properly formatted
    const finalY = (doc as any).lastAutoTable.finalY + 15
    const totalsX = 140

    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)

    // Create a clean totals section
    doc.text("Subtotal:", totalsX, finalY)
    doc.text(`₹${totals.subtotal.toFixed(2)}`, totalsX + 40, finalY)

    if (totals.totalCGST > 0) {
      doc.text("CGST:", totalsX, finalY + 6)
      doc.text(`₹${totals.totalCGST.toFixed(2)}`, totalsX + 40, finalY + 6)

      doc.text("SGST:", totalsX, finalY + 12)
      doc.text(`₹${totals.totalSGST.toFixed(2)}`, totalsX + 40, finalY + 12)
    }

    if (totals.totalIGST > 0) {
      doc.text("IGST:", totalsX, finalY + 6)
      doc.text(`₹${totals.totalIGST.toFixed(2)}`, totalsX + 40, finalY + 6)
    }

    // Draw a line above grand total
    doc.line(totalsX, finalY + 20, totalsX + 50, finalY + 20)

    // Grand total
    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.text("Grand Total:", totalsX, finalY + 28)
    doc.text(`₹${totals.grandTotal.toFixed(2)}`, totalsX + 40, finalY + 28)

    // Notes
    if (invoiceData.notes.trim()) {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(10)
      doc.text("Notes:", 20, finalY + 45)
      const notesLines = doc.splitTextToSize(invoiceData.notes, 170)
      doc.text(notesLines, 20, finalY + 52)
    }

    doc.save(`invoice-${invoiceData.invoiceNumber || "draft"}.pdf`)
  }

  const saveAsTemplate = () => {
    if (!templateName.trim()) return

    const newTemplate: Template = {
      id: Date.now().toString(),
      name: templateName,
      data: { ...invoiceData },
      createdAt: new Date().toISOString(),
    }

    const updatedTemplates = [...templates, newTemplate]
    saveTemplates(updatedTemplates)
    setTemplateName("")
    setIsTemplateDialogOpen(false)
  }

  const loadTemplate = (template: Template) => {
    setInvoiceData({ ...template.data })
  }

  const deleteTemplate = (id: string) => {
    const updatedTemplates = templates.filter((t) => t.id !== id)
    saveTemplates(updatedTemplates)
  }

  const duplicateTemplate = (template: Template) => {
    const newTemplate: Template = {
      id: Date.now().toString(),
      name: `${template.name} (Copy)`,
      data: { ...template.data },
      createdAt: new Date().toISOString(),
    }
    const updatedTemplates = [...templates, newTemplate]
    saveTemplates(updatedTemplates)
  }

  const totals = calculateTotals()

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">GST Invoice Generator</h1>
            <p className="text-muted-foreground">Create professional GST invoices with ease</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Save className="w-4 h-4 mr-2" />
                  Save Template
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Save as Template</DialogTitle>
                  <DialogDescription>Save this invoice as a template for future use</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="template-name">Template Name</Label>
                    <Input
                      id="template-name"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="Enter template name"
                    />
                  </div>
                  <Button onClick={saveAsTemplate} className="w-full">
                    Save Template
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button onClick={generatePDF} disabled={!invoiceData.sellerState.trim() || !invoiceData.buyerState.trim()}>
              <Download className="w-4 h-4 mr-2" />
              Generate PDF
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Templates Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Templates</CardTitle>
                <CardDescription>Saved invoice templates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {templates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No templates saved</p>
                ) : (
                  templates.map((template) => (
                    <div key={template.id} className="flex items-center justify-between p-2 border rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{template.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(template.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => loadTemplate(template)}>
                          <FileText className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => duplicateTemplate(template)}>
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteTemplate(template.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Invoice Form */}
          <div className="lg:col-span-3 space-y-6">
            {/* Invoice Details */}
            <Card>
              <CardHeader>
                <CardTitle>Invoice Details</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="invoice-number">Invoice Number</Label>
                  <Input
                    id="invoice-number"
                    value={invoiceData.invoiceNumber}
                    onChange={(e) => setInvoiceData((prev) => ({ ...prev, invoiceNumber: e.target.value }))}
                    placeholder="INV-001"
                  />
                </div>
                <div>
                  <Label htmlFor="invoice-date">Invoice Date</Label>
                  <Input
                    id="invoice-date"
                    type="date"
                    value={invoiceData.invoiceDate}
                    onChange={(e) => setInvoiceData((prev) => ({ ...prev, invoiceDate: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="due-date">Due Date</Label>
                  <Input
                    id="due-date"
                    type="date"
                    value={invoiceData.dueDate}
                    onChange={(e) => setInvoiceData((prev) => ({ ...prev, dueDate: e.target.value }))}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Seller & Buyer Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Seller Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="seller-name">Company Name</Label>
                    <Input
                      id="seller-name"
                      value={invoiceData.sellerName}
                      onChange={(e) => setInvoiceData((prev) => ({ ...prev, sellerName: e.target.value }))}
                      placeholder="Your Company Name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="seller-address">Address</Label>
                    <Textarea
                      id="seller-address"
                      value={invoiceData.sellerAddress}
                      onChange={(e) => setInvoiceData((prev) => ({ ...prev, sellerAddress: e.target.value }))}
                      placeholder="Complete address"
                    />
                  </div>
                  <div>
                    <Label htmlFor="seller-gstin">GSTIN</Label>
                    <Input
                      id="seller-gstin"
                      value={invoiceData.sellerGSTIN}
                      onChange={(e) => setInvoiceData((prev) => ({ ...prev, sellerGSTIN: e.target.value }))}
                      placeholder="22AAAAA0000A1Z5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="seller-pan">PAN</Label>
                    <Input
                      id="seller-pan"
                      value={invoiceData.sellerPAN}
                      onChange={(e) => setInvoiceData((prev) => ({ ...prev, sellerPAN: e.target.value }))}
                      placeholder="AAAAA0000A"
                    />
                  </div>
                  <div>
                    <Label htmlFor="seller-state">State *</Label>
                    <Input
                      id="seller-state"
                      value={invoiceData.sellerState}
                      onChange={(e) => setInvoiceData((prev) => ({ ...prev, sellerState: e.target.value }))}
                      placeholder="State name"
                      required
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Buyer Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="buyer-name">Company Name</Label>
                    <Input
                      id="buyer-name"
                      value={invoiceData.buyerName}
                      onChange={(e) => setInvoiceData((prev) => ({ ...prev, buyerName: e.target.value }))}
                      placeholder="Client Company Name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="buyer-address">Address</Label>
                    <Textarea
                      id="buyer-address"
                      value={invoiceData.buyerAddress}
                      onChange={(e) => setInvoiceData((prev) => ({ ...prev, buyerAddress: e.target.value }))}
                      placeholder="Complete address"
                    />
                  </div>
                  <div>
                    <Label htmlFor="buyer-gstin">GSTIN</Label>
                    <Input
                      id="buyer-gstin"
                      value={invoiceData.buyerGSTIN}
                      onChange={(e) => setInvoiceData((prev) => ({ ...prev, buyerGSTIN: e.target.value }))}
                      placeholder="22AAAAA0000A1Z5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="buyer-state">State *</Label>
                    <Input
                      id="buyer-state"
                      value={invoiceData.buyerState}
                      onChange={(e) => setInvoiceData((prev) => ({ ...prev, buyerState: e.target.value }))}
                      placeholder="State name"
                      required
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Items */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Items</CardTitle>
                    <CardDescription>Add items to your invoice</CardDescription>
                  </div>
                  <Button onClick={addItem}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Item
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {invoiceData.items.map((item) => (
                  <div key={item.id} className="p-4 border rounded-lg space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="lg:col-span-2">
                        <Label>Description</Label>
                        <Input
                          value={item.description}
                          onChange={(e) => updateItem(item.id, "description", e.target.value)}
                          placeholder="Item description"
                        />
                      </div>
                      <div>
                        <Label>HSN Code</Label>
                        <Input
                          value={item.hsnCode}
                          onChange={(e) => updateItem(item.id, "hsnCode", e.target.value)}
                          placeholder="HSN Code"
                        />
                      </div>
                      <div>
                        <Label>GST Rate (%)</Label>
                        <Select
                          value={item.gstRate.toString()}
                          onValueChange={(value) => updateItem(item.id, "gstRate", Number.parseFloat(value))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0%</SelectItem>
                            <SelectItem value="5">5%</SelectItem>
                            <SelectItem value="12">12%</SelectItem>
                            <SelectItem value="18">18%</SelectItem>
                            <SelectItem value="28">28%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                      <div>
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, "quantity", Number.parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <Label>Rate (₹)</Label>
                        <Input
                          type="number"
                          value={item.rate}
                          onChange={(e) => updateItem(item.id, "rate", Number.parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <Label>Amount (₹)</Label>
                        <Input value={item.amount.toFixed(2)} readOnly />
                      </div>
                      <div>
                        <Label>CGST (₹)</Label>
                        <Input value={item.cgst.toFixed(2)} readOnly />
                      </div>
                      <div>
                        <Label>SGST (₹)</Label>
                        <Input value={item.sgst.toFixed(2)} readOnly />
                      </div>
                      <div>
                        <Label>IGST (₹)</Label>
                        <Input value={item.igst.toFixed(2)} readOnly />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button variant="destructive" size="sm" onClick={() => removeItem(item.id)}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
                {invoiceData.items.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No items added. Click "Add Item" to get started.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Totals */}
            {invoiceData.items.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Invoice Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>₹{totals.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total CGST:</span>
                      <span>₹{totals.totalCGST.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total SGST:</span>
                      <span>₹{totals.totalSGST.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total IGST:</span>
                      <span>₹{totals.totalIGST.toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                      <span>Grand Total:</span>
                      <span>₹{totals.grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle>Additional Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={invoiceData.notes}
                  onChange={(e) => setInvoiceData((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Add any additional notes or terms..."
                  rows={3}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

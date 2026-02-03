// components/admin/ExportPrintSingleOrder.tsx
import React from "react";
import type { Order } from "../../types/order";

type Props = {
  order: Order; // Single order object
};

const ExportPrintSingleOrder: React.FC<Props> = ({ order }) => {

  // CSV Export
  const handleExportCSV = () => {
    const headers = ["Order ID", "Table", "Customer", "Status", "Item", "Quantity", "Price", "Total"];
    const rows = order.items && order.items.length > 0
      ? order.items.map(item => [
        order.id,
        order.tableNumber,
        order.customerName,
        order.status,
        item.name,
        item.quantity,
        item.menuItem.price,
        item.menuItem.price * item.quantity
      ])
      : [[order.id, order.tableNumber, order.customerName, order.status, "", "", "", order.totalAmount]];

    const csvContent = "data:text/csv;charset=utf-8," +
      [headers, ...rows].map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `order_${order.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print
  const handlePrint = () => {
    const newWin = window.open("", "_blank");
    if (!newWin) return;

    const tableHtml = `
      <html>
        <head>
          <title>Order #${order.id} Print</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; }
            th { background-color: #f3f3f3; }
          </style>
        </head>
        <body>
          <h2>Order #${order.id} Details</h2>
          <p><strong>Customer:</strong> ${order.customerName}</p>
          <p><strong>Table:</strong> ${order.tableNumber}</p>
          <p><strong>Status:</strong> ${order.status.toUpperCase()}</p>

          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${order.items && order.items.length > 0
        ? order.items.map(item => `
                  <tr>
                    <td>${item.name}</td>
                    <td>${item.quantity}</td>
                    <td>${item.menuItem.price}</td>
                    <td>${item.quantity * item.menuItem.price}</td>
                  </tr>`).join("")
        : `<tr>
                     <td colspan="4">${order.totalAmount}</td>
                   </tr>`
      }
            </tbody>
          </table>

          <h3>Total Amount: Rs. ${order.totalAmount}</h3>
        </body>
      </html>
    `;

    newWin.document.write(tableHtml);
    newWin.document.close();
    newWin.print();
  };

  return (
    <div className="flex gap-2 mb-4">
      <button
        onClick={handleExportCSV}
        className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 font-semibold"
      >
        Export CSV
      </button>
      <button
        onClick={handlePrint}
        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold"
      >
        Print
      </button>
    </div>
  );
};

export default ExportPrintSingleOrder;

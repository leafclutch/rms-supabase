import { useState, useEffect } from "react";
import { Plus, QrCode, Trash2, Save, X } from "lucide-react";
import { getAllTablesApi, createTableApi, generateQrApi, deleteTableApi } from "../../api/admin";
import QrDownloadModal from "../../components/admin/QrDownloadModal";
import FullscreenLoader from "../../components/common/FullscreenLoader";
import toast from "react-hot-toast";

interface Table {
  id: string;
  tableCode: string;
  tableType: "PHYSICAL" | "WALK_IN" | "ONLINE";
  isActive: boolean;
}

interface GroupedTables {
  PHYSICAL: Table[];
  WALK_IN: Table[];
  ONLINE: Table[];
}

type TabType = "TABLE" | "CABIN" | "OUTSIDE";

const GenerateQr = () => {
  const [tables, setTables] = useState<GroupedTables>({
    PHYSICAL: [],
    WALK_IN: [],
    ONLINE: []
  });
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Tabs State
  const [activeTab, setActiveTab] = useState<TabType>("TABLE");

  // Manual Add State
  const [isAdding, setIsAdding] = useState(false);
  const [newTableName, setNewTableName] = useState("");

  // Fetch all tables on mount
  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    try {
      setLoading(true);
      const data = await getAllTablesApi();
      setTables(data.tables);

      // Check for defaults after fetching
      await checkAndCreateDefaults(data.tables);
    } catch (error) {


    } finally {
      setLoading(false);
    }
  };

  const checkAndCreateDefaults = async (currentTables: GroupedTables) => {
    const physicalTables = currentTables.PHYSICAL || [];

    const tTables = physicalTables.filter(t => t.tableCode.startsWith('T'));
    const cTables = physicalTables.filter(t => t.tableCode.startsWith('C'));
    const oTables = physicalTables.filter(t => t.tableCode.startsWith('O'));

    const commands: Promise<any>[] = [];

    // Helper to create range
    const ensureDefaults = (existing: Table[], prefix: string, count: number) => {
      for (let i = 1; i <= count; i++) {
        const code = `${prefix}${i}`;
        if (!existing.find(t => t.tableCode === code)) {
          // We push a promise to create it
          commands.push(createTableApi("PHYSICAL", code));
        }
      }
    };

    ensureDefaults(tTables, 'T', 4);
    ensureDefaults(cTables, 'C', 4);
    ensureDefaults(oTables, 'O', 4);

    if (commands.length > 0) {
      try {
        await Promise.all(commands);
        // Refresh silently
        const newData = await getAllTablesApi();
        setTables(newData.tables);
      } catch (err) {
        console.error("Error creating defaults", err);
      }
    }
  };

  const handleTableSelect = async (tableCode: string) => {
    try {
      setLoading(true);
      const data = await generateQrApi(tableCode);
      setSelectedTable(tableCode);

      const rawImage = data.table.qrImage || "";
      const cleanQrImage = rawImage.startsWith('/') ? rawImage.slice(1) : rawImage;

      setQrImage(cleanQrImage);
      setOpen(true);
    } catch (error) {
      console.error("QR generation failed", error);
      toast.error("QR generation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateManual = async () => {
    if (!newTableName.trim()) {
      toast.error("Please enter a name");
      return;
    }

    const type: "PHYSICAL" | "WALK_IN" | "ONLINE" = "PHYSICAL";

    await handleCreateTable(type, newTableName);
    setIsAdding(false);
    setNewTableName("");
  };

  const handleCreateTable = async (tableType: "PHYSICAL" | "WALK_IN" | "ONLINE", code?: string) => {
    try {
      setLoading(true);
      const data = await createTableApi(tableType, code);

      // Refresh tables list
      const updatedData = await getAllTablesApi();
      setTables(updatedData.tables);

      toast.success(`${data.table.tableCode} created successfully!`);

      // Auto-open QR modal
      const rawImage = data.table.qrImage || "";
      const cleanQrImage = rawImage.startsWith('/') ? rawImage.slice(1) : rawImage;
      setSelectedTable(data.table.tableCode);
      setQrImage(cleanQrImage);
      setOpen(true);
    } catch (error: any) {
      console.error("Failed to create table", error);
      toast.error(error?.response?.data?.message || "Failed to create table");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTable = async (tableId: string, tableCode: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm(`Are you sure you want to delete ${tableCode}? This cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      await deleteTableApi(tableId);
      const data = await getAllTablesApi();
      setTables(data.tables);
      toast.success(`${tableCode} deleted successfully`);
    } catch (error: any) {
      console.error("Failed to delete table", error);
      toast.error(error?.response?.data?.message || "Failed to delete table");
    } finally {
      setLoading(false);
    }
  };

  // Helper to get tab details
  const getTabDetails = (tab: TabType) => {
    switch (tab) {
      case "TABLE": return { title: "Dine-in Tables", label: "Tables", singularLabel: "Table", prefix: 'T' };
      case "CABIN": return { title: " Cabins", label: "Cabin", singularLabel: "Cabin", prefix: 'C' };
      case "OUTSIDE": return { title: "Outside ", label: "Outside", singularLabel: "Outside", prefix: 'O' };
    }
  };

  const currentTabDetails = getTabDetails(activeTab);

  // Filter logic - strict prefix matching for Physical tables
  const currentList = tables.PHYSICAL.filter(t => t.tableCode.toUpperCase().startsWith(currentTabDetails.prefix));

  return (
    <div className="relative p-6 max-w-7xl mx-auto min-h-screen bg-gray-50">
      {loading && <FullscreenLoader text="Processing..." />}

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Generate QR Codes</h1>
        <p className="text-gray-600">Manage QR codes for tables, cabins, and outside seating.</p>
      </div>

      {/* Tabs Header */}
      <div className="flex gap-4 border-b border-gray-200 mb-8 overflow-x-auto">
        {(["TABLE", "CABIN", "OUTSIDE"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setIsAdding(false);
            }}
            className={`px-6 py-3 font-medium text-sm transition-all relative whitespace-nowrap ${activeTab === tab
              ? "text-[#16516f] font-bold"
              : "text-gray-500 hover:text-gray-700"
              }`}
          >
            {getTabDetails(tab).label}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#16516f]" />
            )}
          </button>
        ))}
      </div>

      {/* Active Tab Content */}
      <div className="animate-in fade-in duration-300">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">{currentTabDetails.title}</h2>

          {/* Add Button Area */}
          {!isAdding ? (
            <button
              onClick={() => {
                setIsAdding(true);
                setNewTableName(currentTabDetails.prefix);
              }}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#16516f] text-white rounded-lg hover:bg-[#11425c] transition-all shadow-md active:scale-95"
            >
              <Plus className="w-5 h-5" />
              Add {currentTabDetails.singularLabel}
            </button>
          ) : (
            <div className="flex items-center gap-2 animate-in slide-in-from-right-4 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
              <input
                autoFocus
                type="text"
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                placeholder={`Ex: ${currentTabDetails.prefix}5`}
                className="px-3 py-1.5 border-none outline-none text-gray-700 w-32 font-medium bg-transparent uppercase"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateManual();
                  if (e.key === 'Escape') setIsAdding(false);
                }}
              />
              <button
                onClick={handleCreateManual}
                className="p-1.5 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
              >
                <Save className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsAdding(false)}
                className="p-1.5 bg-gray-200 text-gray-600 rounded-md hover:bg-gray-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {currentList.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-12 text-center shadow-sm">
            <QrCode className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No codes generated yet</h3>
            <p className="text-gray-500 mb-6">Create your first QR code for {currentTabDetails.title.toLowerCase()}.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {currentList.map((table) => (
              <div
                key={table.id}
                className="group relative bg-white rounded-xl shadow-sm hover:shadow-xl transition-all border border-gray-100 overflow-hidden"
              >
                <button
                  onClick={() => handleTableSelect(table.tableCode)}
                  className="w-full p-6 flex flex-col items-center justify-center gap-3 h-full"
                >
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-[#16516f] group-hover:bg-[#16516f] group-hover:text-white transition-colors">
                    <QrCode className="w-8 h-8" />
                  </div>
                  <span className="font-bold text-2xl text-gray-800">{table.tableCode}</span>
                </button>

                <button
                  onClick={(e) => handleDeleteTable(table.id, table.tableCode, e)}
                  className="absolute top-2 right-2 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {qrImage && (
        <QrDownloadModal
          open={open}
          qrImage={qrImage}
          table={selectedTable}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
};

export default GenerateQr;

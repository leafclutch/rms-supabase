import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTableStore } from '../../store/useTableStore';
import { hasActiveOrderApi } from '../../api/admin';
import type { Table } from '../../types/table';

interface ManualOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ManualOrderModal = ({ isOpen, onClose }: ManualOrderModalProps) => {
    const navigate = useNavigate();
    const { tables, isLoading, error, fetchTables } = useTableStore();
    const [selectedTable, setSelectedTable] = useState<Table | null>(null);
    const [showConfirmation, setShowConfirmation] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchTables();
        }
    }, [isOpen, fetchTables]);

    const handleTableClick = async (table: Table) => {
        setSelectedTable(table);
        const { hasActiveOrder } = await hasActiveOrderApi(table.id);
        if (hasActiveOrder) {
            setShowConfirmation(true);
        } else {
            createOrderForTable(table);
        }
    };

    const createOrderForTable = (table: Partial<Table> & { tableCode: string }) => {
        navigate('/admin/create-order', { state: { table } });
    };

    const handleConfirmation = (proceed: boolean) => {
        if (proceed && selectedTable) {
            createOrderForTable(selectedTable);
        }
        setShowConfirmation(false);
        setSelectedTable(null);
    };

    const handleWalkInClick = () => {
        navigate('/admin/walk-in-customer');
        onClose();
    };

    if (!isOpen) return null;

    const physicalTables = tables.filter(t => t.tableCode.startsWith('T'));
    const cabinTables = tables.filter(t => t.tableCode.startsWith('C'));
    const outsideTables = tables.filter(t => t.tableCode.startsWith('O') && !t.tableCode.startsWith('ONLINE'));

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
            <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-2xl">
                <h2 className="text-2xl font-bold mb-6">Create Manual Order</h2>

                {isLoading && <p>Loading tables...</p>}
                {error && <p className="text-red-500">{error}</p>}

                {showConfirmation ? (
                    <div>
                        <p>Table {selectedTable?.tableCode} already has an active order. Do you want to add another order?</p>
                        <div className="flex justify-end gap-4 mt-4">
                            <button onClick={() => handleConfirmation(false)} className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400">No</button>
                            <button onClick={() => handleConfirmation(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Yes</button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="space-y-6 mb-6">
                            <div>
                                <h3 className="font-semibold text-gray-700 mb-3 border-b pb-2">Tables</h3>
                                <div className="flex flex-wrap gap-3">
                                    {physicalTables.map(table => (
                                        <button key={table.id} onClick={() => handleTableClick(table)} className="px-4 py-2 border rounded-lg bg-gray-100 hover:bg-blue-100 hover:border-blue-500 transition-colors">{table.tableCode}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-700 mb-3 border-b pb-2">Cabins</h3>
                                <div className="flex flex-wrap gap-3">
                                    {cabinTables.map(table => (
                                        <button key={table.id} onClick={() => handleTableClick(table)} className="px-4 py-2 border rounded-lg bg-gray-100 hover:bg-blue-100 hover:border-blue-500 transition-colors">{table.tableCode}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-700 mb-3 border-b pb-2">Outside</h3>
                                <div className="flex flex-wrap gap-3">
                                    {outsideTables.map(table => (
                                        <button key={table.id} onClick={() => handleTableClick(table)} className="px-4 py-2 border rounded-lg bg-gray-100 hover:bg-blue-100 hover:border-blue-500 transition-colors">{table.tableCode}</button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <button onClick={handleWalkInClick} className="w-full p-3 bg-blue-500 text-white rounded-lg mb-6">Walk-in Customer</button>

                        <div className="flex justify-end gap-4">
                            <button onClick={onClose} className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400">
                                Cancel
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ManualOrderModal;

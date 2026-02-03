import React, { useState } from 'react';
import { User, Phone, CreditCard, AlertCircle } from 'lucide-react';
import type { Customer } from '../../types/Customer';
import { useCreditStore } from '../../store/useCreditStore';
import SearchInput from '../../components/common/SearchInput';

interface CreditSearchProps {
  onSelectCustomer: (customer: Customer) => void;
}

export const CreditSearch: React.FC<CreditSearchProps> = ({ onSelectCustomer }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const { searchCustomers } = useCreditStore();

  const results = searchQuery ? searchCustomers(searchQuery) : [];

  const handleSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    onSelectCustomer(customer);
  };

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-gray-800">Search Customer for Credit</h3>

      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search by name or phone..."
      />

      {/* Search Results */}
      {searchQuery && results.length > 0 && (
        <div className="bg-white border-2 border-gray-200 rounded-xl max-h-64 overflow-y-auto">
          {results.map((customer) => (
            <div
              key={customer.id}
              onClick={() => handleSelect(customer)}
              className={`p-4 border-b last:border-0 cursor-pointer hover:bg-gray-50 transition-colors ${selectedCustomer?.id === customer.id ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : ''
                }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-4 h-4 text-gray-500" />
                    <span className="font-bold text-gray-800">{customer.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-3 h-3" />
                    {customer.phone}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <CreditCard className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">
                      Credit: <span className="font-semibold text-red-600">Rs. {customer.totalCredit}</span>
                      {' / '}
                      <span className="text-gray-600">Limit: Rs. {customer.creditLimit}</span>
                    </span>
                  </div>
                </div>
                {selectedCustomer?.id === customer.id && (
                  <div className="bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                    Selected
                  </div>
                )}
              </div>

              {/* Warning if near limit */}
              {customer.creditLimit !== undefined && customer.totalCredit >= customer.creditLimit * 0.8 && (
                <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-lg p-2 flex items-center gap-2 text-xs text-yellow-800">
                  <AlertCircle className="w-4 h-4" />
                  <span>Near credit limit</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {searchQuery && results.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <User className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>No customers found</p>
        </div>
      )}

      {/* Selected Customer Summary */}
      {selectedCustomer && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border-2 border-indigo-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-bold text-gray-800">Selected Customer</h4>
            <button
              onClick={() => {
                setSelectedCustomer(null);
                setSearchQuery('');
              }}
              className="text-sm text-red-600 hover:text-red-700 font-semibold"
            >
              Change
            </button>
          </div>
          <p className="text-lg font-bold text-gray-900">{selectedCustomer.name}</p>
          <div className="mt-2 space-y-1 text-sm">
            <p className="text-gray-600">Current Credit: <span className="font-bold text-red-600">Rs. {selectedCustomer.totalCredit}</span></p>
            <p className="text-gray-600">Available: <span className="font-bold text-green-600">Rs. {(selectedCustomer.creditLimit ?? 0) - selectedCustomer.totalCredit}</span></p>
          </div>
        </div>
      )}
    </div>
  );
};
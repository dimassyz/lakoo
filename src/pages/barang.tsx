import React from 'react';

const BarangPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F8F7F4] p-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[#1F1F1F]">Daftar Barang</h1>
        </div>

        <div className="bg-white border border-[#6B7280] rounded-[8px] p-4 mb-4">
          <input
            type="text"
            placeholder="Cari barang..."
            className="w-full border border-[#6B7280] rounded-[8px] px-4 py-3 text-lg focus:outline-none focus:border-[#10B981]"
          />
        </div>

        <div className="space-y-3">
          {[
            { id: 1, name: 'Keripik Balado', qty: 45, status: 'Sehat' },
            { id: 2, name: 'Gula Pasir', qty: 12, status: 'Waspada' },
            { id: 3, name: 'Tepung Terigu', qty: 2, status: 'Sekarat' },
          ].map((item) => (
            <div key={item.id} className="bg-white border border-[#6B7280] rounded-[8px] p-4 flex justify-between items-center">
              <div>
                <div className="font-semibold">{item.name}</div>
                <div className="text-sm text-[#6B7280]">Stok: {item.qty}</div>
              </div>
              <div className={`px-4 py-1 text-xs font-medium rounded-[8px] ${item.status === 'Sehat' ? 'bg-[#10B981] text-white' : 'bg-[#F59E0B] text-white'}`}>
                {item.status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BarangPage;

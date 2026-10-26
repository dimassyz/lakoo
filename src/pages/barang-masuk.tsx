import React from 'react';

const BarangMasukPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F8F7F4] p-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[#1F1F1F]">Barang Masuk</h1>
        </div>

        <div className="bg-white border border-[#6B7280] rounded-[8px] p-6">
          <textarea
            placeholder="Tempel nota di sini..."
            className="w-full border border-[#6B7280] rounded-[8px] px-4 py-4 text-lg h-40 focus:outline-none focus:border-[#10B981]"
          />

          <button className="w-full py-4 bg-[#10B981] text-white font-semibold text-lg rounded-[8px] mt-6 active:scale-[0.95]">
            Parse & Simpan
          </button>
        </div>

        <div className="mt-6 text-xs text-[#6B7280] text-center">
          Data akan tersimpan di localStorage untuk demo
        </div>
      </div>
    </div>
  );
};

export default BarangMasukPage;
